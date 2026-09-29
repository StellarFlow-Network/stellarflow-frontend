"use client";

import React, { use } from "react";
import Link from "next/link";
import { ArrowLeft, Clock, CheckCircle2 } from "lucide-react";

interface PageProps {
  params: Promise<{ referenceId: string }>;
}

export default function RemittanceTrackingPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const referenceId = resolvedParams.referenceId;

  return (
    <main className="min-h-screen bg-[#071016] text-slate-100 antialiased">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#071016]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <Link
            href="/remittance"
            className="flex items-center gap-2 text-xs font-medium text-slate-400 transition hover:text-white"
          >
            <ArrowLeft size={16} />
            <span>Back to Remittance</span>
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 space-y-8">
        {/* Header Card */}
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#0e1e28] to-[#0a151d] p-6 sm:p-8 shadow-2xl">
          <div className="absolute right-0 top-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

          <div className="flex flex-col gap-6">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-2.5 py-1 rounded-md">
                  REF: {referenceId}
                </span>
                <span className="rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 px-3 py-0.5 text-xs font-semibold flex items-center gap-1">
                  <Clock size={12} className="animate-spin" /> In Transit
                </span>
              </div>

              <h1 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Remittance Tracking
              </h1>

              <p className="mt-2 text-sm text-slate-400">
                Track your cross-border remittance in real-time
              </p>
            </div>
          </div>
        </div>

        {/* Status Section */}
        <section className="rounded-2xl border border-white/10 bg-[#0d1a21] p-6 sm:p-8 shadow-xl">
          <h2 className="text-lg font-bold text-white mb-6">Delivery Timeline</h2>
          
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 rounded-lg bg-emerald-950/40 border border-emerald-500/30">
              <CheckCircle2 size={24} className="text-emerald-400 shrink-0" />
              <div>
                <h3 className="font-semibold text-emerald-300">Initiated</h3>
                <p className="text-xs text-slate-400 mt-1">Transfer has been initiated</p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-lg bg-cyan-950/40 border border-cyan-500/30">
              <Clock size={24} className="text-cyan-400 shrink-0 animate-spin" />
              <div>
                <h3 className="font-semibold text-cyan-300">Processing</h3>
                <p className="text-xs text-slate-400 mt-1">Your remittance is being processed</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
