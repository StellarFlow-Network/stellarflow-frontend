export type MathOperation =
  | "tickToPrice"
  | "priceToTick"
  | "routePath";

export interface TickToPricePayload {
  tick: number;
  base?: number;
}

export interface PriceToTickPayload {
  price: number;
  base?: number;
}

export interface RoutePathPayload {
  amounts: number[];
  feeBps?: number;
}

export type MathWorkerRequest =
  | {
      type: "tickToPrice";
      requestId: string;
      payload: TickToPricePayload;
    }
  | {
      type: "priceToTick";
      requestId: string;
      payload: PriceToTickPayload;
    }
  | {
      type: "routePath";
      requestId: string;
      payload: RoutePathPayload;
    };

export interface MathWorkerSuccess {
  type: "result";
  requestId: string;
  durationMs: number;
  result: unknown;
}

export interface MathWorkerFailure {
  type: "error";
  requestId: string;
  durationMs: number;
  error: string;
}

export type MathWorkerResponse = MathWorkerSuccess | MathWorkerFailure;
