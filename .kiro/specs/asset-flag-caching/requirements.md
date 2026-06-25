# Requirements Document

## Introduction

StellarFlow's frontend displays West African regional token pairs (NGN/XLM, KES/XLM, GHS/XLM, USD/NGN, XLM/KES, NGN/GHS) across multiple components: the dashboard's `RateSparklineCard`, the Corridors Monitor page, and the `PriceFeedCard`. These components need country flag icons to visually identify regional assets. Currently no flag icons exist anywhere in the codebase — they are loaded from an external CDN at runtime, causing connection layout waterfalls and visual stutters during page load.

This feature introduces:
1. Locally hosted flag icon assets (SVG or WebP) under `/public/assets/flags/`
2. A centralized flag asset registry (`assetFlags.ts`) that maps currency codes to local image paths
3. Updated `assetSymbols.ts` with the complete set of currency codes used across all corridor pairs
4. A `CurrencyFlag` component backed by `OptimizedImage` with explicit dimensions and blur placeholders
5. Integration of `CurrencyFlag` into `RateSparklineCard`, `PriceFeedCard`, and the Corridors Monitor rows

---

## Glossary

- **Flag_Registry**: The `assetFlags.ts` config module that maps currency codes to local flag asset paths
- **Currency_Code**: A 3-letter ISO 4217 identifier (e.g., `NGN`, `KES`, `GHS`, `USD`, `EUR`, `XLM`)
- **Asset_Pair**: A trading pair composed of two Currency_Codes separated by a slash (e.g., `NGN/XLM`)
- **CurrencyFlag**: The React component that renders a single country/asset flag using `OptimizedImage`
- **Flag_Asset**: An SVG or WebP image file stored under `/public/assets/flags/` representing a Currency_Code
- **OptimizedImage**: The existing `src/app/components/OptimizedImage.tsx` wrapper around Next.js `<Image>`
- **Asset_Symbol_Registry**: The `assetSymbols.ts` config module — the single source of truth for asset pair identifiers
- **RateSparklineCard**: The dashboard card component displaying a currency's rate and trend sparkline
- **PriceFeedCard**: The dashboard card displaying the live NGN/XLM oracle price feed
- **Corridors_Page**: The `src/app/dashboard/corridors/page.tsx` page listing cross-border exchange corridor metrics
- **Blur_Placeholder**: The `placeholder="blur"` prop on Next.js `<Image>` that renders a blurred preview while the image loads; requires a `blurDataURL`
- **CDN**: Content Delivery Network — an external image host such as `flagcdn.com`

---

## Requirements

### Requirement 1: Local Flag Asset Storage

**User Story:** As a frontend engineer, I want all flag icon files stored locally under `/public/assets/flags/`, so that the application never issues external CDN requests for flag images and eliminates layout shift caused by remote asset waterfalls.

#### Acceptance Criteria

1. THE Flag_Registry SHALL define Flag_Asset entries for the following Currency_Codes: `NGN`, `KES`, `GHS`, `USD`, `EUR`, `XLM`.
2. WHEN the application is built, THE Flag_Asset files for all six Currency_Codes SHALL be present under `/public/assets/flags/` with filenames in the pattern `{lowercase-code}.svg` or `{lowercase-code}.webp` (e.g., `ngn.svg`, `kes.webp`), with exactly one file per Currency_Code.
3. THE Flag_Registry SHALL store each Flag_Asset path as a root-relative string beginning with `/assets/flags/` so that Next.js serves them as static files with no external network request.
4. IF a Currency_Code is looked up in the Flag_Registry and no Flag_Asset entry exists, THEN THE Flag_Registry SHALL return a `null` value rather than throwing an error.

---

### Requirement 2: Centralized Flag Asset Registry

**User Story:** As a frontend engineer, I want a single `assetFlags.ts` config file that maps every Currency_Code to its local Flag_Asset path, so that all flag usages across the codebase share one source of truth and can be updated in one place.

#### Acceptance Criteria

1. THE Flag_Registry SHALL export an `ASSET_FLAGS` constant typed as `Record<CurrencyCode, string | null>` with exactly the following keys: `NGN`, `USD`, `EUR`, `KES`, `GHS`, `XLM`, each mapped to a path of the form `/assets/flags/<lowercase-code>.svg` or `/assets/flags/<lowercase-code>.webp`.
2. THE Flag_Registry SHALL export a `CurrencyCode` union type derived from `keyof typeof ASSET_FLAGS`, ensuring compile-time exhaustiveness across all six supported codes.
3. THE Flag_Registry SHALL export a `getFlag(code: string): string | null` function. WHEN `getFlag` is called with a non-empty string that matches a Currency_Code after uppercasing, THE Flag_Registry SHALL return the corresponding Flag_Asset path.
4. IF `getFlag` is called with an empty string or a string that does not match any Currency_Code after uppercasing, THEN THE Flag_Registry SHALL return `null` without throwing an error.
5. WHEN `getFlag` is called with a Currency_Code in any casing (e.g., `"ngn"`, `"NGN"`, `"Ngn"`), THE Flag_Registry SHALL normalize the input to uppercase before performing the lookup and return the same Flag_Asset path in all cases.
6. THE Asset_Symbol_Registry (`assetSymbols.ts`) SHALL be updated to include the additional pairs `KES_XLM`, `GHS_XLM`, `USD_NGN`, `XLM_KES`, and `NGN_GHS`, and each new pair SHALL have a corresponding entry in both `ASSET_BASE_PRICES` and `ASSET_DECIMALS` to prevent silent map incompleteness.

---

### Requirement 3: CurrencyFlag Component

**User Story:** As a UI developer, I want a `CurrencyFlag` React component that renders a flag icon for a given Currency_Code using the local Flag_Asset, so that flags are displayed with zero layout shift and no CDN dependency.

#### Acceptance Criteria

1. THE CurrencyFlag SHALL accept a required `code` prop of type `string` and optional `size` prop of type `number` with a default value of `20` and a minimum valid value of `1`.
2. WHEN `code` resolves to a non-null Flag_Asset path in the Flag_Registry, THE CurrencyFlag SHALL render an `OptimizedImage` with the Flag_Asset `src`, explicit `width` equal to `size`, explicit `height` equal to `size`, and `alt` equal to `"${code.toUpperCase()} flag"`.
3. WHEN `code` resolves to a non-null Flag_Asset path and the Flag_Asset is a WebP file, THE CurrencyFlag SHALL pass `placeholder="blur"` and a `blurDataURL` sourced from the Flag_Registry's companion blur data map to `OptimizedImage` to prevent layout shift during image decode.
4. WHEN `code` resolves to a non-null Flag_Asset path and the Flag_Asset is an SVG file, THE CurrencyFlag SHALL pass `placeholder="empty"` to `OptimizedImage` because SVGs do not support blur placeholders.
5. WHEN `code` resolves to `null` (unknown Currency_Code), THE CurrencyFlag SHALL render a `<span>` displaying `code.toUpperCase()` with `font-size` and `line-height` inherited from the parent element, and SHALL NOT render any `<img>` or `<Image>` element.
6. THE CurrencyFlag SHALL be wrapped in `React.memo` so that it does not re-render when its parent re-renders with identical `code`, `size`, and `className` prop values.
7. THE CurrencyFlag SHALL accept an optional `className` prop of type `string` and forward it to the rendered `OptimizedImage` or fallback `<span>`.

---

### Requirement 4: RateSparklineCard Flag Integration

**User Story:** As a dashboard user, I want to see a flag icon next to each currency label in the `RateSparklineCard`, so that I can visually identify the regional asset at a glance without reading the text code.

#### Acceptance Criteria

1. WHEN `RateSparklineCard` renders with a `currency` prop, THE RateSparklineCard SHALL display a `CurrencyFlag` with the `currency` value as the `code` prop at `size={20}`, placed immediately before the currency label text in the same flex row, separated by a `gap` of `0.5rem` (`gap-2`).
2. WHILE `RateSparklineCard` is in the loading state (`loading={true}`), THE RateSparklineCard SHALL return the shimmer skeleton layout without including any `CurrencyFlag` element in the rendered output.
3. IF the `CurrencyFlag` within `RateSparklineCard` renders the fallback `<span>` (because the currency code is not in the Flag_Registry), THEN THE RateSparklineCard SHALL NOT apply any additional layout styles that would cause the currency row to overflow or shift compared to a row that renders a flag image.

---

### Requirement 5: PriceFeedCard Flag Integration

**User Story:** As a dashboard user, I want to see flag icons for NGN and XLM in the `PriceFeedCard` header, so that the asset pair is immediately recognizable at a glance.

#### Acceptance Criteria

1. WHEN `PriceFeedCard` renders its pair label, THE PriceFeedCard SHALL display a `CurrencyFlag` with `code="NGN"` at `size={16}` immediately before the "NGN" text, followed by the pair separator, followed by a `CurrencyFlag` with `code="XLM"` at `size={16}` immediately before the "XLM" text, all within the same flex row in the header.
2. WHILE `PriceFeedCard` has not yet mounted (server render or skeleton phase where `mounted === false`), THE PriceFeedCard SHALL NOT render any `CurrencyFlag` component in the header row.
3. WHILE `PriceFeedCard` is in the post-mount loading state (`loading === true` and `mounted === true`), THE PriceFeedCard SHALL NOT render any `CurrencyFlag` component to avoid layout shift during the shimmer phase.
4. WHEN `CurrencyFlag` is rendered with `code="XLM"`, THE CurrencyFlag SHALL render an `OptimizedImage` whose `src` resolves to a path under `/assets/flags/` and whose `alt` attribute equals `"XLM flag"`, using the same rendering branch as any other known Currency_Code.

---

### Requirement 6: Corridors Page Flag Integration

**User Story:** As an operations user, I want to see flag icons for both currencies in each corridor row on the Corridors Monitor page, so that I can quickly distinguish corridor pairs by their regional flags instead of text alone.

#### Acceptance Criteria

1. WHEN the Corridors_Page renders each row in the corridor table, THE Corridors_Page SHALL display two `CurrencyFlag` components per row — one for the first Currency_Code and one for the second Currency_Code — each at `size={18}`, placed within the "Asset Pairing" cell in a flex row before the pair text.
2. THE Corridors_Page SHALL derive the two Currency_Codes for each row by splitting the `pair` string on the delimiter ` / ` (one space, one forward slash, one space) and trimming any remaining whitespace from each resulting segment.
3. IF the split of a `pair` string yields fewer than two non-empty segments, THEN THE Corridors_Page SHALL render zero `CurrencyFlag` components for that row and SHALL continue rendering the pair text unchanged.
4. WHEN a `pair` string contains a Currency_Code that resolves to `null` in the Flag_Registry, THE Corridors_Page SHALL render the `CurrencyFlag` fallback `<span>` for that code without interrupting the rendering of the other `CurrencyFlag` in the same row.
5. THE Corridors_Page SHALL NOT add any new external image domain to `next.config.ts`; all Flag_Asset paths SHALL be served as Next.js static files from `/public/assets/flags/`.

---

### Requirement 7: Next.js Image Configuration Compatibility

**User Story:** As a frontend engineer, I want the flag images to work within the existing Next.js `<Image>` configuration without requiring new remote domain allowlists, so that the security posture of the image configuration is not weakened.

#### Acceptance Criteria

1. THE Flag_Registry SHALL only produce path strings that begin with `/assets/flags/`, ensuring Next.js serves them as static files from the `public` directory with no `remotePatterns` or `domains` entries required in `next.config.ts`.
2. WHEN `OptimizedImage` renders a Flag_Asset with `placeholder="blur"`, THE CurrencyFlag SHALL supply a `blurDataURL` that is a Base64-encoded data URI of no more than 1,500 bytes with a prefix of either `data:image/webp;base64,` or `data:image/png;base64,`.
3. THE `next.config.ts` `images` configuration block SHALL remain unchanged by this feature; specifically, the `imageSizes`, `deviceSizes`, `formats`, `remotePatterns`, and `domains` fields SHALL NOT be modified.
