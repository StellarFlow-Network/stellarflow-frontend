import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ASSET_SYMBOLS } from "@/config/assetSymbols";
import { OrderBookTable } from "@/components/trading/OrderBookTable";

const orderBookState = vi.hoisted(() => ({
  current: null as null | {
    assetPair: "NGN-XLM";
    bids: { price: number; amount: number; total: number }[];
    asks: { price: number; amount: number; total: number }[];
    timestamp: number;
  },
}));

vi.mock("@/app/hooks/useOrderBook", () => ({
  useOrderBook: () => ({ orderBook: orderBookState.current, isConnected: true }),
}));

vi.mock("@/app/hooks/useMounted", () => ({
  useMounted: () => true,
}));

describe("OrderBookTable", () => {
  beforeEach(() => {
    orderBookState.current = {
      assetPair: ASSET_SYMBOLS.NGN_XLM,
      bids: [
        { price: 100.14, amount: 2, total: 2 },
        { price: 100.11, amount: 3, total: 5 },
      ],
      asks: [
        { price: 100.15, amount: 4, total: 4 },
        { price: 100.19, amount: 1, total: 5 },
      ],
      timestamp: 1_800_000_000_000,
    };
  });

  it("aggregates each side at the selected precision and sums bucket amounts", () => {
    render(<OrderBookTable assetId={ASSET_SYMBOLS.NGN_XLM} />);

    expect(screen.getByText("100.14")).toBeInTheDocument();
    expect(screen.getByText("100.11")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Price precision" }), {
      target: { value: "0.1" },
    });

    const [bids, asks] = screen.getAllByRole("rowgroup");
    expect(within(bids).getByText("100.1")).toBeInTheDocument();
    expect(within(asks).getByText("100.1")).toBeInTheDocument();
    expect(within(bids).getByText("5.00")).toBeInTheDocument();
    expect(within(asks).getByText("5.00")).toBeInTheDocument();
    expect(within(bids).queryByText("100.14")).not.toBeInTheDocument();
  });
});
