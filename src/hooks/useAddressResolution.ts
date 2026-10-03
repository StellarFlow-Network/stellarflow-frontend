"use client";

import { useEffect, useState } from "react";
import {
  resolveAddress,
  type ResolvedAddress,
} from "@/lib/addressResolution";

export function useAddressResolution(input: string) {
  const [result, setResult] = useState<ResolvedAddress | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = input.trim();
    if (!trimmed) {
      setResult(null);
      setError(null);
      setIsResolving(false);
      return;
    }

    const controller = new AbortController();
    setIsResolving(true);
    setError(null);

    resolveAddress(trimmed, controller.signal)
      .then((resolved) => setResult(resolved))
      .catch((lookupError: unknown) => {
        if (controller.signal.aborted) return;
        setResult(null);
        setError(lookupError instanceof Error ? lookupError.message : "Address lookup failed");
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsResolving(false);
      });

    return () => controller.abort();
  }, [input]);

  return { result, isResolving, error };
}