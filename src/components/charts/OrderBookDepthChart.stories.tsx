import type { Meta, StoryObj } from "@storybook/react";
import OrderBookDepthChart from "./OrderBookDepthChart";

const meta: Meta<typeof OrderBookDepthChart> = {
  title: "Charts/OrderBookDepthChart",
  component: OrderBookDepthChart,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "SVG-based bid/ask order book depth chart. Green cumulative curve for bids, red for asks, with hover tooltips showing cumulative volume at each price level. Auto-scales to its container via ResizeObserver.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="max-w-xl bg-neutral-950 p-6">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof OrderBookDepthChart>;

const bids = [
  { price: 1485.1, amount: 2500, total: 2500 },
  { price: 1484.8, amount: 4800, total: 7300 },
  { price: 1484.2, amount: 12500, total: 19800 },
  { price: 1483.5, amount: 8200, total: 28000 },
];

const asks = [
  { price: 1485.9, amount: 3100, total: 3100 },
  { price: 1486.3, amount: 6200, total: 9300 },
  { price: 1487.0, amount: 15000, total: 24300 },
  { price: 1487.8, amount: 7100, total: 31400 },
];

export const Default: Story = {
  args: {
    bids,
    asks,
    label: "USD / NGN",
    height: 220,
  },
};

export const ThinBook: Story = {
  args: {
    bids: [{ price: 16.35, amount: 5200, total: 5200 }],
    asks: [{ price: 16.45, amount: 4700, total: 4700 }],
    label: "XLM / KES",
    height: 220,
  },
};

export const Empty: Story = {
  args: {
    bids: [],
    asks: [],
    label: "No liquidity",
    height: 220,
  },
};
