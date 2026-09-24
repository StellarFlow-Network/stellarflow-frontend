import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { FoundationSection, TokenCard, TokenGrid } from "./shared";

const meta: Meta = {
  title: "Foundations/Colors",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Color tokens defined as CSS custom properties in `src/app/globals.css`. " +
          "Theme-aware tokens are set on `:root` (light) and overridden under `.dark` " +
          "(the class next-themes toggles on `<html>`) — use the Theme toolbar toggle " +
          "above to see them shift. A handful of static brand accents are used directly " +
          "as hex values around the app rather than as tokens; they're listed for reference.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

const THEME_TOKENS: { name: string; cssVar: string }[] = [
  { name: "Background", cssVar: "--color-background" },
  { name: "Foreground", cssVar: "--color-foreground" },
  { name: "Surface", cssVar: "--color-surface" },
  { name: "Surface Raised", cssVar: "--color-surface-raised" },
  { name: "Border", cssVar: "--color-border" },
  { name: "Muted", cssVar: "--color-muted" },
];

const STATIC_TOKENS: { name: string; cssVar: string; hex: string }[] = [
  { name: "Neon Green", cssVar: "--color-neon-green", hex: "#39ff14" },
  { name: "Oracle Navy", cssVar: "--color-oracle-navy", hex: "#0a0f1e" },
  { name: "Oracle Border", cssVar: "--color-oracle-border", hex: "#1b2a3b" },
];

const BRAND_ACCENTS: { name: string; hex: string; usage: string }[] = [
  { name: "Wallet Button", hex: "#d9f99d", usage: ".wallet-btn background" },
  { name: "Wallet Button Hover", hex: "#bef574", usage: ".wallet-btn:hover accent" },
  { name: "Cyber Lime", hex: "#99dc1b", usage: "Admin tab active state / focus ring" },
];

function Swatch({ background }: { background: string }) {
  return (
    <div
      style={{
        height: 64,
        background,
        borderBottom: "1px solid var(--border)",
      }}
    />
  );
}

export const ThemeTokens: Story = {
  render: () => (
    <FoundationSection
      title="Theme tokens"
      description="Re-defined per theme via :root / .dark. Toggle the Theme control in the toolbar to compare."
    >
      <TokenGrid>
        {THEME_TOKENS.map((t) => (
          <TokenCard
            key={t.cssVar}
            label={t.name}
            value={t.cssVar}
            swatch={<Swatch background={`var(${t.cssVar})`} />}
          />
        ))}
      </TokenGrid>
    </FoundationSection>
  ),
};

export const StaticBrandTokens: Story = {
  render: () => (
    <FoundationSection
      title="Static brand tokens"
      description="Exposed as CSS custom properties but constant across both themes."
    >
      <TokenGrid>
        {STATIC_TOKENS.map((t) => (
          <TokenCard
            key={t.cssVar}
            label={t.name}
            value={`${t.cssVar} · ${t.hex}`}
            swatch={<Swatch background={t.hex} />}
          />
        ))}
      </TokenGrid>
    </FoundationSection>
  ),
};

export const OtherBrandAccents: Story = {
  render: () => (
    <FoundationSection
      title="Other brand accents"
      description="Hardcoded hex values used directly in a handful of components — not yet exposed as reusable tokens, listed here for reference."
    >
      <TokenGrid>
        {BRAND_ACCENTS.map((t) => (
          <TokenCard key={t.hex} label={t.name} value={`${t.hex} · ${t.usage}`} swatch={<Swatch background={t.hex} />} />
        ))}
      </TokenGrid>
    </FoundationSection>
  ),
};
