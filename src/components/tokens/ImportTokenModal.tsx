"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import OptimizedDialog from "@/app/components/OptimizedDialog";
import Icon from "@/components/icons/Icon";
import { ICON_IDS } from "@/components/icons/iconIds";
import {
  fetchTokenMetadata,
  isTokenImported,
  saveCustomToken,
  validateAssetInput,
  validateContractId,
  type CustomToken,
  type TokenImportInput,
  type TokenMetadata,
} from "@/lib/customTokens";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ImportMode = "contract" | "asset";

export interface ImportTokenModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after a token is successfully persisted to local storage. */
  onImport?: (token: CustomToken) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ImportTokenModal({
  isOpen,
  onClose,
  onImport,
}: ImportTokenModalProps) {
  // ── Input state ────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<ImportMode>("contract");
  const [contractId, setContractId] = useState("");
  const [assetCode, setAssetCode] = useState("");
  const [assetIssuer, setAssetIssuer] = useState("");
  const [touched, setTouched] = useState(false);

  // ── Resolution state ───────────────────────────────────────────────────────
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<TokenMetadata | null>(null);

  // ── Risk acknowledgement / import state ────────────────────────────────────
  const [riskAcknowledged, setRiskAcknowledged] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [imported, setImported] = useState(false);

  // ── Derived input model ────────────────────────────────────────────────────
  const importInput = useMemo<TokenImportInput>(
    () =>
      mode === "contract"
        ? { mode, contractId }
        : { mode, code: assetCode, issuer: assetIssuer },
    [mode, contractId, assetCode, assetIssuer],
  );

  const validation = useMemo(
    () =>
      mode === "contract"
        ? validateContractId(contractId)
        : validateAssetInput(assetCode, assetIssuer),
    [mode, contractId, assetCode, assetIssuer],
  );

  const alreadyImported = useMemo(
    () => (metadata ? isTokenImported(metadata.contractId) : false),
    [metadata],
  );

  // ── Reset on close ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) {
      setMode("contract");
      setContractId("");
      setAssetCode("");
      setAssetIssuer("");
      setTouched(false);
      setIsFetching(false);
      setFetchError(null);
      setMetadata(null);
      setRiskAcknowledged(false);
      setImportError(null);
      setImported(false);
    }
  }, [isOpen]);

  // Any input change invalidates a previously resolved token so the user must
  // re-fetch and re-acknowledge before importing a different asset.
  const resetResolution = useCallback(() => {
    setMetadata(null);
    setFetchError(null);
    setImportError(null);
    setRiskAcknowledged(false);
    setImported(false);
  }, []);

  const switchMode = useCallback(
    (next: ImportMode) => {
      if (next === mode) return;
      setMode(next);
      setTouched(false);
      resetResolution();
    },
    [mode, resetResolution],
  );

  // ── Metadata resolution ────────────────────────────────────────────────────
  const handleFetch = useCallback(async () => {
    setTouched(true);
    setFetchError(null);
    setImportError(null);

    if (!validation.valid) {
      return;
    }

    setIsFetching(true);
    setMetadata(null);
    setRiskAcknowledged(false);
    try {
      const result = await fetchTokenMetadata(importInput);
      setMetadata(result);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Could not resolve token metadata from the network.";
      setFetchError(message);
    } finally {
      setIsFetching(false);
    }
  }, [validation.valid, importInput]);

  // ── Import commit ──────────────────────────────────────────────────────────
  const handleImport = useCallback(() => {
    setImportError(null);
    if (!metadata) {
      setImportError("Resolve the token metadata before importing.");
      return;
    }
    if (!riskAcknowledged) {
      setImportError("You must acknowledge the risk warning before importing.");
      return;
    }

    try {
      const next = saveCustomToken(metadata);
      const saved = next.find((t) => t.contractId === metadata.contractId);
      setImported(true);
      if (saved) onImport?.(saved);
    } catch {
      setImportError("Failed to save the token to local storage.");
    }
  }, [metadata, riskAcknowledged, onImport]);

  const inputError = touched ? validation.error : null;
  const canFetch = validation.valid && !isFetching;
  const canImport = metadata !== null && riskAcknowledged && !imported;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <OptimizedDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Import Custom Token"
      size="lg"
    >
      <div className="space-y-5">
        {/* ── Mode toggle ─────────────────────────────────────────────────── */}
        <div
          className="grid grid-cols-2 gap-2 rounded-lg border border-gray-800 bg-[#0d1117] p-1"
          role="tablist"
          aria-label="Import method"
        >
          {(
            [
              { key: "contract", label: "Contract Address" },
              { key: "asset", label: "Asset Code + Issuer" },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={mode === key}
              onClick={() => switchMode(key)}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                mode === key
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Input fields ────────────────────────────────────────────────── */}
        {mode === "contract" ? (
          <div className="space-y-1.5">
            <label
              htmlFor="import-contract-id"
              className="text-xs uppercase font-bold text-gray-500"
            >
              Contract Address
            </label>
            <input
              id="import-contract-id"
              type="text"
              value={contractId}
              onChange={(e) => {
                setContractId(e.target.value);
                resetResolution();
              }}
              onBlur={() => setTouched(true)}
              spellCheck={false}
              autoComplete="off"
              placeholder="C… (56-character Stellar contract address)"
              disabled={isFetching}
              className="w-full rounded-lg border border-gray-700 bg-[#0d1117] px-3 py-2.5 font-mono text-sm text-gray-200 placeholder:text-gray-600 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              aria-invalid={inputError !== null}
              aria-describedby={inputError ? "import-input-error" : undefined}
            />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label
                htmlFor="import-asset-code"
                className="text-xs uppercase font-bold text-gray-500"
              >
                Asset Code
              </label>
              <input
                id="import-asset-code"
                type="text"
                value={assetCode}
                onChange={(e) => {
                  setAssetCode(e.target.value);
                  resetResolution();
                }}
                onBlur={() => setTouched(true)}
                spellCheck={false}
                autoComplete="off"
                placeholder="e.g. USDC"
                disabled={isFetching}
                maxLength={12}
                className="w-full rounded-lg border border-gray-700 bg-[#0d1117] px-3 py-2.5 font-mono text-sm text-gray-200 placeholder:text-gray-600 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                aria-invalid={inputError !== null}
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="import-asset-issuer"
                className="text-xs uppercase font-bold text-gray-500"
              >
                Issuer Address
              </label>
              <input
                id="import-asset-issuer"
                type="text"
                value={assetIssuer}
                onChange={(e) => {
                  setAssetIssuer(e.target.value);
                  resetResolution();
                }}
                onBlur={() => setTouched(true)}
                spellCheck={false}
                autoComplete="off"
                placeholder="G… (56-character issuer public key)"
                disabled={isFetching}
                className="w-full rounded-lg border border-gray-700 bg-[#0d1117] px-3 py-2.5 font-mono text-sm text-gray-200 placeholder:text-gray-600 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                aria-invalid={inputError !== null}
                aria-describedby={inputError ? "import-input-error" : undefined}
              />
            </div>
          </div>
        )}

        {inputError && (
          <p id="import-input-error" className="text-xs text-red-400" role="alert">
            {inputError}
          </p>
        )}

        {/* ── Fetch metadata ──────────────────────────────────────────────── */}
        {!metadata && (
          <button
            type="button"
            onClick={handleFetch}
            disabled={!canFetch}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-700 bg-[#0d1117] px-4 py-2.5 text-sm font-medium text-gray-200 transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isFetching ? (
              <>
                <span
                  className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-current border-t-transparent animate-spin"
                  aria-hidden="true"
                />
                Resolving token metadata…
              </>
            ) : (
              <>
                <Icon
                  id={ICON_IDS.search}
                  size={15}
                  className="text-gray-400 shrink-0"
                />
                Fetch Token Details
              </>
            )}
          </button>
        )}

        {fetchError && (
          <div
            className="rounded-lg border border-red-500/40 bg-red-950/20 px-3 py-2 text-sm text-red-300"
            role="alert"
          >
            {fetchError}
          </div>
        )}

        {/* ── Resolved metadata ───────────────────────────────────────────── */}
        {metadata && (
          <div className="rounded-lg border border-gray-800 bg-[#0d1117] p-4 space-y-3">
            <p className="text-xs uppercase font-bold tracking-wider text-gray-400 flex items-center gap-1.5">
              <Icon id={ICON_IDS.coins} size={14} className="text-blue-400" />
              Token Details
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-500">Name</p>
                <p className="mt-0.5 text-sm font-semibold text-gray-100 break-words">
                  {metadata.name || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Symbol</p>
                <p className="mt-0.5 text-sm font-semibold text-gray-100 break-words">
                  {metadata.symbol || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Decimals</p>
                <p className="mt-0.5 font-mono text-sm text-gray-200">
                  {metadata.decimals}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Contract</p>
                <p className="mt-0.5 font-mono text-xs text-gray-300 break-all">
                  {metadata.contractId.slice(0, 6)}…
                  {metadata.contractId.slice(-6)}
                </p>
              </div>
            </div>
            {metadata.issuer && (
              <div className="border-t border-gray-800 pt-2">
                <p className="text-xs text-gray-500">Issuer</p>
                <p className="mt-0.5 font-mono text-xs text-gray-300 break-all">
                  {metadata.issuer}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Unverified-asset security warning ───────────────────────────── */}
        {metadata && !imported && (
          <div className="rounded-lg border border-yellow-500/40 bg-yellow-950/10 p-4 space-y-3">
            <div className="flex items-start gap-2">
              <Icon
                id={ICON_IDS.shieldAlert}
                size={18}
                className="text-yellow-400 shrink-0 mt-0.5"
              />
              <div className="space-y-1.5">
                <p className="text-sm font-semibold text-yellow-300">
                  Unverified asset — import at your own risk
                </p>
                <ul className="list-disc space-y-1 pl-4 text-xs text-yellow-200/80">
                  <li>
                    Anyone can create a token using any name or symbol, including
                    ones that impersonate trusted assets.
                  </li>
                  <li>
                    StellarFlow has <span className="font-semibold">not</span>{" "}
                    verified this contract. It may be malicious, worthless, or
                    unable to be sold.
                  </li>
                  <li>
                    Always confirm the contract address from a source you trust
                    before interacting with this token.
                  </li>
                </ul>
              </div>
            </div>

            {alreadyImported && (
              <p className="flex items-center gap-1.5 text-xs text-gray-400">
                <Icon
                  id={ICON_IDS.checkCircle}
                  size={13}
                  className="text-gray-500 shrink-0"
                />
                This token is already in your list. Importing again will refresh
                its details.
              </p>
            )}

            <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-yellow-500/20 bg-[#0d1117]/60 px-3 py-2.5">
              <input
                type="checkbox"
                checked={riskAcknowledged}
                onChange={(e) => {
                  setRiskAcknowledged(e.target.checked);
                  setImportError(null);
                }}
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-yellow-500"
                aria-describedby="import-risk-label"
              />
              <span id="import-risk-label" className="text-xs text-gray-200">
                I understand this is an unverified token and I accept the risks
                of importing it.
              </span>
            </label>
          </div>
        )}

        {importError && (
          <div
            className="rounded-lg border border-red-500/40 bg-red-950/20 px-3 py-2 text-sm text-red-300"
            role="alert"
          >
            {importError}
          </div>
        )}

        {/* ── Success ─────────────────────────────────────────────────────── */}
        {imported && metadata && (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/20 px-3 py-2 text-sm text-emerald-300 flex items-center gap-2">
            <Icon
              id={ICON_IDS.checkCircle}
              size={15}
              className="text-emerald-400 shrink-0"
            />
            <span>
              <span className="font-semibold">{metadata.symbol}</span> imported
              and saved to this browser.
            </span>
          </div>
        )}

        {/* ── Action row ──────────────────────────────────────────────────── */}
        <div className="flex justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-800"
          >
            {imported ? "Close" : "Cancel"}
          </button>
          {!imported && (
            <button
              type="button"
              onClick={handleImport}
              disabled={!canImport}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Import Token
            </button>
          )}
        </div>
      </div>
    </OptimizedDialog>
  );
}

export default ImportTokenModal;
