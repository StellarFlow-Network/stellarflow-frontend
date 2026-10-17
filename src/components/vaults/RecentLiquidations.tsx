export interface LiquidationEvent {
  id: string;
  vaultId: string;
  transactionHash: string;
  network: "public" | "testnet";
  occurredAt: string;
  debtRepaidUsd: number;
}

export default function RecentLiquidations({ events }: { events: readonly LiquidationEvent[] }) {
  const recent = [...events].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
  return (
    <section aria-label="Recent liquidations" className="mt-8">
      <h3 className="mb-4 text-lg font-semibold">Recent liquidations</h3>
      {recent.length === 0 ? <p className="text-slate-400">No recent liquidations.</p> : (
        <ul className="divide-y divide-slate-800 rounded-xl border border-slate-700">
          {recent.map((event) => (
            <li key={event.id} className="flex flex-wrap items-center gap-3 p-4 text-sm">
              <span className="rounded-full bg-red-950 px-2 py-1 text-red-200">Liquidated</span>
              <span className="font-mono">{event.vaultId}</span>
              <span>${event.debtRepaidUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} repaid</span>
              <time dateTime={event.occurredAt} className="text-slate-400">{new Date(event.occurredAt).toISOString().replace("T", " ").slice(0, 16)} UTC</time>
              {/^[a-fA-F0-9]{64}$/.test(event.transactionHash) && (
                <a href={`https://stellar.expert/explorer/${event.network}/tx/${event.transactionHash}`} target="_blank" rel="noopener noreferrer"
                  className="text-emerald-300 underline underline-offset-4" aria-label={`View transaction for vault ${event.vaultId} on ${event.network}`}>
                  View transaction ↗
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
