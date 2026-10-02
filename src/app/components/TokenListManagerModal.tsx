"use client";

import React, { useState, useEffect, useCallback } from "react";
import { X, Plus, RefreshCw, Trash2, CheckCircle2, AlertCircle, Loader2, Link as LinkIcon } from "lucide-react";
import type { TokenListMetadata } from "@/types/tokenList";
import {
  getStoredTokenLists,
  addTokenList,
  removeTokenList,
  toggleTokenList,
  syncTokenList,
  fetchTokenList,
  validateTokenList,
} from "@/lib/tokenListService";

interface TokenListManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onListsUpdated?: () => void;
}

export default function TokenListManagerModal({
  isOpen,
  onClose,
  onListsUpdated,
}: TokenListManagerModalProps) {
  const [lists, setLists] = useState<TokenListMetadata[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newListUrl, setNewListUrl] = useState("");
  const [newListName, setNewListName] = useState("");
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<Set<string>>(new Set());

  const loadLists = useCallback(() => {
    setLists(getStoredTokenLists());
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadLists();
    }
  }, [isOpen, loadLists]);

  const handleToggle = (id: string, enabled: boolean) => {
    toggleTokenList(id, enabled);
    loadLists();
    onListsUpdated?.();
  };

  const handleSync = async (listMeta: TokenListMetadata) => {
    setSyncing((prev) => new Set(prev).add(listMeta.id));
    try {
      await syncTokenList(listMeta);
      loadLists();
      onListsUpdated?.();
    } catch (error) {
      console.error("Sync failed:", error);
    } finally {
      setSyncing((prev) => {
        const next = new Set(prev);
        next.delete(listMeta.id);
        return next;
      });
    }
  };

  const handleRemove = (id: string) => {
    if (confirm("Remove this token list?")) {
      removeTokenList(id);
      loadLists();
      onListsUpdated?.();
    }
  };

  const handleValidateAndAdd = async () => {
    if (!newListUrl.trim()) {
      setValidationError("URL is required");
      return;
    }

    setValidating(true);
    setValidationError(null);

    try {
      // Validate URL format
      const url = new URL(newListUrl);
      if (!url.protocol.startsWith("http")) {
        throw new Error("URL must use HTTP or HTTPS protocol");
      }

      // Fetch and validate
      const tokenList = await fetchTokenList(newListUrl);
      const errors = validateTokenList(tokenList);

      if (errors.length > 0) {
        throw new Error(errors.map((e) => e.message).join(", "));
      }

      // Add list
      const name = newListName.trim() || tokenList.name;
      const newList = addTokenList(newListUrl, name);

      // Sync immediately
      await syncTokenList(newList);

      loadLists();
      onListsUpdated?.();
      setShowAddForm(false);
      setNewListUrl("");
      setNewListName("");
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : "Invalid token list URL");
    } finally {
      setValidating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0A121E] border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div>
            <h2 className="text-xl font-bold text-white">Token List Manager</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Subscribe to token lists to expand available assets
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Token Lists */}
          {lists.map((list) => (
            <div
              key={list.id}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-[#99DC1B]/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-white truncate">{list.name}</h3>
                    {list.isDefault && (
                      <span className="text-[9px] font-bold uppercase tracking-wider bg-[#99DC1B]/20 text-[#99DC1B] px-2 py-0.5 rounded-full">
                        Official
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 truncate mt-1 font-mono">{list.url}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-zinc-400">
                    {list.lastSynced ? (
                      <>
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          {list.tokenCount} tokens
                        </span>
                        <span>
                          Synced {new Date(list.lastSynced).toLocaleDateString()}
                        </span>
                      </>
                    ) : (
                      <span className="flex items-center gap-1 text-amber-500">
                        <AlertCircle className="w-3 h-3" />
                        Not synced
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Toggle */}
                  <button
                    onClick={() => handleToggle(list.id, !list.enabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      list.enabled ? "bg-[#99DC1B]" : "bg-zinc-700"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        list.enabled ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>

                  {/* Sync */}
                  <button
                    onClick={() => handleSync(list)}
                    disabled={syncing.has(list.id)}
                    className="p-2 hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Sync now"
                  >
                    <RefreshCw
                      className={`w-4 h-4 text-zinc-400 ${
                        syncing.has(list.id) ? "animate-spin" : ""
                      }`}
                    />
                  </button>

                  {/* Remove */}
                  {!list.isDefault && (
                    <button
                      onClick={() => handleRemove(list.id)}
                      className="p-2 hover:bg-rose-500/10 rounded-lg transition-colors"
                      title="Remove list"
                    >
                      <Trash2 className="w-4 h-4 text-rose-400" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Add Token List Form */}
          {showAddForm ? (
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white text-sm">Add Custom Token List</h3>
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setNewListUrl("");
                    setNewListName("");
                    setValidationError(null);
                  }}
                  className="text-zinc-500 hover:text-zinc-300 text-xs"
                >
                  Cancel
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                  Token List URL *
                </label>
                <input
                  type="url"
                  value={newListUrl}
                  onChange={(e) => setNewListUrl(e.target.value)}
                  placeholder="https://example.com/tokenlist.json"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#99DC1B] transition-colors font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                  Custom Name (optional)
                </label>
                <input
                  type="text"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="Leave blank to use list name"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#99DC1B] transition-colors"
                />
              </div>

              {validationError && (
                <div className="flex items-start gap-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}

              <button
                onClick={handleValidateAndAdd}
                disabled={validating}
                className="w-full px-4 py-2.5 bg-[#99DC1B] hover:bg-[#8BC919] disabled:bg-zinc-700 disabled:text-zinc-500 text-zinc-950 font-semibold rounded-lg transition-all flex items-center justify-center gap-2 text-sm disabled:cursor-not-allowed"
              >
                {validating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Validating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Add Token List
                  </>
                )}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full px-4 py-3 border-2 border-dashed border-zinc-700 hover:border-[#99DC1B]/50 rounded-xl text-zinc-400 hover:text-[#99DC1B] transition-colors flex items-center justify-center gap-2 text-sm font-semibold"
            >
              <LinkIcon className="w-4 h-4" />
              Add Custom Token List URL
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-900/50">
          <p className="text-xs text-zinc-500">
            Token lists are synced automatically every 24 hours. Toggle lists to filter swap assets.
          </p>
        </div>
      </div>
    </div>
  );
}
