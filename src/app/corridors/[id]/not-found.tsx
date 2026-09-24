import Link from "next/link";

export default function CorridorNotFound() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-bold">Corridor Not Found</h1>
      <p className="text-sm text-neutral-400 max-w-md">
        We couldn&apos;t find a corridor matching that identifier. It may have
        been retired or the link is out of date.
      </p>
      <Link
        href="/dashboard/corridors"
        className="text-sm font-mono text-lime-400 hover:underline"
      >
        &larr; Back to Corridor Monitor
      </Link>
    </div>
  );
}
