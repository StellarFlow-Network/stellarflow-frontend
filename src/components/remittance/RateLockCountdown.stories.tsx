import type { Meta, StoryObj } from "@storybook/react";
import RateLockCountdown from "./RateLockCountdown";

const meta: Meta<typeof RateLockCountdown> = {
  title: "Remittance/RateLockCountdown",
  component: RateLockCountdown,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Countdown badge showing how long the currently displayed FX rate is guaranteed for, resetting whenever `anchorTimestamp` advances.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="bg-neutral-950 p-6">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof RateLockCountdown>;

export const FreshQuote: Story = {
  args: {
    anchorTimestamp: new Date().toISOString(),
    lockSeconds: 60,
  },
};

export const AboutToExpire: Story = {
  args: {
    anchorTimestamp: new Date(Date.now() - 53_000).toISOString(),
    lockSeconds: 60,
  },
};
