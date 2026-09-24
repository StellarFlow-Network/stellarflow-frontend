import type { Meta, StoryObj } from '@storybook/react';
import { VotingPowerCalculator } from './VotingPowerCalculator';

const meta = {
  title: 'Governance/VotingPowerCalculator',
  component: VotingPowerCalculator,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
    },
  },
  tags: ['autodocs'],
  argTypes: {
    totalVeSupply: {
      control: { type: 'number', min: 100000, max: 100000000, step: 100000 },
      description: 'Total veFLOW supply in the governance system',
    },
    userBalance: {
      control: { type: 'number', min: 0, max: 1000000, step: 1000 },
      description: 'User\'s available FLOW balance for validation',
    },
    onLockTokens: {
      action: 'lockTokens',
      description: 'Callback when user confirms lock',
    },
  },
} satisfies Meta<typeof VotingPowerCalculator>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default calculator with standard configuration
 */
export const Default: Story = {
  args: {
    totalVeSupply: 10_000_000,
    onLockTokens: (amount, weeks) => {
      console.log(`Locking ${amount} FLOW for ${weeks} weeks`);
    },
  },
};

/**
 * Calculator with user balance for validation
 */
export const WithUserBalance: Story = {
  args: {
    totalVeSupply: 10_000_000,
    userBalance: 50_000,
    onLockTokens: (amount, weeks) => {
      console.log(`Locking ${amount} FLOW for ${weeks} weeks`);
    },
  },
};

/**
 * Large whale scenario - high token amounts
 */
export const WhaleScenario: Story = {
  args: {
    totalVeSupply: 10_000_000,
    userBalance: 500_000,
    onLockTokens: (amount, weeks) => {
      console.log(`Locking ${amount} FLOW for ${weeks} weeks`);
    },
  },
};

/**
 * Low supply scenario - easier to gain voting power
 */
export const LowSupplyScenario: Story = {
  args: {
    totalVeSupply: 1_000_000,
    userBalance: 10_000,
    onLockTokens: (amount, weeks) => {
      console.log(`Locking ${amount} FLOW for ${weeks} weeks`);
    },
  },
};

/**
 * Read-only calculator without lock action
 */
export const ReadOnly: Story = {
  args: {
    totalVeSupply: 10_000_000,
    userBalance: 25_000,
  },
};

/**
 * High competition scenario - very high total supply
 */
export const HighCompetitionScenario: Story = {
  args: {
    totalVeSupply: 50_000_000,
    userBalance: 100_000,
    onLockTokens: (amount, weeks) => {
      console.log(`Locking ${amount} FLOW for ${weeks} weeks`);
    },
  },
};
