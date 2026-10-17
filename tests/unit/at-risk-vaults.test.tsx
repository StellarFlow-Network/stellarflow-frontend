import test from "node:test";
import assert from "node:assert/strict";
import AtRiskVaultsTable from "@/components/vaults/AtRiskVaultsTable";
import { sortAtRiskVaults } from "@/components/vaults/vaultRisk";
import { renderToHtml } from "./helpers/render";

test("risk table renders sorted vaults and only enables liquidation below one", () => {
  const vaults = [
    { id: "boundary", healthFactor: 1, debtUsd: 10, collateralUsd: 20, collateralSymbol: "XLM" },
    { id: "critical", healthFactor: 0.9, debtUsd: 100, collateralUsd: 120, collateralSymbol: "USDC" },
    { id: "safe", healthFactor: 2, debtUsd: 1, collateralUsd: 3, collateralSymbol: "XLM" },
  ];
  assert.deepEqual(sortAtRiskVaults(vaults).map((v) => v.id), ["critical", "boundary"]);
  assert.deepEqual(sortAtRiskVaults(vaults, "debtUsd").map((v) => v.id), ["boundary", "critical"]);
  const html = renderToHtml(<AtRiskVaultsTable vaults={vaults} />);
  assert.ok(html.indexOf('scope="row" class="p-4 font-mono font-medium">critical') < html.indexOf('scope="row" class="p-4 font-mono font-medium">boundary'));
  assert.match(html, /disabled="" aria-label="Liquidate vault boundary"/);
  assert.doesNotMatch(html, /Liquidate vault safe/);
});
