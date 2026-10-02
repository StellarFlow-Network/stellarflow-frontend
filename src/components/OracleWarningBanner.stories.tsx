import type { Meta, StoryObj } from '@storybook/react';
import { OracleWarningBanner, type OracleHealthMetrics } from './OracleWarningBanner';

const meta: Meta<typeof OracleWarningBanner> = {
  title: 'Components/OracleWarningBanner',
  component: OracleWarningBanner,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof OracleWarningBanner>;

const healthyMetrics: OracleHealthMetrics = {
  heartbeatAge: 30,
  priceDeviation: 0.5,
  sources: [
    {
      name: 'Chainlink',
      price: 0.1234,
      lastUpdate: new Date(Date.now() - 30000),
      status: 'healthy',
    },
    {
      name: 'Band Protocol',
      price: 0.1235,
      lastUpdate: new Date(Date.now() - 25000),
      status: 'healthy',
    },
    {
      name: 'DIA',
      price: 0.1233,
      lastUpdate: new Date(Date.now() - 40000),
      status: 'healthy',
    },
  ],
  consensusPrice: 0.1234,
  isHealthy: true,
};

const staleMetrics: OracleHealthMetrics = {
  heartbeatAge: 400, // Over 5 minutes
  priceDeviation: 1.2,
  sources: [
    {
      name: 'Chainlink',
      price: 0.1234,
      lastUpdate: new Date(Date.now() - 400000),
      status: 'stale',
    },
    {
      name: 'Band Protocol',
      price: 0.1235,
      lastUpdate: new Date(Date.now() - 350000),
      status: 'stale',
    },
    {
      name: 'DIA',
      price: 0.1233,
      lastUpdate: new Date(Date.now() - 420000),
      status: 'stale',
    },
  ],
  consensusPrice: 0.1234,
  isHealthy: false,
};

const divergingMetrics: OracleHealthMetrics = {
  heartbeatAge: 45,
  priceDeviation: 4.8, // Over 3%
  sources: [
    {
      name: 'Chainlink',
      price: 0.1234,
      lastUpdate: new Date(Date.now() - 30000),
      status: 'healthy',
    },
    {
      name: 'Band Protocol',
      price: 0.1294, // Diverging price
      lastUpdate: new Date(Date.now() - 25000),
      status: 'healthy',
    },
    {
      name: 'DIA',
      price: 0.1233,
      lastUpdate: new Date(Date.now() - 40000),
      status: 'healthy',
    },
  ],
  consensusPrice: 0.1254,
  isHealthy: false,
};

const criticalMetrics: OracleHealthMetrics = {
  heartbeatAge: 700, // Very stale
  priceDeviation: 8.5, // High divergence
  sources: [
    {
      name: 'Chainlink',
      price: 0.1234,
      lastUpdate: new Date(Date.now() - 700000),
      status: 'stale',
    },
    {
      name: 'Band Protocol',
      price: 0.1334, // Very divergent
      lastUpdate: new Date(Date.now() - 650000),
      status: 'stale',
    },
    {
      name: 'DIA',
      price: 0.1133,
      lastUpdate: new Date(Date.now() - 800000),
      status: 'offline',
    },
  ],
  consensusPrice: 0.1234,
  isHealthy: false,
};

export const Healthy: Story = {
  args: {
    metrics: healthyMetrics,
    assetPair: 'XLM/USD',
    onDismiss: () => console.log('Dismissed'),
    onRefresh: () => console.log('Refreshing...'),
    oracleFeedUrl: 'https://oracle.stellarflow.network/feeds/xlm-usd',
  },
};

export const StaleHeartbeat: Story = {
  args: {
    metrics: staleMetrics,
    assetPair: 'XLM/USD',
    onDismiss: () => console.log('Dismissed'),
    onRefresh: () => console.log('Refreshing...'),
    oracleFeedUrl: 'https://oracle.stellarflow.network/feeds/xlm-usd',
  },
};

export const PriceDiverging: Story = {
  args: {
    metrics: divergingMetrics,
    assetPair: 'USDC/USD',
    onDismiss: () => console.log('Dismissed'),
    onRefresh: () => console.log('Refreshing...'),
    oracleFeedUrl: 'https://oracle.stellarflow.network/feeds/usdc-usd',
  },
};

export const CriticalState: Story = {
  args: {
    metrics: criticalMetrics,
    assetPair: 'BTC/USD',
    onDismiss: () => console.log('Dismissed'),
    onRefresh: () => console.log('Refreshing...'),
    oracleFeedUrl: 'https://oracle.stellarflow.network/feeds/btc-usd',
  },
};

export const WithoutDismiss: Story = {
  args: {
    metrics: staleMetrics,
    assetPair: 'XLM/USD',
    onRefresh: () => console.log('Refreshing...'),
    oracleFeedUrl: 'https://oracle.stellarflow.network/feeds/xlm-usd',
  },
};
