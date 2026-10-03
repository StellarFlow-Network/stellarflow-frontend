"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { 
  BookOpen, 
  Terminal, 
  Code2, 
  Layers, 
  Copy, 
  Check, 
  ExternalLink, 
  Play,
  Cpu
} from 'lucide-react';
import Icon from '@/components/icons/Icon';
import { ICON_IDS } from '@/components/icons/iconIds';

// import the lightweight cache (CommonJS module)
const langCache = require('./langCache');

export default function DocsPage() {
  const [activeTab, setActiveTab] = useState<'rust' | 'js'>('rust');
  const [copied, setCopied] = useState(false);
  const [invoking, setInvoking] = useState(false);
  const [invokeResult, setInvokeResult] = useState<string | null>(null);

  const timeoutsRef = React.useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    // ensure runtime cache is populated once (fast path avoids repeated parsing)
    if (typeof window !== 'undefined') {
      langCache.populateRuntimeFromStorageOrDefaults();
    }
  }, []);

  const activeConfig = useMemo(() => {
    return langCache.getLangConfig(activeTab) || { code: '' };
  }, [activeTab]);

  const handleCopy = (text: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopied(true);
      const timer = setTimeout(() => {
        setCopied(false);
        timeoutsRef.current.delete(timer);
      }, 2000);
      timeoutsRef.current.add(timer);
    } catch (e) {
      // noop
    }
  };

  const handleTestInvoke = () => {
    setInvoking(true);
    setInvokeResult(null);
    const timer = setTimeout(() => {
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
      timeoutsRef.current.delete(timer);
    }, 1200);
    timeoutsRef.current.add(timer);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 p-8">
      <div className="mb-8">
        <p className="text-sm text-gray-500 mb-1">Admin / Integration</p>
        <h1 className="text-3xl font-bold tracking-tight">Developer Gateway & Docs</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
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

          <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6">
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

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#161b22] border border-gray-800 rounded-xl overflow-hidden flex flex-col h-full">
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
                onClick={() => handleCopy(activeConfig.code)}
                className="pb-3 text-gray-500 hover:text-gray-300 flex items-center gap-1 text-xs"
              >
                {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                <span>{copied ? "Copied!" : "Copy Snippet"}</span>
              </button>
            </div>

            <div className="p-6 bg-[#0d1117] font-mono text-sm overflow-x-auto text-gray-300 leading-relaxed min-h-[380px]">
              <pre className="whitespace-pre">
                {activeConfig.code}
              </pre>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
