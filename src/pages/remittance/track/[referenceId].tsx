"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  HelpCircle,
  Mail,
  MessageSquare,
  Phone,
  RefreshCw,
  Share2,
  Shield,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Upload,
  UserCheck,
  X,
  AlertCircle,
  Copy,
  Check,
} from "lucide-react";

export type DeliveryStep =
  | "initiated"
  | "escrowed"
  | "anchor_processing"
  | "paid_out";

export interface StepInfo {
  id: DeliveryStep;
  label: string;
  shortDescription: string;
  detailedDescription: string;
  icon: React.ElementType;
  timestamp?: string;
  txHash?: string;
}

export interface RemittanceTrackingData {
  referenceId: string;
  senderName: string;
  recipientName: string;
  recipientPhoneOrAccount: string;
  sendAmount: string;
  sendAsset: string;
  receiveAmount: string;
  receiveAsset: string;
  exchangeRate: string;
  corridor: string;
  anchorName: string;
  anchorSupportEmail: string;
  anchorSupportPhone: string;
  anchorHelpDeskUrl: string;
  currentStep: DeliveryStep;
  initiatedAt: string;
  estimatedArrivalMs: number;
  completedAt?: string;
  stepsHistory: {
    step: DeliveryStep;
    completedAt: string;
    note: string;
    txHash?: string;
  }[];
}

const STEPS_CONFIG: {
  id: DeliveryStep;
  label: string;
  description: string;
  icon: React.ElementType;
}[] = [
  {
    id: "initiated",
    label: "Initiated",
    description: "Sender transfer authorized and broadcast to Stellar network",
    icon: Upload,
  },
  {
    id: "escrowed",
    label: "Escrowed",
    description: "Funds securely locked in on-chain non-custodial smart escrow",
    icon: ShieldCheck,
  },
  {
    id: "anchor_processing",
    label: "Anchor Processing",
    description: "Licensed fiat anchor validating and routing payout",
    icon: Clock,
  },
  {
    id: "paid_out",
    label: "Paid Out",
    description: "Fiat currency successfully disbursed to recipient account",
    icon: CheckCircle2,
  },
];

const STEP_ORDER: Record<DeliveryStep, number> = {
  initiated: 0,
  escrowed: 1,
  anchor_processing: 2,
  paid_out: 3,
};

function getMockTrackingData(refId: string): RemittanceTrackingData {
  const now = Date.now();
  return {
    referenceId: refId,
    senderName: "Elena Rostova",
    recipientName: "Kwame Mensah",
    recipientPhoneOrAccount: "+254 ••• ••• 418",
    sendAmount: "250.00",
    sendAsset: "USDC",
    receiveAmount: "32,450.00",
    receiveAsset: "KES",
    exchangeRate: "1 USDC = 129.80 KES",
    corridor: "USDC ➔ KES (Kenya)",
    anchorName: "Kotani Pay Off-Ramp",
    anchorSupportEmail: "support@kotanipay.com",
    anchorSupportPhone: "+254 20 790 3800",
    anchorHelpDeskUrl: "https://kotanipay.com/help/desk",
    currentStep: "anchor_processing",
    initiatedAt: new Date(now - 8 * 60_000).toISOString(),
    estimatedArrivalMs: now + 6 * 60_000 + 45_000,
    stepsHistory: [
      {
        step: "initiated",
        completedAt: new Date(now - 8 * 60_000).toISOString(),
        note: "USDC deposit confirmed on Stellar ledger #4928104",
        txHash: "7b4c9e1f...d2a8",
      },
      {
        step: "escrowed",
        completedAt: new Date(now - 5 * 60_000).toISOString(),
        note: "Non-custodial timelock contract initialized",
        txHash: "3f9d1a8b...0c4e",
      },
      {
        step: "anchor_processing",
        completedAt: new Date(now - 2 * 60_000).toISOString(),
        note: "Anchor dispatching M-PESA mobile money settlement batch",
      },
    ],
  };
}

export default function RemittanceTrackingPage() {
  const router = useRouter();
  const queryRef = typeof router.query.referenceId === "string" ? router.query.referenceId : null;
  const referenceId = queryRef || "REF-STF-90421";

  const [data, setData] = useState<RemittanceTrackingData>(() => getMockTrackingData(referenceId));
  const [loading, setLoading] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(405);
  const [copied, setCopied] = useState(false);
  const [isSupportDrawerOpen, setIsSupportDrawerOpen] = useState(false);

  // Notification state
  const [notifType, setNotifType] = useState<"sms" | "email">("sms");
  const [notifContact, setNotifContact] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [notifyOnAnchorUpdate, setNotifyOnAnchorUpdate] = useState(true);
  const [notifyOnComplete, setNotifyOnComplete] = useState(true);

  // Support ticket state
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketMessage, setTicketMessage] = useState("");
  const [ticketSubmitted, setTicketSubmitted] = useState(false);

  // Synchronize data if reference changes
  useEffect(() => {
    if (queryRef) {
      setData(getMockTrackingData(queryRef));
    }
  }, [queryRef]);

  // Live countdown timer
  useEffect(() => {
    const updateCountdown = () => {
      const remainingMs = Math.max(0, data.estimatedArrivalMs - Date.now());
      setSecondsRemaining(Math.floor(remainingMs / 1000));
    };

    updateCountdown();
    const interval = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(interval);
  }, [data.estimatedArrivalMs]);

  // Simulated live step progression for demo feel
  const handleRefresh = useCallback(async () => {
    setLoading(true);
    await new Promise((res) => setTimeout(res, 600));
    setData((prev) => {
      if (prev.currentStep === "anchor_processing") {
        return {
          ...prev,
          currentStep: "paid_out",
          completedAt: new Date().toISOString(),
          stepsHistory: [
            ...prev.stepsHistory,
            {
              step: "paid_out",
              completedAt: new Date().toISOString(),
              note: "M-PESA receipt #QK982710 confirmed. Payout delivered.",
            },
          ],
        };
      }
      return prev;
    });
    setLoading(false);
  }, []);

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifContact.trim()) return;
    setSubscribing(true);
    setTimeout(() => {
      setSubscribing(false);
      setSubscribed(true);
    }, 800);
  };

  const handleSendSupportTicket = (e: React.FormEvent) => {
    e.preventDefault();
    setTicketSubmitted(true);
  };

  const currentStepIdx = STEP_ORDER[data.currentStep];
  const isCompleted = data.currentStep === "paid_out";

  const formattedCountdown = useMemo(() => {
    if (isCompleted) return "00:00";
    const mins = Math.floor(secondsRemaining / 60);
    const secs = secondsRemaining % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }, [secondsRemaining, isCompleted]);

  const countdownPercent = useMemo(() => {
    if (isCompleted) return 100;
    const totalDurationSecs = 15 * 60; // 15 mins base
    const elapsed = totalDurationSecs - secondsRemaining;
    return Math.min(100, Math.max(10, (elapsed / totalDurationSecs) * 100));
  }, [secondsRemaining, isCompleted]);

  return (
    <>
      <Head>
        <title>Delivery Tracking #{referenceId} | StellarFlow Remittance</title>
        <meta
          name="description"
          content={`Track real-time fiat remittance delivery progress for transaction ${referenceId}`}
        />
      </Head>

      <main className="min-h-screen bg-[#071016] text-slate-100 antialiased">
        {/* Top Navbar */}
        <header className="sticky top-0 z-30 border-b border-white/10 bg-[#071016]/90 backdrop-blur-md">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
            <Link
              href="/remittance"
              className="flex items-center gap-2 text-xs font-medium text-slate-400 transition hover:text-white"
            >
              <ArrowLeft size={16} />
              <span>Back to Remittance</span>
            </Link>

            <div className="flex items-center gap-3">
              <span className="hidden rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 sm:inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Status Feeds Active
              </span>
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
                title="Copy public tracking URL"
              >
                {copied ? <Check size={14} className="text-emerald-400" /> : <Share2 size={14} />}
                <span>{copied ? "Link Copied!" : "Share Link"}</span>
              </button>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 space-y-8">
          {/* Header & Overview Card */}
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#0e1e28] to-[#0a151d] p-6 sm:p-8 shadow-2xl">
            <div className="absolute right-0 top-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-2.5 py-1 rounded-md">
                    REF: {data.referenceId}
                  </span>
                  <span className="rounded-full bg-white/10 px-3 py-0.5 text-xs text-slate-300">
                    {data.corridor}
                  </span>
                  {isCompleted ? (
                    <span className="rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-3 py-0.5 text-xs font-semibold flex items-center gap-1">
                      <CheckCircle2 size={12} /> Delivered
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 px-3 py-0.5 text-xs font-semibold flex items-center gap-1">
                      <Clock size={12} className="animate-spin" /> In Transit
                    </span>
                  )}
                </div>

                <h1 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  {data.receiveAmount} {data.receiveAsset} Delivery
                </h1>

                <p className="mt-2 text-sm text-slate-400">
                  Sent by <span className="text-slate-200 font-medium">{data.senderName}</span> to{" "}
                  <span className="text-slate-200 font-medium">{data.recipientName}</span> (
                  {data.recipientPhoneOrAccount})
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <button
                  onClick={handleRefresh}
                  disabled={loading}
                  className="flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
                >
                  <RefreshCw size={16} className={loading ? "animate-spin text-cyan-400" : ""} />
                  <span>Refresh Status</span>
                </button>
                <button
                  onClick={() => setIsSupportDrawerOpen(true)}
                  className="flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-[#071016] transition hover:bg-cyan-400 shadow-lg shadow-cyan-500/20"
                >
                  <MessageSquare size={16} />
                  <span>Anchor Support</span>
                </button>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="mt-6 grid grid-cols-2 gap-4 border-t border-white/10 pt-6 sm:grid-cols-4">
              <div>
                <p className="text-xs text-slate-400">Sent Amount</p>
                <p className="mt-1 font-mono text-base font-semibold text-white">
                  {data.sendAmount} {data.sendAsset}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Recipient Receives</p>
                <p className="mt-1 font-mono text-base font-semibold text-emerald-400">
                  {data.receiveAmount} {data.receiveAsset}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Locked Rate</p>
                <p className="mt-1 font-mono text-xs font-medium text-slate-300">
                  {data.exchangeRate}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Off-Ramp Anchor</p>
                <p className="mt-1 text-xs font-medium text-cyan-300 truncate">
                  {data.anchorName}
                </p>
              </div>
            </div>
          </div>

          {/* Main 2-Column Content: Left = Timeline & ETA Gauge, Right = Notification Form & Support */}
          <div className="grid gap-8 lg:grid-cols-12">
            {/* Left Column (8 cols): Progress Timeline & Countdown Gauge */}
            <div className="space-y-8 lg:col-span-7">
              {/* Estimated Arrival Countdown Gauge Card */}
              <section className="rounded-2xl border border-white/10 bg-[#0d1a21] p-6 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-cyan-400">
                    <Clock size={18} />
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200">
                      Estimated Delivery Gauge
                    </h2>
                  </div>
                  <span className="text-xs text-slate-400">
                    {isCompleted ? "Completed" : "Target: < 10 mins"}
                  </span>
                </div>

                <div className="mt-6 flex flex-col sm:flex-row items-center gap-6">
                  {/* Circular Arc / Countdown Gauge */}
                  <div className="relative flex h-32 w-32 shrink-0 items-center justify-center">
                    <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 100 100">
                      {/* Background Track */}
                      <circle
                        cx="50"
                        cy="50"
                        r="42"
                        className="stroke-slate-800"
                        strokeWidth="8"
                        fill="transparent"
                      />
                      {/* Progress Stroke */}
                      <circle
                        cx="50"
                        cy="50"
                        r="42"
                        className={`transition-all duration-1000 ${
                          isCompleted ? "stroke-emerald-400" : "stroke-cyan-400"
                        }`}
                        strokeWidth="8"
                        strokeDasharray={264}
                        strokeDashoffset={264 - (264 * countdownPercent) / 100}
                        strokeLinecap="round"
                        fill="transparent"
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center justify-center text-center">
                      <span className="font-mono text-xl font-bold text-white">
                        {formattedCountdown}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-slate-400">
                        {isCompleted ? "Done" : "ETA Remaining"}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 space-y-2 text-center sm:text-left">
                    <h3 className="font-semibold text-white">
                      {isCompleted
                        ? "Delivery Successfully Finalized"
                        : "Off-Ramp Settlement in Progress"}
                    </h3>
                    <p className="text-xs leading-relaxed text-slate-400">
                      {isCompleted
                        ? `The local currency was credited to ${data.recipientName}. Receipt notification has been dispatched.`
                        : `Anchor is processing local mobile money disbursement. Most transfers arrive in under 5 minutes.`}
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <span className="inline-flex items-center gap-1 rounded bg-white/5 px-2 py-1 text-[11px] text-slate-300">
                        <Shield size={12} className="text-cyan-400" /> Non-Custodial Timelock
                      </span>
                      <span className="inline-flex items-center gap-1 rounded bg-white/5 px-2 py-1 text-[11px] text-slate-300">
                        <Sparkles size={12} className="text-amber-400" /> Instant Settlement
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Delivery Progress Timeline */}
              <section className="rounded-2xl border border-white/10 bg-[#0d1a21] p-6 sm:p-8 shadow-xl">
                <div className="flex items-center justify-between pb-6 border-b border-white/10">
                  <h2 className="text-lg font-bold text-white">Delivery Timeline</h2>
                  <span className="text-xs font-mono text-slate-400">
                    Step {currentStepIdx + 1} of {STEPS_CONFIG.length}
                  </span>
                </div>

                <div className="mt-8 relative space-y-8">
                  {/* Vertical connector line */}
                  <div
                    className="absolute left-6 top-4 bottom-4 w-0.5 bg-slate-800 -translate-x-1/2"
                    aria-hidden="true"
                  />

                  {STEPS_CONFIG.map((step, idx) => {
                    const isPassed = idx < currentStepIdx || isCompleted;
                    const isCurrent = idx === currentStepIdx && !isCompleted;
                    const isUpcoming = idx > currentStepIdx && !isCompleted;
                    const IconComp = step.icon;

                    const stepRecord = data.stepsHistory.find((h) => h.step === step.id);

                    return (
                      <div key={step.id} className="relative flex items-start gap-4">
                        {/* Step Marker Node */}
                        <div
                          className={`relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 transition-all ${
                            isPassed
                              ? "border-emerald-400 bg-emerald-950 text-emerald-300 shadow-lg shadow-emerald-500/20"
                              : isCurrent
                              ? "border-cyan-400 bg-cyan-950 text-cyan-200 ring-4 ring-cyan-500/20 animate-pulse"
                              : "border-slate-700 bg-slate-900 text-slate-600"
                          }`}
                        >
                          <IconComp size={20} />
                        </div>

                        {/* Step Details Card */}
                        <div className="flex-1 rounded-xl border border-white/5 bg-white/[0.02] p-4 transition-colors hover:border-white/10">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3
                              className={`text-sm font-semibold ${
                                isPassed
                                  ? "text-emerald-300"
                                  : isCurrent
                                  ? "text-cyan-300"
                                  : "text-slate-500"
                              }`}
                            >
                              {step.label}
                            </h3>
                            {stepRecord?.completedAt && (
                              <span className="font-mono text-[11px] text-slate-400">
                                {new Date(stepRecord.completedAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  second: "2-digit",
                                })}
                              </span>
                            )}
                          </div>

                          <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                            {stepRecord?.note || step.description}
                          </p>

                          {stepRecord?.txHash && (
                            <div className="mt-3 flex items-center gap-2">
                              <a
                                href={`https://stellar.expert/explorer/public/tx/${stepRecord.txHash}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 font-mono text-[11px] text-cyan-400 hover:underline"
                              >
                                <span>Stellar Tx: {stepRecord.txHash}</span>
                                <ExternalLink size={12} />
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>

            {/* Right Column (5 cols): SMS/Email Notification Toggle & Anchor Quick Info */}
            <div className="space-y-6 lg:col-span-5">
              {/* Notification Subscription Form */}
              <section className="rounded-2xl border border-white/10 bg-[#0d1a21] p-6 shadow-xl">
                <div className="flex items-center gap-2 text-[#f5c842]">
                  <Smartphone size={18} />
                  <h2 className="font-semibold text-slate-100">Live Delivery Alerts</h2>
                </div>
                <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                  Receive instant SMS or email notifications at every milestone of this transfer.
                </p>

                {subscribed ? (
                  <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center space-y-2">
                    <CheckCircle2 size={24} className="mx-auto text-emerald-400" />
                    <p className="text-sm font-semibold text-emerald-200">Alerts Activated!</p>
                    <p className="text-xs text-slate-300">
                      We will notify <span className="font-medium text-white">{notifContact}</span> as
                      soon as the status updates.
                    </p>
                    <button
                      onClick={() => setSubscribed(false)}
                      className="mt-2 text-xs text-cyan-400 hover:underline"
                    >
                      Change notification preferences
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubscribe} className="mt-5 space-y-4">
                    {/* Toggle Selector */}
                    <div className="flex rounded-lg border border-white/10 bg-[#071016] p-1">
                      <button
                        type="button"
                        onClick={() => setNotifType("sms")}
                        className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition ${
                          notifType === "sms"
                            ? "bg-cyan-500 text-[#071016] font-semibold"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        <Phone size={13} /> SMS Alert
                      </button>
                      <button
                        type="button"
                        onClick={() => setNotifType("email")}
                        className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition ${
                          notifType === "email"
                            ? "bg-cyan-500 text-[#071016] font-semibold"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        <Mail size={13} /> Email Alert
                      </button>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        {notifType === "sms" ? "Mobile Phone Number" : "Email Address"}
                      </label>
                      <input
                        type={notifType === "sms" ? "tel" : "email"}
                        required
                        value={notifContact}
                        onChange={(e) => setNotifContact(e.target.value)}
                        placeholder={
                          notifType === "sms" ? "+254 700 000 000" : "recipient@domain.com"
                        }
                        className="w-full rounded-lg border border-white/10 bg-[#071016] px-3 py-2.5 text-xs text-white placeholder-slate-600 outline-none focus:border-cyan-400 transition"
                      />
                    </div>

                    <div className="space-y-2 text-xs text-slate-300">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notifyOnComplete}
                          onChange={(e) => setNotifyOnComplete(e.target.checked)}
                          className="rounded border-white/20 bg-slate-900 text-cyan-500 focus:ring-0"
                        />
                        <span>Send notification upon final payout</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notifyOnAnchorUpdate}
                          onChange={(e) => setNotifyOnAnchorUpdate(e.target.checked)}
                          className="rounded border-white/20 bg-slate-900 text-cyan-500 focus:ring-0"
                        />
                        <span>Send intermediate anchor dispatch status</span>
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={subscribing}
                      className="w-full rounded-xl bg-cyan-500 px-4 py-2.5 text-xs font-bold text-[#071016] transition hover:bg-cyan-400 disabled:opacity-50 shadow-md"
                    >
                      {subscribing ? "Subscribing..." : "Enable Delivery Alerts"}
                    </button>
                  </form>
                )}
              </section>

              {/* Anchor Support Information & Trust Summary */}
              <section className="rounded-2xl border border-white/10 bg-[#0d1a21] p-6 shadow-xl space-y-4">
                <div className="flex items-center gap-2 text-cyan-400">
                  <ShieldCheck size={18} />
                  <h2 className="font-semibold text-slate-100">Anchor Partner Information</h2>
                </div>

                <div className="space-y-3 text-xs text-slate-300">
                  <div className="flex justify-between py-1.5 border-b border-white/5">
                    <span className="text-slate-500">Regulated Entity</span>
                    <span className="font-medium text-slate-200">{data.anchorName}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-white/5">
                    <span className="text-slate-500">Corridor Channel</span>
                    <span className="font-medium text-slate-200">M-PESA Bulk Disbursement</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-white/5">
                    <span className="text-slate-500">Escrow Security</span>
                    <span className="font-medium text-emerald-400">Stellar Soroban Timelock</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-500">Direct Support</span>
                    <a
                      href={`mailto:${data.anchorSupportEmail}`}
                      className="text-cyan-400 hover:underline"
                    >
                      {data.anchorSupportEmail}
                    </a>
                  </div>
                </div>

                <button
                  onClick={() => setIsSupportDrawerOpen(true)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-white/10 hover:text-white transition flex items-center justify-center gap-2"
                >
                  <HelpCircle size={14} /> Contact Anchor Helpdesk
                </button>
              </section>
            </div>
          </div>
        </div>

        {/* Customer Support Contact Drawer */}
        {isSupportDrawerOpen && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-opacity">
            <div
              className="relative flex h-full w-full max-w-md flex-col bg-[#0d1a21] border-l border-white/10 p-6 text-slate-100 shadow-2xl overflow-y-auto"
              role="dialog"
              aria-modal="true"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-2 text-cyan-400">
                  <MessageSquare size={20} />
                  <h3 className="font-bold text-white">Anchor Customer Support</h3>
                </div>
                <button
                  onClick={() => setIsSupportDrawerOpen(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="mt-6 space-y-6">
                <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/40 p-4 text-xs space-y-2">
                  <div className="flex items-center gap-1.5 text-cyan-300 font-semibold">
                    <AlertCircle size={14} /> Priority Support for Ref #{data.referenceId}
                  </div>
                  <p className="text-slate-300">
                    Inquiries regarding this transfer are directly routed to the{" "}
                    <span className="text-white font-medium">{data.anchorName}</span> compliance &
                    clearing desk.
                  </p>
                </div>

                {/* Direct Contact Options */}
                <div className="grid grid-cols-2 gap-3">
                  <a
                    href={`tel:${data.anchorSupportPhone}`}
                    className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 p-3 text-center text-xs text-slate-200 hover:bg-white/10"
                  >
                    <Phone size={18} className="text-cyan-400" />
                    <span className="font-medium">Call Desk</span>
                    <span className="text-[10px] text-slate-400">{data.anchorSupportPhone}</span>
                  </a>

                  <a
                    href={`mailto:${data.anchorSupportEmail}?subject=Support%20Request%20for%20Ref%20${data.referenceId}`}
                    className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 p-3 text-center text-xs text-slate-200 hover:bg-white/10"
                  >
                    <Mail size={18} className="text-emerald-400" />
                    <span className="font-medium">Email Desk</span>
                    <span className="text-[10px] text-slate-400">{data.anchorSupportEmail}</span>
                  </a>
                </div>

                {/* Submit Ticket Form */}
                <div className="border-t border-white/10 pt-4">
                  <h4 className="text-sm font-semibold text-white mb-3">
                    Submit In-App Support Inquiry
                  </h4>

                  {ticketSubmitted ? (
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center space-y-2">
                      <CheckCircle2 size={24} className="mx-auto text-emerald-400" />
                      <p className="text-sm font-bold text-emerald-200">Ticket Submitted!</p>
                      <p className="text-xs text-slate-300">
                        Ticket ID: <span className="font-mono text-white">#TKT-{Math.floor(100000 + Math.random() * 900000)}</span>
                      </p>
                      <p className="text-[11px] text-slate-400">
                        An anchor agent will contact you via your registered email shortly.
                      </p>
                      <button
                        onClick={() => setTicketSubmitted(false)}
                        className="mt-2 text-xs text-cyan-400 hover:underline"
                      >
                        Submit another message
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleSendSupportTicket} className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                          Inquiry Subject
                        </label>
                        <input
                          type="text"
                          required
                          value={ticketSubject}
                          onChange={(e) => setTicketSubject(e.target.value)}
                          placeholder="e.g., Payout status inquiry, recipient phone confirmation"
                          className="w-full rounded-lg border border-white/10 bg-[#071016] px-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-cyan-400"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                          Detailed Message
                        </label>
                        <textarea
                          required
                          rows={4}
                          value={ticketMessage}
                          onChange={(e) => setTicketMessage(e.target.value)}
                          placeholder="Describe your inquiry or issue regarding this remittance..."
                          className="w-full rounded-lg border border-white/10 bg-[#071016] p-3 text-xs text-white placeholder-slate-600 outline-none focus:border-cyan-400"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full rounded-xl bg-cyan-500 py-2.5 text-xs font-bold text-[#071016] hover:bg-cyan-400 transition"
                      >
                        Submit Inquiry to Anchor Desk
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
