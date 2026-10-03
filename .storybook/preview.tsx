import type { Decorator, Preview } from "@storybook/react";
import React from "react";
import "../src/app/globals.css";

/**
 * Wraps every story in a div carrying the app's `.dark` theme class (the same
 * mechanism `next-themes` uses on `<html>` via `attribute="class"`, see
 * `src/app/layout.tsx`), driven by the "Theme" toolbar toggle below. This
 * makes every story — foundations and existing components alike — re-render
 * with the correct design tokens for the selected theme.
 */
const withTheme: Decorator = (Story, context) => {
  const theme = context.globals.theme === "light" ? "light" : "dark";
  return (
    <div
      className={theme === "dark" ? "dark" : ""}
      style={{
        background: "var(--background)",
        color: "var(--foreground)",
        minHeight: "100%",
        padding: "1rem",
      }}
    >
      <Story />
    </div>
  );
};

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: "^on[A-Z].*" },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: "dark",
      values: [
        {
          name: "dark",
          value: "#0d1117",
        },
        {
          name: "light",
          value: "#ffffff",
        },
      ],
    },
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
  },
  globalTypes: {
    theme: {
      name: "Theme",
      description: "Global theme (light/dark) applied via the app's .dark class",
      defaultValue: "dark",
      toolbar: {
        icon: "mirror",
        items: [
          { value: "light", title: "Light", icon: "sun" },
          { value: "dark", title: "Dark", icon: "moon" },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [withTheme],
  tags: ["autodocs"],
};

export default preview;