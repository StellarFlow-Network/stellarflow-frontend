"use client";

import React, { useState } from 'react';
import { SorobanBudgetVisualizer } from '@/components/contracts/SorobanBudgetVisualizer';
import { ContractVersionBadge } from '@/components/contracts/ContractVersionBadge';
import type { SorobanResourceMetrics } from '@/types/sorobanBudget';
import { registerContractDeployments } from '@/services/contractVersionService';

// Sample Soroban contracts surfaced on this page. Each maps to an on-chain
// contract id so version metadata can be read from the network, with known
// deployments registered to surface stable tags ("v1.0", "v2.0-beta").
const SAMPLE_CONTRACTS = [
  {
    id: 'CBA2VUOUDHGAAAAOMEVSEQXMNOBDXKJ5AIWNBQELZGCZOYR2DJW2OP7M',
    label: 'Publish Oracle Rate',
    action: 'Submit on-chain rate feed',
    wasmHash: '8a92ec5a3b1f0d7c4e6a2b91f3c8d0e5a6b7c1d2e3f405162738495a6b7c8d9e',
  },
  {
    id: 'CC3WXPYDGHBAAAAWPBUTQXLXKZMMK2OZCQYHGPSTHNBXJ4RCJMBPLGCE',
    label: 'Relayer Settlement',
    action: 'Settle relayer gas reimbursements',
    wasmHash: '5f7e1c9a2b3d4e6f8a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f6',
  },
  {
    id: 'CD4MGVCQHAAAAAVXNLOPZTHWCRVYQTZCWXJASDFGHJQWEKLPOPUTBNMSDV',
    label: 'Voting Power Calc',
    action: 'Compute voter delegation power',
    wasmHash: '01ab23cd45ef67890123456789abcdef0123456789abcdef0123456789abcdef',
  },
];

// Annotate known deployments so badges render readable version tags rather
// than raw wasm hashes. Mark exactly one hash as the latest for each contract.
registerContractDeployments([
  { wasmHash: '8a92ec5a3b1f0d7c4e6a2b91f3c8d0e5a6b7c1d2e3f405162738495a6b7c8d9e', version: 'v2.0', isLatest: true, kind: 'current' },
  { wasmHash: '1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f80', version: 'v1.0', isLatest: false, kind: 'legacy' },
  { wasmHash: '5f7e1c9a2b3d4e6f8a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f6', version: 'v2.0-beta', isLatest: true, kind: 'beta' },
  { wasmHash: '01ab23cd45ef67890123456789abcdef0123456789abcdef0123456789abcdef', version: 'v1.0', isLatest: false, kind: 'legacy' },
  { wasmHash: 'f0e1d2c3b4a5968778695a4b3c2d1e0f1021324354657687981a2b3c4d5e6f7', version: 'v2.0', isLatest: true, kind: 'current' },
]);

export default function ContractsPage() {
  const [metrics] = useState<SorobanResourceMetrics>({
    cpuInstructions: 45000000,
    memoryBytes: 15728640,
    readBytes: 102400,
    writeBytes: 51200,
  });

  return (
    <main className="min-h-screen bg-[#020817] text-white p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Soroban Smart Contracts</h1>
        <p className="text-slate-400">
          Manage and simulate contract executions with resource budget tracking.
          Version badges indicate whether an action targets a legacy or current deployment.
        </p>
      </div>

      {/* Contract action cards with version badges */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          Contract Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {SAMPLE_CONTRACTS.map((contract) => (
            <button
              key={contract.id}
              className="group text-left rounded-xl bg-slate-900 border border-slate-800 p-4 transition-colors hover:border-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold text-white">{contract.label}</h3>
                  <p className="text-xs text-slate-400 mt-1">{contract.action}</p>
                </div>
                <ContractVersionBadge
                  contractId={contract.id}
                  fallbackWasmHash={contract.wasmHash}
                  showKind
                  showHash
                  hideOnError
                />
              </div>
            </button>
          ))}
        </div>
      </section>

      <div className="max-w-2xl">
        <SorobanBudgetVisualizer metrics={metrics} />
      </div>
    </main>
  );
}
