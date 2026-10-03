"use client";

import { useState, useCallback } from "react";
import { ZKProofProgressLoader } from "./ZKProofProgressLoader";
import type { ZKProofConfig } from "./ZKProofTypes";

export function useZKProofLoader() {
  const [isActive, setIsActive] = useState(false);
  const [config, setConfig] = useState<ZKProofConfig>({});

  const startProofGeneration = useCallback((customConfig?: ZKProofConfig) => {
    setConfig(customConfig || {});
    setIsActive(true);
  }, []);

  const stopProofGeneration = useCallback(() => {
    setIsActive(false);
  }, []);

  const Loader = () => (
    <ZKProofProgressLoader isActive={isActive} config={config} />
  );

  return {
    isActive,
    startProofGeneration,
    stopProofGeneration,
    Loader,
  };
}