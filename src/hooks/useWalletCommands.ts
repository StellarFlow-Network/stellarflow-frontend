"use client";

/**
 * useWalletCommands — the wallet actions the command palette can trigger.
 *
 * Freighter is imported lazily inside the connect handler so the wallet adapter
 * stays out of the palette's chunk until someone actually runs the action, and
 * the whole set collapses to an empty list when no WalletProvider is mounted.
 */

import { useMemo } from "react";
import {
  useOptionalWallet,
  useOptionalWalletActions,
} from "@/app/components/providers/WalletProvider";
import { ICON_IDS } from "@/components/icons/iconIds";
import type { CommandItem } from "@/lib/commandRegistry";

export interface UseWalletCommandsOptions {
  /** Surfaces the outcome of an action; wired to the palette's toast queue */
  onResult?: (result: { ok: boolean; message: string }) => void;
}

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-6)}`;
}

export function useWalletCommands({
  onResult,
}: UseWalletCommandsOptions = {}): CommandItem[] {
  const walletState = useOptionalWallet();
  const walletActions = useOptionalWalletActions();

  const wallet = walletState?.wallet ?? null;
  const refreshWalletState = walletActions?.refreshWalletState;

  return useMemo(() => {
    // No provider above us — offer nothing rather than actions that cannot run.
    if (!refreshWalletState) return [];

    const commands: CommandItem[] = [];

    if (wallet?.connected && wallet.publicKey) {
      commands.push({
        id: "action:copy-address",
        kind: "action",
        title: "Copy Wallet Address",
        subtitle: truncateAddress(wallet.publicKey),
        keywords: ["wallet", "address", "public key", "clipboard", "copy"],
        iconId: ICON_IDS.copy,
        run: async () => {
          try {
            await navigator.clipboard.writeText(wallet.publicKey as string);
            onResult?.({ ok: true, message: "Wallet address copied." });
          } catch {
            onResult?.({
              ok: false,
              message: "Clipboard access was denied by the browser.",
            });
          }
        },
      });
    } else {
      commands.push({
        id: "action:connect-wallet",
        kind: "action",
        title: "Connect Wallet",
        subtitle: "Request access through Freighter",
        keywords: ["wallet", "freighter", "connect", "login", "sign in"],
        iconId: ICON_IDS.wallet,
        run: async () => {
          try {
            const { requestAccess } = await import("@stellar/freighter-api");
            const { address, error } = await requestAccess();

            if (error || !address) {
              onResult?.({
                ok: false,
                message: "Wallet connection was declined or unavailable.",
              });
              return;
            }

            await refreshWalletState();
            onResult?.({
              ok: true,
              message: `Connected as ${truncateAddress(address)}.`,
            });
          } catch {
            onResult?.({
              ok: false,
              message: "Freighter is not installed or could not be reached.",
            });
          }
        },
      });
    }

    commands.push({
      id: "action:refresh-wallet",
      kind: "action",
      title: "Refresh Wallet Connection",
      subtitle: wallet?.connected ? "Re-query Freighter state" : "Check for a wallet",
      keywords: ["wallet", "refresh", "reconnect", "sync", "status"],
      iconId: ICON_IDS.refreshCcw,
      run: async () => {
        const state = await refreshWalletState();
        onResult?.({
          ok: Boolean(state?.connected),
          message: state?.connected
            ? "Wallet connection is live."
            : "No wallet connection detected.",
        });
      },
    });

    return commands;
  }, [wallet, refreshWalletState, onResult]);
}

export default useWalletCommands;
