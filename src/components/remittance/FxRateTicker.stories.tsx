import type { Meta, StoryObj } from "@storybook/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import FxRateTicker from "./FxRateTicker";
import FxComparisonTable from "./FxComparisonTable";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const meta: Meta<typeof FxRateTicker> = {
  title: "Remittance/FxRateTicker",
  component: FxRateTicker,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Live fiat conversion rates for the remittance corridors (USD → EUR, NGN, BRL, KES), polling `/api/fx-rates` every 15s. Falls back to a static snapshot in environments (like Storybook) where the route isn't served.",
      },
    },
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <div className="max-w-2xl bg-neutral-950 p-6">
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof FxRateTicker>;

export const Default: Story = {
  args: {},
};

export const WithComparisonTable: Story = {
  render: () => (
    <div className="space-y-4">
      <FxRateTicker />
      <FxComparisonTable />
    </div>
  ),
};
