"use client";

import { useMemo, useState } from "react";
import type {
  LiquidityConcentrationHeatmapProps,
  LiquidityTickPoint,
} from "./LiquidityConcentrationHeatmap.types";
import styles from "./LiquidityConcentrationHeatmap.module.css";

const DEFAULT_WIDTH = 720;
const DEFAULT_HEIGHT = 280;
const DEFAULT_MAX_RENDER_POINTS = 900;
const PADDING = { top: 20, right: 18, bottom: 28, left: 18 };

function numericLiquidity(point: LiquidityTickPoint): number {
  const value = Number(point.liquidity);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function downsample(
  points: LiquidityTickPoint[],
  maxPoints: number,
): LiquidityTickPoint[] {
  if (points.length <= maxPoints) return points;
  const stride = (points.length - 1) / (maxPoints - 1);
  return Array.from({ length: maxPoints }, (_, index) => {
    return points[Math.round(index * stride)];
  });
}

function formatMetric(value: number | string): string {
  return typeof value === "string" ? value : value.toLocaleString();
}

export function LiquidityConcentrationHeatmap({
  ticks,
  activeTickIndex,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  maxRenderPoints = DEFAULT_MAX_RENDER_POINTS,
  ariaLabel = "Liquidity concentration by tick price range",
}: LiquidityConcentrationHeatmapProps) {
  const [hovered, setHovered] = useState<LiquidityTickPoint | null>(null);

  const orderedTicks = useMemo(
    () => [...ticks].sort((a, b) => a.tickIndex - b.tickIndex),
    [ticks],
  );

  const renderTicks = useMemo(
    () => downsample(orderedTicks, Math.max(2, maxRenderPoints)),
    [maxRenderPoints, orderedTicks],
  );

  const geometry = useMemo(() => {
    const innerWidth = width - PADDING.left - PADDING.right;
    const innerHeight = height - PADDING.top - PADDING.bottom;
    const minTick = orderedTicks[0]?.tickIndex ?? 0;
    const maxTick = orderedTicks.at(-1)?.tickIndex ?? 1;
    const tickSpan = Math.max(1, maxTick - minTick);
    const maxLiquidity = Math.max(
      1,
      ...renderTicks.map((point) => numericLiquidity(point)),
    );

    const x = (tickIndex: number) =>
      PADDING.left + ((tickIndex - minTick) / tickSpan) * innerWidth;
    const y = (liquidity: number) =>
      PADDING.top + innerHeight - (liquidity / maxLiquidity) * innerHeight;

    const line = renderTicks
      .map((point, index) => {
        const command = index === 0 ? "M" : "L";
        return `${command}${x(point.tickIndex).toFixed(2)},${y(
          numericLiquidity(point),
        ).toFixed(2)}`;
      })
      .join(" ");

    const baseline = PADDING.top + innerHeight;
    const firstX = x(renderTicks[0]?.tickIndex ?? minTick);
    const lastX = x(renderTicks.at(-1)?.tickIndex ?? maxTick);
    const area = `${line} L${lastX.toFixed(2)},${baseline} L${firstX.toFixed(
      2,
    )},${baseline} Z`;

    const activeX =
      activeTickIndex === undefined ? null : x(activeTickIndex);

    return { line, area, activeX, minTick, maxTick };
  }, [activeTickIndex, height, orderedTicks, renderTicks, width]);

  if (orderedTicks.length === 0) {
    return (
      <div className={styles.empty} role="status">
        No liquidity data available.
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <svg
        className={styles.chart}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel}
      >
        <defs>
          <linearGradient id="liquidity-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--amm-heat-high)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="var(--amm-heat-low)" stopOpacity="0.12" />
          </linearGradient>
        </defs>

        <path className={styles.area} d={geometry.area} fill="url(#liquidity-gradient)" />
        <path className={styles.line} d={geometry.line} />

        {geometry.activeX !== null ? (
          <line
            className={styles.activeMarker}
            x1={geometry.activeX}
            x2={geometry.activeX}
            y1={PADDING.top}
            y2={height - PADDING.bottom}
            aria-label={`Active tick ${activeTickIndex}`}
          />
        ) : null}

        {renderTicks.map((point) => {
          const x =
            PADDING.left +
            ((point.tickIndex - geometry.minTick) /
              Math.max(1, geometry.maxTick - geometry.minTick)) *
              (width - PADDING.left - PADDING.right);
          const y =
            PADDING.top +
            (height - PADDING.top - PADDING.bottom) *
              (1 - numericLiquidity(point) /
                Math.max(1, ...renderTicks.map(numericLiquidity)));

          return (
            <circle
              key={point.tickIndex}
              className={styles.hitTarget}
              cx={x}
              cy={y}
              r="8"
              tabIndex={0}
              role="button"
              aria-label={`Tick ${point.tickIndex}, liquidity ${formatMetric(point.liquidity)}`}
              onMouseEnter={() => setHovered(point)}
              onFocus={() => setHovered(point)}
              onMouseLeave={() => setHovered(null)}
              onBlur={() => setHovered(null)}
            />
          );
        })}
      </svg>

      {hovered ? (
        <div className={styles.tooltip} role="status">
          <strong>Tick {hovered.tickIndex}</strong>
          <span>Lower price: {hovered.lowerPrice}</span>
          <span>Upper price: {hovered.upperPrice}</span>
          <span>Liquidity L: {formatMetric(hovered.liquidity)}</span>
        </div>
      ) : null}
    </div>
  );
}
