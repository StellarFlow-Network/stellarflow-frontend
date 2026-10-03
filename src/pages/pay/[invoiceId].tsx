"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import QRCode from "qrcode";
import { useWallet } from "@/hooks/useWallet";

type Invoice = { id: string; merchantName: string; amountDue: string; asset: string; expiresAt: string; status: "open" | "paid" | "expired" };

export default function InvoicePaymentPage() {
  const router = useRouter();
  const invoiceId = typeof router.query.invoiceId === "string" ? router.query.invoiceId : null;
  const { publicKey, status, connect } = useWallet();
  const connected = status === "connected";
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [qr, setQr] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);

  const refresh = useCallback(async () => {
    if (!invoiceId) return;
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ""}/invoices/${encodeURIComponent(invoiceId)}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Invoice could not be found.");
    setInvoice(await response.json() as Invoice);
  }, [invoiceId]);

  useEffect(() => { refresh().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to load invoice")); }, [refresh]);
  useEffect(() => { if (!invoice) return; const update = () => setSecondsLeft(Math.max(0, Math.floor((Date.parse(invoice.expiresAt) - Date.now()) / 1000))); update(); const timer = window.setInterval(update, 1000); return () => window.clearInterval(timer); }, [invoice]);
  useEffect(() => { if (!invoice) return; QRCode.toDataURL(`${window.location.origin}/pay/${invoice.id}`, { width: 220, margin: 1 }).then(setQr).catch(() => setQr("")); }, [invoice]);
  useEffect(() => {
    if (!invoiceId || typeof window === "undefined") return;
    const base = process.env.NEXT_PUBLIC_API_URL ?? window.location.origin;
    const wsBase = base.replace(/^http/, "ws").replace(/\/$/, "");
    let socket: WebSocket;
    try { socket = new WebSocket(`${wsBase}/ws/invoices`); } catch { return; }
    socket.onopen = () => socket.send(JSON.stringify({ type: "subscribe", invoiceId }));
    socket.onmessage = (event) => { try { const message = JSON.parse(event.data) as { invoiceId?: string; status?: string }; if (message.invoiceId === invoiceId && message.status === "paid") { setPaid(true); setInvoice((current) => current ? { ...current, status: "paid" } : current); } } catch { /* Ignore malformed server frames. */ } };
    return () => socket.close();
  }, [invoiceId]);

  const expired = secondsLeft <= 0 || invoice?.status === "expired";
  const locked = expired || invoice?.status === "paid" || paid;
  const countdown = useMemo(() => `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`, [secondsLeft]);

  async function pay() {
    if (!invoice || locked || busy) return;
    setBusy(true); setError(null);
    try {
      if (!connected) { await connect(); return; }
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ""}/invoices/${encodeURIComponent(invoice.id)}/payment-intent`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ publicKey }) });
      if (!response.ok) throw new Error("Could not prepare invoice payment.");
      const intent = await response.json() as { xdr?: string };
      if (!intent.xdr) throw new Error("Payment service returned no transaction to sign.");
      const { signTransaction } = await import("@stellar/freighter-api");
      const signed = await signTransaction(intent.xdr, { networkPassphrase: "Public Global Stellar Network ; September 2015" });
      if (signed.error) throw new Error(String(signed.error));
      const submit = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ""}/invoices/${encodeURIComponent(invoice.id)}/payments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signedXdr: signed.signedTxXdr, publicKey }) });
      if (!submit.ok) throw new Error("Payment submission failed.");
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Payment failed"); }
    finally { setBusy(false); }
  }

  if (!invoice && !error) return <main className="mx-auto max-w-xl p-8 text-white">Loading invoice…</main>;
  return <main className="mx-auto max-w-xl space-y-6 p-6 text-white"><header><p className="text-sm uppercase tracking-wider text-cyan-400">Secure invoice payment</p><h1 className="mt-2 text-3xl font-bold">{invoice?.merchantName ?? "Invoice"}</h1></header>{error && <p role="alert" className="rounded-lg bg-red-950 p-3 text-red-300">{error}</p>}{invoice && <><section className="rounded-2xl border border-white/10 bg-white/5 p-6"><p className="text-sm text-slate-400">Amount due</p><p className="text-3xl font-semibold">{invoice.amountDue} {invoice.asset}</p><p className="mt-4 text-sm text-slate-400">{locked ? (paid || invoice.status === "paid" ? "Payment confirmed" : "Invoice expired") : `Expires in ${countdown}`}</p></section>{qr && <div className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 p-5"><img src={qr} alt="QR code for this invoice" width="220" height="220" /><p className="text-sm text-slate-400">Scan to open this invoice on a mobile wallet</p></div>}<button type="button" disabled={locked || busy} onClick={pay} className="w-full rounded-xl bg-cyan-600 px-5 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-50">{paid || invoice.status === "paid" ? "Payment confirmed" : expired ? "Invoice expired" : busy ? "Preparing payment…" : connected ? "Pay with connected wallet" : "Connect wallet and pay"}</button>{(paid || invoice.status === "paid") && <div className="mx-auto flex h-16 w-16 animate-in items-center justify-center rounded-full bg-emerald-500 text-4xl text-white" aria-label="Payment successful">✓</div>}</>}</main>;
}
