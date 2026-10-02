import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildLPPnLCsv,
  computeLPPnL,
  computeLPPnLRows,
  escapeCsvField,
  filterLPPnLRows,
  formatPercent,
  formatSignedUsd,
  formatUsd,
  LP_PNL_CSV_HEADERS,
  roiTone,
  sortLPPnLRows,
  summarizeLPPnL,
  type LPPosition,
} from "../../src/components/analytics/lpPnl.ts";

const WINNER: LPPosition = {
  id: "pos-winner",
  pair: "XLM / USDC",
  status: "active",
  openedAt: "2026-05-12T00:00:00Z",
  depositedUsd: 5_000,
  currentValueUsd: 5_420,
  feesClaimedUsd: 610,
  poolTvlUsd: 10_200_000,
};

const LOSER: LPPosition = {
  id: "pos-loser",
  pair: "NGN / XLM",
  status: "closed",
  openedAt: "2026-06-01T00:00:00Z",
  closedAt: "2026-07-15T00:00:00Z",
  depositedUsd: 2_200,
  currentValueUsd: 2_065,
  feesClaimedUsd: 95,
  poolTvlUsd: 1_850_000,
};

const FLAT: LPPosition = {
  id: "pos-flat",
  pair: "USD / GHS",
  status: "active",
  openedAt: "2026-04-20T00:00:00Z",
  depositedUsd: 8_000,
  currentValueUsd: 8_000,
  feesClaimedUsd: 0,
  poolTvlUsd: 890_000,
};

describe("computeLPPnL", () => {
  it("applies PnL_net = V_current + Fee_claimed - V_initial", () => {
    const row = computeLPPnL(WINNER);

    assert.equal(row.netPnlUsd, 5_420 + 610 - 5_000);
    assert.equal(row.netPnlUsd, 1_030);
  });

  it("derives ROI %, fee yield and the impermanent-loss component", () => {
    const row = computeLPPnL(WINNER);

    assert.equal(row.roiPercent, (1_030 / 5_000) * 100);
    assert.equal(row.feeYieldPercent, (610 / 5_000) * 100);
    // Principal drift excludes fees: 5420 - 5000.
    assert.equal(row.impermanentLossUsd, 420);
    assert.equal(row.impermanentLossPercent, 8.4);
    assert.equal(row.isProfit, true);
  });

  it("keeps fees in the net PnL when the principal lost value", () => {
    // Principal drifted -135 but 95 of fees were claimed.
    const row = computeLPPnL(LOSER);

    assert.equal(row.impermanentLossUsd, -135);
    assert.equal(row.netPnlUsd, -135 + 95);
    assert.equal(row.netPnlUsd, -40);
    assert.ok(row.roiPercent < 0);
    assert.equal(row.isProfit, false);
  });

  it("guards a zero / invalid initial deposit against divide-by-zero", () => {
    const row = computeLPPnL({
      ...FLAT,
      depositedUsd: 0,
      currentValueUsd: 10,
      feesClaimedUsd: Number.NaN,
    });

    assert.equal(row.netPnlUsd, 10);
    assert.equal(row.roiPercent, 0);
    assert.equal(row.feeYieldPercent, 0);
    assert.equal(row.feeYieldUsd, 0);
  });
});

describe("filtering and sorting", () => {
  const rows = computeLPPnLRows([WINNER, LOSER, FLAT]);

  it("filters by active / closed status without mutating the input", () => {
    const snapshot = [...rows];

    assert.deepEqual(
      filterLPPnLRows(rows, "active").map((row) => row.id),
      ["pos-winner", "pos-flat"],
    );
    assert.deepEqual(
      filterLPPnLRows(rows, "closed").map((row) => row.id),
      ["pos-loser"],
    );
    assert.equal(filterLPPnLRows(rows, "all").length, 3);
    assert.deepEqual(rows, snapshot);
  });

  it("sorts by ROI %, descending by default", () => {
    const sorted = sortLPPnLRows(rows, "roi");

    assert.deepEqual(
      sorted.map((row) => row.id),
      ["pos-winner", "pos-flat", "pos-loser"],
    );
    assert.ok(sorted[0].roiPercent > sorted[sorted.length - 1].roiPercent);
  });

  it("sorts by ROI % ascending", () => {
    const sorted = sortLPPnLRows(rows, "roi", "asc");

    assert.deepEqual(
      sorted.map((row) => row.id),
      ["pos-loser", "pos-flat", "pos-winner"],
    );
  });

  it("sorts by pool TVL and by date opened", () => {
    assert.deepEqual(
      sortLPPnLRows(rows, "tvl", "asc").map((row) => row.id),
      ["pos-flat", "pos-loser", "pos-winner"],
    );

    assert.deepEqual(
      sortLPPnLRows(rows, "openedAt", "asc").map((row) => row.id),
      ["pos-flat", "pos-winner", "pos-loser"],
    );
  });

  it("breaks ties by id and does not mutate the input array", () => {
    const tied = computeLPPnLRows([
      { ...FLAT, id: "b" },
      { ...FLAT, id: "a" },
    ]);

    assert.deepEqual(
      sortLPPnLRows(tied, "roi", "desc").map((row) => row.id),
      ["a", "b"],
    );
    assert.deepEqual(
      tied.map((row) => row.id),
      ["b", "a"],
    );
  });

  it("treats unparseable dates as the epoch instead of throwing", () => {
    const rowsWithBadDate = computeLPPnLRows([
      { ...FLAT, id: "bad", openedAt: "not-a-date" },
      { ...FLAT, id: "good", openedAt: "2026-04-20T00:00:00Z" },
    ]);

    assert.deepEqual(
      sortLPPnLRows(rowsWithBadDate, "openedAt", "desc").map((row) => row.id),
      ["good", "bad"],
    );
  });
});

describe("summarizeLPPnL", () => {
  it("totals deposits, fees, net PnL and weighted ROI", () => {
    const summary = summarizeLPPnL(computeLPPnLRows([WINNER, LOSER, FLAT]));

    assert.equal(summary.rowCount, 3);
    assert.equal(summary.activeCount, 2);
    assert.equal(summary.closedCount, 1);
    assert.equal(summary.totalDepositedUsd, 15_200);
    assert.equal(summary.totalCurrentValueUsd, 15_485);
    assert.equal(summary.totalFeesClaimedUsd, 705);
    assert.equal(summary.totalNetPnlUsd, 990);
    assert.equal(summary.totalRoiPercent, (990 / 15_200) * 100);
  });

  it("returns zeroed metrics for an empty portfolio", () => {
    const summary = summarizeLPPnL([]);

    assert.equal(summary.rowCount, 0);
    assert.equal(summary.totalRoiPercent, 0);
    assert.equal(summary.totalNetPnlUsd, 0);
  });
});

describe("formatting helpers", () => {
  it("formats signed USD and percentages for the badges", () => {
    assert.equal(formatUsd(1_030), "$1,030.00");
    assert.equal(formatUsd(-135.5), "-$135.50");
    assert.equal(formatSignedUsd(1_030), "+$1,030.00");
    assert.equal(formatSignedUsd(-40), "-$40.00");
    assert.equal(formatPercent(8.4), "+8.40%");
    assert.equal(formatPercent(-1.82), "-1.82%");
  });

  it("maps net PnL to the green/red/flat badge tones", () => {
    assert.equal(roiTone(1), "profit");
    assert.equal(roiTone(-1), "loss");
    assert.equal(roiTone(0), "flat");
    assert.equal(roiTone(Number.NaN), "flat");
  });
});

describe("buildLPPnLCsv", () => {
  const rows = computeLPPnLRows([
    WINNER,
    LOSER,
    { ...FLAT, pair: 'USD, GHS "test"' },
  ]);

  it("emits the documented header row", () => {
    const [header] = buildLPPnLCsv(rows).split("\n");

    assert.equal(header, LP_PNL_CSV_HEADERS.join(","));
  });

  it("writes one spreadsheet row per position with PnL and ROI", () => {
    const lines = buildLPPnLCsv(rows).split("\n");

    // 1 header + 3 position rows.
    assert.equal(lines.length, 4);

    const winner = lines[1].split(",");
    assert.equal(winner[0], "XLM / USDC");
    assert.equal(winner[1], "active");
    assert.equal(winner[2], "2026-05-12");
    assert.equal(winner[3], "");
    assert.equal(winner[4], "5000.00");
    assert.equal(winner[5], "5420.00");
    assert.equal(winner[6], "610.00");
    assert.equal(winner[7], "1030.00");
    assert.equal(winner[8], "20.60");

    const loser = lines[2].split(",");
    assert.equal(loser[3], "2026-07-15");
    assert.equal(loser[7], "-40.00");
  });

  it("escapes fields containing commas and quotes", () => {
    assert.equal(escapeCsvField("plain"), "plain");
    assert.equal(escapeCsvField("a,b"), '"a,b"');
    assert.equal(escapeCsvField('say "hi"'), '"say ""hi"""');

    assert.match(buildLPPnLCsv(rows), /"USD, GHS ""test"""/);
  });

  it("renders an empty-but-valid document for no positions", () => {
    assert.equal(buildLPPnLCsv([]), LP_PNL_CSV_HEADERS.join(","));
  });
});
