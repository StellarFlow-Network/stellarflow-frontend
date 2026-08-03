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
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `,
  });
}

test.describe('Visual regression — landing page (Issue #603)', () => {
  for (const breakpoint of BREAKPOINTS) {
    test(`matches baseline at ${breakpoint.name}`, async ({ page }) => {
      await page.setViewportSize({ width: breakpoint.width, height: breakpoint.height });
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await prepareForSnapshot(page);

      await expect(page).toHaveScreenshot(`landing-${breakpoint.name}.png`, {
        fullPage: true,
        animations: 'disabled',
      });
    });
  }
});
