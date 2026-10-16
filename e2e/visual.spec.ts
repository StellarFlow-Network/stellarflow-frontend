import { test, expect, type Page } from '@playwright/test';

// Visual regression coverage (Issue #603)
//
// Captures full-page pixel-diff snapshots of the landing page at the core
// responsive breakpoints so unexpected layout/UI regressions are caught in
// CI before merge. Baselines live alongside this spec in
// `visual.spec.ts-snapshots/` and are compared via Playwright's built-in
// screenshot diffing (see `expect.toHaveScreenshot` config in
// playwright.config.ts for the pixel-diff threshold).
//
// To (re)generate baselines locally: `npm run test:visual:update`

const BREAKPOINTS = [
  { name: 'mobile-375', width: 375, height: 812 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1440', width: 1440, height: 900 },
] as const;

async function prepareForSnapshot(page: Page) {
  // Freeze CSS animations/transitions so timing differences between runs
  // don't produce false-positive pixel diffs.
  await page.emulateMedia({ reducedMotion: 'reduce' });

  await page.getByRole('heading', { name: 'Live Network Map' }).first().waitFor({ state: 'visible' });
  await page.getByText('NGN/XLM (24h)').first().waitFor({ state: 'visible' });
  await page.getByText('Raw source data').first().waitFor({ state: 'visible' });

  // Hide live dashboard panels that hydrate with dynamic data and can change
  // layout height between runs. The visual snapshots are meant to cover the
  // stable landing-page shell, not the live telemetry content.
  await page.evaluate(() => {
    const labels = ['Live Network Map', 'NGN/XLM (24h)', 'Raw source data'];

    document.querySelectorAll('section').forEach((element) => {
      const text = element.textContent ?? '';
      if (!labels.some((label) => text.includes(label))) {
        return;
      }

        (element as HTMLElement).style.display = 'none';
    });
  });

  await page.waitForTimeout(250);
}

test.describe('Visual regression — landing page (Issue #603)', () => {
  for (const breakpoint of BREAKPOINTS) {
    test(`matches baseline at ${breakpoint.name}`, async ({ page }) => {
      await page.setViewportSize({ width: breakpoint.width, height: breakpoint.height });
      await page.goto('/');
      await page.locator('body').waitFor({ state: 'visible' });
      await prepareForSnapshot(page);

      await expect(page).toHaveScreenshot(`landing-${breakpoint.name}.png`, {
        fullPage: true,
        animations: 'disabled',
        // Permit tiny font rasterization and dynamic map rendering differences
        // while still catching visible layout and color regressions.
        maxDiffPixelRatio: 0.005,
      });
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Trading Page Visual Regression (Issue #1181)
// ─────────────────────────────────────────────────────────────────────────────

async function prepareTradingSnapshot(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });

  // Wait for trading view to load
  await page.locator('body').waitFor({ state: 'visible' });

  // Hide dynamic data components that change between runs
  await page.evaluate(() => {
    // Hide real-time price feeds and order books
    const dynamicSelectors = [
      '[data-testid="price-feed"]',
      '[data-testid="order-book"]',
      '[data-testid="trade-history"]',
      '.live-price',
      '.live-depth',
    ];

    dynamicSelectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((el) => {
        (el as HTMLElement).style.display = 'none';
      });
    });
  });

  await page.waitForTimeout(250);
}

test.describe('Visual regression — trading page (Issue #1181)', () => {
  for (const breakpoint of BREAKPOINTS) {
    test(`matches baseline at ${breakpoint.name}`, async ({ page }) => {
      await page.setViewportSize({ width: breakpoint.width, height: breakpoint.height });
      await page.goto('/trading');
      await page.locator('body').waitFor({ state: 'visible' });
      await prepareTradingSnapshot(page);

      await expect(page).toHaveScreenshot(`trading-${breakpoint.name}.png`, {
        fullPage: true,
        animations: 'disabled',
        maxDiffPixelRatio: 0.005,
      });
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Vaults Page Visual Regression (Issue #1181)
// ─────────────────────────────────────────────────────────────────────────────

async function prepareVaultsSnapshot(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });

  // Wait for vaults view to load
  await page.locator('body').waitFor({ state: 'visible' });

  // Hide dynamic APY data and live metrics
  await page.evaluate(() => {
    const dynamicSelectors = [
      '[data-testid="live-apy"]',
      '[data-testid="vault-metrics"]',
      '.live-chart',
      '.realtime-stats',
    ];

    dynamicSelectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((el) => {
        (el as HTMLElement).style.display = 'none';
      });
    });
  });

  await page.waitForTimeout(250);
}

test.describe('Visual regression — vaults page (Issue #1181)', () => {
  for (const breakpoint of BREAKPOINTS) {
    test(`matches baseline at ${breakpoint.name}`, async ({ page }) => {
      await page.setViewportSize({ width: breakpoint.width, height: breakpoint.height });
      await page.goto('/vaults');
      await page.locator('body').waitFor({ state: 'visible' });
      await prepareVaultsSnapshot(page);

      await expect(page).toHaveScreenshot(`vaults-${breakpoint.name}.png`, {
        fullPage: true,
        animations: 'disabled',
        maxDiffPixelRatio: 0.005,
      });
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Governance Page Visual Regression (Issue #1181)
// ─────────────────────────────────────────────────────────────────────────────

async function prepareGovernanceSnapshot(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });

  // Wait for governance view to load
  await page.locator('body').waitFor({ state: 'visible' });

  // Hide live voting data and proposal metrics
  await page.evaluate(() => {
    const dynamicSelectors = [
      '[data-testid="vote-count"]',
      '[data-testid="proposal-stats"]',
      '.live-voting',
      '.realtime-governance',
    ];

    dynamicSelectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((el) => {
        (el as HTMLElement).style.display = 'none';
      });
    });
  });

  await page.waitForTimeout(250);
}

test.describe('Visual regression — governance page (Issue #1181)', () => {
  for (const breakpoint of BREAKPOINTS) {
    test(`matches baseline at ${breakpoint.name}`, async ({ page }) => {
      await page.setViewportSize({ width: breakpoint.width, height: breakpoint.height });
      await page.goto('/governance');
      await page.locator('body').waitFor({ state: 'visible' });
      await prepareGovernanceSnapshot(page);

      await expect(page).toHaveScreenshot(`governance-${breakpoint.name}.png`, {
        fullPage: true,
        animations: 'disabled',
        maxDiffPixelRatio: 0.005,
      });
    });
  }
});
