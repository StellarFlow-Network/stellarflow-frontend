import type { Meta, StoryObj } from '@storybook/react';
import { SkeletonCard } from './SkeletonCard';
import { SkeletonTable } from './SkeletonTable';
import { SkeletonChart } from './SkeletonChart';

// ============================================================================
// SkeletonCard Stories
// ============================================================================

const cardMeta: Meta<typeof SkeletonCard> = {
  title: 'Loading/SkeletonCard',
  component: SkeletonCard,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Animated shimmer loading skeletons for card layouts. Matches VaultCard, PoolPnLCard, FarmCard, and generic stat cards.',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['vault', 'pool', 'farm', 'stats'],
      description: 'Card variant to display',
    },
    count: {
      control: { type: 'number', min: 1, max: 12 },
      description: 'Number of skeleton cards to render',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
};

export default cardMeta;
type CardStory = StoryObj<typeof SkeletonCard>;

export const VaultCard: CardStory = {
  args: {
    variant: 'vault',
    count: 1,
  },
};

export const VaultCardGrid: CardStory = {
  args: {
    variant: 'vault',
    count: 3,
  },
  decorators: [
    (Story) => (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Story />
      </div>
    ),
  ],
};

export const PoolCard: CardStory = {
  args: {
    variant: 'pool',
    count: 1,
  },
};

export const FarmCard: CardStory = {
  args: {
    variant: 'farm',
    count: 1,
  },
};

export const StatsCard: CardStory = {
  args: {
    variant: 'stats',
    count: 1,
  },
};

export const StatsCardGrid: CardStory = {
  args: {
    variant: 'stats',
    count: 4,
  },
  decorators: [
    (Story) => (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Story />
      </div>
    ),
  ],
};

export const AllCardVariants: CardStory = {
  render: () => (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold mb-4">Vault Card</h3>
        <SkeletonCard variant="vault" count={1} />
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-4">Pool Card</h3>
        <SkeletonCard variant="pool" count={1} />
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-4">Farm Card</h3>
        <SkeletonCard variant="farm" count={1} />
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-4">Stats Card</h3>
        <SkeletonCard variant="stats" count={1} />
      </div>
    </div>
  ),
};

// ============================================================================
// SkeletonTable Stories
// ============================================================================

const tableMeta: Meta<typeof SkeletonTable> = {
  title: 'Loading/SkeletonTable',
  component: SkeletonTable,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Animated shimmer loading skeletons for table layouts. Matches PoolTable, TransactionHistoryTable, and other data tables.',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['pool', 'transaction', 'corridor', 'relayer'],
      description: 'Table variant to display',
    },
    rows: {
      control: { type: 'number', min: 1, max: 20 },
      description: 'Number of skeleton rows to render',
    },
    showSearch: {
      control: 'boolean',
      description: 'Show search bar in header',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
};

export const tableMeta_export = tableMeta;
type TableStory = StoryObj<typeof SkeletonTable>;

export const PoolTable: TableStory = {
  args: {
    variant: 'pool',
    rows: 8,
    showSearch: true,
  },
};

export const PoolTableWithoutSearch: TableStory = {
  args: {
    variant: 'pool',
    rows: 8,
    showSearch: false,
  },
};

export const TransactionTable: TableStory = {
  args: {
    variant: 'transaction',
    rows: 10,
  },
};

export const CorridorTable: TableStory = {
  args: {
    variant: 'corridor',
    rows: 8,
  },
};

export const RelayerTable: TableStory = {
  args: {
    variant: 'relayer',
    rows: 6,
  },
};

export const LargeTable: TableStory = {
  args: {
    variant: 'pool',
    rows: 20,
    showSearch: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Table with 20 rows to test scrolling and performance',
      },
    },
  },
};

export const AllTableVariants: TableStory = {
  render: () => (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold mb-4">Pool Table</h3>
        <SkeletonTable variant="pool" rows={5} showSearch />
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-4">Transaction Table</h3>
        <SkeletonTable variant="transaction" rows={5} />
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-4">Corridor Table</h3>
        <SkeletonTable variant="corridor" rows={5} />
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-4">Relayer Table</h3>
        <SkeletonTable variant="relayer" rows={5} />
      </div>
    </div>
  ),
};

// ============================================================================
// SkeletonChart Stories
// ============================================================================

const chartMeta: Meta<typeof SkeletonChart> = {
  title: 'Loading/SkeletonChart',
  component: SkeletonChart,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Animated shimmer loading skeletons for chart components. Matches TokenPriceChart, PortfolioHistoryChart, and other visualization components.',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['price', 'liquidity', 'portfolio', 'allocation', 'orderbook', 'apy'],
      description: 'Chart variant to display',
    },
    height: {
      control: { type: 'number', min: 200, max: 600, step: 50 },
      description: 'Chart container height in pixels',
    },
    showTimeframes: {
      control: 'boolean',
      description: 'Show timeframe selector controls',
    },
    showIndicators: {
      control: 'boolean',
      description: 'Show indicator toggle controls',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
};

export const chartMeta_export = chartMeta;
type ChartStory = StoryObj<typeof SkeletonChart>;

export const PriceChart: ChartStory = {
  args: {
    variant: 'price',
    height: 400,
    showTimeframes: true,
    showIndicators: true,
  },
};

export const PriceChartMinimal: ChartStory = {
  args: {
    variant: 'price',
    height: 400,
    showTimeframes: false,
    showIndicators: false,
  },
};

export const LiquidityChart: ChartStory = {
  args: {
    variant: 'liquidity',
    height: 350,
  },
};

export const PortfolioChart: ChartStory = {
  args: {
    variant: 'portfolio',
    height: 300,
    showTimeframes: true,
  },
};

export const AllocationChart: ChartStory = {
  args: {
    variant: 'allocation',
    height: 300,
  },
};

export const OrderBookChart: ChartStory = {
  args: {
    variant: 'orderbook',
    height: 400,
  },
};

export const ApyChart: ChartStory = {
  args: {
    variant: 'apy',
    height: 200,
  },
};

export const ChartGrid: ChartStory = {
  render: () => (
    <div className="grid gap-6 lg:grid-cols-2">
      <SkeletonChart variant="portfolio" height={300} showTimeframes />
      <SkeletonChart variant="allocation" height={300} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Example of multiple charts in a grid layout (dashboard pattern)',
      },
    },
  },
};

export const AllChartVariants: ChartStory = {
  render: () => (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold mb-4">Price Chart</h3>
        <SkeletonChart variant="price" height={400} showTimeframes showIndicators />
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-4">Liquidity Chart</h3>
        <SkeletonChart variant="liquidity" height={350} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="text-lg font-semibold mb-4">Portfolio Chart</h3>
          <SkeletonChart variant="portfolio" height={300} showTimeframes />
        </div>
        <div>
          <h3 className="text-lg font-semibold mb-4">Allocation Chart</h3>
          <SkeletonChart variant="allocation" height={300} />
        </div>
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-4">OrderBook Chart</h3>
        <SkeletonChart variant="orderbook" height={400} />
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-4">APY Chart (Compact)</h3>
        <SkeletonChart variant="apy" height={200} />
      </div>
    </div>
  ),
};

// ============================================================================
// Combined Dashboard Example
// ============================================================================

export const DashboardExample: StoryObj = {
  render: () => (
    <div className="space-y-6 p-6 bg-neutral-950 min-h-screen">
      <h2 className="text-2xl font-bold text-neutral-200">Dashboard Loading State</h2>
      
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SkeletonCard variant="stats" count={4} />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SkeletonChart variant="portfolio" height={300} showTimeframes />
        </div>
        <div>
          <SkeletonChart variant="allocation" height={300} />
        </div>
      </div>

      {/* Table */}
      <SkeletonTable variant="pool" rows={10} showSearch />
    </div>
  ),
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        story: 'Complete dashboard loading state example showing how different skeleton components work together',
      },
    },
  },
};

// Export table and chart metas with proper names
export { tableMeta_export as SkeletonTable_Meta };
export { chartMeta_export as SkeletonChart_Meta };
