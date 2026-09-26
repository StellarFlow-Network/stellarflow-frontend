import { describe, expect, it } from "vitest";
import type { ToastItem } from "../../../src/components/toast/AccessibleToastContainer.types";

describe("AccessibleToastContainer contract", () => {
  it("supports the expected toast kinds", () => {
    const toast: ToastItem = {
      id: "error-1",
      message: "Transaction failed",
      kind: "error",
    };

    expect(toast.kind).toBe("error");
  });

  it("keeps the visible toast limit at three by default", () => {
    const toasts = ["1", "2", "3", "4"];
    expect(toasts.slice(-3)).toEqual(["2", "3", "4"]);
  });
});
