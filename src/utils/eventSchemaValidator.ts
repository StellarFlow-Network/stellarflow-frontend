import { z } from "zod";
import * as Sentry from "@sentry/nextjs";

const stringifyAmount = (value: unknown): string | undefined => {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  return undefined;
};

const pickFirstString = (
  record: Record<string, unknown>,
  keys: string[]
): string | undefined => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }

  return undefined;
};

const pickFirstNumber = (
  record: Record<string, unknown>,
  keys: string[]
): number | undefined => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return undefined;
};

const normalizeEventRecord = (payload: unknown): Record<string, unknown> => {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  const record = payload as Record<string, unknown>;
  const normalized: Record<string, unknown> = { ...record };

  const eventType = pickFirstString(record, [
    "type",
    "eventType",
    "event_type",
    "event",
    "kind",
    "name",
    "action",
  ]);

  if (eventType && typeof normalized.type === "undefined") {
    normalized.type = eventType;
  }

  const contractId = pickFirstString(record, [
    "contractId",
    "contract_id",
    "contract",
    "contractAddress",
    "issuer",
  ]);

  if (contractId && typeof normalized.contractId === "undefined") {
    normalized.contractId = contractId;
  }

  if (
    typeof normalized.type === "string" &&
    typeof normalized.eventType === "undefined" &&
    !("event_type" in normalized)
  ) {
    normalized.eventType = normalized.type;
  }

  if (
    typeof normalized.contractId === "string" &&
    typeof normalized.contract_id === "undefined"
  ) {
    normalized.contract_id = normalized.contractId;
  }

  return normalized;
};

const amountSchema = z.preprocess((value) => stringifyAmount(value), z.string().min(1));

const addressSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : value),
  z.string().min(1).max(256)
);

const eventBaseSchema = z.object({
  type: z.string().min(1),
  contractId: addressSchema.optional(),
  contract_id: addressSchema.optional(),
  eventType: z.string().min(1).optional(),
  event_type: z.string().min(1).optional(),
  timestamp: z.union([z.number(), z.string()]).optional(),
  pool: z.string().optional(),
  from: addressSchema.optional(),
  to: addressSchema.optional(),
  tokenIn: addressSchema.optional(),
  token_in: addressSchema.optional(),
  tokenOut: addressSchema.optional(),
  token_out: addressSchema.optional(),
  amountIn: amountSchema.optional(),
  amount_in: amountSchema.optional(),
  amountOut: amountSchema.optional(),
  amount_out: amountSchema.optional(),
  amount: amountSchema.optional(),
  value: amountSchema.optional(),
  data: z.unknown().optional(),
  raw: z.unknown().optional(),
}).passthrough();

export const swapEventSchema = z.preprocess(
  (raw) => normalizeEventRecord(raw),
  eventBaseSchema
    .refine((data) => {
      const normalizedType = String(data.type ?? data.eventType ?? data.event_type ?? "").toLowerCase();
      return normalizedType === "swap";
    }, "Expected a swap event payload")
    .transform((data) => {
      const amountIn = stringifyAmount(data.amountIn ?? data.amount_in ?? data.value ?? data.amount) ?? "0";
      const amountOut = stringifyAmount(data.amountOut ?? data.amount_out ?? data.amount) ?? "0";
      const contractId = data.contractId ?? data.contract_id ?? "unknown";
      const tokenIn = data.tokenIn ?? data.token_in ?? "unknown";
      const tokenOut = data.tokenOut ?? data.token_out ?? "unknown";

      return {
        type: "swap",
        contractId,
        eventType: data.eventType ?? data.event_type ?? "swap",
        timestamp: pickFirstNumber(data as Record<string, unknown>, ["timestamp", "createdAt", "ts"]),
        from: data.from,
        to: data.to,
        tokenIn,
        tokenOut,
        amountIn,
        amountOut,
        raw: data,
      } satisfies SwapEvent;
    })
);

export const depositEventSchema = z.preprocess(
  (raw) => normalizeEventRecord(raw),
  eventBaseSchema
    .refine((data) => {
      const normalizedType = String(data.type ?? data.eventType ?? data.event_type ?? "").toLowerCase();
      return normalizedType === "deposit";
    }, "Expected a deposit event payload")
    .transform((data) => {
      const amount = stringifyAmount(data.amountIn ?? data.amount_in ?? data.amount ?? data.value) ?? "0";
      const contractId = data.contractId ?? data.contract_id ?? "unknown";
      const user = data.from ?? data.to ?? "unknown";

      return {
        type: "deposit",
        contractId,
        eventType: data.eventType ?? data.event_type ?? "deposit",
        timestamp: pickFirstNumber(data as Record<string, unknown>, ["timestamp", "createdAt", "ts"]),
        user,
        amount,
        asset: data.tokenIn ?? data.token_in ?? data.tokenOut ?? data.token_out ?? "unknown",
        raw: data,
      } satisfies DepositEvent;
    })
);

export const mintEventSchema = z.preprocess(
  (raw) => normalizeEventRecord(raw),
  eventBaseSchema
    .refine((data) => {
      const normalizedType = String(data.type ?? data.eventType ?? data.event_type ?? "").toLowerCase();
      return normalizedType === "mint";
    }, "Expected a mint event payload")
    .transform((data) => {
      const amount = stringifyAmount(data.amountIn ?? data.amount_in ?? data.amount ?? data.value) ?? "0";
      const contractId = data.contractId ?? data.contract_id ?? "unknown";
      const recipient = data.to ?? data.from ?? "unknown";

      return {
        type: "mint",
        contractId,
        eventType: data.eventType ?? data.event_type ?? "mint",
        timestamp: pickFirstNumber(data as Record<string, unknown>, ["timestamp", "createdAt", "ts"]),
        recipient,
        amount,
        asset: data.tokenOut ?? data.token_out ?? data.tokenIn ?? data.token_in ?? "unknown",
        raw: data,
      } satisfies MintEvent;
    })
);

export const burnEventSchema = z.preprocess(
  (raw) => normalizeEventRecord(raw),
  eventBaseSchema
    .refine((data) => {
      const normalizedType = String(data.type ?? data.eventType ?? data.event_type ?? "").toLowerCase();
      return normalizedType === "burn";
    }, "Expected a burn event payload")
    .transform((data) => {
      const amount = stringifyAmount(data.amountIn ?? data.amount_in ?? data.amount ?? data.value) ?? "0";
      const contractId = data.contractId ?? data.contract_id ?? "unknown";
      const holder = data.from ?? data.to ?? "unknown";

      return {
        type: "burn",
        contractId,
        eventType: data.eventType ?? data.event_type ?? "burn",
        timestamp: pickFirstNumber(data as Record<string, unknown>, ["timestamp", "createdAt", "ts"]),
        holder,
        amount,
        asset: data.tokenIn ?? data.token_in ?? data.tokenOut ?? data.token_out ?? "unknown",
        raw: data,
      } satisfies BurnEvent;
    })
);

export const contractEventSchemas = {
  swap: swapEventSchema,
  deposit: depositEventSchema,
  mint: mintEventSchema,
  burn: burnEventSchema,
} as const;

export interface SwapEvent {
  type: "swap";
  contractId: string;
  eventType: string;
  timestamp?: number;
  from?: string;
  to?: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  raw?: unknown;
}

export interface DepositEvent {
  type: "deposit";
  contractId: string;
  eventType: string;
  timestamp?: number;
  user: string;
  amount: string;
  asset: string;
  raw?: unknown;
}

export interface MintEvent {
  type: "mint";
  contractId: string;
  eventType: string;
  timestamp?: number;
  recipient: string;
  amount: string;
  asset: string;
  raw?: unknown;
}

export interface BurnEvent {
  type: "burn";
  contractId: string;
  eventType: string;
  timestamp?: number;
  holder: string;
  amount: string;
  asset: string;
  raw?: unknown;
}

export type ContractEvent = SwapEvent | DepositEvent | MintEvent | BurnEvent;

export interface EventValidationResult<T> {
  ok: boolean;
  data?: T;
  error?: z.ZodError;
  issues?: z.ZodIssue[];
  raw: unknown;
  fallbackToRawJson: boolean;
  schemaName?: string;
}

const logValidationFailure = (raw: unknown, error: z.ZodError, schemaName: string): void => {
  const message = `[EventSchemaValidator] ${schemaName} validation failed`;
  console.error(message, error.issues, raw);

  try {
    Sentry.captureException(new Error(message), {
      extra: {
        schemaName,
        payload: raw,
        issues: error.issues,
      },
    });
  } catch {
    // Ignore telemetry failures to keep the UI resilient.
  }
};

export function validateContractEventPayload(raw: unknown): EventValidationResult<ContractEvent> {
  try {
    const candidate = normalizeEventRecord(raw);
    const eventType = pickFirstString(candidate, ["type", "eventType", "event_type", "kind", "name"]) ?? "";
    const normalizedType = eventType.toLowerCase();

    const schemaMap = {
      swap: { name: "swap", schema: swapEventSchema },
      deposit: { name: "deposit", schema: depositEventSchema },
      mint: { name: "mint", schema: mintEventSchema },
      burn: { name: "burn", schema: burnEventSchema },
    } as const;

    const schemaEntry = schemaMap[normalizedType as keyof typeof schemaMap];
    if (schemaEntry) {
      const result = schemaEntry.schema.safeParse(candidate);
      if (result.success) {
        return {
          ok: true,
          data: result.data as ContractEvent,
          raw,
          fallbackToRawJson: false,
          schemaName: schemaEntry.name,
        };
      }

      const error = result.error;
      logValidationFailure(raw, error, schemaEntry.name);
      return {
        ok: false,
        error,
        issues: error.issues,
        raw,
        fallbackToRawJson: true,
        schemaName: schemaEntry.name,
      };
    }

    const knownSchemas = Object.entries(schemaMap)
      .map(([name, entry]) => `${name}:${entry.schema.safeParse(candidate).success}`)
      .join(", ");
    const genericError = new z.ZodError([
      {
        code: "invalid_type",
        expected: "swap | deposit | mint | burn",
        received: typeof raw,
        path: [],
        message: `Unknown Soroban event type: ${eventType || "<missing>"}. Known schema types: ${knownSchemas}`,
      },
    ]);

    logValidationFailure(raw, genericError, "unknown-event");
    return {
      ok: false,
      error: genericError,
      issues: genericError.issues,
      raw,
      fallbackToRawJson: true,
      schemaName: "unknown-event",
    };
  } catch (error) {
    const zodError = new z.ZodError([
      {
        code: "custom",
        path: [],
        message: error instanceof Error ? error.message : "Unknown schema validation error",
      },
    ]);

    logValidationFailure(raw, zodError, "schema-parser");
    return {
      ok: false,
      error: zodError,
      issues: zodError.issues,
      raw,
      fallbackToRawJson: true,
      schemaName: "schema-parser",
    };
  }
}

export function validateWebSocketEventPayload(raw: unknown): EventValidationResult<ContractEvent> {
  return validateContractEventPayload(raw);
}

export function formatEventValidationError(raw: unknown, schemaName: string): string {
  const validation = validateContractEventPayload(raw);
  if (validation.ok) {
    return "";
  }

  const issues = validation.issues ?? [];
  return [
    `Schema validation failed for ${schemaName || validation.schemaName || "event"}`,
    ...issues.map((issue) => `${issue.path.join(".") || "payload"}: ${issue.message}`),
  ].join("; ");
}

export const eventSchemaValidator = {
  swapEventSchema,
  depositEventSchema,
  mintEventSchema,
  burnEventSchema,
  contractEventSchemas,
  validateContractEventPayload,
  validateWebSocketEventPayload,
  formatEventValidationError,
};

export default eventSchemaValidator;
