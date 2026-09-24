import type { IconId } from "@/components/icons/iconIds";
import { ASSET_SYMBOL_LIST } from "@/config/assetSymbols";

/**
 * Command registry for the Command+K action palette.
 *
 * Three categories of commands are indexed for fuzzy search:
 *  1. `navigate`  — jump to a page.
 *  2. `asset`     — jump to an asset-pair workspace.
 *  3. `action`    — execute an in-app action (theme, wallet, etc.).
 */

export type CommandKind = "navigate" | "asset" | "action";

export interface Command {
  id: string;
  kind: CommandKind;
  label: string;
  keywords: string[];
  /** Route to navigate to (navigate/asset only). */
  href?: string;
  /** Optional runtime handler. Takes precedence over `href`. */
  run?: () => void;
  iconId?: IconId;
}

type CommandRegistry = {
  navigate: Command[];
  asset: Command[];
  action: Command[];
};

export const COMMANDS: CommandRegistry = {
  navigate: [
    { id: "nav-dashboard", kind: "navigate", label: "Dashboard", href: "/", iconId: undefined, keywords: ["home", "overview"] },
    { id: "nav-contracts", kind: "navigate", label: "Contracts", href: "/contracts", keywords: ["soroban", "smart", "rpc"] },
    { id: "nav-analytics", kind: "navigate", label: "Analytics", href: "/analytics", keywords: ["charts", "metrics", "stats"] },
    { id: "nav-governance", kind: "navigate", label: "Governance", href: "/governance", keywords: ["proposals", "voting", "sfp"] },
    { id: "nav-multisig", kind: "navigate", label: "Multi-signature", href: "/multisig", keywords: ["msig", "approvals", "signatures"] },
    { id: "nav-settings", kind: "navigate", label: "Settings", href: "/settings", keywords: ["preferences", "config"] },
    { id: "nav-admin", kind: "navigate", label: "Admin Settings", href: "/admin/settings", keywords: ["admin", "manage"] },
    { id: "nav-relayers", kind: "navigate", label: "Relayers", href: "/relayers", keywords: ["nodes", "oracle", "network"] },
    { id: "nav-logs", kind: "navigate", label: "Logs", href: "/logs", keywords: ["audit", "events", "stream"] },
    { id: "nav-dashboard-corridors", kind: "navigate", label: "Corridor Monitor", href: "/dashboard/corridors", keywords: ["liquidity", "spread", "orderbook", "depth"] },
    { id: "nav-dashboard-portfolio", kind: "navigate", label: "Portfolio", href: "/dashboard/portfolio", keywords: ["balances", "positions", "holdings"] },
    { id: "nav-dashboard-transactions", kind: "navigate", label: "Transactions", href: "/dashboard/transactions", keywords: ["history", "tx", "payments"] },
    { id: "nav-dashboard-validators", kind: "navigate", label: "Validators", href: "/dashboard/validators", keywords: ["staking", "nodes", "consensus"] },
    { id: "nav-vaults", kind: "navigate", label: "Vaults", href: "/vaults", keywords: ["yield", "harvest", "treasury"] },
    { id: "nav-staking", kind: "navigate", label: "Staking", href: "/staking", keywords: ["earn", "rewards", "delegate"] },
    { id: "nav-consumers", kind: "navigate", label: "Consumers", href: "/consumers", keywords: ["subscribers", "integrations", "api"] },
    { id: "nav-security-approvals", kind: "navigate", label: "Security Approvals", href: "/security/approvals", keywords: ["audit", "compliance", "review"] },
    { id: "nav-docs", kind: "navigate", label: "Documentation", href: "/docs", keywords: ["guide", "api", "reference", "sdk"] },
    { id: "nav-diagnostics", kind: "navigate", label: "Diagnostics", href: "/diagnostics", keywords: ["health", "checks", "system"] },
    { id: "nav-remittance", kind: "navigate", label: "Cross-border Remittance", href: "/remittance", keywords: ["send", "africa", "payment", "transfer"] },
    { id: "nav-pools", kind: "navigate", label: "Liquidity Pools", href: "/pools/1", keywords: ["swap", "amm", "provide"] },
  ],
  asset: ASSET_SYMBOL_LIST.map((symbol) => {
    const [base, quote] = symbol.split("-");
    return {
      id: `asset-${symbol.toLowerCase()}`,
      kind: "asset" as const,
      label: `${base} / ${quote} Asset Pair`,
      href: "/dashboard/corridors",
      keywords: [symbol, base, quote, `${base}/${quote}`, "pair", "rate", "price"],
    };
  }),
  action: [
    {
      id: "action-theme",
      kind: "action",
      label: "Toggle theme",
      keywords: ["dark", "light", "appearance", "mode"],
    },
    {
      id: "action-command-palette",
      kind: "action",
      label: "Open command palette",
      keywords: ["cmd", "ctrl", "palette", "search"],
    },
  ],
};

/** Flattened, ordered list of every command for indexing. */
export const ALL_COMMANDS: Command[] = [
  ...COMMANDS.navigate,
  ...COMMANDS.asset,
  ...COMMANDS.action,
];

export const COMMAND_GROUPS: { key: CommandKind; title: string }[] = [
  { key: "navigate", title: "Navigate" },
  { key: "asset", title: "Asset pairs" },
  { key: "action", title: "Actions" },
];
