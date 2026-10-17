import React, { useCallback, useEffect, useRef, useState } from "react";

export interface SEP24WebviewMessage {
  type: string;
  transactionId?: string;
  status?: string;
  payload?: unknown;
}

export interface SEP24WebviewModalProps {
  /** Whether the modal is open. */
  open: boolean;
  /** The anchor interactive webview URL to embed. */
  url: string;
  /** Origins allowed to send postMessage events. */
  allowedOrigins: string[];
  /** Title shown in the modal header. */
  title?: string;
  /** Called when the anchor signals flow completion. */
  onComplete: (transactionId?: string) => void;
  /** Called when the user closes the modal manually. */
  onClose?: () => void;
  /** Optional error handler for invalid messages/load failures. */
  onError?: (error: Error) => void;
}

const COMPLETE_EVENT_TYPES = new Set([
  "sep24_complete",
  "sep24_done",
  "sep24_transaction_complete",
  "anchor_flow_complete",
]);

function isSEP24WebviewMessage(data: unknown): data is SEP24WebviewMessage {
  if (!data || typeof data !== "object") {
    return false;
  }
  const candidate = data as { type?: unknown };
  return typeof candidate.type === "string";
}

function normalizeOrigin(origin: string): string {
  try {
    return new URL(origin).origin;
  } catch {
    return origin.replace(/\/$/, "");
  }
}

export const SEP24WebviewModal: React.FC<SEP24WebviewModalProps> = ({
  open,
  url,
  allowedOrigins,
  title = "Complete transfer",
  onComplete,
  onClose,
  onError,
}) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const completedRef = useRef<boolean>(false);

  const origins = React.useMemo(() => {
    const set = new Set<string>();
    for (const origin of allowedOrigins) {
      if (typeof origin === "string" && origin.length > 0) {
        set.add(normalizeOrigin(origin));
      }
    }
    return set;
  }, [allowedOrigins]);

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      if (!open) {
        return;
      }

      // Verify origin against the allowed list.
      if (!origins.has(normalizeOrigin(event.origin))) {
        return;
      }

      // Verify the message originated from the embedded iframe.
      const iframeWindow = iframeRef.current?.contentWindow;
      if (iframeWindow && event.source !== iframeWindow) {
        return;
      }

      if (!isSEP24WebviewMessage(event.data)) {
        return;
      }

      const message = event.data as SEP24WebviewMessage;
      if (!COMPLETE_EVENT_TYPES.has(message.type)) {
        return;
      }

      if (completedRef.current) {
        return;
      }
      completedRef.current = true;

      try {
        onComplete(message.transactionId);
      } catch (err) {
        onError?.(err instanceof Error ? err : new Error(String(err)));
      }
    },
    [open, origins, onComplete, onError],
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [open, handleMessage]);

  useEffect(() => {
    if (open) {
      completedRef.current = false;
      setIsLoading(true);
    }
  }, [open, url]);

  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="sep24-webview-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sep24-webview-title"
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        zIndex: 1000,
      }}
    >
      <div
        className="sep24-webview-modal__content"
        style={{
          width: "min(960px, 95%)",
          height: "min(90%, 800px)",
          backgroundColor: "#fff",
          borderRadius: "12px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
        }}
      >
        <header
          className="sep24-webview-modal__header"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: "1px solid #e5e7eb",
          }}
        >
          <h2 id="sep24-webview-title" style={{ margin: 0, fontSize: "16px" }}>
            {title}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            style={{
              background: "transparent",
              border: "none",
              fontSize: "20px",
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            &times;
          </button>
        </header>
        <div style={{ position: "relative", flex: 1 }}>
          {isLoading && (
            <div
              aria-live="polite"
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#fff",
                zIndex: 1,
              }}
            >
              Loading secure anchor webview&lsp;
            </div>
          )}
          <iframe
            ref={iframeRef}
            src={url}
            title={title}
            onLoad={() => setIsLoading(false)}
            onError={() => onError?.(new Error("Failed to load SEP24 anchor webview"))}
            sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-modals allow-top-navigation-by-user-activation"
            allow="camera; microphone; clipboard-write"
            referrerPolicy="strict-origin-when-cross-origin"
            style={{ border: 0, width: "100%", height: "100%" }}
          />
        </div>
      </div>
    </div>
  );
};

export default SEP24WebviewModal;
