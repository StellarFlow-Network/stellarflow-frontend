'use client';

import React, { useState } from 'react';
import { Search, BookOpen, ExternalLink, ShieldCheck, ArrowRightLeft, Landmark, Layers } from 'lucide-react';
import { DeFiTerm } from '@/components/ui/DeFiTerm';
import { getAllGlossaryTerms, searchGlossary } from '@/lib/defiGlossary';

export default function GlossaryPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const glossaryTerms = searchGlossary(searchQuery);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8 max-w-7xl mx-auto space-y-10">
      {/* Page Header */}
      <header className="space-y-4 text-center sm:text-left border-b border-slate-800 pb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 text-sky-400 text-xs font-semibold border border-sky-500/20">
          <BookOpen className="w-3.5 h-3.5" />
          <span>Accessibility Framework</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-slate-100 via-sky-200 to-sky-400 bg-clip-text text-transparent">
          DeFi Metric Tooltips & Knowledge Base
        </h1>
        <p className="text-slate-400 max-w-3xl text-sm sm:text-base leading-relaxed">
          Hover over or focus any dotted metric term below to inspect inline definitions, formula calculations,
          risk warnings, and direct links to the official StellarFlow Knowledge Base.
        </p>
      </header>

      {/* Interactive Feature Cards Demo */}
      <section className="space-y-6">
        <h2 className="text-xl font-bold text-slate-200 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-sky-400" />
          <span>Interactive Metric Cards Demo</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Swap Trading */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4 hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200 text-base flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-sky-400" />
                Swap Trade (XLM/USDC)
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono">
                Live
              </span>
            </div>
            <div className="space-y-3 pt-2 text-sm">
              <div className="flex justify-between items-center py-1.5 border-b border-slate-800/80">
                <span className="text-slate-400">
                  <DeFiTerm term="slippage" showIcon position="right">
                    Max Slippage
                  </DeFiTerm>
                </span>
                <span className="font-mono font-medium text-slate-200">0.5%</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-slate-800/80">
                <span className="text-slate-400">
                  <DeFiTerm term="twap" showIcon position="right">
                    Oracle TWAP Price
                  </DeFiTerm>
                </span>
                <span className="font-mono font-medium text-sky-300">$0.1245</span>
              </div>
              <div className="flex justify-between items-center py-1.5">
                <span className="text-slate-400">
                  <DeFiTerm term="gas-fee" position="right">
                    Network Base Fee
                  </DeFiTerm>
                </span>
                <span className="font-mono font-medium text-slate-300">0.00001 XLM</span>
              </div>
            </div>
          </div>

          {/* Card 2: Liquidity Pool */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4 hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200 text-base flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-400" />
                Liquidity Pool (XLM/NGN)
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 font-mono">
                AMM v2
              </span>
            </div>
            <div className="space-y-3 pt-2 text-sm">
              <div className="flex justify-between items-center py-1.5 border-b border-slate-800/80">
                <span className="text-slate-400">
                  <DeFiTerm term="tvl" showIcon position="right">
                    Total Value Locked
                  </DeFiTerm>
                </span>
                <span className="font-mono font-medium text-slate-200">$890,450.00</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-slate-800/80">
                <span className="text-slate-400">
                  <DeFiTerm term="apy" showIcon position="right">
                    Est. Annual Yield (APY)
                  </DeFiTerm>
                </span>
                <span className="font-mono font-semibold text-emerald-400">18.20%</span>
              </div>
              <div className="flex justify-between items-center py-1.5">
                <span className="text-slate-400">
                  <DeFiTerm term="impermanent-loss" showIcon position="right">
                    Impermanent Loss Risk
                  </DeFiTerm>
                </span>
                <span className="font-mono font-medium text-amber-400">Low (1.2%)</span>
              </div>
            </div>
          </div>

          {/* Card 3: Lending & Soroban */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4 hover:border-slate-700 transition-all">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200 text-base flex items-center gap-2">
                <Landmark className="w-4 h-4 text-amber-400" />
                Soroban Credit Position
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-mono">
                Soroban
              </span>
            </div>
            <div className="space-y-3 pt-2 text-sm">
              <div className="flex justify-between items-center py-1.5 border-b border-slate-800/80">
                <span className="text-slate-400">
                  <DeFiTerm term="health-factor" showIcon position="right">
                    Collateral Health Factor
                  </DeFiTerm>
                </span>
                <span className="font-mono font-bold text-emerald-400">1.85</span>
              </div>
              <div className="flex justify-between items-center py-1.5">
                <span className="text-slate-400">
                  <DeFiTerm term="soroban-budget" showIcon position="right">
                    Soroban CPU Budget
                  </DeFiTerm>
                </span>
                <span className="font-mono font-medium text-slate-300">42,100 / 100K</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Directory Search & Knowledge Base Grid */}
      <section className="space-y-6 pt-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-slate-200">DeFi Terminology Knowledge Directory</h2>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search terminology..."
              className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
            />
          </div>
        </div>

        {/* Glossary Terms Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {glossaryTerms.map((term) => (
            <div
              key={term.id}
              className="p-5 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-3 flex flex-col justify-between hover:border-slate-700 transition-all"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <DeFiTerm term={term.id} className="text-base font-bold text-slate-100" position="top">
                    {term.term}
                  </DeFiTerm>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-sky-400">
                    {term.category}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{term.shortDefinition}</p>
              </div>

              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs">
                <a
                  href={term.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center font-medium text-sky-400 hover:text-sky-300 hover:underline gap-1"
                >
                  <span>Knowledge Base</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
