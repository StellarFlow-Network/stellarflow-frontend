/* src/workers/masterTimerWorker.ts */

type Callback = () => void;

const subscribers = new Set<Callback>();
let running = false;

function tick() {
  // Execute all subscriber callbacks on each animation frame.
  subscribers.forEach((cb) => {
    try {
      cb();
    } catch (e) {
      console.error('masterTimerWorker callback error', e);
    }
  });
  requestAnimationFrame(tick);
}

/**
 * Starts the RAF loop if not already started. This is invoked automatically on first subscription.
 */
function start() {
  if (!running) {
    running = true;
    requestAnimationFrame(tick);
  }
}

/**
 * Subscribe to the central timer. The provided callback will be called on every animation frame.
 * The function returns an unsubscribe function to remove the callback.
 */
export function subscribe(cb: Callback): () => void {
  subscribers.add(cb);
  start();
  return () => {
    subscribers.delete(cb);
  };
}

// Export for convenience if direct start is needed.
export { start };

export default {
  subscribe,
  start,
};
