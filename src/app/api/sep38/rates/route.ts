import { NextRequest, NextResponse } from "next/server";
import {
  SEP38_PAIRS,
  type Sep38Pair,
  type Sep38RateHistory,
  type Sep38RatePoint,
} from "@/types/sep38Rates";

export const dynamic = "force-dynamic";

function isPair(value: string | null): value is Sep38Pair {
  return SEP38_PAIRS.some((pair) => pair === value);
}

function isRatePoint(value: unknown): value is Sep38RatePoint {
  if (!value || typeof value !== "object") return false;
  const point = value as Record<string, unknown>;
  return (
    typeof point.timestamp === "string" &&
    Number.isFinite(Date.parse(point.timestamp)) &&
    typeof point.anchorRate === "number" &&
    Number.isFinite(point.anchorRate) &&
    point.anchorRate > 0 &&
    typeof point.midMarketRate === "number" &&
    Number.isFinite(point.midMarketRate) &&
    point.midMarketRate > 0
  );
}

function buildDemoHistory(pair: Sep38Pair, now: number): Sep38RateHistory {
  const baseRates: Record<Sep38Pair, number> = {
    "USDC/NGN": 1480,
    "XLM/EUR": 0.112,
    "BRL/USDC": 0.181,
  };
  const baseRate = baseRates[pair];
  const points = Array.from({ length: 25 }, (_, index) => {
    const timestamp = now - (24 - index) * 60 * 60 * 1000;
    const movement =
      Math.sin(index / 3.2) * 0.0032 +
      Math.sin(index / 1.7) * 0.0011 +
      Math.cos(index / 5.4) * 0.0018;
    const midMarketRate = baseRate * (1 + movement);
    const anchorSpread = 0.006 + Math.sin(index / 4.1) * 0.0012;

    return {
      timestamp: new Date(timestamp).toISOString(),
      midMarketRate: Number(midMarketRate.toPrecision(10)),
      anchorRate: Number((midMarketRate * (1 - anchorSpread)).toPrecision(10)),
    };
  });

  return { pair, points, source: "demo" };
}

/**
 * Proxies the SEP-38 historical quote indexer. Set SEP38_INDEXER_API_URL to
 * the full endpoint URL, or NEXT_PUBLIC_API_URL to the API base (the route
 * `/indexer/sep38/rates` is appended). A clearly-labelled local sample keeps
 * the chart useful in development when no indexer is configured.
 */
export async function GET(request: NextRequest) {
  const pairParam = request.nextUrl.searchParams.get("pair");
  if (!isPair(pairParam)) {
    return NextResponse.json(
      { error: `pair must be one of: ${SEP38_PAIRS.join(", ")}` },
      { status: 400 },
    );
  }

  const endpoint = process.env.SEP38_INDEXER_API_URL;
  const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");
  const url = endpoint || (apiBase ? `${apiBase}/indexer/sep38/rates` : null);

  if (!url) {
    return NextResponse.json(buildDemoHistory(pairParam, Date.now()), {
      headers: { "Cache-Control": "no-store" },
    });
  }

  try {
    const upstreamUrl = new URL(url);
    upstreamUrl.searchParams.set("pair", pairParam);
    upstreamUrl.searchParams.set("from", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    upstreamUrl.searchParams.set("to", new Date().toISOString());

    const response = await fetch(upstreamUrl, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return NextResponse.json(
        { error: "SEP-38 indexer request failed" },
        { status: response.status },
      );
    }

    const payload: unknown = await response.json();
    const rawPoints =
      payload && typeof payload === "object" && "points" in payload
        ? (payload as { points: unknown }).points
        : payload;
    if (!Array.isArray(rawPoints)) {
      return NextResponse.json(
        { error: "SEP-38 indexer returned an invalid rate history" },
        { status: 502 },
      );
    }

    const points = rawPoints
      .filter(isRatePoint)
      .filter((point) => {
        const time = Date.parse(point.timestamp);
        return time >= Date.now() - 24 * 60 * 60 * 1000 && time <= Date.now();
      })
      .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));

    const history: Sep38RateHistory = { pair: pairParam, points, source: "indexer" };
    return NextResponse.json(history, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to reach the SEP-38 indexer" },
      { status: 502 },
    );
  }
}