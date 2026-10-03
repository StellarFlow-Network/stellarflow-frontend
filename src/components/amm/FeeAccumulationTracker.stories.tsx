import { useEffect } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { WebSocketManager } from "@/utils/WebSocketManager";
import type { AmmTradeEvent } from "@/types";
import FeeAccumulationTracker from "./FeeAccumulationTracker";

/**
 * Storybook has no live WebSocket feed, so trades are replayed through the
 * shared `WebSocketManager` on a timer. Pushing through the real manager
 * (rather than stubbing the hook) keeps the stories exercising the same
 * subscribe → route → render path the production widget uses.
 */
function SyntheticFeed({ poolId, intervalMs }: { poolId: string; intervalMs: number }) {
  useEffect(() => {
    const manager = WebSocketManager.getInstance();
    manager.addConsumer();

    // `tradeListeners` is intentionally module-private on the manager; the
    // stories reach in rather than widening the public API for demo data.
    const listeners = (
      manager as unknown as { tradeListeners: Set<(data: AmmTradeEvent) => void> }
    ).tradeListeners;

    const timer = setInterval(() => {
      const volumeUsd = 250 + Math.random() * 7_500;
      const spike = Math.random() > 0.9 ? 6 : 1;
      const feeAmount = volumeUsd * 0.003 * spike;

      listeners.forEach((callback) =>
        callback({
          poolId,
          volumeUsd,
          feeAmount,
          lpFee: feeAmount * 0.7,
          protocolFee: feeAmount * 0.3,
          feeAsset: "USDC",
          timestamp: Date.now(),
        }),
      );
    }, intervalMs);

    return () => {
      clearInterval(timer);
      manager.removeConsumer();
    };
  }, [poolId, intervalMs]);

  return null;
}

const meta: Meta<typeof FeeAccumulationTracker> = {
  title: "AMM/FeeAccumulationTracker",
  component: FeeAccumulationTracker,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Live trading-fee ticker for an AMM pool. Accumulates fees from `trade_execution` messages on the shared WebSocket feed over a rolling 24-hour window, animates the cumulative counter, splits it between LP and protocol shares (the two always reconcile to the printed total), and pulses green when a fill spikes above the recent trade-size average.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="max-w-sm bg-neutral-950 p-6">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof FeeAccumulationTracker>;

export const Live: Story = {
  args: {
    poolId: "xlm-usdc",
    pair: "XLM / USDC",
    feeAsset: "USDC",
    initialTotalFees: 1_842.37,
    initialLpFees: 1_289.66,
  },
  render: (args) => (
    <>
      <SyntheticFeed poolId={args.poolId} intervalMs={900} />
      <FeeAccumulationTracker {...args} />
    </>
  ),
};

/** No snapshot baseline — the widget starts at zero and climbs from live fills. */
export const ColdStart: Story = {
  args: {
    poolId: "usdc-ngnc",
    pair: "USDC / NGNC",
    feeAsset: "NGNC",
  },
  render: (args) => (
    <>
      <SyntheticFeed poolId={args.poolId} intervalMs={600} />
      <FeeAccumulationTracker {...args} />
    </>
  ),
};
