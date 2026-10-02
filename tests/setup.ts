/**
 * Vitest setup shared by every unit test.
 *
 * `@testing-library/jest-dom` is registered here rather than in each spec so
 * the DOM matchers are available everywhere.
 *
 * The DOM is also cleaned up between tests explicitly: Testing Library only
 * self-registers that hook when Vitest runs with `globals: true`, and this
 * project imports `describe`/`it` per file instead of relying on globals.
 */

import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
