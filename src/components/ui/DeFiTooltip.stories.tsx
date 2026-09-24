import type { Meta, StoryObj } from '@storybook/react';
import { DeFiTooltip } from './DeFiTooltip';
import { DeFiTerm } from './DeFiTerm';

const meta: Meta<typeof DeFiTooltip> = {
  title: 'UI/DeFiTooltip',
  component: DeFiTooltip,
  tags: ['autodocs'],
  argTypes: {
    position: {
      control: { type: 'select' },
      options: ['top', 'bottom', 'left', 'right'],
    },
    showIcon: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof DeFiTooltip>;

export const Slippage: Story = {
  args: {
    termKey: 'slippage',
    position: 'top',
    showIcon: true,
    children: 'Slippage Tolerance',
  },
};

export const TWAPOracle: Story = {
  args: {
    termKey: 'twap',
    position: 'right',
    showIcon: true,
    children: 'TWAP Price Oracle',
  },
};

export const ImpermanentLoss: Story = {
  args: {
    termKey: 'impermanent-loss',
    position: 'bottom',
    showIcon: true,
    children: 'Impermanent Loss',
  },
};

export const HealthFactor: Story = {
  args: {
    termKey: 'health-factor',
    position: 'top',
    showIcon: true,
    children: 'Health Factor',
  },
};

export const CustomContent: Story = {
  args: {
    title: 'Custom Oracle Protocol',
    shortDefinition: 'Specialized data feed operating across Soroban smart contracts.',
    detailedExplanation: 'Provides low-latency localized market rates for NGN, KES, and GHS cross-pairs.',
    docsUrl: 'https://docs.stellarflow.network/architecture/oracles',
    position: 'right',
    showIcon: true,
    children: 'Oracle Protocol',
  },
};

export const InlineWrapperDemo = () => (
  <div className="p-8 bg-slate-950 text-slate-100 space-y-4 max-w-md rounded-xl border border-slate-800">
    <p>
      When executing a trade on Stellar, your maximum <DeFiTerm term="slippage">Slippage</DeFiTerm> determines the allowable price deviation.
    </p>
    <p>
      Our pricing engine uses a <DeFiTerm term="twap" position="right">TWAP Oracle</DeFiTerm> to protect against flash loan attacks.
    </p>
    <p>
      Liquidity providers should monitor potential <DeFiTerm term="impermanent-loss">Impermanent Loss</DeFiTerm> before depositing.
    </p>
    <p>
      Your position collateral currently maintains a safe <DeFiTerm term="health-factor" position="bottom">Health Factor</DeFiTerm> of 1.85.
    </p>
  </div>
);
