import type { Meta, StoryObj } from '@storybook/react';
import { MobileVoteCard } from './MobileVoteCard';

const meta = {
  title: 'Governance/MobileVoteCard',
  component: MobileVoteCard,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
    },
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
  tags: ['autodocs'],
  argTypes: {
    votingPower: {
      control: { type: 'number', min: 100, max: 1000000, step: 500 },
      description: 'Snapshot voting power for the connected account',
    },
    totalStakingPower: {
      control: { type: 'number', min: 100000, max: 10000000, step: 100000 },
      description: 'Total staking supply across DAO',
    },
    estimatedGasFeeXLM: {
      control: { type: 'text' },
      description: 'Estimated network fee in XLM',
    },
    onVoteSubmitted: {
      action: 'voteSubmitted',
      description: 'Callback when vote is confirmed and submitted',
    },
  },
} satisfies Meta<typeof MobileVoteCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Standard active proposal with default configuration
 */
export const Default: Story = {
  args: {
    proposal: {
      id: 'SFP-12',
      title: 'Whitelist West African GHS/XLM Asset Pair Feed',
      description:
        'Enable automated oracle aggregation and high-throughput remittance corridors for GHS/XLM.',
      proposer: 'GA5THZLKMNPQRSXYZABCDEFGHIJKLMNBC9A',
      status: 'Active',
      votesFor: 785000,
      votesAgainst: 120000,
      quorumThreshold: 60,
      endsInLedgers: 4200,
    },
    votingPower: 12450,
    totalStakingPower: 2850000,
    estimatedGasFeeXLM: '0.000015',
  },
};

/**
 * Pre-selected Vote FOR state
 */
export const PreSelectedFor: Story = {
  args: {
    ...Default.args,
    initialVoteChoice: 'For',
  },
};

/**
 * Pre-selected Vote AGAINST state
 */
export const PreSelectedAgainst: Story = {
  args: {
    ...Default.args,
    initialVoteChoice: 'Against',
  },
};

/**
 * High-stake proposal with whale voting weight
 */
export const WhaleVotingPower: Story = {
  args: {
    proposal: {
      id: 'SFP-11',
      title: 'Adjust Global Deviation Threshold from 2.5% to 1.8%',
      description:
        'Tighten oracle deviation limits to prevent frontrunning in high volatility periods.',
      proposer: 'GBC2VHZLKMNPQRSXYZABCDEFGHIJKLMLOPA',
      status: 'Active',
      votesFor: 450000,
      votesAgainst: 410000,
      quorumThreshold: 60,
      endsInLedgers: 1150,
    },
    votingPower: 450000,
    totalStakingPower: 2850000,
    estimatedGasFeeXLM: '0.000025',
  },
};
