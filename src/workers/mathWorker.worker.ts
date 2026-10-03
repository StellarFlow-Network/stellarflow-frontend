import type {
  MathWorkerRequest,
  MathWorkerResponse,
} from "./mathWorker.types";

const DEFAULT_TICK_BASE = 1.0001;

function tickToPrice(tick: number, base = DEFAULT_TICK_BASE): number {
  if (!Number.isFinite(tick) || base <= 0) {
    throw new Error("Invalid tick or base");
  }
  return Math.pow(base, tick);
}

function priceToTick(price: number, base = DEFAULT_TICK_BASE): number {
  if (!Number.isFinite(price) || price <= 0 || base <= 0 || base === 1) {
    throw new Error("Invalid price or base");
  }
  return Math.log(price) / Math.log(base);
}

function routePath(amounts: number[], feeBps = 30) {
  if (!Array.isArray(amounts) || amounts.some((amount) => amount < 0)) {
    throw new Error("Invalid route amounts");
  }
  const feeMultiplier = 1 - feeBps / 10_000;
  return {
    input: amounts[0] ?? 0,
    output: (amounts[amounts.length - 1] ?? 0) * feeMultiplier,
    hops: Math.max(0, amounts.length - 1),
  };
}

function calculate(request: MathWorkerRequest): unknown {
  switch (request.type) {
    case "tickToPrice":
      return tickToPrice(request.payload.tick, request.payload.base);
    case "priceToTick":
      return priceToTick(request.payload.price, request.payload.base);
    case "routePath":
      return routePath(request.payload.amounts, request.payload.feeBps);
  }
}

self.onmessage = (event: MessageEvent<MathWorkerRequest>) => {
  const request = event.data;
  const started = performance.now();

  try {
    const result = calculate(request);
    const response: MathWorkerResponse = {
      type: "result",
      requestId: request.requestId,
      durationMs: performance.now() - started,
      result,
    };
    self.postMessage(response);
  } catch (error) {
    const response: MathWorkerResponse = {
      type: "error",
      requestId: request.requestId,
      durationMs: performance.now() - started,
      error: error instanceof Error ? error.message : "Unknown worker error",
    };
    self.postMessage(response);
  }
};

export {};
