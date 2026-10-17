"use client";

import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import {
  AlertTriangle,
  Bell,
  BellOff,
  BellRing,
  Shield,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  Info,
  CheckCircle2,
} from "lucide-react";

export type RiskZone = "safe" | "warning" | "liquidation";

export interface LiquidationRiskCardProps {
  /** Symbol or identifier for the collateral asset (e.g., "XLM", "USDC", "ETH") */
  collateralSymbol: string;
  /** Name of the vault or position */
  vaultName?: string;
  /** Current market price of the collateral asset in USD */
  currentPrice: number;
  /** Price at which the position will be liquidated in USD */
  liquidationPrice: number;
  /** Initial or reference price when position was opened (optional) */
  referencePrice?: number;
  /** Warning threshold percentage buffer before liquidation (defaults to 15%) */
  warningThresholdPercent?: number;
  /** Custom warning trigger price set by user (optional) */
  customWarningPrice?: number;
  /** Optional callback when user updates custom alert trigger price */
  onAlertTriggerChange?: (newWarningPrice: number) => void;
  /** Optional callback when alert triggers */
  onAlertTriggered?: (zone: RiskZone, currentPrice: number, liquidationPrice: number) => void;
  /** Allow disabling browser notifications */
  enableNotifications?: boolean;
}

export function formatCurrency(val: number): string {
  if (isNaN(val) || !isFinite(val)) return "$0.00";
  if (val >= 1000) {
    return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (val >= 1) {
    return `$${val.toFixed(2)}`;
  }
  return `$${val.toFixed(4)}`;
}

export default function LiquidationRiskCard({
  collateralSymbol,
  vaultName,
  currentPrice,
  liquidationPrice,
  referencePrice,
  warningThresholdPercent = 15,
  customWarningPrice: initialCustomWarningPrice,
  onAlertTriggerChange,
  onAlertTriggered,
  enableNotifications = true,
}: LiquidationRiskCardProps) {
  // Calculate Delta P: difference between current market price and liquidation price
  const deltaP = useMemo(() => {
    return currentPrice - liquidationPrice;
  }, [currentPrice, liquidationPrice]);

  // Delta P as a percentage of current price
  const deltaPPercent = useMemo(() => {
    if (currentPrice <= 0) return 0;
    return (deltaP / currentPrice) * 100;
  }, [deltaP, currentPrice]);

  // User configurable warning trigger price
  // Default warning price is liquidationPrice * (1 + warningThresholdPercent / 100)
  const defaultWarningPrice = useMemo(() => {
    return liquidationPrice * (1 + Math.max(0, warningThresholdPercent) / 100);
  }, [liquidationPrice, warningThresholdPercent]);

  const [warningTriggerPrice, setWarningTriggerPrice] = useState<number>(
    initialCustomWarningPrice ?? defaultWarningPrice
  );
  const [isEditingTrigger, setIsEditingTrigger] = useState(false);
  const [triggerInputValue, setTriggerInputValue] = useState(
    (initialCustomWarningPrice ?? defaultWarningPrice).toFixed(2)
  );

  // Sync state if props change and not actively editing
  useEffect(() => {
    if (!isEditingTrigger) {
      const nextPrice = initialCustomWarningPrice ?? defaultWarningPrice;
      setWarningTriggerPrice(nextPrice);
      setTriggerInputValue(nextPrice.toFixed(2));
    }
  }, [initialCustomWarningPrice, defaultWarningPrice, isEditingTrigger]);

  // Determine current risk zone
  const currentZone: RiskZone = useMemo(() => {
    if (currentPrice <= liquidationPrice) {
      return "liquidation";
    }
    if (currentPrice <= warningTriggerPrice) {
      return "warning";
    }
    return "safe";
  }, [currentPrice, liquidationPrice, warningTriggerPrice]);

  // Progress Bar Scaling Calculations
  // Range: From minScale (liquidation price * 0.85) to maxScale (referencePrice or higher buffer)
  const { minScale, maxScale, currentPercent, warningPercent, liquidationPercent } = useMemo(() => {
    const min = Math.max(0, liquidationPrice * 0.8);
    const highest = Math.max(
      referencePrice ?? (liquidationPrice * 1.6),
      currentPrice * 1.15,
      warningTriggerPrice * 1.25,
      liquidationPrice * 1.5
    );
    const range = highest - min || 1;

    const clamp = (val: number) => Math.min(100, Math.max(0, ((val - min) / range) * 100));

    return {
      minScale: min,
      maxScale: highest,
      currentPercent: clamp(currentPrice),
      warningPercent: clamp(warningTriggerPrice),
      liquidationPercent: clamp(liquidationPrice),
    };
  }, [currentPrice, liquidationPrice, referencePrice, warningTriggerPrice]);

  // Notification State
  const [browserNotificationAllowed, setBrowserNotificationAllowed] = useState<boolean>(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      return Notification.permission === "granted";
    }
    return false;
  });
  const [notificationsEnabledByUser, setNotificationsEnabledByUser] = useState<boolean>(true);
  const [notificationStatusMsg, setNotificationStatusMsg] = useState<string>("");

  const lastNotifiedZoneRef = useRef<RiskZone | null>(null);

  // Request browser notification permission
  const requestNotificationPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotificationStatusMsg("Browser notifications not supported in this browser");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        setBrowserNotificationAllowed(true);
        setNotificationStatusMsg("Notifications enabled");
        new Notification("Liquidation Alerts Activated", {
          body: `You will be alerted if ${collateralSymbol} approaches the liquidation threshold of ${formatCurrency(liquidationPrice)}.`,
          icon: "/sf.webp",
        });
      } else {
        setBrowserNotificationAllowed(false);
        setNotificationStatusMsg("Notification permission denied");
      }
    } catch {
      setNotificationStatusMsg("Failed to request permission");
    }
  }, [collateralSymbol, liquidationPrice]);

  // Trigger browser notification when asset prices breach user warning thresholds
  useEffect(() => {
    if (!enableNotifications || !notificationsEnabledByUser) return;

    if (currentZone !== "safe" && lastNotifiedZoneRef.current !== currentZone) {
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        const title =
          currentZone === "liquidation"
            ? `🚨 CRITICAL: ${collateralSymbol} Position Liquidation!`
            : `⚠️ Warning: ${collateralSymbol} Approaching Liquidation`;

        const body =
          currentZone === "liquidation"
            ? `${collateralSymbol} price (${formatCurrency(currentPrice)}) has breached liquidation price (${formatCurrency(liquidationPrice)})!`
            : `${collateralSymbol} price (${formatCurrency(currentPrice)}) has entered warning zone (threshold: ${formatCurrency(warningTriggerPrice)}). Delta P is ${formatCurrency(deltaP)}.`;

        try {
          new Notification(title, {
            body,
            icon: "/sf.webp",
            tag: `liquidation-alert-${collateralSymbol}`,
          });
        } catch {
          // Fallback or ignore if background notification fails
        }
      }

      onAlertTriggered?.(currentZone, currentPrice, liquidationPrice);
      lastNotifiedZoneRef.current = currentZone;
    } else if (currentZone === "safe") {
      lastNotifiedZoneRef.current = null;
    }
  }, [
    currentZone,
    currentPrice,
    liquidationPrice,
    warningTriggerPrice,
    collateralSymbol,
    deltaP,
    enableNotifications,
    notificationsEnabledByUser,
    onAlertTriggered,
  ]);

  // Handle saving new custom trigger price
  const handleSaveTrigger = () => {
    const val = parseFloat(triggerInputValue);
    if (!isNaN(val) && val > liquidationPrice) {
      setWarningTriggerPrice(val);
      setIsEditingTrigger(false);
      onAlertTriggerChange?.(val);
    } else {
      setNotificationStatusMsg(`Trigger must be above liquidation price (${formatCurrency(liquidationPrice)})`);
    }
  };

  return (
    <div
      data-testid="liquidation-risk-card"
      className="w-full rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl backdrop-blur-md transition-all duration-300 text-white"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl font-bold text-sm ${
              currentZone === "safe"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : currentZone === "warning"
                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse"
                : "bg-red-500/20 text-red-400 border border-red-500/30 animate-bounce"
            }`}
          >
            {collateralSymbol.slice(0, 3).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-slate-100">
                {vaultName ? `${vaultName} (${collateralSymbol})` : `${collateralSymbol} Collateral Risk`}
              </h3>
              <span
                data-testid="risk-badge"
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                  currentZone === "safe"
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                    : currentZone === "warning"
                    ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                    : "bg-red-500/15 text-red-400 border border-red-500/30"
                }`}
              >
                {currentZone === "safe" && <ShieldCheck className="h-3.5 w-3.5" />}
                {currentZone === "warning" && <AlertTriangle className="h-3.5 w-3.5" />}
                {currentZone === "liquidation" && <ShieldAlert className="h-3.5 w-3.5" />}
                {currentZone} Zone
              </span>
            </div>
            <p className="text-xs text-slate-400">Proactive Liquidation Monitoring</p>
          </div>
        </div>

        {/* Browser Alert Bell Toggle */}
        {enableNotifications && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="notification-toggle-btn"
              onClick={() => {
                if (!browserNotificationAllowed) {
                  requestNotificationPermission();
                } else {
                  setNotificationsEnabledByUser((prev) => !prev);
                }
              }}
              title={
                !browserNotificationAllowed
                  ? "Click to enable browser notifications"
                  : notificationsEnabledByUser
                  ? "Notifications are active. Click to mute."
                  : "Notifications are muted. Click to unmute."
              }
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                !browserNotificationAllowed
                  ? "border-slate-700 bg-slate-800/80 text-slate-300 hover:bg-slate-700"
                  : notificationsEnabledByUser
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                  : "border-slate-700 bg-slate-800 text-slate-400 hover:bg-slate-700"
              }`}
            >
              {!browserNotificationAllowed ? (
                <>
                  <Bell className="h-3.5 w-3.5 text-slate-400" />
                  <span>Enable Alerts</span>
                </>
              ) : notificationsEnabledByUser ? (
                <>
                  <BellRing className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
                  <span>Alerts On</span>
                </>
              ) : (
                <>
                  <BellOff className="h-3.5 w-3.5 text-slate-400" />
                  <span>Alerts Off</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {notificationStatusMsg && (
        <div className="mt-2.5 flex items-center justify-between rounded-lg bg-slate-800/60 px-3 py-1.5 text-xs text-slate-300">
          <span>{notificationStatusMsg}</span>
          <button
            type="button"
            onClick={() => setNotificationStatusMsg("")}
            className="text-slate-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* Metrics Row: Current Price, Liquidation Price, Delta P */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* Current Price */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
          <span className="text-xs font-medium text-slate-400">Current Market Price</span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span data-testid="current-price" className="text-xl font-bold font-mono text-white">
              {formatCurrency(currentPrice)}
            </span>
            <span className="text-xs font-semibold text-slate-400">{collateralSymbol}</span>
          </div>
        </div>

        {/* Liquidation Price */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3">
          <span className="text-xs font-medium text-slate-400">Liquidation Threshold</span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span data-testid="liquidation-price" className="text-xl font-bold font-mono text-red-400">
              {formatCurrency(liquidationPrice)}
            </span>
            <span className="text-xs font-semibold text-slate-400">{collateralSymbol}</span>
          </div>
        </div>

        {/* Delta P (Distance to Liquidation) */}
        <div
          className={`rounded-xl border p-3 ${
            currentZone === "safe"
              ? "border-emerald-500/20 bg-emerald-950/20"
              : currentZone === "warning"
              ? "border-amber-500/20 bg-amber-950/20"
              : "border-red-500/20 bg-red-950/20"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-300">
              Distance to Liquidation (&Delta;P)
            </span>
            <span
              className={`text-xs font-semibold ${
                deltaP >= 0 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {deltaP >= 0 ? `+${deltaPPercent.toFixed(1)}%` : `${deltaPPercent.toFixed(1)}%`}
            </span>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span
              data-testid="delta-p"
              className={`text-xl font-bold font-mono ${
                currentZone === "safe"
                  ? "text-emerald-400"
                  : currentZone === "warning"
                  ? "text-amber-400"
                  : "text-red-400"
              }`}
            >
              {deltaP >= 0 ? `+${formatCurrency(deltaP)}` : `-${formatCurrency(Math.abs(deltaP))}`}
            </span>
          </div>
        </div>
      </div>

      {/* Visual Price Progress Bar Highlighting Safe, Warning, and Liquidation Zones */}
      <div className="mt-6 rounded-xl border border-slate-800/80 bg-slate-950/60 p-4">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
          <span className="font-medium text-slate-300">Collateral Price Progress Track</span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              <span className="text-[11px] text-slate-400">Liquidation</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <span className="text-[11px] text-slate-400">Warning</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-[11px] text-slate-400">Safe</span>
            </div>
          </div>
        </div>

        {/* The Track Container */}
        <div className="relative my-6 h-6 w-full rounded-full bg-slate-900 border border-slate-700/60 p-1">
          {/* Zone Segments */}
          <div className="relative h-full w-full overflow-hidden rounded-full flex">
            {/* Liquidation Zone */}
            <div
              data-testid="zone-liquidation"
              style={{ width: `${liquidationPercent}%` }}
              className="h-full bg-gradient-to-r from-red-700 to-red-500 opacity-80"
              title={`Liquidation Zone: <= ${formatCurrency(liquidationPrice)}`}
            />
            {/* Warning Zone */}
            <div
              data-testid="zone-warning"
              style={{
                width: `${Math.max(0, warningPercent - liquidationPercent)}%`,
              }}
              className="h-full bg-gradient-to-r from-amber-500 to-amber-400 opacity-80"
              title={`Warning Zone: ${formatCurrency(liquidationPrice)} to ${formatCurrency(warningTriggerPrice)}`}
            />
            {/* Safe Zone */}
            <div
              data-testid="zone-safe"
              style={{
                width: `${Math.max(0, 100 - warningPercent)}%`,
              }}
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 opacity-80"
              title={`Safe Zone: > ${formatCurrency(warningTriggerPrice)}`}
            />
          </div>

          {/* Current Market Price Marker Indicator */}
          <div
            data-testid="current-price-indicator"
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 transition-all duration-300"
            style={{ left: `${currentPercent}%` }}
          >
            <div className="relative flex flex-col items-center">
              {/* Tooltip Pill */}
              <div
                className={`absolute bottom-6 whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-bold font-mono shadow-md border ${
                  currentZone === "safe"
                    ? "bg-slate-900 text-emerald-400 border-emerald-500/50"
                    : currentZone === "warning"
                    ? "bg-slate-900 text-amber-400 border-amber-500/50"
                    : "bg-slate-900 text-red-400 border-red-500/50"
                }`}
              >
                Now: {formatCurrency(currentPrice)}
              </div>
              {/* Marker pin */}
              <div className="h-7 w-2 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)] border border-slate-900" />
            </div>
          </div>

          {/* Warning Threshold Line Indicator */}
          <div
            data-testid="warning-threshold-indicator"
            className="absolute top-0 bottom-0 z-0 border-r-2 border-dashed border-amber-300/80"
            style={{ left: `${warningPercent}%` }}
            title={`Warning Threshold: ${formatCurrency(warningTriggerPrice)}`}
          />
        </div>

        {/* Labels below the track */}
        <div className="flex justify-between text-[11px] font-mono text-slate-400 pt-1">
          <span>{formatCurrency(minScale)}</span>
          <span className="text-red-400 font-semibold">Liq: {formatCurrency(liquidationPrice)}</span>
          <span className="text-amber-400 font-semibold">Warn: {formatCurrency(warningTriggerPrice)}</span>
          <span>{formatCurrency(maxScale)}</span>
        </div>
      </div>

      {/* User Custom Alert Trigger Settings */}
      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-amber-400" />
            <div>
              <span className="text-xs font-semibold text-slate-200">
                Custom Warning Alert Trigger
              </span>
              <p className="text-[11px] text-slate-400">
                Alert fires when {collateralSymbol} price drops to or below this threshold
              </p>
            </div>
          </div>

          {!isEditingTrigger ? (
            <div className="flex items-center gap-2">
              <span
                data-testid="custom-trigger-display"
                className="font-mono text-xs font-bold text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-md border border-amber-400/30"
              >
                {formatCurrency(warningTriggerPrice)}
              </span>
              <button
                type="button"
                data-testid="edit-trigger-btn"
                onClick={() => setIsEditingTrigger(true)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
              >
                Edit
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">$</span>
                <input
                  type="number"
                  step="any"
                  data-testid="trigger-price-input"
                  value={triggerInputValue}
                  onChange={(e) => setTriggerInputValue(e.target.value)}
                  className="w-28 rounded-lg border border-amber-500/50 bg-slate-900 py-1 pl-5 pr-2 font-mono text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>
              <button
                type="button"
                data-testid="save-trigger-btn"
                onClick={handleSaveTrigger}
                className="rounded-lg bg-amber-500 px-2.5 py-1 text-xs font-semibold text-slate-950 hover:bg-amber-400 transition-colors"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setTriggerInputValue(warningTriggerPrice.toFixed(2));
                  setIsEditingTrigger(false);
                }}
                className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
