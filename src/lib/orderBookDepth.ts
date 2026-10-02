import type { OrderBookLevel } from "@/types";

export interface CumulativeDepthLevel {
  price: number;
  amount: number;
  cumulativeVolume: number;
}

export interface DepthChartPoint {
  price: number;
  bidDepth: number | null;
  askDepth: number | null;
}

export interface MarketSpread {
  bestBid: number;
  bestAsk: number;
  midPrice: number;
  spread: number;
  spreadPercent: number;
}

export interface PriceDomain {
  min: number;
  max: number;
}

export interface DepthChartModel {
  points: DepthChartPoint[];
  spread: MarketSpread | null;
  domain: PriceDomain | null;
}

export interface DepthChartViewport {
  domain: PriceDomain;
  points: DepthChartPoint[];
  maxDepth: number;
}

const DEGENERATE_DOMAIN_PADDING_RATIO = 0.01;

const NICE_NUMBER_STEP_DIVISOR = 2;

type PriceComparator = (a: { price: number }, b: { price: number }) => number;

const byPriceAscending: PriceComparator = (a, b) => a.price - b.price;
const byPriceDescending: PriceComparator = (a, b) => b.price - a.price;

const isValidLevel = ({ price, amount }: OrderBookLevel): boolean =>
  Number.isFinite(price) && Number.isFinite(amount) && price > 0 && amount > 0;

const aggregateLevels = (levels: readonly OrderBookLevel[]): Map<number, number> =>
  levels.filter(isValidLevel).reduce((amountsByPrice, { price, amount }) => {
    amountsByPrice.set(price, (amountsByPrice.get(price) ?? 0) + amount);
    return amountsByPrice;
  }, new Map<number, number>());

const accumulateLevels = (
  levels: readonly OrderBookLevel[],
  compare: PriceComparator,
): CumulativeDepthLevel[] => {
  let cumulativeVolume = 0;

  return Array.from(aggregateLevels(levels), ([price, amount]) => ({ price, amount }))
    .sort(compare)
    .map(({ price, amount }) => {
      cumulativeVolume += amount;
      return { price, amount, cumulativeVolume };
    });
};

export const accumulateBids = (bids: readonly OrderBookLevel[]): CumulativeDepthLevel[] =>
  accumulateLevels(bids, byPriceDescending);

export const accumulateAsks = (asks: readonly OrderBookLevel[]): CumulativeDepthLevel[] =>
  accumulateLevels(asks, byPriceAscending);

export function buildDepthSeries(
  bids: readonly CumulativeDepthLevel[],
  asks: readonly CumulativeDepthLevel[],
): DepthChartPoint[] {
  const pointsByPrice = new Map<number, DepthChartPoint>();

  const upsert = (price: number, patch: Partial<DepthChartPoint>) => {
    const existing = pointsByPrice.get(price) ?? { price, bidDepth: null, askDepth: null };
    pointsByPrice.set(price, { ...existing, ...patch });
  };

  bids.forEach(({ price, cumulativeVolume }) => upsert(price, { bidDepth: cumulativeVolume }));
  asks.forEach(({ price, cumulativeVolume }) => upsert(price, { askDepth: cumulativeVolume }));

  return Array.from(pointsByPrice.values()).sort(byPriceAscending);
}

export function computeMarketSpread(
  bids: readonly CumulativeDepthLevel[],
  asks: readonly CumulativeDepthLevel[],
): MarketSpread | null {
  const bestBid = bids[0]?.price;
  const bestAsk = asks[0]?.price;

  if (bestBid === undefined || bestAsk === undefined) {
    return null;
  }

  const midPrice = (bestBid + bestAsk) / 2;
  const spread = bestAsk - bestBid;

  return {
    bestBid,
    bestAsk,
    midPrice,
    spread,
    spreadPercent: midPrice > 0 ? (spread / midPrice) * 100 : 0,
  };
}

export function getPriceDomain(points: readonly DepthChartPoint[]): PriceDomain | null {
  if (points.length === 0) {
    return null;
  }

  const min = points[0].price;
  const max = points[points.length - 1].price;

  if (min === max) {
    const padding = min * DEGENERATE_DOMAIN_PADDING_RATIO;
    return { min: min - padding, max: max + padding };
  }

  return { min, max };
}

export function buildDepthChartModel(
  bids: readonly OrderBookLevel[],
  asks: readonly OrderBookLevel[],
): DepthChartModel {
  const cumulativeBids = accumulateBids(bids);
  const cumulativeAsks = accumulateAsks(asks);
  const points = buildDepthSeries(cumulativeBids, cumulativeAsks);

  return {
    points,
    spread: computeMarketSpread(cumulativeBids, cumulativeAsks),
    domain: getPriceDomain(points),
  };
}

export function computeZoomDomain(
  fullDomain: PriceDomain,
  center: number,
  zoomFactor: number,
  minHalfWidth = 0,
): PriceDomain {
  const safeZoomFactor = Math.max(zoomFactor, 1);
  const fullHalfWidth = Math.max(center - fullDomain.min, fullDomain.max - center);
  const halfWidth = Math.max(fullHalfWidth / safeZoomFactor, minHalfWidth);

  return {
    min: Math.max(fullDomain.min, center - halfWidth),
    max: Math.min(fullDomain.max, center + halfWidth),
  };
}

const isWithinDomain = (price: number, { min, max }: PriceDomain): boolean =>
  price >= min && price <= max;

export function slicePointsToDomain(
  points: readonly DepthChartPoint[],
  domain: PriceDomain,
): DepthChartPoint[] {
  const firstInside = points.findIndex(({ price }) => price >= domain.min);
  const lastInside = points.findLastIndex(({ price }) => price <= domain.max);

  if (firstInside === -1 || lastInside === -1) {
    return [];
  }

  const start = Math.max(firstInside - 1, 0);
  const end = Math.min(lastInside + 1, points.length - 1);

  return points.slice(start, end + 1);
}

export function getVisibleMaxDepth(
  points: readonly DepthChartPoint[],
  domain: PriceDomain,
): number {
  return points.reduce((maxDepth, point, index) => {
    const inside = isWithinDomain(point.price, domain);
    const previous = points[index - 1];
    const next = points[index + 1];
    const bidStepVisible =
      inside || (point.price > domain.max && previous !== undefined && previous.price <= domain.max);
    const askStepVisible =
      inside || (point.price < domain.min && next !== undefined && next.price >= domain.min);

    const bidDepth = bidStepVisible ? (point.bidDepth ?? 0) : 0;
    const askDepth = askStepVisible ? (point.askDepth ?? 0) : 0;

    return Math.max(maxDepth, bidDepth, askDepth);
  }, 0);
}

export function roundUpToNiceNumber(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  const step = 10 ** Math.floor(Math.log10(value)) / NICE_NUMBER_STEP_DIVISOR;
  return Math.ceil(value / step) * step;
}

export function resolveDepthViewport(
  model: DepthChartModel,
  zoomFactor: number,
  spreadVisibilityMultiplier: number,
): DepthChartViewport | null {
  if (!model.domain) {
    return null;
  }

  const domain = model.spread
    ? computeZoomDomain(
        model.domain,
        model.spread.midPrice,
        zoomFactor,
        (Math.max(model.spread.spread, 0) / 2) * spreadVisibilityMultiplier,
      )
    : model.domain;

  const points = slicePointsToDomain(model.points, domain);

  return { domain, points, maxDepth: getVisibleMaxDepth(points, domain) };
}
