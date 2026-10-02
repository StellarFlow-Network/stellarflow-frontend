"use client";

import React, { useState, useEffect } from "react";
import { Settings, Coins } from "lucide-react";
import TokenListManagerModal from "../components/TokenListManagerModal";
import { getActiveTokens } from "@/lib/tokenListService";
import type { TokenInfo } from "@/types/tokenList";

export default function TokenListsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTokens = async () => {
    setLoading(true);
    try {
      const activeTokens = await getActiveTokens();
      setTokens(activeTokens);
    } catch (error) {
      console.error("Failed to load tokens:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTokens();
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Coins className="w-8 h-8 text-[#99DC1B]" />
              <div>
                <h1 className="text-2xl font-bold">Token Lists</h1>
                <p className="text-sm text-zinc-400 mt-0.5">
                  Manage subscribed token lists and available assets
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#99DC1B] hover:bg-[#8BC919] text-zinc-950 font-semibold rounded-xl transition-all"
            >
              <Settings className="w-4 h-4" />
              Manage Lists
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="bg-[#0A121E] border border-zinc-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold">Available Tokens</h2>
              <p className="text-xs text-zinc-500 mt-1">
                Tokens from all enabled lists
              </p>
            </div>
            <span className="text-xs text-zinc-500 bg-zinc-800 px-3 py-1.5 rounded-full font-semibold">
              {tokens.length} tokens
            </span>
          </div>

          {loading ? (
            <div className="text-center py-12 text-zinc-500">Loading tokens...</div>
          ) : tokens.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-zinc-400 mb-3">No tokens available</p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="text-sm text-[#99DC1B] hover:underline"
              >
                Enable a token list to see tokens
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {tokens.slice(0, 50).map((token, idx) => (
                <div
                  key={`${token.address}-${idx}`}
                  className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 hover:border-[#99DC1B]/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {token.logoURI ? (
                      <img
                        src={token.logoURI}
                        alt={token.symbol}
                        className="w-8 h-8 rounded-full bg-zinc-800"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-600">
                        {token.symbol[0]}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white text-sm truncate">
                        {token.symbol}
                      </p>
                      <p className="text-xs text-zinc-500 truncate">{token.name}</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-zinc-600 font-mono mt-2 truncate">
                    {token.address}
                  </p>
                </div>
              ))}
              {tokens.length > 50 && (
                <div className="col-span-full text-center text-sm text-zinc-500 mt-2">
                  + {tokens.length - 50} more tokens
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Modal */}
      <TokenListManagerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onListsUpdated={loadTokens}
      />
    </div>
  );
}
