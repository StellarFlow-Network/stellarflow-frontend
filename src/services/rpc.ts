type SorobanServer = InstanceType<
  Awaited<typeof import('@stellar/stellar-sdk/rpc')>['Server']
>;

export interface RpcEndpointConfig {
  id?: string;
  name?: string;
  url: string;
  priority: number;
  network: NetworkTarget;
  type?: 'soroban' | 'horizon' | 'hybrid';
}

export interface RpcLatencyRecord {
  url: string;
  avgLatency: number;
  lastLatency: number;
  sampleCount: number;
  isAvailable: boolean;
  lastError: string | null;
}

export interface RpcFailoverEvent {
  previousUrl: string;
  nextUrl: string;
  reason: string;
}

type RpcFailoverListener = (event: RpcFailoverEvent) => void;

interface LatencyEntry {
  samples: number[];
  lastError: string | null;
}

const DEFAULT_ENDPOINTS: RpcEndpointConfig[] = [
  { url: 'https://soroban-testnet.stellar.org', priority: 1, network: 'testnet' },
  { url: 'https://rpc-testnet.stellar.org', priority: 2, network: 'testnet' },
  { url: 'https://soroban.stellar.org', priority: 1, network: 'mainnet' },
  { url: 'https://rpc-mainnet.stellar.org', priority: 2, network: 'mainnet' },
];

const FAILOVER_ERROR_THRESHOLD = 3;
const HEALTH_POLL_INTERVAL_MS = 15_000;

export class RpcManager {
  private endpoints: RpcEndpointConfig[] = [];
  private servers: Map<string, SorobanServerLike> = new Map();
  private currentUrl: string;
  private activeNetwork: RpcEndpointConfig['network'];
  private latencies: Map<string, LatencyEntry> = new Map();
  private consecutiveErrors = 0;
  private healthTimer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<RpcFailoverListener>();
  private stellarSdk: Awaited<typeof import('@stellar/stellar-sdk')> | null = null;

  constructor(endpoints?: RpcEndpointConfig[]) {
    this.endpoints = (endpoints ?? DEFAULT_ENDPOINTS).sort((a, b) => a.priority - b.priority);
    this.currentUrl = this.endpoints[0]?.url ?? '';
    this.activeNetwork = this.endpoints[0]?.network ?? 'testnet';
  }

  private async getSdk(): Promise<any> {
    if (!this.stellarSdk) {
      this.stellarSdk = await import('@stellar/stellar-sdk');
    }
    return this.stellarSdk;
  }

  async getServer(url?: string): Promise<SorobanServerLike> {
    const targetUrl = url ?? this.currentUrl;
    let server = this.servers.get(targetUrl);
    if (!server) {
      const { Server } = await import('@stellar/stellar-sdk/rpc');
      server = new Server(targetUrl, { allowHttp: true });
      this.servers.set(targetUrl, server);
    }
    return server as SorobanServerLike;
  }

  getCurrentEndpoint(): RpcEndpointConfig | undefined {
    return this.endpoints.find((e) => e.url === this.currentUrl);
  }

  setCurrentEndpoint(url: string): boolean {
    const existing = this.endpoints.find((e) => e.url === url);
    if (existing) {
      this.currentUrl = url;
      return true;
    }
    // If not registered, add it dynamically
    this.endpoints.unshift({
      url,
      priority: 0,
      network: 'testnet',
      name: 'Custom Node',
    });
    this.currentUrl = url;
    return true;
  }

  isRetryableError(error: unknown): boolean {
    if (!error) return false;

    const err = error as Record<string, unknown>;
    const status = (err.status ?? err.statusCode ?? (err.response as Record<string, unknown>)?.status) as number | undefined;

    if (status === 429 || (typeof status === 'number' && status >= 500 && status < 600)) {
      return true;
    }

    const msg = (err.message ?? String(error)).toString().toLowerCase();
    return (
      msg.includes('rate limit') ||
      msg.includes('rate_limit') ||
      msg.includes('timeout') ||
      msg.includes('econnrefused') ||
      msg.includes('econnreset') ||
      msg.includes('network error') ||
      msg.includes('fetch failed')
    );
  }

  private failover(reason: string): void {
    const previousUrl = this.currentUrl;
    const routableEndpoints = this.endpoints.filter((endpoint) => endpoint.network === this.activeNetwork);
    if (routableEndpoints.length < 2) return;
    const candidates = this.getLatencyStats()
      .filter((entry) => routableEndpoints.some((endpoint) => endpoint.url === entry.url) && entry.url !== previousUrl && entry.isAvailable)
      .sort((a, b) => {
        const aLatency = a.sampleCount > 0 ? a.avgLatency : Number.POSITIVE_INFINITY;
        const bLatency = b.sampleCount > 0 ? b.avgLatency : Number.POSITIVE_INFINITY;
        return aLatency - bLatency;
      });
    const currentIdx = routableEndpoints.findIndex((e) => e.url === previousUrl);
    const next = candidates[0] ?? routableEndpoints[(currentIdx + 1) % routableEndpoints.length];
    if (!next || next.url === previousUrl) return;

    this.currentUrl = next.url;
    const event = { previousUrl, nextUrl: next.url, reason };
    this.listeners.forEach((listener) => listener(event));
  }

  subscribe(listener: RpcFailoverListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  startHealthMonitor(intervalMs = HEALTH_POLL_INTERVAL_MS): () => void {
    if (this.healthTimer) return () => this.stopHealthMonitor();
    void this.checkEndpointHealth();
    this.healthTimer = setInterval(() => void this.checkEndpointHealth(), intervalMs);
    return () => this.stopHealthMonitor();
  }

  stopHealthMonitor(): void {
    if (!this.healthTimer) return;
    clearInterval(this.healthTimer);
    this.healthTimer = null;
  }

  private async checkEndpointHealth(): Promise<void> {
    await Promise.all(this.endpoints.map(async (endpoint) => {
      const start = performance.now();
      try {
        const response = await fetch(endpoint.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'getHealth' }),
          signal: AbortSignal.timeout(6_000),
          cache: 'no-store',
        });
        if (!response.ok) throw new Error(`RPC responded ${response.status}`);
        const payload = (await response.json()) as { error?: { message?: string } };
        if (payload.error) throw new Error(payload.error.message ?? 'RPC health check failed');
        this.recordLatency(endpoint.url, performance.now() - start, null);
      } catch (error) {
        this.recordLatency(endpoint.url, performance.now() - start, error instanceof Error ? error.message : String(error));
      }
    }));

    const current = this.latencies.get(this.currentUrl);
    const activeUrls = new Set(this.endpoints.filter((endpoint) => endpoint.network === this.activeNetwork).map((endpoint) => endpoint.url));
    if (current?.lastError && this.getLatencyStats().some((entry) => activeUrls.has(entry.url) && entry.url !== this.currentUrl && entry.isAvailable)) {
      this.failover(current.lastError);
    }
  }

  recordLatency(url: string, durationMs: number, error: string | null): void {
    let entry = this.latencies.get(url);
    if (!entry) {
      entry = { samples: [], lastError: null };
      this.latencies.set(url, entry);
    }
    entry.samples.push(durationMs);
    entry.lastError = error;
    if (entry.samples.length > 100) {
      entry.samples.shift();
    }
  }

  /**
   * Ping any Stellar RPC or Horizon endpoint to measure round-trip latency.
   */
  async pingEndpoint(
    url: string,
    timeoutMs = 6000,
  ): Promise<{ latencyMs: number; error: string | null }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const start = performance.now();

    try {
      // First try Soroban JSON-RPC getHealth
      const isHorizon = url.includes('horizon');
      if (isHorizon) {
        const res = await fetch(url, {
          method: 'GET',
          signal: controller.signal,
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } else {
        const res = await fetch(url, {
          method: 'POST',
          signal: controller.signal,
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getHealth' }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json().catch(() => null);
        if (json?.error) {
          throw new Error(json.error.message ?? 'Soroban RPC error');
        }
      }

      const duration = Math.round(performance.now() - start);
      this.recordLatency(url, duration, null);
      return { latencyMs: duration, error: null };
    } catch (err) {
      const duration = Math.round(performance.now() - start);
      const errMsg = err instanceof Error ? err.message : 'Ping failed';
      this.recordLatency(url, duration, errMsg);
      return { latencyMs: duration, error: errMsg };
    } finally {
      clearTimeout(timer);
    }
  }

  async execute<T>(operation: (server: SorobanServer) => Promise<T>): Promise<T> {
    const routableEndpoints = this.endpoints.filter((endpoint) => endpoint.network === this.activeNetwork);
    const maxAttempts = routableEndpoints.length + FAILOVER_ERROR_THRESHOLD;
    for (let i = 0; i < maxAttempts; i++) {
      const endpoint =
        routableEndpoints.find((e) => e.url === this.currentUrl) ?? routableEndpoints[i];
      const server = await this.getServer(endpoint.url);
      const startTime = performance.now();

      try {
        const result = await operation(server);
        const duration = performance.now() - startTime;
        this.recordLatency(endpoint.url, duration, null);
        this.consecutiveErrors = 0;
        return result;
      } catch (error: unknown) {
        const duration = performance.now() - startTime;
        const errMsg = error instanceof Error ? error.message : String(error);
        this.recordLatency(endpoint.url, duration, errMsg);
        this.consecutiveErrors += 1;

        if (this.isRetryableError(error) && this.consecutiveErrors >= FAILOVER_ERROR_THRESHOLD) {
          this.consecutiveErrors = 0;
          this.failover(errMsg);
          console.warn(`[RpcManager] Failover from ${endpoint.url} after ${FAILOVER_ERROR_THRESHOLD} consecutive RPC errors.`);
          continue;
        }
        if (this.isRetryableError(error) && i < maxAttempts - 1) {
          continue;
        } else {
          throw error;
        }
      }
    }
    throw new Error('[RpcManager] All RPC endpoints exhausted.');
  }

  getLatencyStats(): RpcLatencyRecord[] {
    return this.endpoints.map((ep) => {
      const entry = this.latencies.get(ep.url);
      const samples = entry?.samples ?? [];
      const avg =
        samples.length > 0
          ? samples.reduce((a, b) => a + b, 0) / samples.length
          : 0;
      return {
        url: ep.url,
        avgLatency: Math.round(avg * 10) / 10,
        lastLatency: samples.length > 0 ? samples[samples.length - 1] : 0,
        sampleCount: samples.length,
        isAvailable: !entry?.lastError,
        lastError: entry?.lastError ?? null,
      };
    });
  }

  getEndpoints(): RpcEndpointConfig[] {
    return [...this.endpoints];
  }

  addEndpoint(config: RpcEndpointConfig): void {
    const exists = this.endpoints.some((e) => e.url === config.url);
    if (!exists) {
      this.endpoints.push(config);
      this.endpoints.sort((a, b) => a.priority - b.priority);
    }
  }

  removeEndpoint(url: string): void {
    this.endpoints = this.endpoints.filter((e) => e.url !== url);
    this.servers.delete(url);
    this.latencies.delete(url);
    if (this.currentUrl === url) {
      const next = this.endpoints.find((endpoint) => endpoint.network === this.activeNetwork);
      this.currentUrl = next?.url ?? '';
    }
  }

  /**
   * Switch the active RPC endpoint to the given URL. If the endpoint is not
   * already configured it will be added automatically.
   */
  setCurrentUrl(url: string): void {
    if (!this.endpoints.some((e) => e.url === url)) {
      this.addEndpoint({ url, priority: 1, network: this.activeNetwork });
    }
    this.currentUrl = url;
    this.consecutiveErrors = 0;
  }
}

export const rpcManager = new RpcManager();
