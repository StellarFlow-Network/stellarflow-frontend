"use client";

import React, { useState } from 'react';
import { Icon, ICON_IDS } from '@/components/icons';

export default function DocsPage() {
  const [activeTab, setActiveTab] = useState<'rust' | 'js'>('rust');
  const [copied, setCopied] = useState(false);
  const [invoking, setInvoking] = useState(false);
  const [invokeResult, setInvokeResult] = useState<string | null>(null);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTestInvoke = () => {
    setInvoking(true);
    setInvokeResult(null);
    setTimeout(() => {
      setInvoking(false);
      setInvokeResult(
        JSON.stringify({
          status: "SUCCESS",
          ledger: 589102,
          timestamp: new Date().toISOString(),
          result_xdr: "AAAAEAAAAAEAAAAC...",
          decoded_rate: {
            pair: "NGN/XLM",
            rate: "1480.5000000",
            decimals: 7
          }
        }, null, 2)
      );
    }, 1200);
  };

  const codeSnippets = {
    rust: `#![no_std]
use soroban_sdk::{contractimpl, Env, Address, Symbol};

pub struct ConsumerContract;

#[contractimpl]
impl ConsumerContract {
    pub fn read_oracle_rate(env: Env, oracle_id: Address) -> u128 {
        // Invoke StellarFlow core proxy using dynamic interface
        let asset_symbol = Symbol::new(&env, "NGN");
        let rate: u128 = env.invoke_contract(
            &oracle_id,
            &Symbol::new(&env, "get_latest_rate"),
            soroban_sdk::vec![&env, asset_symbol.to_val()]
        );
        rate
    }
}`,
    js: `import { Contract, networks } from '@stellar/stellar-sdk';

const contractId = 'CCEMOFO5TE7FGOAJOA3RDHPC6RW3CFXRVIGOFQPFE4ZGOKA2QEA636SN';
const stellarFlowOracle = new Contract(contractId);

async function fetchLiveRate(providerRpcUrl) {
  // Query latest decentralized exchange base rates
  const response = await providerRpcUrl.getLatestRate({
    asset: 'NGN'
  });
  console.log(\`Live Oracle Rate: \${response.rate}\`);
}`
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 p-8">
      
      {/* --- Header Section --- */}
      <div className="mb-8">
        <p className="text-sm text-gray-500 mb-1">Admin / Integration</p>
        <h1 className="text-3xl font-bold tracking-tight">Developer Gateway & Docs</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* --- Left Column: Documentation Outline --- */}
        <div className="lg:col-span-1 space-y-6">
          <div
            className="content-visibility-auto bg-[#161b22] border border-gray-800 rounded-xl p-6"
            style={{ '--content-visibility-fallback': '1px 320px' } as React.CSSProperties}
          >
            <h2 className="text-sm font-bold uppercase text-gray-400 tracking-wider mb-4 flex items-center gap-2">
              <Icon id={ICON_IDS.bookOpen} size={16} className="text-blue-400" />
              Integration Invariants
            </h2>
            <ul className="space-y-3 text-sm text-gray-400">
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">•</span>
                <span><strong>Contract Storage:</strong> Feeds utilize Soroban persistent instance storage instances to avoid unexpected TTL evictions.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">•</span>
                <span><strong>Integer Math Scaling:</strong> Floating decimals are not natively supported on Soroban. Rates are scaled to a fixed factor of <code>10^7</code>.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">•</span>
                <span><strong>Gas Reimbursements:</strong> Consumer addresses must preserve an open balance in the Gas Tank module to pay relayers.</span>
              </li>
            </ul>
            <div className="mt-6 pt-4 border-t border-gray-800">
              <a href="https://developers.stellar.org" target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:underline inline-flex items-center gap-1">
                <span>Stellar Developer Docs</span>
                <Icon id={ICON_IDS.externalLink} size={12} />
              </a>
            </div>
          </div>

          {/* --- Live Interactive On-Chain Invoker Box --- */}
          <div
            className="content-visibility-auto bg-[#161b22] border border-gray-800 rounded-xl p-6"
            style={{ '--content-visibility-fallback': '1px 280px' } as React.CSSProperties}
          >
            <h2 className="text-sm font-bold uppercase text-gray-400 tracking-wider mb-2 flex items-center gap-2">
              <Icon id={ICON_IDS.cpu} size={16} className="text-purple-400" />
              Soroban RPC Invoker Playground
            </h2>
            <p className="text-xs text-gray-500 mb-4">Trigger a diagnostic read invocation directly against the deployed Testnet proxy structure.</p>
            
            <button 
              onClick={handleTestInvoke}
              disabled={invoking}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800/50 text-white font-medium text-sm py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <Icon id={ICON_IDS.play} size={14} className={invoking ? "animate-ping" : ""} />
              {invoking ? "Invoking Soroban RPC..." : "Execute Test Invocate"}
            </button>

            {invokeResult && (
              <div className="mt-4 bg-[#0d1117] border border-gray-800 rounded-lg p-3 text-xs font-mono text-purple-300 max-h-48 overflow-y-auto node-status-cell">
                <pre className="numeric-value">{invokeResult}</pre>
              </div>
            )}
          </div>
        </div>

        {/* --- Right Column: Interactive Code Workspace --- */}
        <div className="lg:col-span-2 space-y-6">
          <div
            className="content-visibility-auto bg-[#161b22] border border-gray-800 rounded-xl overflow-hidden flex flex-col h-full"
            style={{ '--content-visibility-fallback': '1px 520px' } as React.CSSProperties}
          >
            
            {/* Tab Controller Bar */}
            <div className="bg-[#0d1117] px-4 pt-3 border-b border-gray-800 flex justify-between items-center">
              <div className="flex gap-4">
                <button 
                  onClick={() => setActiveTab('rust')}
                  className={`pb-3 text-xs uppercase font-mono tracking-wider font-bold transition-all border-b-2 ${activeTab === 'rust' ? 'text-blue-400 border-blue-500' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  Rust SDK (Soroban)
                </button>
                <button 
                  onClick={() => setActiveTab('js')}
                  className={`pb-3 text-xs uppercase font-mono tracking-wider font-bold transition-all border-b-2 ${activeTab === 'js' ? 'text-blue-400 border-blue-500' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  Stellar JS SDK
                </button>
              </div>
              
              <button 
                onClick={() => handleCopy(codeSnippets[activeTab])}
                className="pb-3 text-gray-500 hover:text-gray-300 flex items-center gap-1 text-xs"
              >
                {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                <span>{copied ? "Copied!" : "Copy Snippet"}</span>
              </button>
            </div>

            {/* Code Mirror Container */}
            <div className="p-6 bg-[#0d1117] font-mono text-sm overflow-x-auto text-gray-300 leading-relaxed min-h-[380px]">
              <pre className="whitespace-pre">
                {codeSnippets[activeTab]}
              </pre>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
