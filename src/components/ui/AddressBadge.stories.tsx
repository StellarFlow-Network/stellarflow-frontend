import type { Meta, StoryObj } from "@storybook/react";
import { AddressBadge } from "./AddressBadge";

const meta: Meta<typeof AddressBadge> = {
  title: "UI/Badges/AddressBadge",
  component: AddressBadge,
  tags: ["autodocs"],
  argTypes: {
    address: {
      control: "text",
      description: "The blockchain address to display",
    },
    showCopyButton: {
      control: "boolean",
      description: "Whether to show the copy to clipboard button",
    },
    showAvatar: {
      control: "boolean",
      description: "Whether to show the Jazzicon avatar",
    },
    truncateLength: {
      control: { type: "number", min: 4, max: 20, step: 1 },
      description: "Number of characters to keep at start/end of address",
    },
  },
  parameters: {
    a11y: {
      config: {
        rules: [
          {
            id: "color-contrast",
            reviewOnFail: true,
          },
        ],
      },
    },
    docs: {
      description: {
        component: "A reusable badge component for displaying blockchain addresses with copy-to-clipboard functionality and Jazzicon avatars.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof AddressBadge>;

export const Default: Story = {
  args: {
    address: "0x742d35Cc6634C0532925a3b844Bc9e7595f4b781",
    showCopyButton: true,
    showAvatar: true,
  },
};

export const LongAddress: Story = {
  args: {
    address: "0x1234567890abcdef1234567890abcdef12345678",
    showCopyButton: true,
    showAvatar: true,
  },
};

export const WithoutAvatar: Story = {
  args: {
    address: "0x742d35Cc6634C0532925a3b844Bc9e7595f4b781",
    showCopyButton: true,
    showAvatar: false,
  },
};

export const WithoutCopyButton: Story = {
  args: {
    address: "0x742d35Cc6634C0532925a3b844Bc9e7595f4b781",
    showCopyButton: false,
    showAvatar: true,
  },
};

export const CustomTruncation: Story = {
  args: {
    address: "0x742d35Cc6634C0532925a3b844Bc9e7595f4b781",
    showCopyButton: true,
    showAvatar: true,
    truncateLength: 6,
  },
};