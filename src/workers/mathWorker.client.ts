import type {
  MathWorkerRequest,
  MathWorkerResponse,
} from "./mathWorker.types";

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  startedAt: number;
};

export function createMathWorkerClient() {
  const pending = new Map<string, PendingRequest>();
  let worker: Worker | null = null;

  const canUseWorker =
    typeof window !== "undefined" && typeof Worker !== "undefined";

  if (canUseWorker) {
    try {
      worker = new Worker(
        new URL("./mathWorker.worker.ts", import.meta.url),
        { type: "module" },
      );
    } catch {
      worker = null;
    }
  }

  worker?.addEventListener("message", (event: MessageEvent<MathWorkerResponse>) => {
    const response = event.data;
    const request = pending.get(response.requestId);
    if (!request) return;

    pending.delete(response.requestId);

    if (response.type === "error") {
      request.reject(new Error(response.error));
      return;
    }

    request.resolve({
      result: response.result,
      workerDurationMs: response.durationMs,
      roundTripMs: performance.now() - request.startedAt,
    });
  });

  worker?.addEventListener("error", (event) => {
    for (const request of pending.values()) {
      request.reject(event.error ?? new Error(event.message));
    }
    pending.clear();
  });

  return {
    supported: worker !== null,

    request(request: MathWorkerRequest): Promise<unknown> {
      if (!worker) {
        return Promise.reject(new Error("Web Worker unavailable; use fallback"));
      }

      return new Promise((resolve, reject) => {
        pending.set(request.requestId, {
          resolve,
          reject,
          startedAt: performance.now(),
        });
        worker!.postMessage(request);
      });
    },

    dispose() {
      worker?.terminate();
      worker = null;
      for (const request of pending.values()) {
        request.reject(new Error("Worker disposed"));
      }
      pending.clear();
    },
  };
}
