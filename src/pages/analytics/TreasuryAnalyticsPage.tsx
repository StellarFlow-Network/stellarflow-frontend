"use client";

import { useEffect, useMemo, useState } from "react";

type RevenueDay = { date: string; assets: Record<string, number> };
type Holding = { asset: string; amount: number; usdValue: number };
type TreasuryData = { revenue: RevenueDay[]; burnedTokens: number; holdings: Holding[] };

const ranges = [7, 30, 90] as const;

export default function TreasuryAnalyticsPage() {
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<TreasuryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const api = process.env.NEXT_PUBLIC_API_URL ?? "";

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    fetch(`${api}/indexer/analytics/treasury?days=${days}`, { signal: controller.signal, cache: "no-store" })
      .then((response) => { if (!response.ok) throw new Error(`Indexer returned ${response.status}`); return response.json() as Promise<TreasuryData>; })
      .then(setData)
      .catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to load treasury analytics"); });
    return () => controller.abort();
  }, [api, days]);

  const assets = useMemo(() => Array.from(new Set(data?.revenue.flatMap((day) => Object.keys(day.assets)) ?? [])), [data]);
  const totals = useMemo(() => (data?.revenue ?? []).map((day) => Object.values(day.assets).reduce((sum, amount) => sum + amount, 0)), [data]);
  const max = Math.max(1, ...totals);

  async function exportPdf() {
    if (!data) return;
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF();
    pdf.setFontSize(18); pdf.text("StellarFlow Treasury Transparency Report", 14, 20);
    pdf.setFontSize(11); pdf.text(`Revenue period: ${days} days`, 14, 30);
    pdf.text(`Cumulative reward tokens burned: ${data.burnedTokens.toLocaleString()}`, 14, 39);
    let y = 52;
    pdf.text("Treasury holdings", 14, y); y += 8;
    data.holdings.forEach((holding) => { pdf.text(`${holding.asset}: ${holding.amount.toLocaleString()} ($${holding.usdValue.toLocaleString()})`, 14, y); y += 7; });
    pdf.save("stellarflow-treasury-report.pdf");
  }

  return <main className="mx-auto max-w-6xl space-y-8 p-6 text-white">
    <header className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm uppercase tracking-widest text-cyan-400">Protocol transparency</p><h1 className="text-3xl font-bold">Treasury analytics</h1></div><button className="rounded-lg border border-white/20 px-4 py-2" onClick={exportPdf} disabled={!data}>Export PDF</button></header>
    <section className="grid gap-4 md:grid-cols-2"><article className="rounded-2xl border border-white/10 bg-white/5 p-6"><p className="text-sm text-slate-400">Reward tokens burned</p><p className="mt-2 text-3xl font-semibold">{data?.burnedTokens.toLocaleString() ?? "—"}</p></article><article className="rounded-2xl border border-white/10 bg-white/5 p-6"><p className="text-sm text-slate-400">Treasury value</p><p className="mt-2 text-3xl font-semibold">{data ? `$${data.holdings.reduce((sum, item) => sum + item.usdValue, 0).toLocaleString()}` : "—"}</p></article></section>
    <section className="rounded-2xl border border-white/10 bg-white/5 p-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Daily fee revenue</h2><label className="text-sm">Time range <select className="ml-2 rounded bg-slate-800 p-2" value={days} onChange={(event) => setDays(Number(event.target.value))}>{ranges.map((range) => <option key={range} value={range}>{range} days</option>)}</select></label></div>{error && <p role="alert" className="mt-4 text-rose-400">{error}</p>}{!data && !error && <p className="mt-6 text-slate-400">Loading indexer data…</p>}<div className="mt-6 flex h-56 items-end gap-1 overflow-x-auto">{(data?.revenue ?? []).map((day, i) => <div key={day.date} title={`${day.date}: ${totals[i]}`} className="flex h-full min-w-3 flex-1 flex-col justify-end">{assets.map((asset) => { const amount = day.assets[asset] ?? 0; return <div key={asset} className="w-full bg-cyan-400" style={{ height: `${amount / max * 100}%`, backgroundColor: `hsl(${(assets.indexOf(asset) * 75 + 180) % 360} 75% 55%)` }} />; })}</div>)}</div><div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-300">{assets.map((asset, index) => <span key={asset}><i className="mr-2 inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: `hsl(${(index * 75 + 180) % 360} 75% 55%)` }} />{asset}</span>)}</div></section>
    <section className="rounded-2xl border border-white/10 bg-white/5 p-6"><h2 className="text-xl font-semibold">Active treasury holdings</h2><div className="mt-4 overflow-x-auto"><table className="w-full text-left"><thead className="text-sm text-slate-400"><tr><th className="py-2">Asset</th><th>Balance</th><th>USD value</th></tr></thead><tbody>{(data?.holdings ?? []).map((holding) => <tr key={holding.asset} className="border-t border-white/10"><td className="py-3">{holding.asset}</td><td>{holding.amount.toLocaleString()}</td><td>${holding.usdValue.toLocaleString()}</td></tr>)}</tbody></table></div></section>
  </main>;
}
