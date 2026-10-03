import type { Meta, StoryObj } from "@storybook/react";
import { ContractVersionBadge } from "./ContractVersionBadge";

const meta: Meta<typeof ContractVersionBadge> = {
  title: "Contracts/ContractVersionBadge",
  component: ContractVersionBadge,
  tags: ["autodocs"],
  argTypes: {
    version: {
      control: "text",
      description: "Pre-supplied version tag (skips network reads)",
    },
    kind: {
      control: "select",
      options: ["current", "legacy", "beta", "unknown"],
      description: "Deployment classification used to theme the badge",
    },
    showKind: {
      control: "boolean",
      description: "Also render the Current/Legacy/Beta classification label",
    },
    showHash: {
      control: "boolean",
      description: "Render the short wasm hash alongside the tag",
    },
    hideOnError: {
      control: "boolean",
      description: "Hide the badge entirely when metadata cannot be resolved",
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
        component:
          "Visual badge that surfaces a Soroban contract's version tag so users know whether they are interacting with a legacy or current deployment.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ContractVersionBadge>;

export const Current: Story = {
  args: {
    version: "v2.0",
    kind: "current",
    showKind: true,
  },
};

export const Legacy: Story = {
  args: {
    version: "v1.0",
    kind: "legacy",
    showKind: true,
  },
};

export const Beta: Story = {
  args: {
    version: "v2.0-beta",
    kind: "beta",
    showKind: true,
  },
};

export const WithWasmHash: Story = {
  args: {
    version: "v1.0",
    kind: "legacy",
    fallbackWasmHash: "8a92ec5a3b1f0d7c4e6a2b91f3c8d0e5a6b7c1d2e3f405162738495a6b7c8d9e",
    showHash: true,
    showKind: true,
  },
};

export const Unknown: Story = {
  args: {
    contractId: "CBA2VUOUDHGAAAAOMEVSEQXMNOBDXKJ5AIWNBQELZGCZOYR2DJW2OP7M",
  },
};
