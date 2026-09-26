# Liquidity Concentration Heatmap

## Data contract

Each point must include:
- `tickIndex`
- `lowerPrice`
- `upperPrice`
- `liquidity`

The component sorts points by tick index and downsamples only the visual rendering set. Tooltip values come from the original point selected for the rendered target.

## Integration requirements

- Connect to the canonical AMM pool tick-array update source.
- Confirm token decimal normalization and price orientation.
- Avoid converting large liquidity integers to JavaScript `number` if exact arithmetic is required by the domain. Use a formatting/scale adapter for production precision.
- Add Playwright tests for hover, focus, active marker updates, and high-density datasets.
- Validate chart performance using representative pool tick-array sizes.
- Confirm the existing theme token names and replace fallback variables as needed.

## Acceptance validation

- High-density tick arrays render without unacceptable frame drops.
- Active tick marker updates when the pool state changes.
- Tooltip displays exact price bounds and liquidity values.
- Empty and malformed datasets are handled safely.
