/**
 * AsyncMutex — promise-chain-based mutual exclusion for async operations.
 *
 * Usage:
 *   const release = await mutex.acquire();
 *   try {
 *     // critical section
 *   } finally {
 *     release();
 *   }
 */
export class AsyncMutex {
  private _queue: Promise<void> = Promise.resolve();

  /**
   * Acquire the mutex. Returns a promise that resolves to a release function.
   * The caller MUST invoke the release function in a `finally` block to avoid deadlocks.
   */
  acquire(): Promise<() => void> {
    let release!: () => void;

    const next = new Promise<void>((resolve) => {
      release = resolve;
    });

    const entry = this._queue.then(() => release);
    this._queue = this._queue.then(() => next);

    return entry;
  }
}
