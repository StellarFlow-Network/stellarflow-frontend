"use client";

import React, { useState, useMemo, useEffect } from 'react';
import Icon from '@/components/icons/Icon';
import { ICON_IDS } from '@/components/icons/iconIds';
import {
  calculateStorageCost,
  compareStorageTradeoffs,
  parseSimulationFootprint,
  formatLedgerDuration,
  StorageTier,
  LEDGERS_PER_DAY,
  LEDGERS_PER_MONTH,
  LEDGERS_PER_YEAR,
} from '@/lib/storageCostCalculator';
import { getXlmUsdRate } from '@/services/storageFootprintService';

const PRESETS = [
  { label: 'Oracle Price Feed', bytes: 64, entries: 1, type: 'temporary' as StorageTier, ledgers: LEDGERS_PER_DAY * 7, desc: 'Short-lived volatile data' },
  { label: 'User Token Balance', bytes: 128, entries: 1, type: 'persistent' as StorageTier, ledgers: LEDGERS_PER_MONTH, desc: 'Essential user balances' },
  { label: 'DEX Pool State', bytes: 2048, entries: 4, type: 'persistent' as StorageTier, ledgers: LEDGERS_PER_MONTH * 6, desc: 'Multi-entry AMM reserves' },
  { label: 'Admin Configuration', bytes: 512, entries: 1, type: 'instance' as StorageTier, ledgers: LEDGERS_PER_YEAR, desc: 'Contract-wide parameters' },
  { label: 'WASM Contract Code', bytes: 32768, entries: 1, type: 'persistent' as StorageTier, ledgers: LEDGERS_PER_YEAR, desc: 'Deploy 32KB smart contract' },
];

const SAMPLE_SIMULATION_JSON = JSON.stringify({
  minResourceFee: "125000",
  transactionData: {
    resources: {
      readBytes: 4096,
      writeBytes: 1536,
      footprint: {
        readOnly: [{ contractCode: "8f2a...7e1b" }],
        readWrite: [{ contractData: "user_balance_key" }, { contractData: "nonce_key" }]
      }
    }
  }
}, null, 2);

export default function StorageFootprintCalculator() {
  const [activeTab, setActiveTab] = useState<'estimator' | 'simulation' | 'tradeoffs'>('estimator');
  const [byteSize, setByteSize] = useState<number>(1024);
  const [entryCount, setEntryCount] = useState<number>(1);
  const [storageType, setStorageType] = useState<StorageTier>('persistent');
  const [ledgerCount, setLedgerCount] = useState<number>(LEDGERS_PER_MONTH);
  const [xlmUsdPrice, setXlmUsdPrice] = useState<number>(0.125);
  const [rawSimulationJson, setRawSimulationJson] = useState<string>(SAMPLE_SIMULATION_JSON);
  const [simError, setSimError] = useState<string | null>(null);

  // Fetch live or cached XLM price on mount
  useEffect(() => {
    let isMounted = true;
    getXlmUsdRate().then((rate) => {
      if (isMounted && rate > 0) {
        setXlmUsdPrice(rate);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Compute custom cost breakdown
  const costBreakdown = useMemo(() => {
    return calculateStorageCost({
      byteSize,
      entryCount,
      storageType,
      ledgerCount,
      xlmUsdPrice,
    });
  }, [byteSize, entryCount, storageType, ledgerCount, xlmUsdPrice]);

  // Compute tradeoff comparison matrix
  const tradeoffs = useMemo(() => {
    return compareStorageTradeoffs({
      byteSize,
      entryCount,
      ledgerCount,
      xlmUsdPrice,
    });
  }, [byteSize, entryCount, ledgerCount, xlmUsdPrice]);

  // Parse simulation JSON
  const simulationSummary = useMemo(() => {
    if (!rawSimulationJson.trim()) return null;
    try {
      const parsed = JSON.parse(rawSimulationJson);
      return parseSimulationFootprint(parsed, xlmUsdPrice);
    } catch {
      return null;
    }
  }, [rawSimulationJson, xlmUsdPrice]);

  const handleApplyPreset = (preset: typeof PRESETS[0]) => {
    setByteSize(preset.bytes);
    setEntryCount(preset.entries);
    setStorageType(preset.type);
    setLedgerCount(preset.ledgers);
  };

  const handleSimulateJsonChange = (val: string) => {
    setRawSimulationJson(val);
    try {
      JSON.parse(val);
      setSimError(null);
    } catch {
      setSimError('Invalid JSON structure');
    }
  };

  return (
    <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-gray-800 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Icon id={ICON_IDS.database} size={22} className="text-blue-400" />
            <h2 className="text-xl font-bold text-gray-100">
              Soroban Storage Footprint & Rent Calculator
            </h2>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Preview ledger state rent, write overhead, and storage tier allocations in XLM and USD
          </p>
        </div>

        {/* Live XLM Price Badge */}
        <div className="flex items-center gap-2 bg-[#0d1117] border border-gray-700 px-3 py-1.5 rounded-lg text-xs font-mono">
          <span className="text-gray-400">XLM / USD:</span>
          <span className="text-emerald-400 font-bold">${xlmUsdPrice.toFixed(4)}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-800 pb-2">
        <button
          onClick={() => setActiveTab('estimator')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'estimator'
              ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
          }`}
        >
          Custom Estimator
        </button>
        <button
          onClick={() => setActiveTab('simulation')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'simulation'
              ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
          }`}
        >
          RPC Simulation Analyzer
        </button>
        <button
          onClick={() => setActiveTab('tradeoffs')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'tradeoffs'
              ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
          }`}
        >
          Storage Tier Tradeoffs
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: CUSTOM ESTIMATOR */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'estimator' && (
        <div className="space-y-6">
          {/* Quick Presets */}
          <div>
            <span className="text-xs uppercase font-bold text-gray-400 block mb-2">
              Quick Architecture Presets
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => handleApplyPreset(p)}
                  className="p-2.5 text-left bg-[#0d1117] hover:bg-gray-800/80 border border-gray-800 hover:border-gray-700 rounded-lg transition-all text-xs group"
                >
                  <p className="font-semibold text-gray-200 group-hover:text-blue-400 truncate">{p.label}</p>
                  <p className="text-[11px] text-gray-500">{p.bytes >= 1024 ? `${p.bytes / 1024} KB` : `${p.bytes} B`} • {p.type}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Input Controls */}
            <div className="lg:col-span-6 space-y-4 bg-[#0d1117] p-4 rounded-xl border border-gray-800">
              {/* Storage Tier */}
              <div>
                <label className="text-xs uppercase font-bold text-gray-400 block mb-2">Storage Tier</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['persistent', 'temporary', 'instance'] as StorageTier[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setStorageType(t)}
                      className={`py-2 px-3 text-xs font-semibold rounded-lg capitalize border transition-all ${
                        storageType === t
                          ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-900/30'
                          : 'bg-[#161b22] text-gray-400 border-gray-700 hover:text-gray-200'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Byte Size Input & Sliders */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs uppercase font-bold text-gray-400">Payload Size</label>
                  <span className="text-xs font-mono text-blue-400 font-bold">
                    {byteSize.toLocaleString()} Bytes ({ (byteSize / 1024).toFixed(2) } KB)
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="65536"
                  step="64"
                  value={byteSize}
                  onChange={(e) => setByteSize(Number(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex gap-2 mt-2">
                  {[64, 256, 1024, 4096, 16384, 65536].map((b) => (
                    <button
                      key={b}
                      onClick={() => setByteSize(b)}
                      className={`text-[11px] px-2 py-1 rounded border ${
                        byteSize === b ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-white'
                      }`}
                    >
                      {b >= 1024 ? `${b / 1024}K` : `${b}B`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Number of Entries */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs uppercase font-bold text-gray-400">Storage Entries / Keys</label>
                  <span className="text-xs font-mono text-blue-400 font-bold">{entryCount} entries</span>
                </div>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={entryCount}
                  onChange={(e) => setEntryCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-[#161b22] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              {/* TTL Duration */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs uppercase font-bold text-gray-400">TTL Duration</label>
                  <span className="text-xs font-mono text-blue-400 font-bold">
                    {formatLedgerDuration(ledgerCount)}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 mb-2">
                  {[
                    { label: '1 Day', ledgers: LEDGERS_PER_DAY },
                    { label: '30 Days', ledgers: LEDGERS_PER_MONTH },
                    { label: '90 Days', ledgers: LEDGERS_PER_MONTH * 3 },
                    { label: '1 Year', ledgers: LEDGERS_PER_YEAR },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => setLedgerCount(preset.ledgers)}
                      className={`text-xs py-1.5 rounded border transition-all ${
                        ledgerCount === preset.ledgers
                          ? 'bg-blue-600/30 text-blue-300 border-blue-500'
                          : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-white'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <input
                  type="range"
                  min={LEDGERS_PER_DAY}
                  max={LEDGERS_PER_YEAR}
                  step={LEDGERS_PER_DAY}
                  value={ledgerCount}
                  onChange={(e) => setLedgerCount(Number(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>
            </div>

            {/* Cost Results Display */}
            <div className="lg:col-span-6 space-y-4">
              {/* Primary Total Card */}
              <div className="bg-gradient-to-br from-blue-950/30 to-[#0d1117] border border-blue-900/50 p-5 rounded-xl space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs uppercase font-bold text-gray-400">Estimated Total Cost</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    {costBreakdown.storageType}
                  </span>
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-extrabold font-mono text-gray-100">
                    {costBreakdown.totalCostXlm.toFixed(6)} <span className="text-lg text-blue-400 font-semibold">XLM</span>
                  </span>
                  {costBreakdown.totalCostUsd !== null && (
                    <span className="text-sm font-mono text-emerald-400">
                      ≈ ${costBreakdown.totalCostUsd.toFixed(4)} USD
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 font-mono">
                  {costBreakdown.totalCostStroops.toLocaleString()} Stroops for {formatLedgerDuration(costBreakdown.ledgerCount)}
                </p>

                {/* Fee Split Bar */}
                <div className="pt-2 border-t border-gray-800 space-y-1.5">
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Base Write Fee: <strong className="text-gray-300">{costBreakdown.writeFeeXlm.toFixed(6)} XLM</strong></span>
                    <span>State Rent: <strong className="text-gray-300">{costBreakdown.rentFeeXlm.toFixed(6)} XLM</strong></span>
                  </div>
                  <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden flex">
                    <div
                      className="bg-blue-500 h-full"
                      style={{
                        width: `${Math.max(5, (costBreakdown.writeFeeStroops / costBreakdown.totalCostStroops) * 100)}%`,
                      }}
                      title="Write Fee"
                    />
                    <div
                      className="bg-emerald-500 h-full flex-1"
                      title="State Rent"
                    />
                  </div>
                </div>
              </div>

              {/* Time Projection Table */}
              <div className="bg-[#0d1117] border border-gray-800 rounded-xl p-4 space-y-3">
                <span className="text-xs uppercase font-bold text-gray-400 block">Rent Cost Projections</span>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center py-1.5 border-b border-gray-800/80">
                    <span className="text-gray-400">Daily Rent (17,280 ledgers)</span>
                    <span className="font-mono text-gray-200 font-semibold">
                      {costBreakdown.rentPerDayXlm.toFixed(6)} XLM
                      {costBreakdown.totalCostUsd !== null && (
                        <span className="text-gray-500 font-normal ml-2">
                          (${(costBreakdown.rentPerDayXlm * xlmUsdPrice).toFixed(4)})
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-gray-800/80">
                    <span className="text-gray-400">Monthly Rent (30 Days)</span>
                    <span className="font-mono text-gray-200 font-semibold">
                      {costBreakdown.rentPerMonthXlm.toFixed(6)} XLM
                      {costBreakdown.totalCostUsd !== null && (
                        <span className="text-gray-500 font-normal ml-2">
                          (${(costBreakdown.rentPerMonthXlm * xlmUsdPrice).toFixed(4)})
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1.5">
                    <span className="text-gray-400">Annual Rent (365 Days)</span>
                    <span className="font-mono text-gray-200 font-semibold">
                      {costBreakdown.rentPerYearXlm.toFixed(6)} XLM
                      {costBreakdown.totalCostUsd !== null && (
                        <span className="text-gray-500 font-normal ml-2">
                          (${(costBreakdown.rentPerYearXlm * xlmUsdPrice).toFixed(4)})
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: SIMULATION ANALYZER */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'simulation' && (
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs uppercase font-bold text-gray-400">
                Soroban RPC Simulation Response (JSON)
              </label>
              <button
                onClick={() => handleSimulateJsonChange(SAMPLE_SIMULATION_JSON)}
                className="text-xs text-blue-400 hover:text-blue-300 underline"
              >
                Reset Sample
              </button>
            </div>
            <textarea
              rows={7}
              value={rawSimulationJson}
              onChange={(e) => handleSimulateJsonChange(e.target.value)}
              placeholder="Paste simulateTransaction JSON response..."
              className="w-full bg-[#0d1117] border border-gray-700 rounded-lg p-3 text-xs font-mono text-gray-200 focus:outline-none focus:border-blue-500 resize-none"
            />
            {simError && <p className="text-xs text-red-400">{simError}</p>}
          </div>

          {simulationSummary && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#0d1117] p-4 rounded-xl border border-gray-800 space-y-1">
                <span className="text-xs text-gray-400 uppercase font-bold">Storage Footprint</span>
                <p className="text-lg font-bold font-mono text-gray-200">
                  {simulationSummary.writeBytes} B Write / {simulationSummary.readBytes} B Read
                </p>
                <p className="text-xs text-gray-500">
                  {simulationSummary.totalKeysCount} Total Keys ({simulationSummary.readWriteKeysCount} RW, {simulationSummary.readOnlyKeysCount} RO)
                </p>
              </div>

              <div className="bg-[#0d1117] p-4 rounded-xl border border-gray-800 space-y-1">
                <span className="text-xs text-gray-400 uppercase font-bold">Simulation Min Fee</span>
                <p className="text-lg font-bold font-mono text-blue-400">
                  {simulationSummary.minResourceFeeXlm.toFixed(6)} XLM
                </p>
                <p className="text-xs text-gray-500 font-mono">
                  {simulationSummary.minResourceFeeStroops.toLocaleString()} Stroops {simulationSummary.minResourceFeeUsd ? `($${simulationSummary.minResourceFeeUsd.toFixed(4)})` : ''}
                </p>
              </div>

              <div className="bg-[#0d1117] p-4 rounded-xl border border-gray-800 space-y-1">
                <span className="text-xs text-gray-400 uppercase font-bold">Projected 30-Day Rent</span>
                <p className="text-lg font-bold font-mono text-emerald-400">
                  {simulationSummary.estimatedRent30DaysXlm.toFixed(6)} XLM
                </p>
                <p className="text-xs text-gray-500">
                  {simulationSummary.estimatedRent30DaysUsd ? `≈ $${simulationSummary.estimatedRent30DaysUsd.toFixed(4)} USD` : 'Persistent Tier'}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 3: TRADEOFF MATRIX */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'tradeoffs' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {tradeoffs.map((item) => (
              <div
                key={item.tier}
                className="bg-[#0d1117] border border-gray-800 rounded-xl p-5 flex flex-col justify-between space-y-4 hover:border-gray-700 transition-all"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-base text-gray-100">{item.title}</h3>
                      <span className="inline-block mt-1 text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {item.badge}
                      </span>
                    </div>
                  </div>

                  {/* Monthly Cost Preview */}
                  <div className="py-2 px-3 bg-[#161b22] rounded-lg border border-gray-800">
                    <span className="text-[10px] text-gray-500 uppercase block font-bold">Monthly Rent</span>
                    <span className="text-sm font-mono font-bold text-emerald-400">
                      {item.rentPerMonthXlm.toFixed(6)} XLM
                      {item.costUsd !== null && (
                        <span className="text-gray-400 text-xs font-normal ml-1">
                          (${(item.rentPerMonthXlm * xlmUsdPrice).toFixed(4)})
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Pros */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-green-400 uppercase tracking-wide">Advantages</span>
                    <ul className="text-xs text-gray-400 space-y-1">
                      {item.pros.map((p, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-green-500 mt-0.5">•</span>
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Cons */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wide">Limitations</span>
                    <ul className="text-xs text-gray-400 space-y-1">
                      {item.cons.map((c, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-amber-500 mt-0.5">•</span>
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Recommendations */}
                <div className="pt-3 border-t border-gray-800">
                  <span className="text-[10px] uppercase font-bold text-gray-500 block mb-1">Recommended For</span>
                  <div className="flex flex-wrap gap-1">
                    {item.recommendedUseCases.map((rec, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] bg-gray-800/80 text-gray-300 px-2 py-0.5 rounded border border-gray-700"
                      >
                        {rec}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
