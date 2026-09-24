import type { StorybookConfig } from "@storybook/nextjs";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.tsx", "../src/**/*.stories.mdx"],
  // @storybook/addon-essentials and @storybook/addon-interactions were
  // removed upstream — their functionality (actions, controls, backgrounds,
  // viewport, measure/outline, and interaction/play-function debugging) now
  // ships in Storybook core as of v9. Pinning them here against a v10
  // storybook/nextjs framework created an unresolvable peer conflict
  // (addon-essentials@8.6.14 required storybook@^8.6.14).
  addons: ["@storybook/addon-links", "@storybook/addon-a11y"],
  framework: {
    name: "@storybook/nextjs",
    options: {},
  },
  docs: {
    autodocs: "tag",
  },
  staticDirs: ["../public"],
};

export default config;