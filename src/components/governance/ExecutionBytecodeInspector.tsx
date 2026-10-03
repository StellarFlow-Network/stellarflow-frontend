"use client";

import { useCallback, useMemo, useState } from "react";
import OptimizedDialog from "@/app/components/OptimizedDialog";
import { rpcManager } from "@/services/rpc";

export interface ExecutionBytecodeInspectorProps {
  /** Base64 encoded Stellar transaction/envelope, InvokeHostFunctionOp, or HostFunction XDR. */
  xdr: string;
  /** Optional label shown above the inspector. */
  title?: string;
  /** Testnet RPC endpoint used for simulation. */
  rpcUrl?: string;
  /** Called when a decoded call is available. */
  onDecoded?: (call: DecodedExecutionCall) => void;
}

export interface DecodedExecutionCall {
  contractAddress: string | null;
  functionSignature: string | null;
  arguments: unknown[];
  operationCount: number;
  source: "transaction" | "invoke-host-function" | "host-function";
}

interface SimulationState {
  open: boolean;
  loading: boolean;
  error: string | null;
  trace: unknown | null;
  durationMs: number | null;
}

const TESTNET_RPC = "https://soroban-testnet.stellar.org";
const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";

function normalize(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Uint8Array || (typeof Buffer !== "undefined" && Buffer.isBuffer(value))) {
    return `0x${Array.from(value as Uint8Array).map((b) => b.toString(16).padStart(2, "0")).join("")}`;
  }
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (key.startsWith("_")) continue;
      try {
        out[key] = normalize(item);
      } catch {
        out[key] = String(item);
      }
    }
    return out;
  }
  return String(value);
}

function decodeContractCall(hostFunction: any, sdk: any): Omit<DecodedExecutionCall, "operationCount" | "source"> {
  const switchName = hostFunction.switch().name;
  if (switchName !== "hostFunctionTypeInvokeContract") {
    return {
      contractAddress: null,
      functionSignature: switchName,
      arguments: [],
    };
  }

  const invoke = hostFunction.invokeContractArgs();
  const rawContractId = invoke.address().contractId();
  const contractAddress = sdk.StrKey.encodeContract(rawContractId);
  const functionSignature = invoke.functionName().toString();
  const args = invoke.args().map((value: any) => {
    try {
      return normalize(sdk.scValToNative(value));
    } catch {
      return normalize(value);
    }
  });

  return { contractAddress, functionSignature, arguments: args };
}

async function decodeExecutionXdr(rawXdr: string): Promise<DecodedExecutionCall> {
  const sdk = await import("@stellar/stellar-sdk");
  const xdr = sdk.xdr;
  const input = rawXdr.trim();

  if (!input) throw new Error("Execution XDR is empty.");

  // Governance proposals normally carry a full transaction envelope.
  try {
    const envelope = xdr.TransactionEnvelope.fromXDR(input, "base64");
    const operations = envelope.v1().tx().operations();
    const calls = operations
      .filter((operation: any) => operation.body().switch().name === "invokeHostFunction")
      .map((operation: any) => decodeContractCall(operation.body().invokeHostFunctionOp().hostFunction(), sdk));

    if (calls.length > 0) {
      return { ...calls[0], operationCount: calls.length, source: "transaction" };
    }
  } catch {
    // Fall through to operation/host-function decoding.
  }

  try {
    const operation = xdr.InvokeHostFunctionOp.fromXDR(input, "base64");
    return {
      ...decodeContractCall(operation.hostFunction(), sdk),
      operationCount: 1,
      source: "invoke-host-function",
    };
  } catch {
    // Fall through to a raw HostFunction payload.
  }

  try {
    const hostFunction = xdr.HostFunction.fromXDR(input, "base64");
    return {
      ...decodeContractCall(hostFunction, sdk),
      operationCount: 1,
      source: "host-function",
    };
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Unable to decode execution XDR.");
  }
}

function JsonValue({ value }: { value: unknown }) {
  const json = JSON.stringify(value, null, 2) ?? "null";
  const parts = json.split(/("(?:\\.|[^"\\])*"(?=\\s*:)|"(?:\\.|[^"\\])*"|\\b(?:true|false|null)\\b|-?\\b\\d+(?:\\.\\d+)?\\b)/g);

  return (
    <pre className="overflow-auto rounded-lg border border-gray-800 bg-black/40 p-4 text-xs leading-5 text-gray-300">
      <code>
        {parts.map((part, index) => {
          let className = "text-gray-300";
          if (/^".*"(?=\\s*:)/.test(part)) className = "text-sky-300";
          else if (/^"/.test(part)) className = "text-emerald-300";
          else if (/^(true|false)$/.test(part)) className = "text-amber-300";
          else if (part === "null" || /^-?\\d/.test(part)) className = "text-violet-300";
          return <span className={className} key={index}>{part}</span>;
        })}
      </code>
    </pre>
  );
}

export function ExecutionBytecodeInspector({
  xdr: rawXdr,
  title = "Execution Bytecode Inspector",
  rpcUrl = TESTNET_RPC,
  onDecoded,
}: ExecutionBytecodeInspectorProps) {
  const [decoded, setDecoded] = useState<DecodedExecutionCall | null>(null);
  const [decodeError, setDecodeError] = useState<string | null>(null);
  const [copyLabel, setCopyLabel] = useState("Copy XDR");
  const [simulation, setSimulation] = useState<SimulationState>({
    open: false,
    loading: false,
    error: null,
    trace: null,
    durationMs: null,
  });

  const inspect = useCallback(async () => {
    const started = performance.now();
    setDecodeError(null);
    try {
      const result = await decodeExecutionXdr(rawXdr);
      const duration = performance.now() - started;
      setDecoded(result);
      onDecoded?.(result);
      if (duration > 100) {
        console.debug(`[ExecutionBytecodeInspector] XDR decode took ${duration.toFixed(1)}ms`);
      }
    } catch (error) {
      setDecoded(null);
      setDecodeError(error instanceof Error ? error.message : "Failed to decode execution XDR.");
    }
  }, [rawXdr, onDecoded]);

  const copyXdr = useCallback(async () => {
    await navigator.clipboard.writeText(rawXdr);
    setCopyLabel("Copied");
    window.setTimeout(() => setCopyLabel("Copy XDR"), 1200);
  }, [rawXdr]);

  const simulate = useCallback(async () => {
    setSimulation({ open: true, loading: true, error: null, trace: null, durationMs: null });

    const started = performance.now();
    try {
      const sdk = await import("@stellar/stellar-sdk");
      const transaction = sdk.TransactionBuilder.fromXDR(rawXdr.trim(), TESTNET_PASSPHRASE);
      rpcManager.setCurrentUrl(rpcUrl);
      const result = await rpcManager.execute((server) => server.simulateTransaction(transaction as any));

      setSimulation({
        open: true,
        loading: false,
        error: null,
        trace: normalize(result),
        durationMs: performance.now() - started,
      });
    } catch (error) {
      setSimulation({
        open: true,
        loading: false,
        error: error instanceof Error ? error.message : "Simulation failed.",
        trace: null,
        durationMs: performance.now() - started,
      });
    }
  }, [rawXdr, rpcUrl]);

  const summary = useMemo(() => {
    if (!decoded) return null;
    return {
      targetContract: decoded.contractAddress ?? "Unknown",
      functionSignature: decoded.functionSignature ?? "Unknown",
      operationCount: decoded.operationCount,
      source: decoded.source,
    };
  }, [decoded]);

  return (
    <>
      <section className="rounded-xl border border-gray-800 bg-[#161b22] p-5 text-gray-100">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-blue-400">Governance / Soroban</p>
            <h2 className="mt-1 text-lg font-semibold">{title}</h2>
            <p className="mt-1 text-xs text-gray-500">Decode proposed contract execution before it is submitted.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => void inspect()} className="rounded-lg border border-gray-700 px-3 py-2 text-xs font-medium text-gray-200 hover:bg-gray-800">
              Inspect XDR
            </button>
            <button type="button" onClick={() => void copyXdr()} className="rounded-lg border border-gray-700 px-3 py-2 text-xs font-medium text-gray-200 hover:bg-gray-800">
              {copyLabel}
            </button>
          </div>
        </div>

        <div className="mb-4 rounded-lg border border-gray-800 bg-[#0d1117] p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Raw XDR</p>
          <code className="block max-h-28 overflow-auto break-all font-mono text-xs text-gray-400">{rawXdr || "No XDR supplied."}</code>
        </div>

        {decodeError ? (
          <div role="alert" className="rounded-lg border border-rose-900/60 bg-rose-950/30 p-3 text-sm text-rose-300">{decodeError}</div>
        ) : null}

        {summary ? (
          <div className="space-y-4">
            <dl className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-gray-800 bg-[#0d1117] p-3">
                <dt className="text-[10px] uppercase tracking-wide text-gray-500">Target contract</dt>
                <dd className="mt-1 break-all font-mono text-xs text-gray-200">{summary.targetContract}</dd>
              </div>
              <div className="rounded-lg border border-gray-800 bg-[#0d1117] p-3">
                <dt className="text-[10px] uppercase tracking-wide text-gray-500">Function signature</dt>
                <dd className="mt-1 font-mono text-xs text-sky-300">{summary.functionSignature}</dd>
              </div>
              <div className="rounded-lg border border-gray-800 bg-[#0d1117] p-3">
                <dt className="text-[10px] uppercase tracking-wide text-gray-500">Operations</dt>
                <dd className="mt-1 font-mono text-xs text-gray-200">{summary.operationCount} · {summary.source}</dd>
              </div>
            </dl>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-200">Execution arguments</h3>
                <button type="button" onClick={() => void simulate()} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500">
                  Simulate Execution Dry-Run
                </button>
              </div>
              <JsonValue value={decoded?.arguments ?? []} />
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-gray-800 p-8 text-center text-sm text-gray-500">
            Select <span className="font-medium text-gray-300">Inspect XDR</span> to decode the proposed execution call.
          </div>
        )}
      </section>

      <OptimizedDialog
        isOpen={simulation.open}
        onClose={() => setSimulation((current) => ({ ...current, open: false }))}
        title="Simulation Trace"
        size="xl"
      >
        <div className="space-y-4">
          {simulation.loading ? (
            <div className="rounded-lg border border-gray-800 bg-[#0d1117] p-6 text-sm text-gray-400">Running Soroban simulation against testnet RPC…</div>
          ) : simulation.error ? (
            <div role="alert" className="rounded-lg border border-rose-900/60 bg-rose-950/30 p-4 text-sm text-rose-300">{simulation.error}</div>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Testnet RPC: {rpcUrl}</span>
                <span>{simulation.durationMs?.toFixed(1)}ms</span>
              </div>
              <JsonValue value={simulation.trace} />
            </>
          )}
        </div>
      </OptimizedDialog>
    </>
  );
}

export default ExecutionBytecodeInspector;
