"use client";

import { useState, useRef, useCallback } from "react";
import {
  MerkleRootHistoryBuffer,
  DEFAULT_MERKLE_BUFFER_CAPACITY,
  type MerkleBufferStats,
  type ZKProofRootValidation,
} from "@/lib/merkleRootBuffer";

export interface UseMerkleRootBufferOptions {
  capacity?: number;
  initialRoots?: string[];
}

export interface UseMerkleRootBufferReturn {
  buffer: MerkleRootHistoryBuffer;
  stats: MerkleBufferStats;
  latestRoot: string | null;
  historicalRoots: string[];
  pushRoot: (rawRootHash: string) => string | null;
  validateRoot: (rawRootHash: string) => ZKProofRootValidation;
  clear: () => void;
}

export function useMerkleRootBuffer(
  options: UseMerkleRootBufferOptions = {},
): UseMerkleRootBufferReturn {
  const { capacity = DEFAULT_MERKLE_BUFFER_CAPACITY, initialRoots = [] } = options;

  // Preserve class instance across renders
  const bufferRef = useRef<MerkleRootHistoryBuffer | null>(null);
  if (!bufferRef.current) {
    const instance = new MerkleRootHistoryBuffer(capacity);
    if (initialRoots && Array.isArray(initialRoots)) {
      for (const root of initialRoots) {
        try {
          instance.pushRoot(root);
        } catch {
          // Ignore invalid initial seed roots
        }
      }
    }
    bufferRef.current = instance;
  }

  const [stats, setStats] = useState<MerkleBufferStats>(() =>
    bufferRef.current!.getBufferStats(),
  );

  const syncStats = useCallback(() => {
    if (bufferRef.current) {
      setStats(bufferRef.current.getBufferStats());
    }
  }, []);

  const pushRoot = useCallback(
    (rawRootHash: string): string | null => {
      if (!bufferRef.current) return null;
      const evicted = bufferRef.current.pushRoot(rawRootHash);
      syncStats();
      return evicted;
    },
    [syncStats],
  );

  const validateRoot = useCallback((rawRootHash: string): ZKProofRootValidation => {
    if (!bufferRef.current) {
      return {
        valid: false,
        rootHash: rawRootHash,
        isLatestRoot: false,
        rootAge: null,
        error: "Buffer not initialized.",
      };
    }
    return bufferRef.current.validateProofRoot(rawRootHash);
  }, []);

  const clear = useCallback(() => {
    if (bufferRef.current) {
      bufferRef.current.clear();
      syncStats();
    }
  }, [syncStats]);

  return {
    buffer: bufferRef.current,
    stats,
    latestRoot: stats.latestRoot,
    historicalRoots: bufferRef.current.getHistoricalRoots(),
    pushRoot,
    validateRoot,
    clear,
  };
}
