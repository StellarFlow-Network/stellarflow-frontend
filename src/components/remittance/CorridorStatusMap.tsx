"use client";

import { Minus, Plus, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";

export type CorridorRegion = "Africa" | "Latin America" | "Europe" | "Asia";
export type AnchorStatus = "Active" | "High Congestion" | "Offline";
export interface RemittanceCorridor { id: string; sourceCountry: string; destinationCountry: string; source: [number, number]; destination: [number, number]; region: CorridorRegion; liquidity: "High" | "Medium" | "Low"; anchorStatus: AnchorStatus; }
export interface CorridorStatusMapProps { corridors?: RemittanceCorridor[]; onCorridorSelect?: (corridor: RemittanceCorridor) => void; }

export const DEFAULT_CORRIDORS: RemittanceCorridor[] = [
  { id: "ng-ke", sourceCountry: "Nigeria", destinationCountry: "Kenya", source: [8, 9], destination: [37, 0], region: "Africa", liquidity: "High", anchorStatus: "Active" },
  { id: "us-mx", sourceCountry: "United States", destinationCountry: "Mexico", source: [-99, 39], destination: [-102, 23], region: "Latin America", liquidity: "High", anchorStatus: "Active" },
  { id: "gb-ph", sourceCountry: "United Kingdom", destinationCountry: "Philippines", source: [-2, 54], destination: [122, 13], region: "Asia", liquidity: "Medium", anchorStatus: "High Congestion" },
  { id: "de-tr", sourceCountry: "Germany", destinationCountry: "Türkiye", source: [10, 51], destination: [35, 39], region: "Europe", liquidity: "Low", anchorStatus: "Offline" },
];
const regions: Array<CorridorRegion | "All"> = ["All", "Africa", "Latin America", "Europe", "Asia"];
const statusClass: Record<AnchorStatus, string> = { Active: "bg-emerald-400/15 text-emerald-200", "High Congestion": "bg-amber-400/15 text-amber-200", Offline: "bg-rose-400/15 text-rose-200" };
const statusStroke: Record<AnchorStatus, string> = { Active: "#34d399", "High Congestion": "#fbbf24", Offline: "#fb7185" };
function project([longitude, latitude]: [number, number]) { return [((longitude + 180) / 360) * 800, ((90 - latitude) / 180) * 420] as const; }

/** Lightweight interactive world map; select a corridor to prefill a remittance transfer wizard in the parent. */
export function CorridorStatusMap({ corridors = DEFAULT_CORRIDORS, onCorridorSelect }: CorridorStatusMapProps) {
  const [region, setRegion] = useState<CorridorRegion | "All">("All"); const [zoom, setZoom] = useState(1); const [selected, setSelected] = useState<string | null>(null);
  const filtered = useMemo(() => corridors.filter((corridor) => region === "All" || corridor.region === region), [corridors, region]);
  const choose = (corridor: RemittanceCorridor) => { setSelected(corridor.id); onCorridorSelect?.(corridor); };
  return <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-5 text-neutral-100"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="font-semibold">Corridor liquidity map</h2><p className="mt-1 text-xs text-neutral-400">Choose a route to start a pre-filled transfer.</p></div><div className="flex rounded-lg border border-neutral-700"><button type="button" onClick={() => setZoom((value) => Math.min(1.6, value + .15))} aria-label="Zoom in" className="p-2 hover:bg-white/10"><Plus size={16} /></button><button type="button" onClick={() => setZoom((value) => Math.max(.8, value - .15))} aria-label="Zoom out" className="border-x border-neutral-700 p-2 hover:bg-white/10"><Minus size={16} /></button><button type="button" onClick={() => setZoom(1)} aria-label="Reset map zoom" className="p-2 hover:bg-white/10"><RotateCcw size={16} /></button></div></div>
    <div className="mt-4 flex flex-wrap gap-2">{regions.map((item) => <button type="button" key={item} onClick={() => setRegion(item)} className={`rounded-full px-3 py-1 text-xs font-medium ${region === item ? "bg-blue-400 text-neutral-950" : "bg-white/5 text-neutral-300 hover:bg-white/10"}`}>{item}</button>)}</div>
    <div className="mt-4 overflow-hidden rounded-xl border border-neutral-800 bg-[#07101d]"><svg viewBox="0 0 800 420" className="h-auto w-full" role="img" aria-label="Interactive world remittance corridor map"><rect width="800" height="420" fill="#07101d"/><path d="M35 95h130l35 45-50 38 25 62-105-15-35-70zM275 78l115-35 102 40 45 52-35 60-73 20-51-48-81-8zM355 235l81 4 45 100-70 54-56-48zM511 85l130 14 95 65-48 45-98-18-64-56zM618 268l95 16 48 69-114 21-46-46z" fill="#172638" stroke="#294158" strokeWidth="2" transform={`translate(0 0) scale(${zoom})`} style={{ transformOrigin: "center" }}/>{filtered.map((corridor) => { const [x1,y1]=project(corridor.source); const [x2,y2]=project(corridor.destination); const colour=statusStroke[corridor.anchorStatus]; return <g key={corridor.id} className="cursor-pointer" onClick={() => choose(corridor)} role="button" tabIndex={0} aria-label={`Select ${corridor.sourceCountry} to ${corridor.destinationCountry}`} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") choose(corridor); }}><path d={`M ${x1} ${y1} Q ${(x1+x2)/2} ${Math.min(y1,y2)-45} ${x2} ${y2}`} fill="none" stroke={colour} strokeWidth={selected===corridor.id ? 5 : 3} strokeDasharray={corridor.anchorStatus === "Offline" ? "7 6" : undefined} opacity=".9"/><circle cx={x1} cy={y1} r="6" fill={colour}/><circle cx={x2} cy={y2} r="6" fill={colour}/></g>; })}</svg></div>
    <ul className="mt-4 grid gap-2 sm:grid-cols-2">{filtered.map((corridor) => <li key={corridor.id}><button type="button" onClick={() => choose(corridor)} className={`flex w-full items-center justify-between rounded-xl border p-3 text-left ${selected === corridor.id ? "border-blue-400 bg-blue-400/10" : "border-neutral-800 hover:border-neutral-600"}`}><span><span className="block text-sm font-medium">{corridor.sourceCountry} → {corridor.destinationCountry}</span><span className="text-xs text-neutral-400">{corridor.region} · {corridor.liquidity} liquidity</span></span><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${statusClass[corridor.anchorStatus]}`}>{corridor.anchorStatus}</span></button></li>)}</ul>
  </section>;
}
export default CorridorStatusMap;
