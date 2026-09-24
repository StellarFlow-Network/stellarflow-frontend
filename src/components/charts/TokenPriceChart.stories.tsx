import type { Meta, StoryObj } from "@storybook/react";
import { TokenPriceChart } from "./TokenPriceChart";

const meta: Meta<typeof TokenPriceChart> = {
  title: "Charts/TokenPriceChart",
  component: TokenPriceChart,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Interactive candlestick chart with timeframe selector (1H, 24H, 7D, 1M, 1Y, ALL), technical indicator toggles (Moving Average, Volume, RSI), and localStorage preference persistence.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="max-w-4xl bg-neutral-950 p-6 rounded-2xl">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof TokenPriceChart>;

export const Default24H: Story = {
  args: {
    pairId: "XLM-USDC",
    tokenASymbol: "XLM",
    tokenBSymbol: "USDC",
    height: 420,
    initialTimeframe: "24H",
  },
};

export const AllTimeWithRSI: Story = {
  args: {
    pairId: "USDC-NGN",
    tokenASymbol: "USDC",
    tokenBSymbol: "NGN",
    height: 450,
    initialTimeframe: "ALL",
    initialIndicators: {
      ma: true,
      volume: true,
      rsi: true,
      maPeriod: 50,
    },
  },
};

export const OneHourClean: Story = {
  args: {
    pairId: "XLM-EURC",
    tokenASymbol: "XLM",
    tokenBSymbol: "EURC",
    height: 380,
    initialTimeframe: "1H",
    initialIndicators: {
      ma: false,
      volume: false,
      rsi: false,
    },
  },
};
