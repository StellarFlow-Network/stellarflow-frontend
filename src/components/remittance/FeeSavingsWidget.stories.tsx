import type { Meta, StoryObj } from "@storybook/react";
import FeeSavingsWidget from "./FeeSavingsWidget";

const meta = {
  title: "Remittance/FeeSavingsWidget",
  component: FeeSavingsWidget,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Interactive fee savings calculator that compares StellarFlow remittance costs against traditional Money Transfer Operators. Features real-time calculations, interactive slider, and exportable receipts.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof FeeSavingsWidget>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default state with $500 transfer amount showing comparison
 * across all major MTOs.
 */
export const Default: Story = {
  args: {
    defaultAmount: 500,
  },
};

/**
 * Small transfer amount ($100) showing how StellarFlow's
 * flat fee structure benefits smaller transfers.
 */
export const SmallTransfer: Story = {
  args: {
    defaultAmount: 100,
  },
};

/**
 * Large transfer amount ($5000) demonstrating significant
 * savings on high-value remittances.
 */
export const LargeTransfer: Story = {
  args: {
    defaultAmount: 5000,
  },
};

/**
 * Typical remittance amount ($200) showing real-world
 * savings for frequent senders.
 */
export const TypicalRemittance: Story = {
  args: {
    defaultAmount: 200,
  },
};

/**
 * Mid-range transfer ($1000) highlighting the sweet spot
 * for StellarFlow's competitive advantage.
 */
export const MidRangeTransfer: Story = {
  args: {
    defaultAmount: 1000,
  },
};
