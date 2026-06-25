# Bundle Optimization Setup Guide

This guide explains how to set up and use the automated bundle size optimization protocols.

## Installation

### 1. Install Dependencies

The `@next/bundle-analyzer` package has already been added to `package.json`. Install it:

```bash
npm install
```

### 2. Verify Installation

Confirm the bundle analyzer is installed:

```bash
npm ls @next/bundle-analyzer
```

## Quick Start

### Build & Check Bundle Size

```bash
npm run build
```

This will:
1. Build the Next.js project
2. Analyze all generated bundles
3. Check against size limits in `.bundle-limits.json`
4. Generate a detailed report in `.bundle-report.json`
5. Display results in the terminal

### Analyze Bundle Contents (Interactive)

```bash
ANALYZE=true npm run build
```

This generates interactive HTML visualizations showing:
- Which packages take up the most space
- Unused/duplicate dependencies
- Opportunities for optimization

**The visualization opens automatically in your browser at `.next/analyze/`**

### Strict Build (Fails if Thresholds Exceeded)

```bash
npm run build:strict
```

Use this in production CI/CD pipelines. The build will fail if any bundle exceeds size limits.

## Configuration

### Adjusting Size Limits

Edit `.bundle-limits.json` to change thresholds:

```json
{
  "maxMainBundle": 250,         // Main JS chunk limit (gzipped, KB)
  "maxPageBundle": 100,         // Per-page chunk limit (gzipped, KB)
  "maxTotalGzipped": 500,       // Total all bundles (gzipped, KB)
  "maxIndividualGzipped": 150   // Hard limit per bundle (gzipped, KB)
}
```

**Guidelines:**
- **Keep limits strict** during development to catch bloat early
- **250KB main bundle** is a good baseline for SPA/Next.js projects
- **500KB total** is a reasonable overall limit
- Adjust only after measuring actual project needs

### Creating a Baseline Report

To track bundle size changes over time:

```bash
npm run build
cp .bundle-report.json .bundle-report.baseline.json
```

Then after making changes:
```bash
npm run build
# Compare totalGzipped in the new report vs baseline
cat .bundle-report.json | jq '.totalGzipped'
cat .bundle-report.baseline.json | jq '.totalGzipped'
```

## CI/CD Integration

### GitHub Actions

The repository includes `.github/workflows/bundle-check.yml` which automatically:

✅ Runs on every push to `main` and `develop` branches
✅ Runs on all pull requests
✅ Blocks merges if bundle sizes exceed limits
✅ Posts bundle report as a PR comment
✅ Updates the job summary

**No additional setup required!** Just push to GitHub and the checks run automatically.

### Local Pre-commit Hook (Optional)

To warn about bundle size changes before committing:

```bash
# Install the pre-commit hook
cp scripts/pre-commit-bundle-check.js .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit

# Create baseline
npm run build
cp .bundle-report.json .bundle-report.baseline.json
```

Now, each commit will analyze bundle changes and warn if the bundle grew significantly.

## Understanding Reports

### Terminal Report Example

```
============================================================
📦 Bundle Size Analysis Report
============================================================

📋 Configuration:
  • Max main bundle: 250KB (gzipped)
  • Max page bundle: 100KB (gzipped)
  • Max individual: 150KB (gzipped)
  • Max total: 500KB (gzipped)

📊 Bundle Breakdown:
  ✅ main-abc123.js
     └─ 180.45KB raw | 45.2KB gzipped
  ✅ pages-def456.js
     └─ 92.30KB raw | 28.1KB gzipped

📈 Total (gzipped): 75.5KB

✅ All bundles are within size limits!
```

**What to look for:**
- ⚠️ warnings indicate violations
- ✅ means bundle is OK
- Total (gzipped) is what users actually download
- Raw size is before compression

### JSON Report (.bundle-report.json)

```json
{
  "timestamp": "2026-06-01T10:30:00.000Z",
  "limits": { ... },
  "bundles": [
    {
      "name": "main-abc123.js",
      "size": 180.45,
      "gzipped": 45.2,
      "exceeds": []
    }
  ],
  "totalGzipped": 75.5,
  "violations": [],
  "passed": true
}
```

## Troubleshooting

### Bundle exceeds limits

**Find what's bloating it:**
```bash
ANALYZE=true npm run build
```
Then open `.next/analyze/` in your browser to see the breakdown.

**Common causes:**
- Large heavy dependencies
- Missing code splitting
- Duplicate/unused code
- Non-tree-shakeable imports

### Build fails unexpectedly

Clear the cache and rebuild:
```bash
rm -rf .next node_modules
npm install
npm run build
```

### High memory during build

Increase Node memory:
```bash
NODE_OPTIONS="--max-old-space-size=4096" npm run build
```

### GitHub Actions workflow not running

Check that `.github/workflows/bundle-check.yml` exists and is properly formatted (YAML).

## Optimization Tips

### 1. Code Splitting

```typescript
// Use dynamic imports for page-level components
import dynamic from 'next/dynamic';

const Dashboard = dynamic(() => import('./Dashboard'), {
  loading: () => <LoadingSpinner />
});
```

### 2. Tree-Shaking

```typescript
// ✅ Good - only imports what's used
import { Button, Input } from '@ui-library/components';

// ❌ Avoid - imports entire library
import * as UI from '@ui-library/components';
```

### 3. Review Dependencies

```bash
# See what's in your bundle
ANALYZE=true npm run build
```

Then check:
- Are all dependencies actually used?
- Are there lighter alternatives?
- Can heavy libraries be lazy-loaded?

### 4. Next.js Optimizations

Already configured in `next.config.ts`:
- SWC minification (faster, smaller)
- Automatic compression
- Font optimization
- Package imports optimization

## Next Steps

1. **Run your first build:** `npm run build`
2. **Review the report** to understand current bundle size
3. **Run interactive analysis:** `ANALYZE=true npm run build`
4. **Identify optimization opportunities** from the visualization
5. **Implement code splitting** for large features
6. **Set up baseline:** `cp .bundle-report.json .bundle-report.baseline.json`
7. **Monitor over time** as you add features

For more details, see [BUNDLE_OPTIMIZATION.md](BUNDLE_OPTIMIZATION.md).
