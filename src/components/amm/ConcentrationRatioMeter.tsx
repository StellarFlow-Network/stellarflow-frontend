"use client";

import { Info } from "lucide-react";
import styles from "./ConcentrationRatioMeter.module.css";

export interface ConcentrationTickBand {
  tickIndex: number;
  lowerPrice: number;
  upperPrice: number;
  tvlUsd: number;
}

export interface ConcentrationRatioMeterProps {
  tickBands: ConcentrationTickBand[];
  spotPrice: number;
  totalTvlUsd: number;
  className?: string;
}

const WINDOW_FRACTION = 0.05;
const V2_REFERENCE_RATIO =
  ((Math.sqrt(1 + WINDOW_FRACTION) - 1 +
    1 - Math.sqrt(1 - WINDOW_FRACTION)) /
    2) *
  100;

function validPositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

export function calculateConcentrationRatio(
  tickBands: ConcentrationTickBand[],
  spotPrice: number,
  totalTvlUsd: number,
): number {
  if (!validPositive(spotPrice) || !validPositive(totalTvlUsd)) return 0;

  const windowLower = spotPrice * (1 - WINDOW_FRACTION);
  const windowUpper = spotPrice * (1 + WINDOW_FRACTION);
  const concentratedTvl = tickBands.reduce((sum, band) => {
    if (
      !Number.isFinite(band.lowerPrice) ||
      !Number.isFinite(band.upperPrice) ||
      !Number.isFinite(band.tvlUsd) ||
      band.lowerPrice >= band.upperPrice ||
      band.tvlUsd <= 0
    ) {
      return sum;
    }

    const overlap =
      Math.min(band.upperPrice, windowUpper) -
      Math.max(band.lowerPrice, windowLower);
    if (overlap <= 0) return sum;

    const bandWidth = band.upperPrice - band.lowerPrice;
    return sum + band.tvlUsd * (overlap / bandWidth);
  }, 0);

  return Math.min(100, (concentratedTvl / totalTvlUsd) * 100);
}

export function ConcentrationRatioMeter({
  tickBands,
  spotPrice,
  totalTvlUsd,
  className,
}: ConcentrationRatioMeterProps) {
  const ratio = calculateConcentrationRatio(
    tickBands,
    spotPrice,
    totalTvlUsd,
  );
  const relativeToV2 = ratio / V2_REFERENCE_RATIO;
  const isValid = validPositive(spotPrice) && validPositive(totalTvlUsd);

  return (
    <section className={[styles.meter, className].filter(Boolean).join(" ")}>
      <header className={styles.header}>
        <div>
          <h2 className={styles.title}>Liquidity concentration</h2>
          <p className={styles.subtitle}>Capital within 5% of spot</p>
        </div>
        <div className={styles.valueGroup}>
          <strong className={styles.value}>{ratio.toFixed(1)}%</strong>
          <span className={styles.valueCaption}>of pool TVL</span>
        </div>
      </header>

      {isValid ? (
        <>
          <div
            className={styles.track}
            role="meter"
            aria-label="Pool TVL within 5% of spot price"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Number(ratio.toFixed(1))}
            aria-valuetext={`${ratio.toFixed(1)} percent of total pool TVL`}
          >
            <span className={styles.fill} style={{ width: `${ratio}%` }} />
            <span
              className={styles.benchmark}
              style={{ left: `${V2_REFERENCE_RATIO}%` }}
              aria-hidden="true"
            />
          </div>
          <div className={styles.scale}>
            <span>0%</span>
            <span>100%</span>
          </div>
          <div className={styles.comparison}>
            <span>Standard V2 pool reference</span>
            <strong>
              {relativeToV2.toFixed(1)}x depth
              <span className={styles.comparisonDetail}>
                {V2_REFERENCE_RATIO.toFixed(1)}% of TVL at ±5%
              </span>
            </strong>
          </div>
        </>
      ) : (
        <p className={styles.empty} role="status">
          Pool price and total TVL are required to calculate concentration.
        </p>
      )}

      <details className={styles.info}>
        <summary aria-label="About the concentration ratio">
          <Info size={16} aria-hidden="true" />
        </summary>
        <div className={styles.tooltip}>
          <strong>How to read this metric</strong>
          <p>
            Tick-band TVL inside ±5% of spot is divided by total pool TVL.
            Bands crossing the window edge are apportioned by their price-range
            overlap. More nearby liquidity generally means less price impact
            for a given trade.
          </p>
          <p>
            The V2 reference estimates two-sided depth from a constant-product
            curve for ±5% price moves; it is not a trade-specific slippage
            quote.
          </p>
        </div>
      </details>
    </section>
  );
}