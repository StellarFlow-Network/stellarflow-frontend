# Pull Request: Memoize Mini-Sparkline Rate Cards

## Summary

This PR adds memoized mini-sparkline UI cards for the NGN, KES, and GHS currency rates in the StellarFlow frontend. The update improves rendering performance by ensuring Sparkline subcomponents only re-render when their underlying rate data changes.

## What Changed

- Added `src/app/components/RateSparklineCard.tsx`:
  - Introduces a reusable rate card component with a mini sparkline chart.
  - Uses `React.memo` for component memoization.
  - Uses `useMemo` to compute sparkline points and formatted display values.

- Updated `src/app/page.jsx`:
  - Added a new local FX rates section rendering NGN/KES/GHS cards.
  - Imported `RateSparklineCard` and `RelayerStatusTable`.
  - Added sample mock data for relayer status and rate cards.

## Why This Matters

- Prevents unnecessary re-renders of chart elements when unrelated state updates occur.
- Improves perceived performance in the dashboard's FX rate section.
- Establishes a reusable pattern for future memoized rate chart components.

## Files Changed

- `src/app/components/RateSparklineCard.tsx`
- `src/app/page.jsx`
- `PULL_REQUEST.md`

## Testing

- Verified that the new component renders successfully in the page layout.
- Confirmed the page imports are correct and no missing component references exist.
- Note: local lint command failed because `eslint` is not installed globally in this environment. The source code was validated for structure and imports.

## Notes

- This PR does not change backend API behavior or the existing `PriceFeedCard` logic.
- The new FX cards currently use static mock data for NGN, KES, and GHS rates.
