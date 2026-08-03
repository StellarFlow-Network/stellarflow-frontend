/**
 * Command palette registry and fuzzy index.
 *
 * Holds the static searchable surface of the app (routes, documentation) plus
 * the adapters that fold live data — liquidity pools, tokens — into the same
 * `CommandItem` shape so one fuzzy index covers every source.
 *
 * Fuse tuning mirrors the log search worker (`src/app/logs/search-worker.ts`):
 * threshold 0.3 with `ignoreLocation` so a match anywhere in a short label
 * counts, which is what makes "val" find "Validators".
 */

import Fuse from "fuse.js";
import type { FuseResultMatch, IFuseOptions } from "fuse.js";
import { ICON_IDS, type IconId } from "@/components/icons/iconIds";
import { ASSET_SYMBOL_LIST } from "@/config/assetSymbols";

export type CommandKind = "page" | "pool" | "token" | "action" | "doc";

export interface CommandItem {
  /** Stable identity, also used as the DOM id for `aria-activedescendant` */
  id: string;
  kind: CommandKind;
  title: string;
  subtitle?: string;
  /**
   * Extra terms folded into the index but not displayed — asset symbols,
   * contract addresses, and the synonyms people actually type ("swap" for the
   * corridors page).
   */
  keywords?: string[];
  iconId: IconId;
  /** Route or URL to navigate to; ignored when `run` is present */
  href?: string;
  /** True when `href` leaves the app and should open in a new tab */
  external?: boolean;
  /** Executed instead of navigating */
  run?: () => void | Promise<void>;
  /** Shown right-aligned on the row, e.g. a pool's TVL */
  meta?: string;
}

/** Order groups appear in the palette. */
export const GROUP_ORDER: readonly CommandKind[] = [
  "action",
  "page",
  "pool",
  "token",
  "doc",
];

export const GROUP_LABELS: Record<CommandKind, string> = {
  action: "Actions",
  page: "Pages",
  pool: "Liquidity Pools",
  token: "Tokens",
  doc: "Documentation",
};

// ─────────────────────────────────────────────────────────────────────────────
// Static sources
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Every route that resolves to a real page in `src/app`.
 *
 * Deliberately excludes `/analytics`, which the sidebars link to but which has
 * no `page.tsx` — surfacing it here would just hand users a 404. Dynamic routes
 * such as `/proposals/[id]/history` are omitted because they need an id the
 * palette does not have.
 */
export const NAVIGATION_COMMANDS: readonly CommandItem[] = [
  {
    id: "page:dashboard",
    kind: "page",
    title: "Dashboard",
    subtitle: "/",
    keywords: ["home", "overview", "stats", "metrics"],
    iconId: ICON_IDS.layoutDashboard,
    href: "/",
  },
  {
    id: "page:contracts",
    kind: "page",
    title: "Contracts",
    subtitle: "/contracts",
    keywords: ["soroban", "deploy", "wasm", "invoke"],
    iconId: ICON_IDS.database,
    href: "/contracts",
  },
  {
    id: "page:corridors",
    kind: "page",
    title: "Corridors",
    subtitle: "/dashboard/corridors",
    keywords: ["spread", "swap", "routes", "pairs", "liquidity"],
    iconId: ICON_IDS.network,
    href: "/dashboard/corridors",
  },
  {
    id: "page:validators",
    kind: "page",
    title: "Validators",
    subtitle: "/dashboard/validators",
    keywords: ["nodes", "quorum", "heartbeat", "uptime", "audit"],
    iconId: ICON_IDS.shieldCheck,
    href: "/dashboard/validators",
  },
  {
    id: "page:staking",
    kind: "page",
    title: "Staking",
    subtitle: "/staking",
    keywords: ["bond", "delegate", "rewards", "allocation", "farms"],
    iconId: ICON_IDS.coins,
    href: "/staking",
  },
  {
    id: "page:governance",
    kind: "page",
    title: "Governance",
    subtitle: "/governance",
    keywords: ["proposals", "vote", "quorum", "ballot"],
    iconId: ICON_IDS.gavel,
    href: "/governance",
  },
  {
    id: "page:relayers",
    kind: "page",
    title: "Relayers",
    subtitle: "/relayers",
    keywords: ["bridge", "oracle", "messages", "status"],
    iconId: ICON_IDS.radio,
    href: "/relayers",
  },
  {
    id: "page:consumers",
    kind: "page",
    title: "Consumers",
    subtitle: "/consumers",
    keywords: ["clients", "api keys", "usage", "quota"],
    iconId: ICON_IDS.users,
    href: "/consumers",
  },
  {
    id: "page:logs",
    kind: "page",
    title: "Logs",
    subtitle: "/logs",
    keywords: ["events", "audit trail", "xdr", "history", "search"],
    iconId: ICON_IDS.fileText,
    href: "/logs",
  },
  {
    id: "page:docs",
    kind: "page",
    title: "Docs",
    subtitle: "/docs",
    keywords: ["reference", "guide", "examples", "sdk", "api"],
    iconId: ICON_IDS.bookOpen,
    href: "/docs",
  },
  {
    id: "page:settings",
    kind: "page",
    title: "Settings",
    subtitle: "/settings",
    keywords: ["preferences", "profile", "notifications", "theme"],
    iconId: ICON_IDS.settings,
    href: "/settings",
  },
  {
    id: "page:admin",
    kind: "page",
    title: "Admin",
    subtitle: "/admin",
    keywords: ["operators", "management", "controls"],
    iconId: ICON_IDS.sliders,
    href: "/admin",
  },
  {
    id: "page:admin-settings",
    kind: "page",
    title: "Admin Settings",
    subtitle: "/admin/settings",
    keywords: ["network config", "thresholds", "operators"],
    iconId: ICON_IDS.shield,
    href: "/admin/settings",
  },
];

/**
 * Documentation targets.
 *
 * The in-app `/docs` page has no anchored sections to deep-link into, so the
 * remaining entries point at canonical upstream references rather than invented
 * fragment URLs that would land nowhere.
 */
export const DOC_COMMANDS: readonly CommandItem[] = [
  {
    id: "doc:in-app",
    kind: "doc",
    title: "Contract Integration Guide",
    subtitle: "In-app reference with Rust and JS samples",
    keywords: ["rust", "javascript", "snippet", "invoke", "example"],
    iconId: ICON_IDS.code2,
    href: "/docs",
  },
  {
    id: "doc:soroban",
    kind: "doc",
    title: "Soroban Smart Contracts",
    subtitle: "developers.stellar.org",
    keywords: ["soroban", "wasm", "rust", "contract", "host functions"],
    iconId: ICON_IDS.terminal,
    href: "https://developers.stellar.org/docs/build/smart-contracts/overview",
    external: true,
  },
  {
    id: "doc:horizon-api",
    kind: "doc",
    title: "Horizon API Reference",
    subtitle: "developers.stellar.org",
    keywords: ["horizon", "rest", "endpoints", "transactions", "accounts"],
    iconId: ICON_IDS.network,
    href: "https://developers.stellar.org/docs/data/apis/horizon",
    external: true,
  },
  {
    id: "doc:fees",
    kind: "doc",
    title: "Fees, Surge Pricing & Fee Strategies",
    subtitle: "developers.stellar.org",
    keywords: ["fee", "surge", "base fee", "stuck", "pending", "bump"],
    iconId: ICON_IDS.zap,
    href: "https://developers.stellar.org/docs/learn/fundamentals/fees-resource-limits-metering",
    external: true,
  },
];

/**
 * The oracle price feeds the app actually tracks, from the interned asset
 * registry, so asset search works without a caller having to supply data.
 *
 * These are feeds rather than tokens — the constituent assets are indexed as
 * keywords so "XLM" or "NGN" surfaces the pair that carries it.
 */
export const PRICE_FEED_COMMANDS: readonly CommandItem[] = ASSET_SYMBOL_LIST.map(
  (pair) => {
    const [base, quote] = pair.split("-");
    return {
      id: `token:feed:${pair}`,
      kind: "token" as const,
      title: pair,
      subtitle: "Oracle price feed",
      keywords: [base, quote, `${base}/${quote}`, "feed", "price", "oracle", "rate"],
      iconId: ICON_IDS.trendingUp,
      href: "/dashboard/corridors",
    };
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Live-data adapters
// ─────────────────────────────────────────────────────────────────────────────

export interface PoolSummary {
  /** Pool contract id or internal identifier */
  id: string;
  tokenASymbol: string;
  tokenBSymbol: string;
  /** Pre-formatted total value locked, e.g. "$1.24M" */
  tvl?: string;
  /** Pre-formatted APR, e.g. "12.4%" */
  apr?: string;
  /** Route to the pool detail view; falls back to the corridors page */
  href?: string;
}

export interface TokenSummary {
  symbol: string;
  name?: string;
  /** Soroban contract id or classic asset issuer */
  contractId?: string;
  issuer?: string;
  /** Pre-formatted spot price, e.g. "$0.114" */
  price?: string;
  href?: string;
}

/** Folds a liquidity pool into a searchable palette row. */
export function poolCommand(pool: PoolSummary): CommandItem {
  const pair = `${pool.tokenASymbol}/${pool.tokenBSymbol}`;
  return {
    id: `pool:${pool.id}`,
    kind: "pool",
    title: `${pair} Pool`,
    subtitle: pool.apr ? `APR ${pool.apr}` : "Liquidity pool",
    // Both orderings are indexed so "USDC XLM" finds an XLM/USDC pool.
    keywords: [
      pool.tokenASymbol,
      pool.tokenBSymbol,
      pair,
      `${pool.tokenBSymbol}/${pool.tokenASymbol}`,
      pool.id,
      "pool",
      "liquidity",
      "lp",
    ],
    iconId: ICON_IDS.layers,
    href: pool.href ?? "/dashboard/corridors",
    meta: pool.tvl,
  };
}

/** Folds a token into a searchable palette row. */
export function tokenCommand(token: TokenSummary): CommandItem {
  const identifier = token.contractId ?? token.issuer;
  return {
    id: `token:${token.symbol}:${identifier ?? "native"}`,
    kind: "token",
    title: token.symbol,
    subtitle: token.name ?? identifier ?? "Asset",
    keywords: [
      token.symbol,
      token.name ?? "",
      identifier ?? "",
      "token",
      "asset",
    ].filter(Boolean),
    iconId: ICON_IDS.coins,
    href: token.href ?? "/dashboard/corridors",
    meta: token.price,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Fuzzy index
// ─────────────────────────────────────────────────────────────────────────────

export interface CommandResult {
  item: CommandItem;
  matches?: readonly FuseResultMatch[];
}

const FUSE_OPTIONS: IFuseOptions<CommandItem> = {
  // Titles outrank subtitles, which outrank the invisible synonym list, so an
  // exact page name never loses to a pool that merely mentions it in keywords.
  keys: [
    { name: "title", weight: 0.6 },
    { name: "subtitle", weight: 0.25 },
    { name: "keywords", weight: 0.15 },
  ],
  threshold: 0.3,
  distance: 100,
  ignoreLocation: true,
  includeMatches: true,
  includeScore: true,
  minMatchCharLength: 1,
};

export function createCommandIndex(items: CommandItem[]): Fuse<CommandItem> {
  return new Fuse(items, FUSE_OPTIONS);
}

/**
 * Runs the query against the index, or returns the unfiltered list when the
 * query is empty so an untouched palette still shows every entry point.
 */
export function searchCommands(
  index: Fuse<CommandItem>,
  items: CommandItem[],
  query: string,
  limit = 40,
): CommandResult[] {
  const trimmed = query.trim();

  if (!trimmed) {
    return items.slice(0, limit).map((item) => ({ item }));
  }

  return index
    .search(trimmed, { limit })
    .map(({ item, matches }) => ({ item, matches }));
}

/** Groups results by kind while preserving relevance order inside each group. */
export function groupResults(
  results: CommandResult[],
): { kind: CommandKind; results: CommandResult[] }[] {
  const buckets = new Map<CommandKind, CommandResult[]>();

  for (const result of results) {
    const bucket = buckets.get(result.item.kind);
    if (bucket) {
      bucket.push(result);
    } else {
      buckets.set(result.item.kind, [result]);
    }
  }

  return GROUP_ORDER.filter((kind) => buckets.has(kind)).map((kind) => ({
    kind,
    results: buckets.get(kind) as CommandResult[],
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Match highlighting
// ─────────────────────────────────────────────────────────────────────────────

export interface TitleSegment {
  text: string;
  matched: boolean;
}

/**
 * Splits a result's title into matched and unmatched runs so the UI can
 * emphasise exactly the characters Fuse scored against.
 *
 * Only the `title` key is highlighted — subtitle and keyword matches are what
 * surfaced the row, but marking them up adds noise to a dense list.
 */
export function titleSegments(result: CommandResult): TitleSegment[] {
  const title = result.item.title;
  const match = result.matches?.find((m) => m.key === "title");

  if (!match?.indices.length) {
    return [{ text: title, matched: false }];
  }

  // Fuse emits inclusive [start, end] pairs; merge touching ranges so adjacent
  // hits render as one highlighted run rather than several.
  const ranges = [...match.indices]
    .map(([start, end]) => [start, end] as [number, number])
    .sort((a, b) => a[0] - b[0])
    .reduce<[number, number][]>((merged, range) => {
      const last = merged[merged.length - 1];
      if (last && range[0] <= last[1] + 1) {
        last[1] = Math.max(last[1], range[1]);
        return merged;
      }
      merged.push(range);
      return merged;
    }, []);

  const segments: TitleSegment[] = [];
  let cursor = 0;

  for (const [start, end] of ranges) {
    if (start > cursor) {
      segments.push({ text: title.slice(cursor, start), matched: false });
    }
    segments.push({ text: title.slice(start, end + 1), matched: true });
    cursor = end + 1;
  }

  if (cursor < title.length) {
    segments.push({ text: title.slice(cursor), matched: false });
  }

  return segments;
}
