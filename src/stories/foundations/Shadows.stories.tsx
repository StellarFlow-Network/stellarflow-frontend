import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { FoundationSection, TokenGrid } from "./shared";

const meta: Meta = {
  title: "Foundations/Shadows",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "`tailwind.config.js` does not extend `theme.boxShadow`, so every `shadow-*` " +
          "utility in the app resolves to Tailwind v4's built-in default scale, reproduced here.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

const SHADOWS: { name: string; value: string }[] = [
  { name: "shadow-sm", value: "0 1px 2px 0 rgb(0 0 0 / 0.05)" },
  { name: "shadow (default)", value: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)" },
  { name: "shadow-md", value: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)" },
  { name: "shadow-lg", value: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)" },
  { name: "shadow-xl", value: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)" },
  { name: "shadow-2xl", value: "0 25px 50px -12px rgb(0 0 0 / 0.25)" },
  { name: "shadow-inner", value: "inset 0 2px 4px 0 rgb(0 0 0 / 0.05)" },
];

export const DefaultScale: Story = {
  render: () => (
    <FoundationSection title="Shadow scale">
      <TokenGrid>
        {SHADOWS.map((s) => (
          <div key={s.name} style={{ padding: "1.5rem 0.75rem" }}>
            <div
              style={{
                height: 64,
                borderRadius: "0.5rem",
                background: "var(--surface)",
                boxShadow: s.value,
              }}
            />
            <p style={{ fontSize: "0.8125rem", fontWeight: 500, marginTop: "0.75rem", marginBottom: 0 }}>{s.name}</p>
            <p style={{ fontSize: "0.6875rem", color: "var(--muted)", fontFamily: "monospace", marginTop: "0.125rem" }}>
              {s.value}
            </p>
          </div>
        ))}
      </TokenGrid>
    </FoundationSection>
  ),
};
