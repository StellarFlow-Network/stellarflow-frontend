import type { Meta, StoryObj } from "@storybook/react";
import RelayerStatusTable from "./RelayerStatusTable";

const meta: Meta<typeof RelayerStatusTable> = {
  title: "UI/Tables/RelayerStatusTable",
  component: RelayerStatusTable,
  tags: ["autodocs"],
  argTypes: {
    relayers: {
      control: "object",
      description: "Array of relayer objects to display in the table",
    },
  },
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
        component: "A high-performance table component for displaying relayer statuses with optimized re-renders. Each row is memoized to ensure only updated rows re-render during socket updates. Features animated status indicators, latency display, and responsive design.",
      },
    },
    backgrounds: {
      default: "dark",
    },
  },
  decorators: [
    (Story) => (
      <div className="p-8 bg-gray-900 max-w-4xl">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof RelayerStatusTable>;

const sampleRelayers = [
  { id: "1", name: "US-East-1", status: "Online" as const, latency: 45 },
  { id: "2", name: "EU-West-1", status: "Online" as const, latency: 89 },
  { id: "3", name: "AP-Southeast-1", status: "Syncing" as const, latency: 156 },
  { id: "4", name: "SA-Brazil-1", status: "Offline" as const, latency: 999 },
];

export const Default: Story = {
  args: {
    relayers: sampleRelayers,
  },
};

export const EmptyState: Story = {
  args: {
    relayers: [],
  },
};

export const AllOnline: Story = {
  args: {
    relayers: [
      { id: "1", name: "US-East-1", status: "Online" as const, latency: 42 },
      { id: "2", name: "EU-West-1", status: "Online" as const, latency: 78 },
      { id: "3", name: "AP-Northeast-1", status: "Online" as const, latency: 112 },
    ],
  },
};

export const AllOffline: Story = {
  args: {
    relayers: [
      { id: "1", name: "US-West-1", status: "Offline" as const, latency: 999 },
      { id: "2", name: "EU-Central-1", status: "Offline" as const, latency: 999 },
    ],
  },
};

export const MixedLoad: Story = {
  args: {
    relayers: [
      { id: "1", name: "US-East-1 (Primary)", status: "Online" as const, latency: 38 },
      { id: "2", name: "US-East-2 (Backup)", status: "Online" as const, latency: 45 },
      { id: "3", name: "EU-West-1 (Primary)", status: "Online" as const, latency: 82 },
      { id: "4", name: "EU-West-2 (Backup)", status: "Syncing" as const, latency: 234 },
      { id: "5", name: "AP-Southeast-1", status: "Online" as const, latency: 145 },
      { id: "6", name: "SA-Brazil-1", status: "Offline" as const, latency: 999 },
      { id: "7", name: "AU-Southeast-1", status: "Online" as const, latency: 198 },
    ],
  },
};

export const SingleRelayer: Story = {
  args: {
    relayers: [
      { id: "1", name: "Single-Relayer-Node", status: "Online" as const, latency: 55 },
    ],
  },
};