"use client";

/**
 * CapitalEfficiencyGauge
 *
 * Visualises a pool's capital efficiency as a circular arc gauge.
 *
 *   R_cap = V_24h / TVL
 *
 * A ratio > 1 means the pool turned over more than its full TVL in 24 h –
 * a signal of excellent capital utilisation and higher fee yield for LPs.
 *
 * Props also accept a `protocolAvgRatio` benchmark so LPs can see whether
 * this pool is outperforming or underperforming the protocol-wide average.
 */

import React, { memo, useMemo, useState, useId } from "react";
import { HelpCircle } from "lucide-react";
import type { LiquidityPool } from "@/lib/pools";
import styles from "./CapitalEfficiencyGauge.module.css";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Arc radius (SVG user units) */
const RADIUS = 42;

/**
 * We only use 270° of the full circle (starting at ≈8 o'clock, ending at
 * ≈4 o'clock) so the opening is at the bottom – a common gauge convention.
 *
 *   arc length = 2π r × (270/360)
 */
const ARC_FRACTION = 0.75; // 270° / 360°
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const TRACK_LENGTH = CIRCUMFERENCE * ARC_FRACTION;

/**
 * SVG `transform` that rotates the coordinate system so the arc begins at
 * the 7-o'clock position (−135°).  The SVG starts drawing arcs from
 * 3-o'clock, so we subtract 225° total.
 */
const GAUGE_ROTATION = "rotate(-225, 50, 50)";

// ─── Zone definitions ─────────────────────────────────────────────────────────

type Zone = "low" | "healthy" | "optimal";

interface ZoneCfg {
  label: string;
  color: string;
  glow: string;
}

const ZONES: Record<Zone, ZoneCfg> = {
  low: {
    label: "Low",
    color: "#f59e0b",
    glow: "drop-shadow(0 0 6px rgba(245,158,11,0.5))",
  },
  healthy: {
    label: "Healthy",
    color: "#2563eb",
    glow: "drop-shadow(0 0 6px rgba(37,99,235,0.5))",
  },
  optimal: {
    label: "Optimal",
    color: "#10b981",
    glow: "drop-shadow(0 0 6px rgba(16,185,129,0.5))",
  },
};

/**
 * Classify a Volume/TVL ratio.
 *
 * | Ratio          | Zone    | Rationale                               |
 * |----------------|---------|------------------------------------------|
 * | < 0.1          | low     | < 10 % of TVL traded; low fee generation |
 * | 0.1 – < 0.5    | healthy | moderate churn; solid LP returns         |
 * | ≥ 0.5          | optimal | high turnover; maximum fee yield         |
 */
function getZone(ratio: number): Zone {
  if (ratio >= 0.5) return "optimal";
  if (ratio >= 0.1) return "healthy";
  return "low";
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Compute the Volume / TVL ratio, guarded against division by zero.
 * Clamped to [0, 2] for display – ratios > 2× TVL are effectively maxed out.
 */
function calcRatio(volume24h: number, tvl: number): number {
  if (!Number.isFinite(tvl) || tvl <= 0) return 0;
  if (!Number.isFinite(volume24h) || volume24h < 0) return 0;
  return volume24h / tvl;
}

/** Normalise a ratio to [0, 1] using a 2× TVL cap. */
function normalise(ratio: number): number {
  return Math.max(0, Math.min(1, ratio / 2));
}

/** Format a ratio as a percentage string ("18.5 %"). */
function formatRatio(ratio: number): string {
  if (ratio >= 10) {
    return `${ratio.toFixed(1)}×`;
  }
  return `${(ratio * 100).toFixed(1)} %`;
}

/** Compact USD formatter – "$1.85M", "$640K", "$250" etc. */
function compactUSD(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}K`;
  }
  return `$${value.toFixed(0)}`;
}

/** Format delta as "+12.4 %" or "−3.1 %". */
function formatDelta(delta: number): string {
  const sign = delta >= 0 ? "+" : "−";
  return `${sign}${Math.abs(delta * 100).toFixed(1)} %`;
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface CapitalEfficiencyGaugeProps {
  /** Pool data – only `volume24h` and `totalValueLocked` are required. */
  pool: Pick<LiquidityPool, "volume24h" | "totalValueLocked" | "pair">;
  /**
   * Protocol-wide average Volume/TVL ratio for the benchmark comparison row.
   * Defaults to `0.21` (21 % – a reasonable AMM market average).
   */
  protocolAvgRatio?: number;
  /** Accessible label for the gauge SVG. */
  ariaLabel?: string;
  /** Additional CSS class applied to the outermost wrapper. */
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

function CapitalEfficiencyGauge({
  pool,
  protocolAvgRatio = 0.21,
  ariaLabel,
  className = "",
}: CapitalEfficiencyGaugeProps) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const tooltipId = useId();

  // ── Derived values ──────────────────────────────────────────────────────
  const ratio = useMemo(
    () => calcRatio(pool.volume24h, pool.totalValueLocked),
    [pool.volume24h, pool.totalValueLocked],
  );

  const zone = useMemo(() => getZone(ratio), [ratio]);
  const cfg = ZONES[zone];

  const norm = useMemo(() => normalise(ratio), [ratio]);

  /**
   * strokeDashoffset drives the arc fill animation.
   *
   * When `norm = 0`, offset = TRACK_LENGTH  → arc fully hidden.
   * When `norm = 1`, offset = 0             → arc fully shown.
   */
  const strokeDashoffset = useMemo(
    () => TRACK_LENGTH * (1 - norm),
    [norm],
  );

  // Protocol-avg arc position
  const avgNorm = useMemo(() => normalise(protocolAvgRatio), [protocolAvgRatio]);
  const avgOffset = useMemo(() => TRACK_LENGTH * (1 - avgNorm), [avgNorm]);

  // Delta vs protocol average
  const delta = ratio - protocolAvgRatio;
  const deltaSign: "positive" | "negative" | "neutral" =
    Math.abs(delta) < 0.005 ? "neutral" : delta > 0 ? "positive" : "negative";

  // ── Accessible description ──────────────────────────────────────────────
  const computedAriaLabel =
    ariaLabel ??
    `Capital efficiency gauge for ${pool.pair}: ${formatRatio(ratio)} Volume/TVL ratio, ${cfg.label} zone`;

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className={`${styles.wrapper} ${className}`}>
      {/* ── Info button ─────────────────────────────────────────────────── */}
      <button
        type="button"
        className={styles.infoButton}
        aria-label="Capital efficiency information"
        aria-expanded={tooltipOpen}
        aria-controls={tooltipId}
        onClick={() => setTooltipOpen((v) => !v)}
        onBlur={() => setTooltipOpen(false)}
      >
        <HelpCircle size={15} aria-hidden="true" />
      </button>

      {/* ── Tooltip popover ──────────────────────────────────────────────── */}
      {tooltipOpen && (
        <div
          id={tooltipId}
          role="tooltip"
          className={styles.tooltipPopover}
        >
          <p className={styles.tooltipTitle}>Capital Efficiency</p>
          <p className={styles.tooltipBody}>
            Measures how hard a pool's liquidity is working. A higher ratio
            means more fee revenue relative to TVL locked – ideal for LP yield.
            Pools with high capital efficiency require less TVL to generate the
            same fee income.
          </p>
          <p className={styles.tooltipFormula}>R_cap = V_24h / TVL</p>
          <p className={styles.tooltipBody} style={{ marginTop: "0.5rem" }}>
            <strong style={{ color: "#f9fafb" }}>≥ 50 %</strong> Optimal ·{" "}
            <strong style={{ color: "#f9fafb" }}>10 – 50 %</strong> Healthy ·{" "}
            <strong style={{ color: "#f9fafb" }}>&lt; 10 %</strong> Low
          </p>
        </div>
      )}

      {/* ── SVG gauge ───────────────────────────────────────────────────── */}
      <div className={styles.gaugeWrapper}>
        <svg
          className={styles.gaugeArc}
          width="120"
          height="120"
          viewBox="0 0 100 100"
          aria-label={computedAriaLabel}
          role="img"
        >
          {/* Glow layer beneath the filled arc */}
          <circle
            className={styles.fillArcGlow}
            cx="50"
            cy="50"
            r={RADIUS}
            stroke={cfg.color}
            strokeDasharray={`${TRACK_LENGTH} ${CIRCUMFERENCE}`}
            strokeDashoffset={strokeDashoffset}
            transform={GAUGE_ROTATION}
          />

          {/* Track (background arc) */}
          <circle
            className={styles.trackArc}
            cx="50"
            cy="50"
            r={RADIUS}
            strokeDasharray={`${TRACK_LENGTH} ${CIRCUMFERENCE}`}
            strokeDashoffset={0}
            transform={GAUGE_ROTATION}
          />

          {/* Protocol-avg marker — small contrasting arc segment */}
          <circle
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            stroke="rgba(255,255,255,0.35)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={`2 ${CIRCUMFERENCE}`}
            strokeDashoffset={avgOffset}
            transform={GAUGE_ROTATION}
            aria-label={`Protocol average: ${formatRatio(protocolAvgRatio)}`}
          />

          {/* Main filled arc */}
          <circle
            className={styles.fillArc}
            cx="50"
            cy="50"
            r={RADIUS}
            stroke={cfg.color}
            strokeDasharray={`${TRACK_LENGTH} ${CIRCUMFERENCE}`}
            strokeDashoffset={strokeDashoffset}
            transform={GAUGE_ROTATION}
            style={{ filter: cfg.glow }}
          />
        </svg>

        {/* Centre readout */}
        <div className={styles.centreText} aria-hidden="true">
          <span className={styles.ratioValue}>{formatRatio(ratio)}</span>
          <span className={styles.ratioLabel} data-zone={zone}>
            {cfg.label}
          </span>
        </div>
      </div>

      {/* ── Benchmark comparison ─────────────────────────────────────────── */}
      <div className={styles.benchmarks} role="group" aria-label="Benchmark comparison">
        {/* Pool ratio */}
        <div className={styles.benchmarkItem}>
          <span className={styles.benchmarkLabel}>This Pool</span>
          <span className={styles.benchmarkValue}>{formatRatio(ratio)}</span>
          <span
            className={styles.benchmarkDelta}
            data-sign={deltaSign}
            aria-label={`${formatDelta(delta)} vs protocol average`}
          >
            {formatDelta(delta)}
          </span>
        </div>

        <div className={styles.benchmarkDivider} aria-hidden="true" />

        {/* Protocol average */}
        <div className={styles.benchmarkItem}>
          <span className={styles.benchmarkLabel}>Protocol Avg</span>
          <span className={styles.benchmarkValue}>
            {formatRatio(protocolAvgRatio)}
          </span>
          <span
            className={styles.benchmarkDelta}
            data-sign="neutral"
            aria-hidden="true"
          >
            baseline
          </span>
        </div>
      </div>

      {/* ── Raw-metric stat row ──────────────────────────────────────────── */}
      <div className={styles.stats} aria-label="Pool metrics">
        <div className={styles.stat}>
          <span className={styles.statLabel}>24 h Vol</span>
          <span className={styles.statValue}>
            {compactUSD(pool.volume24h)}
          </span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>TVL</span>
          <span className={styles.statValue}>
            {compactUSD(pool.totalValueLocked)}
          </span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Pair</span>
          <span className={styles.statValue}>{pool.pair}</span>
        </div>
      </div>
    </div>
  );
}

export default memo(CapitalEfficiencyGauge);
