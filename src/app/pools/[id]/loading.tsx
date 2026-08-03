export default function PoolDetailLoading() {
  return (
    <div className="min-h-screen bg-neutral-950 p-6">
      <div className="h-4 w-40 rounded bg-neutral-900 animate-pulse mb-4" />
      <div className="h-20 rounded-xl bg-neutral-900/80 animate-pulse mb-8" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-24 rounded-xl bg-neutral-900/80 animate-pulse"
          />
        ))}
      </div>
      <div className="h-40 rounded-xl bg-neutral-900/80 animate-pulse" />
    </div>
  );
}
