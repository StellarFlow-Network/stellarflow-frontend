# Bundle Size Optimization & Monitoring

This document outlines the automated bundle size analysis and optimization protocols implemented in the Stellarflow Frontend project.

## Overview

The project now includes:
- **Automated bundle analysis** using `@next/bundle-analyzer`
- **Strict size thresholds** that can block distribution builds
- **GitHub Actions integration** for CI/CD pipeline checks
- **Bundle size reporting** with violation detection

## Configuration

### Bundle Size Limits

Bundle size thresholds are configured in [`.bundle-limits.json`](.bundle-limits.json):

```json
{
  "maxMainBundle": 250,       // Main chunk max size (gzipped, KB)
  "maxPageBundle": 100,       // Per-page chunk max size (gzipped, KB)
  "maxTotalGzipped": 500,     // Total all chunks (gzipped, KB)
  "maxIndividualGzipped": 150 // Individual bundle hard limit (gzipped, KB)
}
```

**Adjust thresholds based on your project requirements:**
- Smaller values = stricter optimization requirements
- Run baseline builds first to establish realistic limits
- Update thresholds as the project grows, but avoid exceeding them

## Usage

### 1. Standard Build with Warnings

```bash
npm run build
```

Builds the project and analyzes bundle sizes. Violations are reported but **do not block the build**.

### 2. Strict Build (Recommended for CI/CD)

```bash
npm run build:strict
```

Builds the project and **fails the build if any thresholds are exceeded**. Use this in production deployment pipelines.

### 3. Interactive Bundle Analysis

```bash
ANALYZE=true npm run build
```

Generates interactive HTML bundle visualizations in `.next/analyze/` directory. Opens in browser to explore what's bloating bundles.

### 4. View Bundle Report

After any build, view the detailed JSON report:

```bash
cat .bundle-report.json
```

## Build Output Example

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

## CI/CD Integration

### GitHub Actions

The project includes `.github/workflows/bundle-check.yml` which:

✅ Runs on every push to `main` and `develop`
✅ Runs on all pull requests
✅ Fails the build if bundle sizes exceed limits
✅ Posts bundle report as PR comment
✅ Generates summary in GitHub Actions

**PR Comment Example:**
```
📦 Bundle Size Report

| Bundle | Size (KB) | Gzipped (KB) |
|--------|-----------|--------------|
| ✅ main-abc.js | 180.45 | 45.2 |
| ✅ pages-def.js | 92.30 | 28.1 |

Total (gzipped): 75.5KB
Limit: 500KB

✅ All bundles within limits!
```

## Optimization Best Practices

### 1. Regular Analysis

Run interactive analysis periodically to identify bloat:
```bash
ANALYZE=true npm run build
```

### 2. Track Bundle Evolution

Monitor `.bundle-report.json` over time to catch gradual bloat:
```bash
# Store baseline
cp .bundle-report.json .bundle-report.baseline.json

# Compare after changes
npm run build
# Check if totalGzipped increased significantly
```

### 3. Code Splitting

Ensure pages are code-split properly:
```typescript
// ✅ Good - dynamic imports for large features
import dynamic from 'next/dynamic';
const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <div>Loading...</div>
});

// ❌ Avoid - forces everything into main bundle
import HeavyComponent from './HeavyComponent';
```

### 4. Tree-Shaking

Verify unused code is eliminated:
```typescript
// ✅ Good - import specific exports
import { Button } from 'react-icons/fa';

// ❌ Avoid - imports entire library
import * as Icons from 'react-icons/fa';
```

### 5. External Dependencies

Review large dependencies in bundle analysis. Consider:
- Lighter alternatives (e.g., `date-fns` vs `moment`)
- Lazy-loading heavy libraries
- Tree-shakeable imports

### 6. Next.js Optimizations

The project includes these optimizations in `next.config.ts`:

```typescript
swcMinify: true              // SWC-based minification (faster)
compress: true               // Enable compression
productionBrowserSourceMaps: false // Reduce build size
optimizeFonts: true         // Optimize font loading
optimizePackageImports: []  // Tree-shake specific packages
```

## Troubleshooting

### Build fails with bundle size violations

**Check what's causing the bloat:**
```bash
ANALYZE=true npm run build
```

**Review interactive visualization:**
- Opens in browser automatically
- Shows which packages consume the most space
- Identify unused/duplicate dependencies

**Increase thresholds only if necessary:**

Edit `.bundle-limits.json`:
```json
{
  "maxTotalGzipped": 600  // Increased from 500
}
```

**Better solution - reduce bundle:**
- Remove unused dependencies
- Implement code splitting
- Use lighter alternatives
- Enable proper tree-shaking

### High memory usage during build

Set Node memory limit:
```bash
NODE_OPTIONS="--max-old-space-size=4096" npm run build
```

### Changes don't affect bundle size

Verify Next.js cache is cleared:
```bash
rm -rf .next
npm run build
```

## Reporting Bundle Issues

When you encounter bundle size violations:

1. **Document the violation**: Note which bundle exceeds limits
2. **Analyze the cause**: Use `ANALYZE=true npm run build`
3. **Create an issue**: Link bundle report and analysis results
4. **Propose fix**: Code splitting, removing dependencies, etc.
5. **Update limits**: Only if the increase is justified and necessary

## References

- [Next.js Bundle Analysis](https://nextjs.org/docs/advanced-features/bundle-analysis)
- [Web Vitals & Performance](https://web.dev/performance/)
- [Code Splitting in React](https://reactjs.org/docs/code-splitting.html)
- [Tree Shaking & Optimization](https://webpack.js.org/guides/tree-shaking/)
