import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    css: false,
    setupFiles: ["./src/test/setup.ts"],
    include: [
      "src/components/swap/__tests__/**/*.test.{ts,tsx}",
      "src/components/remittance/__tests__/**/*.test.{ts,tsx}",
      "src/components/ui/**/*.test.{ts,tsx}",
      "src/lib/__tests__/**/*.test.{ts,tsx}",
      "src/utils/__tests__/formatters.test.{ts,tsx}",
    ],
    coverage: {
      provider: "v8",
      all: true,
      include: [
        "src/components/ui/**/*.{ts,tsx}",
        "src/components/swap/SwapForm.tsx",
        "src/components/remittance/BeneficiaryForm.tsx",
        "src/lib/slippage.ts",
        "src/utils/formatters.ts",
      ],
      exclude: [
        "src/components/ui/index.ts",
        "src/components/ui/**/*.stories.{ts,tsx}",
        "src/components/ui/**/*.test.{ts,tsx}",
        "src/components/swap/**/*.stories.{ts,tsx}",
        "src/components/swap/**/*.test.{ts,tsx}",
        "src/components/remittance/**/*.stories.{ts,tsx}",
        "src/components/remittance/**/*.test.{ts,tsx}",
      ],
      reporter: ["text", "text-summary", "html"],
      thresholds: {
        statements: 80,
        lines: 80,
        functions: 80,
        branches: 70,
        "src/components/ui/**": {
          statements: 80,
          lines: 80,
          functions: 80,
          branches: 70,
        },
      },
    },
  },
});