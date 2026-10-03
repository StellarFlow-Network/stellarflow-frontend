export function VotingGridSkeleton() {
  return (
    <div className="w-full animate-pulse space-y-4" aria-label="Loading voting history">
      {/* Header skeleton */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-4 dark:border-gray-700">
        <div className="h-6 w-48 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="flex gap-2">
          <div className="h-9 w-24 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-9 w-24 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>

      {/* Table header skeleton */}
      <div className="grid grid-cols-6 gap-4 border-b border-gray-200 py-3 dark:border-gray-700">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-4 rounded bg-gray-200 dark:bg-gray-700" />
        ))}
      </div>

      {/* Row skeletons */}
      {Array.from({ length: 8 }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="grid grid-cols-6 gap-4 border-b border-gray-100 py-4 dark:border-gray-800"
        >
          <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-4 w-20 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-4 w-16 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-6 w-20 rounded-full bg-gray-200 dark:bg-gray-700" />
          <div className="h-8 w-24 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      ))}

      {/* Pagination skeleton */}
      <div className="flex items-center justify-between pt-4">
        <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 w-8 rounded bg-gray-200 dark:bg-gray-700" />
          ))}
        </div>
      </div>
    </div>
  );
}