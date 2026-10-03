import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { FoundationSection, TokenGrid } from "./shared";

const meta: Meta = {
  title: "Foundations/Radii",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "`tailwind.config.js` does not extend `theme.borderRadius`, so every `rounded-*` " +
          "utility in the app resolves to Tailwind v4's built-in default scale, reproduced here. " +
          "Common app usages: `rounded-lg`/`rounded-xl` for cards and panels, `rounded-full` for " +
          "toggles, badges, and avatars.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

const RADII: { name: string; valueRem: number | "full" }[] = [
  { name: "rounded-none", valueRem: 0 },
  { name: "rounded-sm", valueRem: 0.125 },
  { name: "rounded (default)", valueRem: 0.25 },
  { name: "rounded-md", valueRem: 0.375 },
  { name: "rounded-lg", valueRem: 0.5 },
  { name: "rounded-xl", valueRem: 0.75 },
  { name: "rounded-2xl", valueRem: 1 },
  { name: "rounded-3xl", valueRem: 1.5 },
  { name: "rounded-full", valueRem: "full" },
];

export const DefaultScale: Story = {
  render: () => (
    <FoundationSection title="Border radius scale">
      <TokenGrid>
        {RADII.map((r) => (
          <div key={r.name} style={{ padding: "0.5rem" }}>
            <div
              style={{
                height: 64,
                background: "var(--color-neon-green)",
                opacity: 0.85,
                borderRadius: r.valueRem === "full" ? 9999 : `${r.valueRem}rem`,
              }}
            />
            <p style={{ fontSize: "0.8125rem", fontWeight: 500, marginTop: "0.75rem", marginBottom: 0 }}>{r.name}</p>
            <p style={{ fontSize: "0.75rem", color: "var(--muted)", fontFamily: "monospace", marginTop: "0.125rem" }}>
              {r.valueRem === "full" ? "9999px" : `${r.valueRem}rem`}
            </p>
          </div>
        ))}
      </TokenGrid>
    </FoundationSection>
  ),
};
