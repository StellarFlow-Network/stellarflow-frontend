import { useCallback, useEffect, useMemo } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

export type SEP24TransactionType = "deposit" | "withdrawal";

export type SEP24StepState =
  | "pending_user_action"
  | "processing_anchor"
  | "tokens_dispatched"
  | "completed";

export type SEP24TerminalState = "error" | "expired";

export interface SEP24TransactionStatus {
  id: string;
  type: SEP24TransactionType;
  status: string;
  amountIn?: string;
  assetIn?: string;
  amountOut?: string;
  assetOut?: string;
  anchorName: string;
  anchorReference: string;
  interactiveUrl?: string;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  errorMessage?: string;
  supportEmail?: string;
  supportUrl?: string;
  supportPhone?: string;
  moreInfoUrl?: string;
}

export interface SEP24ProgressStepperProps {
  transactionId: string;
  type?: SEP24TransactionType;
  /** Polling interval in ms. Defaults to 5000. */
  pollInterval?: number;
  /** Optional external controlled status (skips polling when provided). */
  status?: SEP24TransactionStatus;
  /** Optional callback invoked when the transaction reaches a terminal state. */
  onComplete?: (tx: SEP24TransactionStatus) => void;
  /** Optional callback invoked on error/expiry. */
  onError?: (tx: SEP24TransactionStatus) => void;
  className?: string;
}

const STEP_ORDER: SEP24StepState[] = [
  "pending_user_action",
  "processing_anchor",
  "tokens_dispatched",
  "completed",
];

const STEP_LABELS: Record<SEP24StepState, string> = {
  pending_user_action: "Pending User Action",
  processing_anchor: "Processing Anchor",
  tokens_dispatched: "Tokens Dispatched",
  completed: "Completed",
};

const STEP_DESCRIPTIONS: Record<SEP24StepState, string> = {
  pending_user_action:
    "Complete the interactive form to continue your SEP-24 transfer.",
  processing_anchor:
    "The anchor is processing your fiat transfer.",
  tokens_dispatched:
    "Tokens have been dispatched to your wallet.",
  completed: "Your SEP-24 transfer is complete.",
};

const STATUS_TO_STEP: Record<string, SEP24StepState> = {
  // Deposit flow
  incomplete: "pending_user_action",
  pending_user_transfer_info: "pending_user_action",
  pending_user_transfer: "pending_user_action",
  pending_anchor_status: "processing_anchor",
  pending_external: "processing_anchor",
  pending_trustline: "processing_anchor",
  pending_anchor: "processing_anchor",
  // Withdrawal flow
  // Terminal success states
  completed: "completed",
  refunded: "completed",
  // Terminal failure states
  error: "processing_anchor",
  expired: "pending_user_action",
  no_market: "processing_anchor",
  too_small: "processing_anchor",
  too_large: "processing_anchor",
  too_many_requests: "processing_anchor",
  unsupported_asset: "processing_anchor",
  unsupported_currency: "processing_anchor",
  unsupported_language: "processing_anchor",
  unsupported_sep24_transaction: "processing_anchor",
  unsupported_wallet: "processing_anchor",
};

const TERMINAL_ERROR_STATUS = new Set([
  "error",
  "no_market",
  "too_small",
  "too_large",
  "too_many_requests",
  "unsupported_asset",
  "unsupported_currency",
  "unsupported_language",
  "unsupported_sep24_transaction",
  "unsupported_wallet",
]);

const TERMINAL_EXPIRE_STATUS = new Set(["expired"]);

const TERMINAL_SUCCESS_STATUS = new Set(["completed", "refunded"]);

const DEFAULT_POLL_INTERVAL = 5000;

export function normalizeSEP24Status(status: string): string {
  return status.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function getStepFromStatus(status: string): SEP24StepState {
  const normalized = normalizeSEP24Status(status);
  return STATUS_TO_STEP[normalized] ?? "processing_anchor";
}

export function isTerminalStatus(status: string): boolean {
  const normalized = normalizeSEP24Status(status);
  return (
    TERMINAL_ERROR_STATUS.has(normalized) ||
    TERMINAL_EXPIRE_STATUS.has(normalized) ||
    TERMINAL_SUCCESS_STATUS.has(normalized)
  );
}

export function isErrorStatus(status: string): boolean {
  const normalized = normalizeSEP24Status(status);
  return TERMINAL_ERROR_STATUS.has(normalized);
}

export function isExpiredStatus(status: string): boolean {
  return TERMINAL_EXPIRE_STATUS.has(normalizeSEP24Status(status));
}

export function isSuccessStatus(status: string): boolean {
  return TERMINAL_SUCCESS_STATUS.has(normalizeSEP24Status(status));
}

export function getStepIndex(step: SEP24StepState): number {
  return STEP_ORDER.indexOf(step);
}

export function getStepLabel(step: SEP24StepState): string {
  return STEP_LABELS[step];
}

async function fetchSEP24TransactionStatus(
  transactionId: string,
  signal?: AbortSignal,
): Promise<SEP24TransactionStatus> {
  const res = await fetch(
    `/api/sep24/transactions/${encodeURIComponent(transactionId)}`,
    {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal,
    },
  );

  if (!res.ok) {
    throw new Error(
      `Failed to fetch SEP-24 transaction ${transactionId}: ${res.status}`,
    );
  }

  return (await res.json()) as SEP24TransactionStatus;
}

export function useSEP24TransactionStatus(
  transactionId: string,
  options?: {
    pollInterval?: number;
    enabled?: boolean;
  },
): UseQueryResult<SEP24TransactionStatus, Error> {
  const pollInterval = options?.pollInterval ?? DEFAULT_POLL_INTERVAL;
  const enabled = options?.enabled ?? Boolean(transactionId);

  return useQuery<SEP24TransactionStatus, Error>({
    queryKey: ["sep24-transaction", transactionId],
    queryFn: ({ signal }) => fetchSEP24TransactionStatus(transactionId, signal),
    enabled: enabled && Boolean(transactionId),
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: true,
    refetchInterval: (query) => {
      const data = query.state.data as SEP24TransactionStatus | undefined;
      if (data && isTerminalStatus(data.status)) {
        return false;
      }
      return pollInterval;
    },
    refetchIntervalInBackground: false,
  });
}

function formatAmount(amount?: string, asset?: string): string | null {
  if (!amount) return null;
  const numeric = Number(amount);
  const display = Number.isFinite(numeric)
    ? numeric.toLocaleString("un-US", { maximumFractionDigits: 7 })
    : amount;
  return asset ? `${display} ${asset}` : display;
}

function formatTimestamp(timestamp?: string): string | null {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString();
}

export function SEP24ProgressStepper({
  transactionId,
  type,
  pollInterval = DEFAULT_POLL_INTERVAL,
  status: controlledStatus,
  onComplete,
  onError,
  className,
}: SEP24ProgressStepperProps) {
  const isControlled = Boolean(controlledStatus);
  const query = useSEP24TransactionStatus(transactionId, {
    pollInterval,
    enabled: !isControlled,
  });

  const transaction = controlledStatus ?? query.data;
  const isLoading = !isControlled && query.isLoading;
  const isFetching = !isControlled && query.isFetching;
  const queryError = isControlled ? null : query.error;

  const normalizedStatus = transaction ? normalizeSEP24Status(transaction.status) : null;
  const currentStep = transaction ? getStepFromStatus(transaction.status) : "pending_user_action";
  const currentIndex = getStepIndex(currentStep);
  const hasError = normalizedStatus ? isErrorStatus(normalizedStatus) : false;
  const hasExpired = normalizedStatus ? isExpiredStatus(normalizedStatus) : false;
  const isComplete = normalizedStatus ? isSuccessStatus(normalizedStatus) : false;
  const isTerminal = hasError || hasExpired || isComplete;

  const handleComplete = useCallback(
    (tx: SEP24TransactionStatus) => {
      onComplete?.(tx);
    },
    [onComplete],
  );

  const handleError = useCallback(
    (tx: SEP24TransactionStatus) => {
      onError?.(tx);
    },
    [onError],
  );

  useEffect(() => {
    if (!transaction || !isTerminal) return;
    if (isComplete) {
      handleComplete(transaction);
    } else {
      handleError(transaction);
    }
  }, [transaction, isTerminal, isComplete, handleComplete, handleError]);

  const steps = useMemo(() => STEP_ORDER, []);

  const stepStatusLabel = useMemo(() => {
    if (hasError) return "Transfer error";
    if (hasExpired) return "Transfer expired";
    return STEP_LABELS[currentStep];
  }, [hasError, hasExpired, currentStep]);

  if (isLoading && !transaction) {
    return (
      <div
        className={`sep24-progress-stepper sep24-progress-stepper--loading ${className ?? ""}`}
        role="status"
        aria-live="polite"
        data-testid="sep24-progress-stepper"
      >
        <p className="sep24-progress-stepper__loading">
          Loading transaction progress...
        </p>
      </div>
    );
  }

  if (queryError && !transaction) {
    return (
      <div
        className={`sep24-progress-stepper sep24-progress-stepper--error ${className ?? ""}`}
        role="alert"
        data-testid="sep24-progress-stepper-error"
      >
        <p className="sep24-progress-stepper__error-message">
          Unable to load transaction progress: {queryError.message}
        </p>
      </div>
    );
  }

  if (!transaction) {
    return null;
  }

  const amountIn = formatAmount(transaction.amountIn, transaction.assetIn);
  const amountOut = formatAmount(transaction.amountOut, transaction.assetOut);
  const updatedAt = formatTimestamp(transaction.updatedAt);
  const completedAt = formatTimestamp(transaction.completedAt);

  const supportEmail = transaction.supportEmail;
  const supportUrl = transaction.supportUrl;
  const supportPhone = transaction.supportPhone;
  const moreInfoUrl = transaction.moreInfoUrl;

  return (
    <section
      className={`sep24-progress-stepper ${className ?? ""}`}
      aria-label="SEP-24 transaction progress"
      data-testid="sep24-progress-stepper"
      data-status={normalizedStatus ?? "unknown"}
      data-type={type ?? transaction.type}
    >
      <header className="sep24-progress-stepper__header">
        <h1 className="sep24-progress-stepper__title">
          {type === "withdrawal" || transaction.type === "withdrawal"
            ? "SEP-24 Withdrawal Progress"
            : "SEP-24 Deposit Progress"}
        </h1>
        <p className="sep24-progress-stepper__anchor">
          {transaction.anchorName}
        </p>
        <p className="sep24-progress-stepper__reference">
          Reference ID: <code>{transaction.anchorReference}</code>
        </p>
      </header>

      <ol
        className="sep24-progress-stepper__steps"
        aria-label="Transaction progress"
      >
        {steps.map((step, index) => {
          const isActive = index === currentIndex && !isTerminal;
          const isCompletedStep = index < currentIndex || isComplete;
          const isErrorStep = hasError && index === currentIndex;
          const isExpiredStep = hasExpired && index === currentIndex;
          const stateLabel = isErrorStep
            ? "error"
            : isExpiredStep
              ? "expired"
              : isActive
                ? "active"
                : isCompletedStep
                  ? "completed"
                  : "upcoming";

          return (
            <li
              key={step}
              className={`sep24-progress-stepper__step sep24-progress-stepper__step--${stateLabel}`}
              aria-current={isActive ? "step" : undefined}
              data-step={step}
              data-state={stateLabel}
            >
              <span
                className="sep24-progress-stepper__indicator"
                aria-hidden="true"
              >
                {isCompletedStep && !isErrorStep ? "✓" : index + 1}
              </span>
              <div className="sep24-progress-stepper__content">
                <span className="sep24-progress-stepper__label">
                  {STEP_LABELS[step]}
                </span>
                <span className="sep24-progress-stepper__description">
                  {STEP_DESCRIPTIONS[step]}
                </span>
              </div>
            </li>
          );
        })
      </ol>

      <div className="sep24-progress-stepper__summary">
        <p className="sep24-progress-stepper__status">
          Status: {stepStatusLabel}
          {isFetching ? " (refreshing...)" : null}
        </p>

        {amountIn ? (
          <p className="sep24-progress-stepper__amount-in">
            Amount in: {amountIn}
          </p>
        ) : null}

        {amountOut ? (
          <p className="sep24-progress-stepper__amount-out">
            Amount out: {amountOut}
          </p>
        ) : null}

        {updatedAt ? (
          <p className="sep24-progress-stepper__updated-at">
            Last updated: {updatedAt}
          </p>
        ) : null}

        {completedAt ? (
          <p className="sep24-progress-stepper__completed-at">
            Completed: {completedAt}
          </p>
        ) : null}
      </div>

      {hasExpired ? (
        <div
          className="sep24-progress-stepper__expired"
          role="alert"
        >
          <p>Your SEP-24 transaction has expired. Please start a new transfer.</p>
        </div>
      ) : null}

      {hasError ? (
        <div
          className="sep24-progress-stepper__error"
          role="alert"
        >
          <p className="sep24-progress-stepper__error-message">
            {transaction.errorMessage ?? "The transfer encountered an error."}
          </p>
        </div>
      ) : null}

      <footer className="sep24-progress-stepper__footer">
        <p className="sep24-progress-stepper__support-label">
          Need help? Contact the anchor:
        </p>
        <div className="sep24-progress-stepper__support-buttons">
          {supportEmail ? (
            <a
              className="sep24-progress-stepper__support-button"
              href={`mailto:${supportEmail}`}
              data-testid="sep24-support-email"
            >
              Email support
            </a>
          ) : null}

          {supportUrl ? (
            <a
              className="sep24-progress-stepper__support-button"
              href={supportUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="sep24-support-url"
            >
              Support site
            </a>
          ) : null}

          {supportPhone ? (
            <a
              className="sep24-progress-stepper__support-button"
              href={`tel:${supportPhone}`}
              data-testid="sep24-support-phone"
            >
              Call support
            </a>
          ) : null}

          {moreInfoUrl ? (
            <a
              className="sep24-progress-stepper__more-info"
              href={moreInfoUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="sep24-more-info"
            >
              View transaction details
            </a>
          ) : null}
        </div>
      </footer>
    </section>
  );
}
