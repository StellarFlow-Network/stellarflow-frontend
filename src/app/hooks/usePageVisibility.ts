"use client";

import { useEffect, useState } from "react";

function readPageVisibility(): boolean {
  if (
    typeof document === "undefined" ||
    typeof document.visibilityState === "undefined"
  ) {
    return true;
  }

  return document.visibilityState !== "hidden";
}

export function usePageVisibility(): boolean {
  const [isPageVisible, setIsPageVisible] = useState(readPageVisibility);

  useEffect(() => {
    if (
      typeof document === "undefined" ||
      typeof document.visibilityState === "undefined"
    ) {
      return;
    }

    const handleVisibilityChange = () => {
      setIsPageVisible(readPageVisibility());
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return isPageVisible;
}
