"use client";

import { useState } from "react";
import { ExecutionBytecodeInspector } from "@/components/governance/ExecutionBytecodeInspector";

export default function SimulationDebuggerPage() {
  const [xdr, setXdr] = useState("");

  return (
    <main className="min-h-screen bg-[#0d1117] px-4 py-10 text-gray-100">
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <p className="text-xs font-bold uppercase tracking-wider text-blue-400">Developer tools</p>
          <h1 className="mt-2 text-3xl font-bold">Soroban pre-flight debugger</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-400">
            Paste an unsigned Soroban transaction envelope, inspect its contract calls, and run a read-only RPC simulation before submitting it.
          </p>
        </header>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-gray-200">Transaction envelope XDR</span>
          <textarea
            value={xdr}
            onChange={(event) => setXdr(event.target.value)}
            rows={5}
            spellCheck={false}
            placeholder="Paste base64 transaction envelope XDR"
            className="w-full rounded-xl border border-gray-700 bg-[#161b22] p-4 font-mono text-xs text-gray-200 placeholder:text-gray-600 focus:border-blue-500 focus:outline-none"
            aria-label="Transaction envelope XDR"
          />
        </label>

        {xdr.trim() ? (
          <ExecutionBytecodeInspector xdr={xdr.trim()} title="Transaction pre-flight" />
        ) : (
          <p className="rounded-xl border border-dashed border-gray-700 p-6 text-center text-sm text-gray-500">
            Paste XDR above to open the inspection and simulation controls.
          </p>
        )}
      </div>
    </main>
  );
}
