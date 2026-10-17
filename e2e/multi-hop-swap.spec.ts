import { test, expect } from '@playwright/test';

const MOCK_WALLET_KEY = 'GCIDCLWXEXA5BOKVW5GZMZPBTFCHNOEOFLYAY7EIKV3N7ID7X2L323GK';
const MOCK_RECIPIENT_KEY = 'GCNQO5ZL27AWRSJCNUQPTV3KUMHZRSP2YGG54QVLW7CUQGOQNVFCO5AC';
const USDC_OPTION_VALUE = 'USDC|GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';
const EURT_ISSUER = 'GDPJQFI3DNBTNT6YRF73EB72TMQBEOSNEWH5FRPHIK4LBWZFGBHFWFWY';
const BTC_ISSUER = 'GAOZXM4ZRNQNKYYNZCT6XUDF7ENSH73QFBBLVU7PJ6WFN6NPABISPFWK';

test.describe('Multi-Hop Token Swap Routing E2E Suite', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Pre-seed wallet authentication in browser context
    await page.addInitScript(({ walletKey }) => {
      (window as any).stellar = {
        getPublicKey: async () => walletKey,
        isConnected: async () => true,
        signTransaction: async (xdr: string) => xdr,
      };
      window.localStorage.setItem('stellarflow.wallet.publicKey', walletKey);
    }, { walletKey: MOCK_WALLET_KEY });

    // 2. Mock Horizon account endpoint to support transaction building
    await page.route('**/accounts/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: MOCK_WALLET_KEY,
          account_id: MOCK_WALLET_KEY,
          sequence: '100000000000001',
          subentry_count: 2,
          thresholds: { low_threshold: 0, med_threshold: 0, high_threshold: 0 },
          flags: {
            auth_required: false,
            auth_revocable: false,
            auth_immutable: false,
            auth_clawback_enabled: false,
          },
          balances: [
            { balance: '10000.0000000', asset_type: 'native' },
            {
              balance: '500.0000000',
              asset_type: 'credit_alphanum4',
              asset_code: 'USDC',
              asset_issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
            },
          ],
          signers: [
            {
              weight: 1,
              key: MOCK_WALLET_KEY,
              type: 'ed25519_public_key',
            },
          ],
        }),
      });
    });
  });

  test('discovers and renders multi-pool trade route with intermediate hops and price impact', async ({ page }) => {
    // Mock 2-hop route: XLM -> EURT -> USDC
    await page.route('**/paths/strict-receive*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          _embedded: {
            records: [
              {
                source_asset_type: 'native',
                source_amount: '550.0000000',
                destination_asset_type: 'credit_alphanum4',
                destination_asset_code: 'USDC',
                destination_asset_issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
                destination_amount: '100.0000000',
                path: [
                  {
                    asset_type: 'credit_alphanum4',
                    asset_code: 'EURT',
                    asset_issuer: EURT_ISSUER,
                  },
                ],
              },
            ],
          },
        }),
      });
    });

    await page.goto('/swap');

    // Select destination asset (USDC)
    const destSelect = page.locator('select').nth(1);
    await destSelect.selectOption(USDC_OPTION_VALUE);

    // Enter destination amount (100)
    const destAmountInput = page.locator('input[type="number"]');
    await destAmountInput.fill('100');

    // Assert Path Breakdown container appears
    const pathBreakdown = page.locator('div:has(> h2:has-text("Path Breakdown"))');
    await expect(pathBreakdown).toBeVisible({ timeout: 5000 });

    // Verify source asset hop (XLM) with source amount
    await expect(pathBreakdown.getByText('Stellar Lumens (XLM)')).toBeVisible();
    await expect(pathBreakdown.getByText('550.0000000')).toBeVisible();

    // Verify intermediate hop (EURT) with issuer snippet
    await expect(pathBreakdown.getByText(/EURT \(GDPJQFI3/)).toBeVisible();

    // Verify destination asset hop (USDC) with destination amount
    await expect(pathBreakdown.getByText(/USDC \(GA5ZSEJY/)).toBeVisible();
    await expect(pathBreakdown.getByText('100.0000000')).toBeVisible();

    // Verify estimated slippage for 1 intermediate hop (0.10%)
    await expect(pathBreakdown.getByText('Estimated Slippage')).toBeVisible();
    await expect(pathBreakdown.getByText('0.10%')).toBeVisible();

    // Verify default minimum receive calculation with 0.5% slippage (100 * 0.995 = 99.5000000)
    await expect(pathBreakdown.getByText('Minimum Receive')).toBeVisible();
    await expect(pathBreakdown.getByText('99.5000000')).toBeVisible();
  });

  test('dynamically configures slippage tolerance and recalculates minimum receive', async ({ page }) => {
    await page.route('**/paths/strict-receive*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          _embedded: {
            records: [
              {
                source_asset_type: 'native',
                source_amount: '550.0000000',
                destination_asset_type: 'credit_alphanum4',
                destination_asset_code: 'USDC',
                destination_asset_issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
                destination_amount: '100.0000000',
                path: [
                  {
                    asset_type: 'credit_alphanum4',
                    asset_code: 'EURT',
                    asset_issuer: EURT_ISSUER,
                  },
                ],
              },
            ],
          },
        }),
      });
    });

    await page.goto('/swap');

    const destSelect = page.locator('select').nth(1);
    await destSelect.selectOption(USDC_OPTION_VALUE);

    const destAmountInput = page.locator('input[type="number"]');
    await destAmountInput.fill('100');

    // Confirm initial state inside Path Breakdown (0.5% slippage -> 99.5000000 minimum receive)
    const pathBreakdown = page.locator('div:has(> h2:has-text("Path Breakdown"))');
    await expect(pathBreakdown.getByText('99.5000000')).toBeVisible({ timeout: 5000 });

    // Open slippage dialog
    const slippageTrigger = page.locator('button:has-text("0.5%")');
    await expect(slippageTrigger).toBeVisible();
    await slippageTrigger.click();

    // Verify dialog opens
    const dialog = page.locator('div:has(> h3:has-text("Set Slippage Tolerance"))');
    await expect(dialog).toBeVisible();

    // Select 1.0% tolerance preset inside dialog
    await dialog.getByRole('button', { name: '1%', exact: true }).click();

    // Verify modal closes, trigger button updates to 1%, and minimum receive updates to 99.0000000
    await expect(dialog).not.toBeVisible();
    await expect(page.locator('button:has-text("1%")')).toBeVisible();
    await expect(pathBreakdown.getByText('99.0000000')).toBeVisible();

    // Reopen dialog and change to 2.0% tolerance preset
    await page.locator('button:has-text("1%")').click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: '2%', exact: true }).click();

    // Verify minimum receive updates to 98.0000000 (100 * 0.98)
    await expect(dialog).not.toBeVisible();
    await expect(page.locator('button:has-text("2%")')).toBeVisible();
    await expect(pathBreakdown.getByText('98.0000000')).toBeVisible();
  });

  test('locks quote and debounces re-fetching on trade amount alteration', async ({ page }) => {
    await page.route('**/paths/strict-receive*', async (route) => {
      const url = new URL(route.request().url());
      const destAmount = url.searchParams.get('destination_amount');

      if (destAmount === '250') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            _embedded: {
              records: [
                {
                  source_asset_type: 'native',
                  source_amount: '1375.0000000',
                  destination_asset_type: 'credit_alphanum4',
                  destination_asset_code: 'USDC',
                  destination_asset_issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
                  destination_amount: '250.0000000',
                  path: [
                    {
                      asset_type: 'credit_alphanum4',
                      asset_code: 'EURT',
                      asset_issuer: EURT_ISSUER,
                    },
                  ],
                },
              ],
            },
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            _embedded: {
              records: [
                {
                  source_asset_type: 'native',
                  source_amount: '550.0000000',
                  destination_asset_type: 'credit_alphanum4',
                  destination_asset_code: 'USDC',
                  destination_asset_issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
                  destination_amount: '100.0000000',
                  path: [
                    {
                      asset_type: 'credit_alphanum4',
                      asset_code: 'EURT',
                      asset_issuer: EURT_ISSUER,
                    },
                  ],
                },
              ],
            },
          }),
        });
      }
    });

    await page.goto('/swap');

    const destSelect = page.locator('select').nth(1);
    await destSelect.selectOption(USDC_OPTION_VALUE);

    const destAmountInput = page.locator('input[type="number"]');
    await destAmountInput.fill('100');

    // Confirm initial 100 quote
    const pathBreakdown = page.locator('div:has(> h2:has-text("Path Breakdown"))');
    await expect(pathBreakdown.getByText('550.0000000')).toBeVisible({ timeout: 5000 });
    await expect(pathBreakdown.getByText('99.5000000')).toBeVisible();

    // Modify amount to 250
    await destAmountInput.fill('250');

    // Confirm updated quote reflecting new debounced calculation
    await expect(pathBreakdown.getByText('1375.0000000')).toBeVisible({ timeout: 5000 });
    await expect(pathBreakdown.getByText('248.7500000')).toBeVisible();

    // Clear amount and assert Path Breakdown unmounts
    await destAmountInput.fill('');
    await expect(page.getByRole('heading', { name: 'Path Breakdown' })).not.toBeVisible();
  });

  test('gracefully handles empty path discovery when route does not exist', async ({ page }) => {
    await page.route('**/paths/strict-receive*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          _embedded: {
            records: [],
          },
        }),
      });
    });

    await page.goto('/swap');

    const destSelect = page.locator('select').nth(1);
    await destSelect.selectOption(USDC_OPTION_VALUE);

    const destAmountInput = page.locator('input[type="number"]');
    await destAmountInput.fill('100');

    // Path Breakdown must not appear
    await expect(page.getByRole('heading', { name: 'Path Breakdown' })).not.toBeVisible();

    // Swap button should remain disabled
    const swapButton = page.getByRole('button', { name: 'Swap & Send' });
    await expect(swapButton).toBeDisabled();
  });

  test('discovers and renders complex 3-hop multi-pool route with higher price impact', async ({ page }) => {
    // 3-hop route: XLM -> EURT -> BTC -> USDC (2 intermediate hops)
    await page.route('**/paths/strict-receive*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          _embedded: {
            records: [
              {
                source_asset_type: 'native',
                source_amount: '620.0000000',
                destination_asset_type: 'credit_alphanum4',
                destination_asset_code: 'USDC',
                destination_asset_issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
                destination_amount: '100.0000000',
                path: [
                  {
                    asset_type: 'credit_alphanum4',
                    asset_code: 'EURT',
                    asset_issuer: EURT_ISSUER,
                  },
                  {
                    asset_type: 'credit_alphanum4',
                    asset_code: 'BTC',
                    asset_issuer: BTC_ISSUER,
                  },
                ],
              },
            ],
          },
        }),
      });
    });

    await page.goto('/swap');

    const destSelect = page.locator('select').nth(1);
    await destSelect.selectOption(USDC_OPTION_VALUE);

    const destAmountInput = page.locator('input[type="number"]');
    await destAmountInput.fill('100');

    const pathBreakdown = page.locator('div:has(> h2:has-text("Path Breakdown"))');
    await expect(pathBreakdown).toBeVisible({ timeout: 5000 });

    // Assert all 4 hops appear in the chain
    await expect(pathBreakdown.getByText('Stellar Lumens (XLM)')).toBeVisible();
    await expect(pathBreakdown.getByText(/EURT \(GDPJQFI3/)).toBeVisible();
    await expect(pathBreakdown.getByText(/BTC \(GAOZXM4Z/)).toBeVisible();
    await expect(pathBreakdown.getByText(/USDC \(GA5ZSEJY/)).toBeVisible();

    // 2 intermediate hops * 0.1% = 0.20% estimated slippage
    await expect(pathBreakdown.getByText('0.20%')).toBeVisible();
  });

  test('successfully prepares and executes multi-hop swap end-to-end', async ({ page }) => {
    let accountLoaded = false;
    await page.route('**/paths/strict-receive*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          _embedded: {
            records: [
              {
                source_asset_type: 'native',
                source_amount: '550.0000000',
                destination_asset_type: 'credit_alphanum4',
                destination_asset_code: 'USDC',
                destination_asset_issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
                destination_amount: '100.0000000',
                path: [
                  {
                    asset_type: 'credit_alphanum4',
                    asset_code: 'EURT',
                    asset_issuer: EURT_ISSUER,
                  },
                ],
              },
            ],
          },
        }),
      });
    });

    await page.route('**/accounts/*', async (route) => {
      accountLoaded = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: MOCK_WALLET_KEY,
          account_id: MOCK_WALLET_KEY,
          sequence: '100000000000001',
          subentry_count: 2,
          thresholds: { low_threshold: 0, med_threshold: 0, high_threshold: 0 },
          flags: { auth_required: false, auth_revocable: false, auth_immutable: false, auth_clawback_enabled: false },
          balances: [{ balance: '10000.0000000', asset_type: 'native' }],
          signers: [{ weight: 1, key: MOCK_WALLET_KEY, type: 'ed25519_public_key' }],
        }),
      });
    });

    await page.goto('/swap');

    // Fill receiver address
    const recipientInput = page.locator('input[placeholder="G..."]');
    await recipientInput.fill(MOCK_RECIPIENT_KEY);

    // Select destination asset and amount
    const destSelect = page.locator('select').nth(1);
    await destSelect.selectOption(USDC_OPTION_VALUE);

    const destAmountInput = page.locator('input[type="number"]');
    await destAmountInput.fill('100');

    // Wait for route to resolve and enable button
    const swapButton = page.getByRole('button', { name: 'Swap & Send' });
    await expect(swapButton).toBeEnabled({ timeout: 5000 });

    // Click swap button to build transaction
    await swapButton.click();

    // A prepared transaction shows the success confetti overlay. Verify the
    // account was loaded and the UI reached its prepared state without error.
    await expect.poll(() => accountLoaded).toBe(true);
    await expect(page.locator('.stellar-confetti').first()).toBeVisible();
    await expect(page.locator('.bg-red-900\\/30')).toHaveCount(0);
    await expect(swapButton).toBeEnabled();
  });
});
