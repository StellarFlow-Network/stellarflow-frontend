import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Unit test config.
 *
 * Vitest was already used by `tests/ui/useAssetThemeColor.test.ts` but was not
 * listed as a dependency, so nothing could actually run it. This config makes
 * the suite executable and wires the `@/` alias to match `tsconfig.json`.
 */
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    setupFiles: ["./tests/setup.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
