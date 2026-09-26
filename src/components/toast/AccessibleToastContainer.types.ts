export type ToastKind = "info" | "success" | "warning" | "error";

export interface ToastItem {
  id: string;
  title?: string;
  message: string;
  kind: ToastKind;
  durationMs?: number;
}

export interface AccessibleToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
  maxVisible?: number;
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
}
