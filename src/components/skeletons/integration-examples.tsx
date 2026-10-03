/**
 * Integration Examples for Skeleton Components
 * 
 * This file provides real-world examples of integrating skeleton components
 * with React Query and other loading states to eliminate layout shift (CLS).
 * 
 * Copy and adapt these patterns to your components.
 */

import { SkeletonCard } from "./SkeletonCard";
import { SkeletonTable } from "./SkeletonTable";
import { SkeletonChart } from "./SkeletonChart";

// ============================================================================
// Example 1: React Query with Vault Cards
// ============================================================================

/**
 * Example: Using SkeletonCard with React Query
 * Shows vault cards with zero layout shift during initial fetch
 */
export function VaultsPageExample() {
  // Simulated React Query hook
  const { data: vaults, isLoading, error } = useVaultsQuery();

  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <SkeletonCard variant="vault" count={6} />
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500">Failed to load vaults</div>;
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {vaults?.map((vault) => (
        <VaultCard key={vault.id} vault={vault} />
      ))}
    </div>
  );
}

// ============================================================================
// Example 2: React Query with Pool Table
// ============================================================================

/**
 * Example: Using SkeletonTable with React Query
 * Shows pool table with zero layout shift during initial fetch
 */
export function PoolsPageExample() {
  const { data: pools, isLoading, error } = usePoolsQuery();

  if (isLoading) {
    return <SkeletonTable variant="pool" rows={10} showSearch />;
  }

  if (error) {
    return <div className="text-red-500">Failed to load pools</div>;
  }

  return <PoolTable pools={pools} />;
}

// ============================================================================
// Example 3: React Query with Price Chart
// ============================================================================

/**
 * Example: Using SkeletonChart with React Query
 * Shows price chart with zero layout shift during initial fetch
 */
export function PriceChartExample({ pairId }: { pairId: string }) {
  const { data: chartData, isLoading, error } = usePriceDataQuery(pairId);

  if (isLoading) {
    return (
      <SkeletonChart
        variant="price"
        height={400}
        showTimeframes
        showIndicators
      />
    );
  }

  if (error) {
    return <div className="text-red-500">Failed to load chart data</div>;
  }

  return (
    <TokenPriceChart
      pairId={pairId}
      tokenASymbol={chartData.tokenA}
      tokenBSymbol={chartData.tokenB}
      height={400}
    />
  );
}

// ============================================================================
// Example 4: Multiple Skeletons with Staggered Loading
// ============================================================================

/**
 * Example: Dashboard with multiple data sources
 * Shows how to handle different loading states independently
 */
export function DashboardExample() {
  const { data: stats, isLoading: statsLoading } = useStatsQuery();
  const { data: pools, isLoading: poolsLoading } = usePoolsQuery();
  const { data: chartData, isLoading: chartLoading } = useChartDataQuery();

  return (
    <div className="space-y-6">
      {/* Stats Cards Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statsLoading ? (
          <SkeletonCard variant="stats" count={4} />
        ) : (
          stats?.map((stat) => <StatCard key={stat.id} {...stat} />)
        )}
      </div>

      {/* Chart Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          {chartLoading ? (
            <SkeletonChart variant="portfolio" height={300} showTimeframes />
          ) : (
            <PortfolioHistoryChart data={chartData?.history} />
          )}
        </div>
        <div>
          {chartLoading ? (
            <SkeletonChart variant="allocation" height={300} />
          ) : (
            <PortfolioAllocationChart data={chartData?.allocation} />
          )}
        </div>
      </div>

      {/* Pools Table */}
      {poolsLoading ? (
        <SkeletonTable variant="pool" rows={8} showSearch />
      ) : (
        <PoolTable pools={pools} />
      )}
    </div>
  );
}

// ============================================================================
// Example 5: Suspense Boundary Integration
// ============================================================================

/**
 * Example: Using skeletons with React Suspense
 * Modern approach for concurrent rendering
 */
export function SuspenseExample() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <SkeletonChart variant="price" height={400} showTimeframes />
          <SkeletonTable variant="transaction" rows={10} />
        </div>
      }
    >
      <TradingView />
    </Suspense>
  );
}

// ============================================================================
// Example 6: Conditional Loading with LoadingContainer
// ============================================================================

/**
 * Example: Using with existing LoadingContainer component
 * Integrates with the project's LoadingContainer wrapper
 */
export function LoadingContainerExample() {
  const { data: vaults, isLoading } = useVaultsQuery();

  return (
    <LoadingContainer
      isLoading={isLoading}
      fallback={<SkeletonCard variant="vault" count={3} />}
    >
      <div className="grid gap-6 md:grid-cols-3">
        {vaults?.map((vault) => (
          <VaultCard key={vault.id} vault={vault} />
        ))}
      </div>
    </LoadingContainer>
  );
}

// ============================================================================
// Example 7: Refetching / Background Updates
// ============================================================================

/**
 * Example: Handling refetch without showing skeleton
 * Shows skeleton only on initial load, not on background refetch
 */
export function RefetchExample() {
  const { data: pools, isLoading, isFetching, isRefetching } = usePoolsQuery();

  // Show skeleton only on initial load (isLoading), not on refetch
  if (isLoading) {
    return <SkeletonTable variant="pool" rows={10} showSearch />;
  }

  return (
    <div className="relative">
      {/* Optional: Show subtle indicator during background refetch */}
      {isRefetching && (
        <div className="absolute top-0 right-0 z-10">
          <span className="text-xs text-gray-500 animate-pulse">
            Updating...
          </span>
        </div>
      )}
      <PoolTable pools={pools} />
    </div>
  );
}

// ============================================================================
// Example 8: Mixed Content Patterns
// ============================================================================

/**
 * Example: Page with mixed loading states
 * Some data loaded, some still loading
 */
export function MixedLoadingExample() {
  const { data: user } = useUserQuery(); // Already loaded (cached)
  const { data: portfolio, isLoading: portfolioLoading } = usePortfolioQuery();
  const { data: transactions, isLoading: txLoading } = useTransactionsQuery();

  return (
    <div className="space-y-6">
      {/* User header - always rendered (cached) */}
      <UserHeader user={user} />

      {/* Portfolio section - conditional */}
      {portfolioLoading ? (
        <div className="grid gap-6 md:grid-cols-2">
          <SkeletonChart variant="portfolio" height={250} />
          <SkeletonCard variant="stats" count={4} />
        </div>
      ) : (
        <PortfolioOverview portfolio={portfolio} />
      )}

      {/* Transactions section - conditional */}
      {txLoading ? (
        <SkeletonTable variant="transaction" rows={8} />
      ) : (
        <TransactionHistoryTable transactions={transactions} />
      )}
    </div>
  );
}

// ============================================================================
// Example 9: Custom Row Counts Based on Viewport
// ============================================================================

/**
 * Example: Responsive skeleton row counts
 * Adjust skeleton rows based on available space
 */
export function ResponsiveSkeletonExample() {
  const { data: pools, isLoading } = usePoolsQuery();
  const [rowCount, setRowCount] = React.useState(10);

  React.useEffect(() => {
    const updateRowCount = () => {
      // Calculate rows based on viewport height
      const viewportHeight = window.innerHeight;
      const estimatedRows = Math.floor((viewportHeight - 300) / 48); // 48px per row
      setRowCount(Math.max(5, Math.min(estimatedRows, 20)));
    };

    updateRowCount();
    window.addEventListener("resize", updateRowCount);
    return () => window.removeEventListener("resize", updateRowCount);
  }, []);

  if (isLoading) {
    return <SkeletonTable variant="pool" rows={rowCount} showSearch />;
  }

  return <PoolTable pools={pools} />;
}

// ============================================================================
// Mock hooks for examples (replace with real React Query hooks)
// ============================================================================

function useVaultsQuery() {
  return { data: null, isLoading: true, error: null };
}

function usePoolsQuery() {
  return { data: null, isLoading: true, error: null };
}

function usePriceDataQuery(pairId: string) {
  return { data: null, isLoading: true, error: null };
}

function useStatsQuery() {
  return { data: null, isLoading: true, error: null };
}

function useChartDataQuery() {
  return { data: null, isLoading: true, error: null };
}

function useUserQuery() {
  return { data: null };
}

function usePortfolioQuery() {
  return { data: null, isLoading: true };
}

function useTransactionsQuery() {
  return { data: null, isLoading: true };
}

// Mock components
function VaultCard({ vault }: any) {
  return <div>VaultCard</div>;
}
function PoolTable({ pools }: any) {
  return <div>PoolTable</div>;
}
function TokenPriceChart(props: any) {
  return <div>TokenPriceChart</div>;
}
function StatCard(props: any) {
  return <div>StatCard</div>;
}
function PortfolioHistoryChart({ data }: any) {
  return <div>PortfolioHistoryChart</div>;
}
function PortfolioAllocationChart({ data }: any) {
  return <div>PortfolioAllocationChart</div>;
}
function TradingView() {
  return <div>TradingView</div>;
}
function LoadingContainer({ isLoading, fallback, children }: any) {
  return isLoading ? fallback : children;
}
function UserHeader({ user }: any) {
  return <div>UserHeader</div>;
}
function PortfolioOverview({ portfolio }: any) {
  return <div>PortfolioOverview</div>;
}
function TransactionHistoryTable({ transactions }: any) {
  return <div>TransactionHistoryTable</div>;
}

const React = { useEffect: (() => {}) as any, useState: (() => [10, () => {}]) as any };
const Suspense = ({ fallback, children }: any) => children;
