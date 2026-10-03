import type { Meta, StoryObj } from '@storybook/react';
import { FiatRampDrawer } from './FiatRampDrawer';

const meta: Meta<typeof FiatRampDrawer> = {
  title: 'Remittance/FiatRampDrawer',
  component: FiatRampDrawer,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof FiatRampDrawer>;

export const Default: Story = {
  args: {
    isOpen: true,
    walletAddress: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    defaultCurrency: 'USDC',
    defaultAmount: 100,
    onClose: () => console.log('Close drawer'),
    onProviderSelected: (provider, method) => console.log('Selected:', provider, method),
  },
};

export const WithHighAmount: Story = {
  args: {
    isOpen: true,
    walletAddress: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    defaultCurrency: 'XLM',
    defaultAmount: 500,
    onClose: () => console.log('Close drawer'),
    onProviderSelected: (provider, method) => console.log('Selected:', provider, method),
  },
};

export const MobileMoneyPreferred: Story = {
  args: {
    isOpen: true,
    walletAddress: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    defaultCurrency: 'USDC',
    defaultAmount: 50,
    onClose: () => console.log('Close drawer'),
    onProviderSelected: (provider, method) => console.log('Selected:', provider, method),
  },
};
