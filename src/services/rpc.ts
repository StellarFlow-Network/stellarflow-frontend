type SorobanServer = InstanceType<
  Awaited<typeof import('@stellar/stellar-sdk')>['SorobanRpc']['Server']
>;

export interface RpcEndpointConfig {
  url: string;
  priority: number;
  network: 'testnet' | 'mainnet';
}

export interface RpcLatencyRecord {
  url: string;
  avgLatency: number;
  lastLatency: number;
  sampleCount: number;
  isAvailable: boolean;
  lastError: string | null;
}

interface LatencyEntry {
  samples: number[];
  lastError: string | null;
}

const DEFAULT_ENDPOINTS: RpcEndpointConfig[] = [
  { url: 'https://soroban-testnet.stellar.org', priority: 1, network: 'testnet' },
  { url: 'https://soroban-rpc.mainnet.stellar.org', priority: 1, network: 'mainnet' },
];

export class RpcManager {
  private endpoints: RpcEndpointConfig[] = [];
  private servers: Map<string, SorobanServer> = new Map();
  private currentUrl: string;
  private latencies: Map<string, LatencyEntry> = new Map();
  private stellarSdk: Awaited<typeof import('@stellar/stellar-sdk')> | null = null;

  constructor(endpoints?: RpcEndpointConfig[]) {
    this.endpoints = (endpoints ?? DEFAULT_ENDPOINTS).sort((a, b) => a.priority - b.priority);
    this.currentUrl = this.endpoints[0]?.url ?? '';
  }

  private async getSdk(): Promise<Awaited<typeof import('@stellar/stellar-sdk')>> {
    if (!this.stellarSdk) {
      this.stellarSdk = await import('@stellar/stellar-sdk');
    }
    return this.stellarSdk;
  }

  async getServer(url?: string): Promise<SorobanServer> {
    const targetUrl = url ?? this.currentUrl;
    let server = this.servers.get(targetUrl);
    if (!server) {
      const { SorobanRpc } = await this.getSdk();
      server = new SorobanRpc.Server(targetUrl, { allowHttp: true });
      this.servers.set(targetUrl, server);
    }
    return server;
  }

  getCurrentEndpoint(): RpcEndpointConfig | undefined {
    return this.endpoints.find((e) => e.url === this.currentUrl);
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

  private failover(): void {
    const currentIdx = this.endpoints.findIndex((e) => e.url === this.currentUrl);
    const nextIdx = (currentIdx + 1) % this.endpoints.length;
    this.currentUrl = this.endpoints[nextIdx].url;
  }

  private recordLatency(url: string, durationMs: number, error: string | null): void {
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

    console.log(
      `[RpcManager] ${error ? 'FAIL' : 'OK'} ${url} - ${durationMs.toFixed(1)}ms${error ? ` - ${error}` : ''}`,
    );
  }

  async execute<T>(operation: (server: SorobanServer) => Promise<T>): Promise<T> {
    const attempts = this.endpoints.length;
    for (let i = 0; i < attempts; i++) {
      const endpoint =
        this.endpoints.find((e) => e.url === this.currentUrl) ?? this.endpoints[i];
      const server = await this.getServer(endpoint.url);
      const startTime = performance.now();

      try {
        const result = await operation(server);
        const duration = performance.now() - startTime;
        this.recordLatency(endpoint.url, duration, null);
        return result;
      } catch (error: unknown) {
        const duration = performance.now() - startTime;
        const errMsg = error instanceof Error ? error.message : String(error);
        this.recordLatency(endpoint.url, duration, errMsg);

        if (this.isRetryableError(error) && i < attempts - 1) {
          console.warn(
            `[RpcManager] Failover from ${endpoint.url} due to: ${errMsg}. Trying next endpoint...`,
          );
          this.failover();
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
    this.endpoints.push(config);
    this.endpoints.sort((a, b) => a.priority - b.priority);
  }

  removeEndpoint(url: string): void {
    this.endpoints = this.endpoints.filter((e) => e.url !== url);
    this.servers.delete(url);
    this.latencies.delete(url);
    if (this.currentUrl === url) {
      this.currentUrl = this.endpoints[0]?.url ?? '';
    }
  }
}

export const rpcManager = new RpcManager();