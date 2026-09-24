import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { MockWalletProvider } from "./MockWalletProvider";
import { useWallet } from "./WalletProvider";
import { MockRpcSandboxProvider, useMockRpcSandbox } from "./MockRpcSandboxProvider";

/**
 * A tiny demo consumer showing what a real component would see when mounted
 * inside `MockWalletProvider` + `MockRpcSandboxProvider`: a connected wallet
 * with pre-funded balances, and RPC calls that resolve (or fail) according
 * to the sandbox's configurable latency/failure controls.
 */
function SandboxDemo() {
  const { wallet } = useWallet();
  const { config, callCount, simulateTransaction, sendTransaction } = useMockRpcSandbox();
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const runTransaction = async () => {
    setBusy(true);
    const sim = await simulateTransaction();
    if (sim.status === "ERROR") {
      setLog((prev) => [`❌ simulateTransaction failed: ${sim.error}`, ...prev].slice(0, 6));
      setBusy(false);
      return;
    }
    const sent = await sendTransaction();
    setLog((prev) => [
      sent.status === "SUCCESS"
        ? `✅ sendTransaction succeeded — hash ${sent.hash.slice(0, 12)}…`
        : `❌ sendTransaction failed: ${sent.error}`,
      ...prev,
    ].slice(0, 6));
    setBusy(false);
  };

  return (
    <div className="max-w-md space-y-4 rounded-2xl border border-gray-800 bg-gray-900 p-5 text-sm text-gray-200">
      <div>
        <p className="text-xs uppercase tracking-wide text-gray-500">Mock Wallet</p>
        <p className="font-mono text-xs break-all">{wallet?.publicKey ?? "Disconnected"}</p>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-gray-500">Sandbox Config</p>
        <p className="text-xs text-gray-400">
          Latency: {config.latencyMs}ms · Failure rate: {(config.failureRate * 100).toFixed(0)}% · Calls made:{" "}
          {callCount}
        </p>
      </div>

      <button
        type="button"
        onClick={runTransaction}
        disabled={busy}
        className="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
      >
        {busy ? "Simulating…" : "Simulate + Send Transaction"}
      </button>

      <div className="space-y-1 text-xs">
        {log.length === 0 ? (
          <p className="text-gray-500">No calls yet.</p>
        ) : (
          log.map((entry, i) => <p key={i}>{entry}</p>)
        )}
      </div>
    </div>
  );
}

interface DemoArgs {
  latencyMs: number;
  failureRate: number;
  xlmBalance: string;
  usdcBalance: string;
}

const meta: Meta<DemoArgs> = {
  title: "Providers/MockRpcSandbox",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Combines `MockWalletProvider` (pre-funded mock wallet) with `MockRpcSandboxProvider` (simulated Soroban RPC responses) for fully offline local development and Storybook testing. Use the controls below to dial in network latency and transaction failure rate live.",
      },
    },
  },
  argTypes: {
    latencyMs: { control: { type: "range", min: 0, max: 3000, step: 50 } },
    failureRate: { control: { type: "range", min: 0, max: 1, step: 0.05 } },
    xlmBalance: { control: "text" },
    usdcBalance: { control: "text" },
  },
  args: {
    latencyMs: 400,
    failureRate: 0,
    xlmBalance: "10000.0000000",
    usdcBalance: "500.0000000",
  },
  render: (args) => (
    <MockWalletProvider
      config={{
        initialConnected: true,
        mockBalances: { XLM: args.xlmBalance, USDC: args.usdcBalance },
      }}
    >
      <MockRpcSandboxProvider
        config={{ latencyMs: args.latencyMs, failureRate: args.failureRate }}
      >
        <SandboxDemo />
      </MockRpcSandboxProvider>
    </MockWalletProvider>
  ),
};

export default meta;
type Story = StoryObj<DemoArgs>;

export const Default: Story = {};

export const HighLatency: Story = {
  args: { latencyMs: 2500 },
};

export const FlakyNetwork: Story = {
  args: { latencyMs: 600, failureRate: 0.5 },
};

export const AlwaysFails: Story = {
  args: { latencyMs: 300, failureRate: 1 },
};
