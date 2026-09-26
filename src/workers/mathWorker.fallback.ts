import type { MathWorkerRequest } from "./mathWorker.types";

export function calculateOnMainThread(request: MathWorkerRequest): unknown {
  switch (request.type) {
    case "tickToPrice":
      return Math.pow(request.payload.base ?? 1.0001, request.payload.tick);
    case "priceToTick":
      return Math.log(request.payload.price) /
        Math.log(request.payload.base ?? 1.0001);
    case "routePath": {
      const feeMultiplier = 1 - (request.payload.feeBps ?? 30) / 10_000;
      const amounts = request.payload.amounts;
      return {
        input: amounts[0] ?? 0,
        output: (amounts[amounts.length - 1] ?? 0) * feeMultiplier,
        hops: Math.max(0, amounts.length - 1),
      };
    }
  }
}
