import { test, expect } from "@playwright/test";

test("risk dashboard sorts vaults and opens a prefilled keyboard-accessible drawer", async ({ page }, testInfo) => {
  await page.goto("/vaults");
  const dashboard = page.getByRole("region", { name: "Vault risk dashboard" });
  await expect(dashboard).toBeVisible();
  await dashboard.screenshot({ path: testInfo.outputPath("risk-dashboard.png") });
  await expect(dashboard.getByRole("rowheader")).toHaveText(["vault-102", "vault-101", "vault-103", "vault-104"]);
  await dashboard.getByRole("button", { name: "Debt amount (USD)" }).click();
  await expect(dashboard.getByRole("rowheader")).toHaveText(["vault-101", "vault-104", "vault-103", "vault-102"]);
  await dashboard.getByRole("button", { name: "Debt amount (USD)" }).click();
  await expect(dashboard.getByRole("rowheader")).toHaveText(["vault-102", "vault-103", "vault-104", "vault-101"]);
  await expect(dashboard.getByRole("button", { name: "Liquidate vault vault-103" })).toBeDisabled();
  const trigger = dashboard.getByRole("button", { name: "Liquidate vault vault-101" });
  await trigger.click();
  const drawer = page.getByRole("dialog", { name: "Confirm liquidation" });
  await expect(drawer).toBeVisible();
  await drawer.screenshot({ path: testInfo.outputPath("liquidation-drawer.png") });
  await expect(drawer.getByLabel("Vault ID")).toHaveValue("vault-101");
  await expect(drawer.getByRole("button", { name: "Confirm liquidation" })).toBeDisabled();
  await page.keyboard.press("Tab");
  await expect.poll(() => drawer.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(drawer).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await expect(dashboard.getByRole("link", { name: /View transaction/ })).toHaveCount(2);
});

test("risk dashboard remains usable on a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/vaults");
  const dashboard = page.getByRole("region", { name: "Vault risk dashboard" });
  await expect(dashboard).toBeVisible();
  await dashboard.getByRole("button", { name: "Liquidate vault vault-102" }).click();
  const drawer = page.getByRole("dialog", { name: "Confirm liquidation" });
  await expect(drawer.getByLabel("Vault ID")).toHaveValue("vault-102");
  const box = await drawer.boundingBox();
  expect(box?.width).toBeLessThanOrEqual(390);
  await drawer.getByRole("button", { name: "Close liquidation drawer" }).click();
  await expect(drawer).not.toBeVisible();
});
