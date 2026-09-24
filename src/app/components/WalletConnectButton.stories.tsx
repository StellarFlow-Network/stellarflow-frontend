import type { Meta, StoryObj } from "@storybook/react";
import WalletConnectButton from "./WalletConnectButton";
import { WalletProvider } from "@/app/hooks/useWalletState";

const meta: Meta<typeof WalletConnectButton> = {
  title: "UI/Buttons/WalletConnectButton",
  component: WalletConnectButton,
  tags: ["autodocs"],
  parameters: {
    a11y: {
      config: {
        rules: [
          {
            id: "color-contrast",
            reviewOnFail: true,
          },
        ],
      },
    },
    docs: {
      description: {
        component: "A self-contained wallet connection button that includes its own WalletProvider boundary. Dynamically imported to keep wallet logic out of the initial JavaScript bundle. Features smooth animations, loading states, and wallet address truncation.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="p-8 bg-gray-900">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof WalletConnectButton>;

export const Default: Story = {
  args: {},
};

// Disconnected state (default)
export const Disconnected: Story = {
  render: () => (
    <div className="space-y-4">
      <p className="text-white mb-4">Default disconnected state with "Connect Wallet" label:</p>
      <WalletConnectButton />
    </div>
  ),
};

// Show loading state with a mock
export const CheckingWallet: Story = {
  render: () => {
    // Mock the isChecking state to show loading
    return (
      <div className="space-y-4">
        <p className="text-white mb-4">Loading state while checking wallet status:</p>
        <button
          disabled={true}
          className="wallet-btn group flex min-w-0 items-center gap-2 px-3 sm:gap-2.5 sm:px-4 py-2 rounded-2xl font-semibold text-sm sm:text-base transition-all duration-300 hover:shadow-xl active:scale-95 whitespace-nowrap opacity-70"
        >
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Checking...</span>
        </button>
      </div>
    );
  },
};

// Connected state with truncated address
export const Connected: Story = {
  render: () => (
    <div className="space-y-4">
      <p className="text-white mb-4">Connected state showing truncated wallet address:</p>
      <button
        onClick={() => {}}
        className="wallet-btn group flex min-w-0 items-center gap-2 px-3 sm:gap-2.5 sm:px-4 py-2 rounded-2xl font-semibold text-sm sm:text-base transition-all duration-300 hover:shadow-xl active:scale-95 whitespace-nowrap"
      >
        <svg
          className="transition-transform group-hover:rotate-12"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M21 12V7H5.41L12 13.59L13.41 12.17L18 16.59V12H21Z" />
          <path d="M3 5v14h18v-2H5V7h16V5H3z" />
        </svg>
        <span className="truncate">GCDH...XYZ1</span>
      </button>
    </div>
  ),
};