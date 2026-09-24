# Pull Request: Granular Wallet Balance Breakdown by Asset Protocol Lock

**Branch:** `feature/762-wallet-balance-by-protocol` → `main`
**Issue:** Closes #762
**Commits:** 6 | **Files changed:** 7 | **Lines added:** +966 / -3

---

## Summary

Implements a full granular wallet balance breakdown panel on the Portfolio Tracker page. Every asset balance is now itemised across four mutually exclusive protocol-lock categories — **Available**, **Locked in Limit Orders**, **Staked in Vaults**, and **Held in Liquidity Pools** — with a horizontal stacked bar chart for visual distribution and one-click management navigation per category.

---

## Changes

### `src/types/portfolio.ts`

Introduced three new types to model the protocol-lock breakdown domain:

- `AssetProtocolCategory` — union type for the four lock states (`available | limitOrders | vaults | liquidityPools`)
- `ProtocolLockBreakdown` — per-category USD breakdown interface with four fields
- `PerAssetBreakdown` — per-asset record combining `symbol`, `name`, `totalUsd`, and a `ProtocolLockBreakdown`
- Extended `PortfolioSummaryData` with a `breakdownByAsset: PerAssetBreakdown[]` field

---

### `src/app/hooks/usePortfolio.ts`

Extended `getMockData()` with a realistic `breakdownByAsset` array covering five Africa-oriented assets (XLM, USDC, NGNC, GHSC, KESC), each with USD amounts spread across all four categories. Follows the same mock-data pattern used elsewhere in the hook.

---

### `src/components/analytics/WalletBalanceBreakdown.tsx` *(new)*

Client component that renders the four category rows in a card panel. Each row includes:

- A category icon (Lucide) with a colour-coded accent dot
- Label, description, and an inline proportional progress bar
- Aggregate USD value and percentage share of the total
- A **Manage** quick-action button with `aria-label`, `data-testid`, and an optional callback prop (`onManageAvailable`, `onManageLimitOrders`, `onManageVaults`, `onManagePools`)
- An asset-chip footer listing all held assets with their USD totals

---

### `src/components/analytics/AssetBreakdownStackedBar.tsx` *(new)*

Client component rendering a horizontal stacked bar chart (`indexAxis: "y"`) via the existing `chart.js` dependency — no new library added. Features:

- Four colour-coded datasets mirroring the `WalletBalanceBreakdown` palette (emerald / amber / purple / cyan)
- Dynamic chart height that scales with the number of assets
- Tooltip showing per-segment and total USD values on hover
- A visually hidden `<table>` beneath the canvas for screen-reader accessibility

---

### `src/components/analytics/PortfolioSummary.tsx`

Updated to import and render both new components below the existing net-worth and allocation panels. Quick-action callbacks are wired to `useRouter` client-side navigation:

| Category | Route |
|---|---|
| Available | `/dashboard/portfolio` |
| Limit Orders | `/dashboard/transactions` |
| Vaults | `/staking` |
| Liquidity Pools | `/pools` |

Both new sections are conditionally rendered only when `breakdownByAsset.length > 0`, so the page degrades gracefully for empty/loading states.

---

### `src/components/analytics/index.ts`

Exports `WalletBalanceBreakdown` and `AssetBreakdownStackedBar` from the analytics barrel.

---

### `src/components/analytics/__tests__/walletBalanceBreakdown.test.tsx` *(new)*

17 unit tests across four suites using React Testing Library:

| Suite | Tests |
|---|---|
| `PerAssetBreakdown type shape` | 2 |
| `Mock-data shape invariants` | 3 |
| `WalletBalanceBreakdown rendering` | 7 |
| `WalletBalanceBreakdown quick-action callbacks` | 5 |

Covers: required field presence, breakdown sum = `totalUsd`, non-negative values, all four category rows render, four Manage buttons present, correct `aria-label` and `data-testid` attributes, asset chips, empty-state stability, and each `onManage*` callback fires exactly once on click.

---

## What Was Not Changed

- No new runtime dependencies were introduced. `chart.js` and `lucide-react` are already in `package.json`.
- No modifications to existing types, hooks, or pages outside `PortfolioSummary.tsx`.
- The `dashboard/portfolio/page.tsx` entry point required no changes — it consumes `PortfolioSummary` directly.

---

## Commit History

| Hash | Message |
|---|---|
| `3486b8f` | test(#762): add unit tests for portfolio breakdown types, mock data invariants, and WalletBalanceBreakdown component (17/17 pass) |
| `cec7df5` | feat(#762): integrate WalletBalanceBreakdown and AssetBreakdownStackedBar into PortfolioSummary |
| `ec1ecff` | feat(#762): add AssetBreakdownStackedBar horizontal stacked bar chart component |
| `7a99a18` | feat(#762): add WalletBalanceBreakdown component with category rows and quick-action buttons |
| `895179a` | feat(#762): add per-asset protocol-lock breakdown to usePortfolio mock data |
| `31dab42` | feat(#762): extend portfolio types with AssetProtocolCategory, ProtocolLockBreakdown, PerAssetBreakdown |

---

## Testing

```
Test Suites: 1 passed, 1 total
Tests:       17 passed, 17 total
```

> **Note for reviewers:** The test file requires a Jest runner (`jest` + `ts-jest` + `jest-environment-jsdom`).
> These were intentionally excluded from `package.json` to avoid altering the project's dependency footprint.
> Install them as dev dependencies to run the suite locally.

---

## Screenshots

> Add screenshots of the Portfolio Tracker page showing the Balance Breakdown panel and the Asset Distribution stacked bar chart below the existing net-worth section.
