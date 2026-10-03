"use client";

import { useEffect, useState } from "react";
import { getCustomTokens, removeCustomToken, type CustomToken } from "@/lib/customTokens";

export function CustomTokenSettings() {
  const [tokens, setTokens] = useState<CustomToken[]>([]);
  useEffect(() => setTokens(getCustomTokens()), []);
  return <section className="rounded-xl border border-gray-800 bg-[#161b22] p-6">
    <h2 className="mb-4 text-lg font-semibold text-white">Custom tokens</h2>
    {tokens.length === 0 ? <p className="text-sm text-gray-400">No custom tokens imported in this browser.</p> : <ul className="space-y-3">{tokens.map((token) => <li key={token.contractId} className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-800 pt-3"><span className="text-sm text-gray-200">{token.name} ({token.symbol}) <span className="font-mono text-xs text-gray-500">{token.contractId}</span></span><button type="button" className="rounded border border-red-500/50 px-3 py-1.5 text-sm text-red-300" onClick={() => setTokens(removeCustomToken(token.contractId))}>Remove Custom Token</button></li>)}</ul>}
  </section>;
}
