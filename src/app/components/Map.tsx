"use client";

import React from "react";
import DataProvenanceMap from "@/app/components/DataProvenanceMap";

export default function Map() {
  const [geoData, setGeoData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadMapData = async () => {
      try {
        // Load the simplified Africa network data
        const response = await fetch("/africa-network-simplified.geojson");
        if (!response.ok) {
          throw new Error(`Failed to load map data: ${response.status}`);
        }
        const data = await response.json();
        setGeoData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    loadMapData();
  }, []);

  // Custom style for network regions
  const networkStyle = (feature: any) => {
    const status = feature.properties.network;
    const nodeCount = feature.properties.nodes;
    
    // Color intensity based on node count
    let opacity = 0.3;
    if (nodeCount > 200) opacity = 0.8;
    else if (nodeCount > 150) opacity = 0.6;
    else if (nodeCount > 100) opacity = 0.4;
    
    return {
      fillColor: status === "active" ? "#A7C957" : "#64748b",
      weight: 2,
      opacity: 1,
      color: "#D9F99D",
      fillOpacity: opacity,
    };
  };

  // Popup content for each region
  const onEachFeature = (feature: any, layer: any) => {
    if (feature.properties) {
      const popupContent = `
        <div class="p-2">
          <h3 class="font-bold text-green-400">${feature.properties.name}</h3>
          <p class="text-sm">Status: <span class="text-green-300">${feature.properties.network}</span></p>
          <p class="text-sm">Nodes: <span class="text-blue-300">${feature.properties.nodes}</span></p>
        </div>
      `;
      layer.bindPopup(popupContent);
    }
  };

  if (loading) {
    return (
      <div className="relative min-h-[320px] overflow-hidden rounded-[28px] border border-[#A7C957]/30 bg-[#0A1020] p-5 shadow-[0_24px_80px_rgba(2,8,23,0.42)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(217,249,157,0.12),transparent_35%),radial-gradient(circle_at_85%_80%,rgba(96,165,250,0.12),transparent_40%)]" />
        <div className="relative flex h-full min-h-[280px] items-center justify-center rounded-[24px] border border-white/10 bg-[#0F172A] p-6 text-center">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#D9F99D]/85">
              Loading Network Map...
            </p>
            <p className="text-sm leading-6 text-slate-300">
              Simplified Africa network data (2.5KB)
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative min-h-[320px] overflow-hidden rounded-[28px] border border-[#A7C957]/30 bg-[#0A1020] p-5 shadow-[0_24px_80px_rgba(2,8,23,0.42)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(217,249,157,0.12),transparent_35%),radial-gradient(circle_at_85%_80%,rgba(96,165,250,0.12),transparent_40%)]" />
        <div className="relative flex h-full min-h-[280px] items-center justify-center rounded-[24px] border border-white/10 bg-[#0F172A] p-6 text-center">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-red-400">
              Map Error
            </p>
            <p className="text-sm leading-6 text-slate-300">
              {error}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[320px] overflow-hidden rounded-[28px] border border-[#A7C957]/30 bg-[#0A1020] p-5 shadow-[0_24px_80px_rgba(2,8,23,0.42)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(217,249,157,0.12),transparent_35%),radial-gradient(circle_at_85%_80%,rgba(96,165,250,0.12),transparent_40%)]" />
      <div className="relative flex h-full min-h-[280px] items-center justify-center rounded-[24px] border border-white/10 bg-[#0F172A] p-6 text-center">
        <div className="flex h-full w-full items-center justify-center">
          <DataProvenanceMap width={500} height={300} />
        </div>
      </div>
    </div>
  );
}
