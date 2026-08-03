import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { FoundationSection } from "./shared";

const meta: Meta = {
  title: "Foundations/Typography",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Font family tokens come from `src/app/globals.css` (`--font-sans` / `--font-mono`, " +
          "both currently mapped to the Geist Sans variable loaded in `src/app/layout.tsx` via " +
          "`next/font/google`). The type scale and weights below are Tailwind CSS v4's built-in " +
          "defaults — `tailwind.config.js` does not override `theme.extend`, so these are exactly " +
          "what's available to every component in the app.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

const FONT_FAMILY = "var(--font-sans, ui-sans-serif, system-ui, sans-serif)";

const TYPE_SCALE: { name: string; sizeRem: number; lineHeightRem: number }[] = [
  { name: "text-xs", sizeRem: 0.75, lineHeightRem: 1 },
  { name: "text-sm", sizeRem: 0.875, lineHeightRem: 1.25 },
  { name: "text-base", sizeRem: 1, lineHeightRem: 1.5 },
  { name: "text-lg", sizeRem: 1.125, lineHeightRem: 1.75 },
  { name: "text-xl", sizeRem: 1.25, lineHeightRem: 1.75 },
  { name: "text-2xl", sizeRem: 1.5, lineHeightRem: 2 },
  { name: "text-3xl", sizeRem: 1.875, lineHeightRem: 2.25 },
  { name: "text-4xl", sizeRem: 2.25, lineHeightRem: 2.5 },
  { name: "text-5xl", sizeRem: 3, lineHeightRem: 1 },
];

const WEIGHTS: { name: string; weight: number }[] = [
  { name: "font-normal", weight: 400 },
  { name: "font-medium", weight: 500 },
  { name: "font-semibold", weight: 600 },
  { name: "font-bold", weight: 700 },
];

export const FontFamilies: Story = {
  render: () => (
    <FoundationSection title="Font families">
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div>
          <p style={{ fontSize: "0.75rem", color: "var(--muted)", fontFamily: "monospace", marginBottom: "0.25rem" }}>
            --font-sans
          </p>
          <p style={{ fontFamily: FONT_FAMILY, fontSize: "1.25rem" }}>
            The quick brown fox jumps over the lazy dog — Geist Sans
          </p>
        </div>
        <div>
          <p style={{ fontSize: "0.75rem", color: "var(--muted)", fontFamily: "monospace", marginBottom: "0.25rem" }}>
            --font-mono <span style={{ opacity: 0.7 }}>(currently also Geist Sans, not a distinct monospace face)</span>
          </p>
          <p style={{ fontFamily: FONT_FAMILY, fontSize: "1.25rem" }}>0123456789 StellarFlow tx_hash</p>
        </div>
      </div>
    </FoundationSection>
  ),
};

export const TypeScale: Story = {
  render: () => (
    <FoundationSection title="Type scale" description="Tailwind v4 defaults.">
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {TYPE_SCALE.map((t) => (
          <div key={t.name} style={{ display: "flex", alignItems: "baseline", gap: "1rem" }}>
            <span style={{ width: 90, fontSize: "0.75rem", color: "var(--muted)", fontFamily: "monospace" }}>
              {t.name}
            </span>
            <span style={{ width: 130, fontSize: "0.75rem", color: "var(--muted)" }}>
              {t.sizeRem}rem / {t.lineHeightRem}rem
            </span>
            <span style={{ fontFamily: FONT_FAMILY, fontSize: `${t.sizeRem}rem`, lineHeight: `${t.lineHeightRem}rem` }}>
              StellarFlow
            </span>
          </div>
        ))}
      </div>
    </FoundationSection>
  ),
};

export const FontWeights: Story = {
  render: () => (
    <FoundationSection title="Font weights" description="Tailwind v4 defaults.">
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {WEIGHTS.map((w) => (
          <div key={w.name} style={{ display: "flex", alignItems: "baseline", gap: "1rem" }}>
            <span style={{ width: 130, fontSize: "0.75rem", color: "var(--muted)", fontFamily: "monospace" }}>
              {w.name} · {w.weight}
            </span>
            <span style={{ fontFamily: FONT_FAMILY, fontSize: "1.25rem", fontWeight: w.weight }}>
              StellarFlow Network
            </span>
          </div>
        ))}
      </div>
    </FoundationSection>
  ),
};
