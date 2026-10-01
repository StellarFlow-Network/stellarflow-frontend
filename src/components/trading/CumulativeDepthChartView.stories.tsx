import type { Meta, StoryObj } from "@storybook/react";
import { ASSET_SYMBOLS } from "@/config/assetSymbols";
import type { OrderBookSnapshot } from "@/types";
import { CumulativeDepthChartView } from "./CumulativeDepthChartView";

const meta: Meta<typeof CumulativeDepthChartView> = {
  title: "Trading/CumulativeDepthChart",
  component: CumulativeDepthChartView,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Recharts cumulative depth chart with green bid and red ask step curves, a mid-market price line, a spread gap indicator and zoom controls focused on the spread.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="max-w-4xl bg-neutral-950 p-6">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof CumulativeDepthChartView>;

const buildLevels = (midPrice: number, direction: 1 | -1, amounts: number[]) =>
  amounts.map((amount, index) => ({
    price: Number((midPrice + direction * midPrice * 0.0008 * (index + 1)).toFixed(2)),
    amount,
    total: 0,
  }));

const DEEP_BOOK: OrderBookSnapshot = {
  assetPair: ASSET_SYMBOLS.NGN_XLM,
  bids: buildLevels(750, -1, [420, 880, 310, 960, 540, 700, 250, 830, 610, 390]),
  asks: buildLevels(750, 1, [380, 640, 910, 270, 720, 450, 860, 330, 590, 940]),
  timestamp: 1_727_568_000_000,
};

const THIN_BOOK: OrderBookSnapshot = {
  ...DEEP_BOOK,
  bids: DEEP_BOOK.bids.slice(0, 2),
  asks: DEEP_BOOK.asks.slice(0, 2),
};

export const Live: Story = {
  args: { assetId: ASSET_SYMBOLS.NGN_XLM, orderBook: DEEP_BOOK, isConnected: true },
};

export const ThinBook: Story = {
  args: { assetId: ASSET_SYMBOLS.NGN_XLM, orderBook: THIN_BOOK, isConnected: true },
};

export const Loading: Story = {
  args: { assetId: ASSET_SYMBOLS.NGN_XLM, orderBook: null, isConnected: false },
};

export const NoLiquidity: Story = {
  args: {
    assetId: ASSET_SYMBOLS.NGN_XLM,
    orderBook: { ...DEEP_BOOK, bids: [], asks: [] },
    isConnected: true,
  },
};
