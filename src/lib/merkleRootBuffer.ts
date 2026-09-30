/**
 * Shielded Note Commitments Merkle Root History Buffer (#990)
 *
 * Maintains a circular buffer storage of the last K = 32 Merkle root hashes
 * to eliminate ZK withdrawal proof rejection race conditions caused by concurrent note deposits.
 */

export const DEFAULT_MERKLE_BUFFER_CAPACITY = 32;
const HEX_32_BYTES_PATTERN = /^(?:0x|0X)?[0-9a-fA-F]{64}$/i;

export interface MerkleBufferStats {
  capacity: number;
  activeCount: number;
  headPointer: number;
  isFull: boolean;
  latestRoot: string | null;
  oldestRoot: string | null;
}

export interface ZKProofRootValidation {
  valid: boolean;
  rootHash: string;
  isLatestRoot: boolean;
  rootAge: number | null;
  error?: string;
}

/**
 * Normalizes a hex string Merkle root (lowercased, stripped of 0x prefix if present).
 * Returns normalized string or null if invalid format.
 */
export function normalizeMerkleRoot(rawRoot: string): string | null {
  if (typeof rawRoot !== "string") return null;
  const trimmed = rawRoot.trim();
  if (!HEX_32_BYTES_PATTERN.test(trimmed)) return null;

  const hexOnly = trimmed.startsWith("0x") || trimmed.startsWith("0X")
    ? trimmed.slice(2)
    : trimmed;

  return hexOnly.toLowerCase();
}

/**
 * Circular buffer storage for maintaining historical Merkle roots (K = 32).
 */
export class MerkleRootHistoryBuffer {
  public readonly capacity: number;
  private readonly buffer: string[];
  private readonly rootSet: Set<string>;
  private readonly rootCounts: Map<string, number>;
  private headPointer: number;
  private activeCount: number;

  constructor(capacity: number = DEFAULT_MERKLE_BUFFER_CAPACITY) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error("Capacity must be a positive integer.");
    }
    this.capacity = capacity;
    this.buffer = new Array<string>(capacity);
    this.rootSet = new Set<string>();
    this.rootCounts = new Map<string, number>();
    this.headPointer = 0;
    this.activeCount = 0;
  }

  /**
   * Pushes a new Merkle root hash into the circular buffer.
   * If the buffer is full (activeCount === capacity), the oldest root is evicted (FIFO).
   * Returns the evicted root hash, or null if no eviction occurred.
   */
  public pushRoot(rawRootHash: string): string | null {
    const normalized = normalizeMerkleRoot(rawRootHash);
    if (!normalized) {
      throw new Error("Invalid Merkle root hash. Must be a 32-byte hexadecimal string.");
    }

    // Ignore idempotent push if identical to current latest root
    if (this.getLatestRoot() === normalized) {
      return null;
    }

    let evicted: string | null = null;

    if (this.activeCount === this.capacity) {
      evicted = this.buffer[this.headPointer];
      const remainingCount = (this.rootCounts.get(evicted) ?? 1) - 1;
      if (remainingCount === 0) {
        this.rootSet.delete(evicted);
        this.rootCounts.delete(evicted);
      } else {
        this.rootCounts.set(evicted, remainingCount);
      }
    }

    this.buffer[this.headPointer] = normalized;
    this.rootSet.add(normalized);
    this.rootCounts.set(normalized, (this.rootCounts.get(normalized) ?? 0) + 1);

    this.headPointer = (this.headPointer + 1) % this.capacity;
    this.activeCount = Math.min(this.capacity, this.activeCount + 1);

    return evicted;
  }

  /**
   * Performs an O(1) check to see if a Merkle root exists in the active buffer.
   */
  public isRootValid(rawRootHash: string): boolean {
    const normalized = normalizeMerkleRoot(rawRootHash);
    if (!normalized) return false;
    return this.rootSet.has(normalized);
  }

  /**
   * Returns the age of the root relative to the latest inserted root.
   * 0 = latest root, 1 = 1 deposit ago, ..., up to K-1.
   * Returns null if root is not found in the active buffer.
   */
  public getRootAge(rawRootHash: string): number | null {
    const normalized = normalizeMerkleRoot(rawRootHash);
    if (!normalized || !this.rootSet.has(normalized)) return null;

    let idx = (this.headPointer - 1 + this.capacity) % this.capacity;
    for (let age = 0; age < this.activeCount; age++) {
      if (this.buffer[idx] === normalized) return age;
      idx = (idx - 1 + this.capacity) % this.capacity;
    }
    return null;
  }

  /**
   * Validates a ZK proof Merkle root against the buffer history.
   */
  public validateProofRoot(rawRootHash: string): ZKProofRootValidation {
    const normalized = normalizeMerkleRoot(rawRootHash);
    if (!normalized) {
      return {
        valid: false,
        rootHash: rawRootHash,
        isLatestRoot: false,
        rootAge: null,
        error: "Invalid Merkle root hash format.",
      };
    }

    const age = this.getRootAge(normalized);
    if (age === null) {
      return {
        valid: false,
        rootHash: normalized,
        isLatestRoot: false,
        rootAge: null,
        error: `Merkle root expired or invalid. Root is not within active ${this.capacity}-root buffer.`,
      };
    }

    return {
      valid: true,
      rootHash: normalized,
      isLatestRoot: age === 0,
      rootAge: age,
    };
  }

  /**
   * Returns the latest inserted Merkle root, or null if buffer is empty.
   */
  public getLatestRoot(): string | null {
    if (this.activeCount === 0) return null;
    const latestIndex = (this.headPointer - 1 + this.capacity) % this.capacity;
    return this.buffer[latestIndex];
  }

  /**
   * Returns active historical roots ordered from newest (index 0) to oldest.
   */
  public getHistoricalRoots(): string[] {
    if (this.activeCount === 0) return [];

    const result: string[] = [];
    let idx = (this.headPointer - 1 + this.capacity) % this.capacity;
    for (let i = 0; i < this.activeCount; i++) {
      result.push(this.buffer[idx]);
      idx = (idx - 1 + this.capacity) % this.capacity;
    }
    return result;
  }

  /**
   * Returns current buffer operational stats.
   */
  public getBufferStats(): MerkleBufferStats {
    const latest = this.getLatestRoot();
    const historical = this.getHistoricalRoots();
    const oldest = historical.length > 0 ? historical[historical.length - 1] : null;

    return {
      capacity: this.capacity,
      activeCount: this.activeCount,
      headPointer: this.headPointer,
      isFull: this.activeCount === this.capacity,
      latestRoot: latest,
      oldestRoot: oldest,
    };
  }

  /**
   * Clears all entries from the buffer.
   */
  public clear(): void {
    this.buffer.fill("");
    this.rootSet.clear();
    this.rootCounts.clear();
    this.headPointer = 0;
    this.activeCount = 0;
  }
}
