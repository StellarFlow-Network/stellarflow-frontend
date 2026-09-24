'use client';

import React from 'react';
import { VotingPowerCalculator } from '@/components/governance';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import Link from 'next/link';

/**
 * Governance Calculator Page
 * 
 * Standalone page for the Voting Power Calculator component.
 * Allows users to preview their governance voting power before locking tokens.
 */
export default function GovernanceCalculatorPage() {
  const handleLockTokens = (amount: number, durationWeeks: number) => {
    // TODO: Integrate with actual smart contract
    console.log(`Locking ${amount} FLOW for ${durationWeeks} weeks`);
    
    // Example: Show toast notification
    if (typeof window !== 'undefined') {
      alert(`Ready to lock ${amount.toLocaleString()} FLOW for ${durationWeeks} weeks.\n\nThis would be integrated with your wallet and smart contract.`);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-800 bg-[#0d1117]">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link 
              href="/governance"
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
            >
              <ArrowLeft size={16} />
              Back to Governance
            </Link>
            
            <nav className="flex items-center gap-4 text-sm">
              <Link 
                href="/governance/proposals" 
                className="text-gray-400 hover:text-gray-200 transition-colors"
              >
                Proposals
              </Link>
              <Link 
                href="/governance/delegates" 
                className="text-gray-400 hover:text-gray-200 transition-colors"
              >
                Delegates
              </Link>
              <Link 
                href="/governance/calculator" 
                className="text-blue-400 font-semibold"
              >
                Calculator
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Page Header */}
        <div className="mb-8 space-y-4">
          <h1 className="text-4xl font-bold text-gray-100">
            Voting Power Calculator
          </h1>
          <p className="text-lg text-gray-400 max-w-3xl">
            Calculate your potential governance voting power and yield multiplier boost. 
            Adjust token amounts and lock durations to see how they affect your influence in the protocol.
          </p>
        </div>

        {/* Info Cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <div className="rounded-lg border border-blue-500/20 bg-blue-950/10 p-4">
            <h3 className="text-sm font-bold text-blue-400 mb-2">What is veFLOW?</h3>
            <p className="text-xs text-gray-400">
              Vote-escrowed FLOW (veFLOW) represents your locked FLOW tokens and determines your 
              voting power in governance decisions.
            </p>
          </div>
          
          <div className="rounded-lg border border-purple-500/20 bg-purple-950/10 p-4">
            <h3 className="text-sm font-bold text-purple-400 mb-2">Lock Duration Benefits</h3>
            <p className="text-xs text-gray-400">
              Longer lock periods provide higher multipliers (up to 4x), giving you more voting 
              power and yield boost per FLOW token locked.
            </p>
          </div>
          
          <div className="rounded-lg border border-cyan-500/20 bg-cyan-950/10 p-4">
            <h3 className="text-sm font-bold text-cyan-400 mb-2">Yield Boost</h3>
            <p className="text-xs text-gray-400">
              Your multiplier is also applied to vault rewards, increasing your earnings from 
              liquidity provision proportionally.
            </p>
          </div>
        </div>

        {/* Calculator Component */}
        <VotingPowerCalculator
          totalVeSupply={10_000_000}
          userBalance={50_000}
          onLockTokens={handleLockTokens}
        />

        {/* Additional Information */}
        <div className="mt-8 space-y-6">
          <div className="rounded-lg border border-gray-800 bg-[#0d1117] p-6 space-y-4">
            <h2 className="text-xl font-bold text-gray-100">How It Works</h2>
            
            <div className="space-y-3 text-sm text-gray-400">
              <div className="flex gap-3">
                <span className="text-blue-400 font-bold shrink-0">1.</span>
                <div>
                  <p className="font-semibold text-gray-300">Choose Your Lock Amount</p>
                  <p>Decide how many FLOW tokens you want to lock. More tokens = more voting power.</p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <span className="text-blue-400 font-bold shrink-0">2.</span>
                <div>
                  <p className="font-semibold text-gray-300">Select Lock Duration</p>
                  <p>Choose how long to lock (1 week to 4 years). Longer locks = higher multiplier.</p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <span className="text-blue-400 font-bold shrink-0">3.</span>
                <div>
                  <p className="font-semibold text-gray-300">Preview Your Power</p>
                  <p>See your veFLOW balance, voting power percentage, and yield boost in real-time.</p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <span className="text-blue-400 font-bold shrink-0">4.</span>
                <div>
                  <p className="font-semibold text-gray-300">Lock Your Tokens</p>
                  <p>When satisfied with the preview, confirm the transaction to lock your FLOW tokens.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-amber-500/20 bg-amber-950/10 p-6 space-y-3">
            <h3 className="text-lg font-bold text-amber-400 flex items-center gap-2">
              Important Notes
            </h3>
            <ul className="space-y-2 text-sm text-gray-400 list-disc list-inside">
              <li>veFLOW tokens are non-transferable and cannot be sold or moved</li>
              <li>Your tokens will be locked for the entire duration you select</li>
              <li>Voting power and yield boost decay linearly as your lock approaches expiry</li>
              <li>You can extend your lock duration to refresh your multiplier</li>
              <li>Early unlock is not possible - choose your duration carefully</li>
            </ul>
          </div>

          <div className="flex items-center justify-center gap-6 text-sm">
            <Link
              href="/governance/docs"
              className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
            >
              View Documentation
              <ExternalLink size={14} />
            </Link>
            
            <Link
              href="/governance/faq"
              className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
            >
              Governance FAQ
              <ExternalLink size={14} />
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-16">
        <div className="container mx-auto px-4 py-8">
          <p className="text-center text-xs text-gray-500">
            StellarFlow Governance • Built on Stellar Network
          </p>
        </div>
      </footer>
    </div>
  );
}
