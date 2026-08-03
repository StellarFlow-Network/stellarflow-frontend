'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  X,
  Bell,
  BellOff,
  Plus,
  Trash2,
  Pencil,
  ArrowUpCircle,
  ArrowDownCircle,
  Check,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AlertCondition = 'above' | 'below';

export interface PriceAlert {
  id: string;
  symbol: string;
  condition: AlertCondition;
  targetPrice: number;
  enabled: boolean;
  createdAt: string;
  triggeredAt: string | null;
}

export interface PriceAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Live price ticks keyed by uppercase symbol (e.g. `{ XLM: 0.243 }`).
   * When omitted, a built-in demo ticker simulates prices for every symbol
   * referenced by the user's saved alerts.
   */
  livePrices?: Record<string, number>;
  /** Called whenever an active alert's condition is met on a price tick. */
  onAlertTriggered?: (alert: PriceAlert, price: number) => void;
}

// ---------------------------------------------------------------------------
// Local "notification service" — persists alert triggers and evaluates ticks.
// Swappable for a real backend call without changing the component API.
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'stellarflow-price-alerts-v1';

export function loadPriceAlerts(): PriceAlert[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function savePriceAlerts(alerts: PriceAlert[]): Promise<void> {
  if (typeof window === 'undefined') return;
  // Placeholder for a real backend sync call — persisted locally for now so
  // alerts survive reloads without requiring an account-linked service.
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
}

/** Pure function: returns the subset of alerts whose condition is met by `prices`. */
export function evaluatePriceAlerts(
  alerts: PriceAlert[],
  prices: Record<string, number>,
): PriceAlert[] {
  return alerts.filter((alert) => {
    if (!alert.enabled) return false;
    const price = prices[alert.symbol];
    if (price === undefined) return false;
    return alert.condition === 'above' ? price >= alert.targetPrice : price <= alert.targetPrice;
  });
}

function requestBrowserNotification(alert: PriceAlert, price: number) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  new Notification(`${alert.symbol} price alert`, {
    body: `${alert.symbol} is now $${price.toFixed(4)} (target: ${alert.condition} $${alert.targetPrice})`,
    tag: alert.id,
  });
}

// ---------------------------------------------------------------------------
// Demo ticker — simulates live prices when the caller doesn't supply real ones
// ---------------------------------------------------------------------------

const DEFAULT_SEED_PRICES: Record<string, number> = {
  XLM: 0.24,
  USDC: 1.0,
  BTC: 62000,
};

function useDemoTicker(symbols: string[], enabled: boolean): Record<string, number> {
  const [prices, setPrices] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    symbols.forEach((s) => {
      initial[s] = DEFAULT_SEED_PRICES[s] ?? 1;
    });
    return initial;
  });

  const symbolsKey = symbols.join(',');

  useEffect(() => {
    if (!enabled || symbolsKey === '') return;
    const tracked = symbolsKey.split(',');
    const interval = setInterval(() => {
      setPrices((prev) => {
        const next = { ...prev };
        tracked.forEach((symbol) => {
          const base = next[symbol] ?? DEFAULT_SEED_PRICES[symbol] ?? 1;
          const drift = base * (Math.random() * 0.02 - 0.01);
          next[symbol] = Math.max(0.0001, base + drift);
        });
        return next;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [enabled, symbolsKey]);

  return prices;
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

interface AlertToast {
  id: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PriceAlertModal({ isOpen, onClose, livePrices, onAlertTriggered }: PriceAlertModalProps) {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [toasts, setToasts] = useState<AlertToast[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [formSymbol, setFormSymbol] = useState('');
  const [formCondition, setFormCondition] = useState<AlertCondition>('above');
  const [formTarget, setFormTarget] = useState('');
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>(
    'unsupported',
  );

  useEffect(() => {
    setAlerts(loadPriceAlerts());
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifPermission(Notification.permission);
    }
  }, []);

  const persist = useCallback((next: PriceAlert[]) => {
    setAlerts(next);
    void savePriceAlerts(next);
  }, []);

  const trackedSymbols = useMemo(
    () => Array.from(new Set(alerts.map((a) => a.symbol))),
    [alerts],
  );

  const demoPrices = useDemoTicker(trackedSymbols, !livePrices && isOpen);
  const prices = livePrices ?? demoPrices;

  // Evaluate every price tick against active alerts.
  useEffect(() => {
    if (!isOpen) return;
    const matched = evaluatePriceAlerts(alerts, prices);
    if (matched.length === 0) return;

    const now = new Date().toISOString();
    let didUpdate = false;

    const next = alerts.map((alert) => {
      const hit = matched.find((m) => m.id === alert.id);
      if (!hit || alert.triggeredAt) return alert;
      didUpdate = true;

      const price = prices[alert.symbol];
      setToasts((prev) => [
        ...prev,
        {
          id: `${alert.id}-${now}`,
          message: `${alert.symbol} ${alert.condition === 'above' ? 'rose above' : 'fell below'} $${alert.targetPrice} — now $${price.toFixed(4)}`,
        },
      ]);
      requestBrowserNotification(alert, price);
      onAlertTriggered?.(alert, price);

      return { ...alert, triggeredAt: now };
    });

    if (didUpdate) persist(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prices, isOpen]);

  const dismissToast = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const resetForm = () => {
    setFormSymbol('');
    setFormCondition('above');
    setFormTarget('');
    setIsCreating(false);
    setEditingId(null);
  };

  const handleStartCreate = () => {
    resetForm();
    setIsCreating(true);
  };

  const handleStartEdit = (alert: PriceAlert) => {
    setFormSymbol(alert.symbol);
    setFormCondition(alert.condition);
    setFormTarget(String(alert.targetPrice));
    setEditingId(alert.id);
    setIsCreating(false);
  };

  const handleSave = () => {
    const symbol = formSymbol.trim().toUpperCase();
    const target = parseFloat(formTarget);
    if (!symbol || Number.isNaN(target) || target <= 0) return;

    if (editingId) {
      persist(
        alerts.map((a) =>
          a.id === editingId
            ? { ...a, symbol, condition: formCondition, targetPrice: target, triggeredAt: null }
            : a,
        ),
      );
    } else {
      const newAlert: PriceAlert = {
        id: crypto.randomUUID(),
        symbol,
        condition: formCondition,
        targetPrice: target,
        enabled: true,
        createdAt: new Date().toISOString(),
        triggeredAt: null,
      };
      persist([...alerts, newAlert]);
    }
    resetForm();
  };

  const handleToggle = (id: string) => {
    persist(alerts.map((a) => (a.id === id ? { ...a, enabled: !a.enabled, triggeredAt: null } : a)));
  };

  const handleDelete = (id: string) => {
    persist(alerts.filter((a) => a.id !== id));
    if (editingId === id) resetForm();
  };

  const handleEnableBrowserPush = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const permission = await Notification.requestPermission();
    setNotifPermission(permission);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl bg-white dark:bg-gray-900 rounded-2xl shadow-xl overflow-hidden border border-gray-200 dark:border-gray-800 max-h-[85vh] flex flex-col">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Bell size={22} className="text-blue-500" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Price Alerts</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-500"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {notifPermission !== 'granted' && notifPermission !== 'unsupported' && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-blue-500/30 bg-blue-50 dark:bg-blue-950/20 px-4 py-3">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Enable browser push to get alerted even when this tab isn&apos;t focused.
              </p>
              <button
                type="button"
                onClick={handleEnableBrowserPush}
                className="shrink-0 px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
              >
                Enable
              </button>
            </div>
          )}

          {/* Alert list */}
          <div className="space-y-2">
            {alerts.length === 0 && !isCreating ? (
              <div className="text-center py-10 text-gray-500 dark:text-gray-400 space-y-2">
                <Bell size={28} className="mx-auto opacity-40" />
                <p>No price alerts yet.</p>
              </div>
            ) : (
              alerts.map((alert) => {
                const currentPrice = prices[alert.symbol];
                const isEditing = editingId === alert.id;
                return (
                  <div
                    key={alert.id}
                    className={`p-4 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                      alert.triggeredAt
                        ? 'border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/10'
                        : 'border-gray-200 dark:border-gray-800'
                    } ${isEditing ? 'ring-2 ring-blue-500' : ''}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {alert.condition === 'above' ? (
                        <ArrowUpCircle size={20} className="text-emerald-500 shrink-0" />
                      ) : (
                        <ArrowDownCircle size={20} className="text-red-500 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {alert.symbol}{' '}
                          <span className="font-normal text-gray-500 dark:text-gray-400">
                            {alert.condition} ${alert.targetPrice}
                          </span>
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {currentPrice !== undefined ? `Current: $${currentPrice.toFixed(4)}` : 'Awaiting price feed…'}
                          {alert.triggeredAt && ' · Triggered'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggle(alert.id)}
                        aria-label={alert.enabled ? 'Disable alert' : 'Enable alert'}
                        aria-pressed={alert.enabled}
                        className={`p-2 rounded-lg transition-colors ${
                          alert.enabled
                            ? 'text-blue-500 hover:bg-blue-500/10'
                            : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                      >
                        {alert.enabled ? <Bell size={16} /> : <BellOff size={16} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStartEdit(alert)}
                        aria-label="Edit alert"
                        className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(alert.id)}
                        aria-label="Delete alert"
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Create / edit form */}
          {(isCreating || editingId) && (
            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {editingId ? 'Edit Alert' : 'New Price Alert'}
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder="Symbol (e.g. XLM)"
                  value={formSymbol}
                  onChange={(e) => setFormSymbol(e.target.value)}
                  className="col-span-1 px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select
                  value={formCondition}
                  onChange={(e) => setFormCondition(e.target.value as AlertCondition)}
                  className="col-span-1 px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="above">Exceeds</option>
                  <option value="below">Drops below</option>
                </select>
                <input
                  type="number"
                  step="any"
                  placeholder="Target price ($)"
                  value={formTarget}
                  onChange={(e) => setFormTarget(e.target.value)}
                  className="col-span-1 px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 font-medium transition-colors"
                >
                  <Check size={16} /> Save Alert
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-800">
          <button
            type="button"
            onClick={handleStartCreate}
            className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-2 font-medium transition-colors"
          >
            <Plus size={18} /> New Price Alert
          </button>
        </div>
      </div>

      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-[60] space-y-2 w-80">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="flex items-start gap-2 rounded-lg border border-emerald-500/40 bg-white dark:bg-gray-900 shadow-lg px-4 py-3 text-sm text-gray-800 dark:text-gray-200"
            role="status"
          >
            <Bell size={16} className="text-emerald-500 shrink-0 mt-0.5" />
            <span className="flex-1">{toast.message}</span>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss"
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PriceAlertModal;
