import Link from "next/link";

export default function PoolNotFound() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-bold">Pool Not Found</h1>
      <p className="text-sm text-neutral-400 max-w-md">
        We couldn&apos;t find a liquidity pool matching that identifier. It may
        have been retired or the link is out of date.
      </p>
      <Link href="/" className="text-sm font-mono text-lime-400 hover:underline">
        &larr; Back to Dashboard
      </Link>
    </div>
  );
}
