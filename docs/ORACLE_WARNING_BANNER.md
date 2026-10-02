# Oracle Warning Banner Component

## Overview

The `OracleWarningBanner` component displays a warning banner across trading and lending interfaces when the off-chain indexer detects stale or diverging oracle price feeds. The banner automatically disables high-risk operations until oracle health is restored.

## Features

- **Real-Time Monitoring**: Tracks oracle feed heartbeat and price deviation metrics
- **Automatic Detection**: Shows warning when oracle update age exceeds 5 minutes or sources diverge >3%
- **Action Protection**: Temporarily disables liquidation and borrowing triggers during warnings
- **Detailed Feed View**: Expandable panel showing individual oracle source status
- **Auto-Resolution**: Banner disappears and actions restore when oracle health returns
- **Manual Refresh**: User can trigger oracle data refresh attempt

## Usage

```typescript
import { OracleWarningBanner } from '@/components';

function TradingInterface() {
  const { oracleMetrics, refreshOracle } = useOracleHealth('XLM/USD');

  return (
    <>
      <OracleWarningBanner
        metrics={oracleMetrics}
        assetPair="XLM/USD"
        onRefresh={refreshOracle}
        onDismiss={() => console.log('User dismissed warning')}
        oracleFeedUrl="https://oracle.stellarflow.network/feeds/xlm-usd"
      />
      
      {/* Trading interface */}
      <BorrowForm disabled={!oracleMetrics.isHealthy} />
    </>
  );
}
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `metrics` | `OracleHealthMetrics` | Yes | Current oracle health metrics |
| `assetPair` | `string` | Yes | Asset pair being monitored (e.g., "XLM/USD") |
| `onDismiss` | `() => void` | No | Callback when user dismisses banner |
| `onRefresh` | `() => void \| Promise<void>` | No | Callback for manual oracle refresh |
| `oracleFeedUrl` | `string` | No | Link to detailed oracle feed information |
| `maxHeartbeatAge` | `number` | No | Max allowed heartbeat age in seconds (default: 300) |
| `maxPriceDeviation` | `number` | No | Max allowed price deviation % (default: 3) |

## OracleHealthMetrics Interface

```typescript
interface OracleHealthMetrics {
  heartbeatAge: number;           // Age in seconds since last update
  priceDeviation: number;         // Max deviation % between sources
  sources: OracleFeedSource[];    // Individual feed sources
  consensusPrice: number | null;  // Median price from sources
  isHealthy: boolean;             // Overall health status
}

interface OracleFeedSource {
  name: string;                   // Source name (e.g., "Chainlink")
  price: number;                  // Current price
  lastUpdate: Date;               // Timestamp of last update
  status: 'healthy' | 'stale' | 'offline';
}
```

## Warning Levels

### Warning (Yellow/Amber)
Triggered when:
- Heartbeat age: 5-10 minutes
- Price deviation: 3-6%
- Action: Display warning, recommend caution

### Critical (Red)
Triggered when:
- Heartbeat age: >10 minutes
- Price deviation: >6%
- Action: Display critical warning, disable operations

## Protected Operations

When oracle warning is active, the following operations are temporarily disabled:

1. **Opening New Borrow Positions**
   - Prevents borrowing with unreliable collateral valuations
   - Existing positions remain intact

2. **Liquidation Triggers**
   - Automatic liquidations paused
   - Prevents unfair liquidations due to price feed issues
   - Manual liquidations still possible with confirmation

3. **Automatic Collateral Rebalancing**
   - Scheduled rebalancing operations suspended
   - Manual adjustments allowed with warnings

## Banner States

### Collapsed (Default)
- Shows asset pair, warning level, and key metrics
- Primary actions: Details, Refresh, View Feeds, Dismiss
- Minimal screen space usage

### Expanded (Details)
- Individual oracle source status with prices
- Last update timestamp per source
- Consensus price and deviation percentage
- List of disabled operations
- Auto-restoration notice

## Integration Examples

### With React Query

```typescript
function useLendingInterface() {
  const { data: oracleHealth } = useQuery(
    ['oracle-health', assetPair],
    () => fetchOracleHealth(assetPair),
    {
      refetchInterval: 30000, // Poll every 30 seconds
      staleTime: 10000,
    }
  );

  const refreshOracle = useMutation(
    () => api.refreshOracleFeeds(assetPair)
  );

  return {
    metrics: oracleHealth,
    refresh: refreshOracle.mutateAsync,
  };
}
```

### With WebSocket Updates

```typescript
function useRealtimeOracleHealth(assetPair: string) {
  const [metrics, setMetrics] = useState<OracleHealthMetrics | null>(null);

  useEffect(() => {
    const ws = new WebSocket('wss://oracle.stellarflow.network/stream');
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.pair === assetPair) {
        setMetrics(data.metrics);
      }
    };

    return () => ws.close();
  }, [assetPair]);

  return metrics;
}
```

### Conditional Rendering

```typescript
function BorrowInterface() {
  const oracleMetrics = useOracleHealth('USDC/USD');
  const canBorrow = oracleMetrics.isHealthy && 
                    oracleMetrics.heartbeatAge < 300 &&
                    oracleMetrics.priceDeviation < 3;

  return (
    <>
      <OracleWarningBanner 
        metrics={oracleMetrics}
        assetPair="USDC/USD"
      />
      
      <BorrowButton 
        disabled={!canBorrow}
        tooltip={!canBorrow ? 'Disabled due to oracle issues' : ''}
      />
    </>
  );
}
```

## Oracle Source Configuration

Typical oracle configuration with multiple sources:

```typescript
const ORACLE_SOURCES = [
  {
    name: 'Chainlink',
    endpoint: 'https://chainlink.oracle.network/price',
    weight: 1.0,
    timeout: 5000,
  },
  {
    name: 'Band Protocol',
    endpoint: 'https://band.oracle.network/price',
    weight: 1.0,
    timeout: 5000,
  },
  {
    name: 'DIA',
    endpoint: 'https://dia.oracle.network/price',
    weight: 0.8,
    timeout: 5000,
  },
];
```

## State Transitions

```
Healthy → Warning → Critical
  ↓         ↓          ↓
  ↓    (Auto-heal)    ↓
  ← ← ← ← ← ← ← ← ← ←
```

The banner:
- Appears when entering Warning or Critical state
- Persists until oracle health fully restores
- Can be temporarily dismissed (reappears on page refresh if still unhealthy)
- Automatically hides when `isHealthy: true` and thresholds are met

## Acceptance Criteria

✅ Banner appears automatically upon detecting stale or diverging oracle feeds  
✅ Warning displayed when update age exceeds 5 minutes  
✅ Warning displayed when price sources diverge >3%  
✅ Liquidation and borrowing triggers temporarily disabled during active warnings  
✅ Link to view individual oracle price feed sources included  
✅ Banner hides and actions restore automatically when oracle health returns  
✅ Manual refresh button triggers oracle data update  
✅ Expanded details show per-source status and timestamps

## Security Considerations

- Never trust stale oracle data for financial operations
- Implement circuit breakers for extended outages
- Log all oracle health state changes for audit
- Alert administrators on critical oracle failures
- Provide manual override only for authorized roles

## Performance Optimization

- Poll oracle health every 30 seconds (not every second)
- Cache consensus price calculations
- Debounce warning banner animations
- Lazy load detailed source information
- Use WebSocket for real-time updates when available

## Testing

Run Storybook to view interactive examples:

```bash
npm run storybook
```

Navigate to: `Components/OracleWarningBanner`

Test scenarios:
- Healthy state (banner hidden)
- Stale heartbeat warning
- Price divergence warning
- Critical combined state
- Auto-resolution flow
- Manual refresh action
