"use client";

import React, { useState, useCallback } from "react";
import { Search, Play, FileCode2, Database, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContractFunction {
  name: string;
  inputs: Array<{ name: string; type: string }>;
  outputs: Array<{ type: string }>;
  docs?: string;
}

interface ContractSpec {
  contractId: string;
  functions: ContractFunction[];
  storage: Record<string, unknown>;
}

interface ExecutionResult {
  success: boolean;
  result?: unknown;
  xdr?: string;
  error?: string;
  gasUsed?: number;
  duration?: number;
}

// ─── Mock API (replace with real Soroban RPC) ────────────────────────────────

async function fetchContractSpec(contractId: string): Promise<ContractSpec> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 300));

  // Mock validation
  if (!contractId || contractId.length < 56) {
    throw new Error("Invalid contract ID format");
  }

  // Mock ABI response
  return {
    contractId,
    functions: [
      {
        name: "initialize",
        inputs: [
          { name: "admin", type: "Address" },
          { name: "token", type: "Address" },
        ],
        outputs: [{ type: "void" }],
        docs: "Initialize the contract with admin and token addresses",
      },
      {
        name: "transfer",
        inputs: [
          { name: "from", type: "Address" },
          { name: "to", type: "Address" },
          { name: "amount", type: "i128" },
        ],
        outputs: [{ type: "bool" }],
        docs: "Transfer tokens from one address to another",
      },
      {
        name: "balance",
        inputs: [{ name: "account", type: "Address" }],
        outputs: [{ type: "i128" }],
        docs: "Get the token balance of an account",
      },
      {
        name: "get_config",
        inputs: [],
        outputs: [{ type: "ConfigData" }],
        docs: "Retrieve current contract configuration",
      },
    ],
    storage: {
      admin: "GAQAGJFX...",
      token_address: "CDLZFC3S...",
      total_supply: "1000000000000",
      initialized: true,
      version: "1.0.0",
    },
  };
}

async function simulateDryRun(
  contractId: string,
  functionName: string,
  params: Record<string, string>
): Promise<ExecutionResult> {
  const start = Date.now();
  await new Promise((resolve) => setTimeout(resolve, 400));

  // Mock simulation
  return {
    success: true,
    result: {
      status: "SUCCESS",
      value: functionName === "balance" ? "500000000" : true,
      events: [
        { type: "contract", topics: ["transfer"], data: params },
      ],
    },
    xdr: "AAAAAgAAAAIAAAADAAAbfQAAAAAAAAAAqOoCz...",
    gasUsed: 45230,
    duration: Date.now() - start,
  };
}

// ─── Components ───────────────────────────────────────────────────────────────

function ContractExplorerPage() {
  const [contractId, setContractId] = useState("");
  const [spec, setSpec] = useState<ContractSpec | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFetchSpec = useCallback(async () => {
    if (!contractId.trim()) return;

    setLoading(true);
    setError(null);
    setSpec(null);

    try {
      const data = await fetchContractSpec(contractId);
      setSpec(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch contract spec");
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center gap-3">
            <FileCode2 className="w-8 h-8 text-[#99DC1B]" />
            <div>
              <h1 className="text-2xl font-bold">Contract Explorer</h1>
              <p className="text-sm text-zinc-400 mt-0.5">
                Inspect Soroban smart contract functions and storage
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Contract ID Input */}
        <div className="bg-[#0A121E] border border-zinc-800 rounded-2xl p-6">
          <label className="block text-sm font-semibold text-zinc-300 mb-3">
            Soroban Contract ID
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              value={contractId}
              onChange={(e) => setContractId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleFetchSpec()}
              placeholder="C... (56+ character contract address)"
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#99DC1B] focus:ring-1 focus:ring-[#99DC1B] transition-colors font-mono"
            />
            <button
              onClick={handleFetchSpec}
              disabled={loading || !contractId.trim()}
              className="px-6 py-3 bg-[#99DC1B] hover:bg-[#8BC919] disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-950 font-semibold rounded-xl transition-all flex items-center gap-2 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              {loading ? "Fetching..." : "Fetch ABI"}
            </button>
          </div>
          {error && (
            <div className="mt-3 flex items-start gap-2 text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Results */}
        {spec && (
          <>
            {/* Functions Section */}
            <section className="bg-[#0A121E] border border-zinc-800 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <FileCode2 className="w-5 h-5 text-[#99DC1B]" />
                <h2 className="text-lg font-bold">Contract Functions</h2>
                <span className="ml-auto text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded-full">
                  {spec.functions.length} functions
                </span>
              </div>
              <div className="space-y-3">
                {spec.functions.map((fn, idx) => (
                  <FunctionCard key={idx} fn={fn} contractId={spec.contractId} />
                ))}
              </div>
            </section>

            {/* Storage Section */}
            <section className="bg-[#0A121E] border border-zinc-800 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Database className="w-5 h-5 text-[#99DC1B]" />
                <h2 className="text-lg font-bold">Contract Storage</h2>
                <span className="ml-auto text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded-full">
                  {Object.keys(spec.storage).length} entries
                </span>
              </div>
              <div className="bg-zinc-900 rounded-xl p-4 font-mono text-sm overflow-x-auto">
                <pre className="text-zinc-300">
                  {JSON.stringify(spec.storage, null, 2)}
                </pre>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

// ─── Function Card ────────────────────────────────────────────────────────────

function FunctionCard({ fn, contractId }: { fn: ContractFunction; contractId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [params, setParams] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [simulating, setSimulating] = useState(false);

  const handleSimulate = async () => {
    setSimulating(true);
    setResult(null);
    try {
      const res = await simulateDryRun(contractId, fn.name, params);
      setResult(res);
    } catch (err) {
      setResult({
        success: false,
        error: err instanceof Error ? err.message : "Simulation failed",
      });
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="border border-zinc-700 rounded-xl overflow-hidden hover:border-[#99DC1B]/40 transition-colors">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between bg-zinc-900 hover:bg-zinc-800 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-mono font-semibold text-[#99DC1B]">{fn.name}</span>
          <span className="text-xs text-zinc-500">
            ({fn.inputs.map((i) => i.type).join(", ")}) → {fn.outputs[0]?.type || "void"}
          </span>
        </div>
        <span className="text-zinc-500 text-sm">{expanded ? "−" : "+"}</span>
      </button>

      {expanded && (
        <div className="p-4 bg-zinc-900/50 space-y-4">
          {fn.docs && (
            <p className="text-xs text-zinc-400 italic border-l-2 border-zinc-700 pl-3">
              {fn.docs}
            </p>
          )}

          {/* Input Fields */}
          {fn.inputs.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                Parameters
              </h4>
              {fn.inputs.map((input) => (
                <div key={input.name}>
                  <label className="block text-xs text-zinc-500 mb-1 font-mono">
                    {input.name} <span className="text-zinc-600">({input.type})</span>
                  </label>
                  <input
                    type="text"
                    value={params[input.name] || ""}
                    onChange={(e) =>
                      setParams((prev) => ({ ...prev, [input.name]: e.target.value }))
                    }
                    placeholder={`Enter ${input.type}`}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#99DC1B] transition-colors font-mono"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Simulate Button */}
          <button
            onClick={handleSimulate}
            disabled={simulating}
            className="w-full px-4 py-2.5 bg-[#99DC1B] hover:bg-[#8BC919] disabled:bg-zinc-700 disabled:text-zinc-500 text-zinc-950 font-semibold rounded-lg transition-all flex items-center justify-center gap-2 text-sm disabled:cursor-not-allowed"
          >
            {simulating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {simulating ? "Simulating..." : "Dry Run"}
          </button>

          {/* Results */}
          {result && (
            <div
              className={`rounded-lg p-3 text-xs space-y-2 ${
                result.success
                  ? "bg-emerald-500/10 border border-emerald-500/20"
                  : "bg-rose-500/10 border border-rose-500/20"
              }`}
            >
              <div className="flex items-center gap-2 font-semibold">
                {result.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400" />
                )}
                <span className={result.success ? "text-emerald-400" : "text-rose-400"}>
                  {result.success ? "Simulation Success" : "Simulation Failed"}
                </span>
                {result.duration && (
                  <span className="ml-auto text-zinc-500">{result.duration}ms</span>
                )}
              </div>

              {result.success && (
                <>
                  <div className="bg-zinc-900 rounded p-2 font-mono overflow-x-auto">
                    <pre className="text-zinc-300 text-[10px]">
                      {JSON.stringify(result.result, null, 2)}
                    </pre>
                  </div>

                  {result.xdr && (
                    <details className="cursor-pointer">
                      <summary className="text-zinc-400 hover:text-zinc-300">
                        XDR Trace ({result.gasUsed?.toLocaleString()} gas)
                      </summary>
                      <div className="mt-2 bg-zinc-900 rounded p-2 font-mono overflow-x-auto">
                        <code className="text-[10px] text-zinc-400 break-all">
                          {result.xdr}
                        </code>
                      </div>
                    </details>
                  )}
                </>
              )}

              {result.error && <p className="text-rose-400">{result.error}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ContractExplorerPage;
