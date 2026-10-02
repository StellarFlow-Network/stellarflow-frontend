import type { Meta, StoryObj } from '@storybook/react';
import { AccountSwitcherDropdown, type WalletAccount } from './AccountSwitcherDropdown';

const meta: Meta<typeof AccountSwitcherDropdown> = {
  title: 'Navigation/AccountSwitcherDropdown',
  component: AccountSwitcherDropdown,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof AccountSwitcherDropdown>;

const mockAccounts: WalletAccount[] = [
  {
    publicKey: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX1',
    label: 'Main Account',
    balance: '1,234.56 XLM',
    balanceUSD: '123.45',
    isActive: true,
  },
  {
    publicKey: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX2',
    label: 'Trading Account',
    balance: '5,678.90 XLM',
    balanceUSD: '567.89',
    isActive: false,
  },
  {
    publicKey: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX3',
    label: 'Savings',
    balance: '10,000.00 XLM',
    balanceUSD: '1,000.00',
    isActive: false,
  },
];

export const Default: Story = {
  args: {
    accounts: mockAccounts,
    activeAccountKey: mockAccounts[0].publicKey,
    onAccountSwitch: (key) => console.log('Switching to:', key),
    onAddAccount: () => console.log('Adding new account'),
  },
};

export const SingleAccount: Story = {
  args: {
    accounts: [mockAccounts[0]],
    activeAccountKey: mockAccounts[0].publicKey,
    onAccountSwitch: (key) => console.log('Switching to:', key),
    onAddAccount: () => console.log('Adding new account'),
  },
};

export const Loading: Story = {
  args: {
    accounts: mockAccounts,
    activeAccountKey: mockAccounts[0].publicKey,
    onAccountSwitch: (key) => console.log('Switching to:', key),
    onAddAccount: () => console.log('Adding new account'),
    isLoading: true,
  },
};

export const WithoutAddAccount: Story = {
  args: {
    accounts: mockAccounts,
    activeAccountKey: mockAccounts[0].publicKey,
    onAccountSwitch: (key) => console.log('Switching to:', key),
  },
};
