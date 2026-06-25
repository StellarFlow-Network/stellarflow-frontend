"use client";

import { useState, useMemo } from "react";
import { useDebounce } from "@/app/hooks/useDebounce";

interface ValidatorEntry {
  id: string;
  name: string;
  publicKey: string;
}

interface RegistrySearchProps {
  validators: ValidatorEntry[];
}

/** Returns true for a plausible Stellar public key (G… 56 chars). */
function isValidStellarKey(key: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(key);
}

export function RegistrySearch({ validators }: RegistrySearchProps) {
  const [input, setInput] = useState("");
  // Structural address checking executes only after typing pauses (300 ms).
  const debouncedQuery = useDebounce(input, 300);

  const results = useMemo(() => {
    const q = debouncedQuery.trim();
    if (!q) return validators;

    const lower = q.toLowerCase();
    return validators.filter(
      (v) =>
        v.name.toLowerCase().includes(lower) ||
        v.publicKey.toLowerCase().includes(lower) ||
        (isValidStellarKey(q) && v.publicKey === q)
    );
  }, [debouncedQuery, validators]);

  return (
    <div className="flex flex-col gap-4">
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Search by name or validator public key…"
        aria-label="Search validator registry"
        className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <ul className="flex flex-col gap-2">
        {results.map((v) => (
          <li
            key={v.id}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-3"
          >
            <p className="text-sm font-medium text-white">{v.name}</p>
            <p className="mt-0.5 font-mono text-xs text-white/50 break-all">
              {v.publicKey}
            </p>
          </li>
        ))}

        {results.length === 0 && (
          <li className="text-sm text-white/40">No validators match your query.</li>
        )}
      </ul>
    </div>
  );
}
