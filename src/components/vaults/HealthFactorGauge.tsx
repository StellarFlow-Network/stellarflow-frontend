"use client";

import React, { memo, useEffect, useRef, useMemo } from "react";

export enum HealthFactorZone {
  Safe = "Safe",
  Warning = "Warning",
  Critical = "Critical",
}

interface HealthFactorGaugeProps {
  healthFactor: number;
  onAddCollateral?: () => void;
}

interface ZoneConfig {
  label: string;
  color: string;
  glow: string;
  trackColor: string;
}

const zoneConfig: Record<HealthFactorZone, ZoneConfig> = {
  [HealthFactorZone.Safe]: {
    label: "Safe",
    color: "#10b981",
    glow: "0 0 12px rgba(16,185,129,0.45)",
    trackColor: "bg-emerald-500/20",
  },
  [HealthFactorZone.Warning]: {
    label: "Warning",
    color: "#eab308",
    glow: "0 0 12px rgba(234,179,8,0.45)",
    trackColor: "bg-yellow-500/20",
  },
  [HealthFactorZone.Critical]: {
    label: "Critical",
    color: "#ef4444",
    glow: "0 0 12px rgba(239,68,68,0.45)",
    trackColor: "bg-red-500/20",
  },
};

function getZone(hf: number): HealthFactorZone {
  if (hf < 1.1) return HealthFactorZone.Critical;
  if (hf <= 1.5) return HealthFactorZone.Warning;
  return HealthFactorZone.Safe;
}

const RADIUS = 40;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const HealthFactorGauge = ({ healthFactor, onAddCollateral }: HealthFactorGaugeProps) => {
  const zone = useMemo(() => getZone(healthFactor), [healthFactor]);
  const config = zoneConfig[zone];

  const normalized = useMemo(() => {
    const v = healthFactor <= 2 ? healthFactor / 2 : 1;
    return Math.max(0, Math.min(1, v));
  }, [healthFactor]);

  const strokeDashoffset = useMemo(
    () => CIRCUMFERENCE * (1 - normalized),
    [normalized],
  );

  const notifiedRef = useRef(false);

  useEffect(() => {
    if (healthFactor < 1.2 && !notifiedRef.current && typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        new Notification("Vault Health Factor Alert", {
          body: `Health factor dropped to ${healthFactor.toFixed(2)}. Consider adding collateral.`,
          icon: "/sf.webp",
        });
        notifiedRef.current = true;
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then((perm) => {
          if (perm === "granted") {
            new Notification("Vault Health Factor Alert", {
              body: `Health factor dropped to ${healthFactor.toFixed(2)}. Consider adding collateral.`,
              icon: "/sf.webp",
            });
          }
          notifiedRef.current = true;
        });
      }
    }
  }, [healthFactor]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative inline-block">
        <svg
          width="120"
          height="120"
          viewBox="0 0 100 100"
          className="transform -rotate-90"
          aria-hidden="true"
        >
          <circle
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-gray-700"
          />
          <circle
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            stroke={config.color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: "stroke-dashoffset 0.4s ease, stroke 0.3s ease", filter: `drop-shadow(${config.glow})` }}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold font-mono text-white tabular-nums">
            {healthFactor.toFixed(2)}
          </span>
          <span className={`text-[10px] font-semibold tracking-wider ${zone === HealthFactorZone.Safe ? "text-emerald-400" : zone === HealthFactorZone.Warning ? "text-yellow-400" : "text-red-400"}`}>
            {config.label}
          </span>
        </div>
      </div>

      {zone === HealthFactorZone.Warning && onAddCollateral && (
        <button
          type="button"
          onClick={onAddCollateral}
          className="px-4 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs font-bold hover:bg-yellow-500/20 transition-colors"
        >
          Add Collateral
        </button>
      )}
    </div>
  );
};

export default memo(HealthFactorGauge);
