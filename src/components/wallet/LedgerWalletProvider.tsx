"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  ReactNode,
  useEffect,
} from "react";
import { useToast } from "@/components/ui/ToastQueue";

export type LedgerConnectionStep =
  | "idle"
  | "connecting"
  | "unlock_device"
  | "open_app"
  | "enable_signing"
  | "fetching_key"
  | "connected"
  | "error";

interface LedgerState {
  step: LedgerConnectionStep;
  publicKey: string | null;
  errorMessage: string | null;
  deviceModel: string | null;
}

interface LedgerWalletContextValue {
  isSupported: boolean;
  state: LedgerState;
  isSigning: boolean;
  signError: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  signTransaction: (xdr: string) => Promise<string | null>;
  resetError: () => void;
}

const LedgerWalletContext = createContext<LedgerWalletContextValue | null>(null);

function isWebUSBSupported(): boolean {
  return typeof navigator !== "undefined" && "usb" in navigator;
}

export function LedgerWalletProvider({ children }: { children: ReactNode }) {
  const { addToast, updateToast } = useToast();

  const [state, setState] = useState<LedgerState>({
    step: "idle",
    publicKey: null,
    errorMessage: null,
    deviceModel: null,
  });

  const [isSigning, setIsSigning] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);

  const isSupported = useMemo(() => isWebUSBSupported(), []);

  const connect = useCallback(async () => {
    if (!isSupported) {
      setState((s) => ({
        ...s,
        step: "error",
        errorMessage: "WebUSB is not supported in this browser. Please use Chrome, Edge, or Opera.",
      }));
      return;
    }

    setState((s) => ({
      ...s,
      step: "connecting",
      errorMessage: null,
      publicKey: null,
    }));

    try {
      setState((s) => ({ ...s, step: "unlock_device" }));
      const TransportWebUSB = await import("@ledgerhq/hw-transport-webusb").then((m) => m.default);

      setState((s) => ({ ...s, step: "open_app" }));
      const transport = await TransportWebUSB.create();

      const deviceName =
        (transport as unknown as Record<string, { productName?: string }>).device?.productName ?? "Ledger Device";
      setState((s) => ({ ...s, deviceModel: deviceName }));

      setState((s) => ({ ...s, step: "enable_signing" }));
      setState((s) => ({ ...s, step: "fetching_key" }));
      
      const Str = await import("@ledgerhq/hw-app-str").then((m) => m.default);
      const stellarApp = new Str(transport);

      const { rawPublicKey } = await stellarApp.getPublicKey("44'/148'/0'");
      const publicKey = rawPublicKey.toString("hex");

      setState((s) => ({
        ...s,
        step: "connected",
        publicKey,
      }));

      await transport.close();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error occurred.";

      let userMessage = message;
      if (message.includes("denied")) {
        userMessage = "USB device access was denied. Please approve the connection prompt.";
      } else if (message.includes("0x6e01") || message.includes("0x6e00")) {
        userMessage = "The Stellar app is not open on your Ledger. Please open it and try again.";
      } else if (message.includes("Locked") || message.includes("0x6b0c")) {
        userMessage = "Your Ledger device is locked. Please unlock it with your PIN.";
      } else if (message.includes("timeout") || message.includes("disconnected")) {
        userMessage = "Connection timed out or device was disconnected. Please reconnect.";
      }

      setState((s) => ({
        ...s,
        step: "error",
        errorMessage: userMessage,
      }));
    }
  }, [isSupported]);

  const disconnect = useCallback(() => {
    setState({
      step: "idle",
      publicKey: null,
      errorMessage: null,
      deviceModel: null,
    });
    setIsSigning(false);
    setSignError(null);
  }, []);

  const signTransaction = useCallback(
    async (xdr: string) => {
      if (!state.publicKey) return null;

      setIsSigning(true);
      setSignError(null);

      const toastId = addToast({
        title: "Ledger signing",
        description: "Verify the transaction hash on your Ledger device.",
        status: "processing",
      });

      try {
        const TransportWebUSB = await import("@ledgerhq/hw-transport-webusb").then((m) => m.default);
        const transport = await TransportWebUSB.create();
        
        // Handle disconnects during signing gracefully
        transport.on("disconnect", () => {
          setSignError("Ledger device was disconnected. Please reconnect and try again.");
          updateToast(toastId, {
            status: "failed",
            title: "Signing failed",
            description: "Device disconnected",
          });
          setIsSigning(false);
        });

        const Str = await import("@ledgerhq/hw-app-str").then((m) => m.default);
        const stellarApp = new Str(transport);

        const { Networks, TransactionBuilder } = await import("@stellar/stellar-sdk");
        const tx = TransactionBuilder.fromXDR(xdr.trim(), Networks.TESTNET);
        
        // Decode and display transaction hash on Ledger device screen
        // using signHash which will present the transaction hash to the user
        const hashBuffer = Buffer.from(tx.hash());
        const result = await stellarApp.signHash("44'/148'/0'", hashBuffer);

        const signedXdr = Buffer.from(
          result.signature.buffer as ArrayBuffer,
          result.signature.byteOffset,
          result.signature.byteLength
        ).toString("base64");

        updateToast(toastId, {
          status: "confirmed",
          title: "Transaction signed",
          description: "Your Ledger has signed the transaction.",
        });

        await transport.close();
        setIsSigning(false);
        return signedXdr;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Signing failed.";

        let userMessage = message;
        if (message.includes("denied") || message.includes("0x6985")) {
          userMessage = "Transaction was rejected on the Ledger device.";
        } else if (message.includes("timeout")) {
          userMessage = "Signing timed out. Please try again.";
        }

        setSignError(userMessage);
        updateToast(toastId, {
          status: "failed",
          title: "Signing failed",
          description: userMessage,
        });
        
        setIsSigning(false);
        return null;
      }
    },
    [state.publicKey, addToast, updateToast]
  );

  const resetError = useCallback(() => {
    setSignError(null);
    if (state.step === "error") {
      setState((s) => ({ ...s, step: "idle", errorMessage: null }));
    }
  }, [state.step]);

  const value = useMemo(
    () => ({
      isSupported,
      state,
      isSigning,
      signError,
      connect,
      disconnect,
      signTransaction,
      resetError,
    }),
    [isSupported, state, isSigning, signError, connect, disconnect, signTransaction, resetError]
  );

  return <LedgerWalletContext.Provider value={value}>{children}</LedgerWalletContext.Provider>;
}

export function useLedgerWallet() {
  const ctx = useContext(LedgerWalletContext);
  if (!ctx) {
    throw new Error("useLedgerWallet must be used within LedgerWalletProvider");
  }
  return ctx;
}
