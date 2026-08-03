import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * Base Skeleton component with pulse animation
 */
export function Skeleton({ className = '', ...props }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-gray-200 dark:bg-gray-700/60 rounded-md ${className}`}
      {...props}
    />
  );
}

export interface LoadingContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  isLoading: boolean;
  children: React.ReactNode;
  fallback: React.ReactNode;
}

/**
 * Accessible container that provides smooth transition between loading skeleton and content
 */
export function LoadingContainer({
  isLoading,
  children,
  fallback,
  className = '',
  ...props
}: LoadingContainerProps) {
  return (
    <div 
      className={`relative ${className}`} 
      aria-busy={isLoading} 
      aria-live="polite" 
      {...props}
    >
      {/* Fallback state (Skeleton) */}
      <div 
        className={`transition-opacity duration-300 ease-in-out absolute inset-0 z-10 ${
          isLoading ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {fallback}
      </div>

      {/* Actual Content */}
      <div 
        className={`transition-opacity duration-500 ease-in-out ${
          !isLoading ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none invisible'
        }`}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Layout-matching skeleton for standard dashboard cards
 */
export function CardSkeleton() {
  return (
    <div className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-xl p-6 w-full" aria-busy="true" aria-live="polite">
      <div className="flex items-center space-x-4 mb-6">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-10 w-1/3 rounded-lg" />
      </div>
    </div>
  );
}

/**
 * Layout-matching skeleton for data tables
 */
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="w-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-lg overflow-hidden" aria-busy="true" aria-live="polite">
      {/* Table Header */}
      <div className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex gap-4">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/4" />
      </div>
      
      {/* Table Body */}
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="px-6 py-5 flex gap-4 items-center">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-1/4" />
            <div className="w-1/4 flex justify-end">
              <Skeleton className="h-8 w-20 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Layout-matching skeleton for analytic charts
 */
export function ChartSkeleton() {
  return (
    <div className="w-full h-80 border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-xl p-6 flex flex-col" aria-busy="true" aria-live="polite">
      {/* Chart Header */}
      <div className="flex justify-between items-start mb-8">
        <div className="space-y-3 w-1/3">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <Skeleton className="h-8 w-28 rounded-md" />
      </div>
      
      {/* Chart Body (Bars) */}
      <div className="flex-1 flex items-end justify-between space-x-2 w-full pt-4">
        {Array.from({ length: 12 }).map((_, i) => {
          // Static but varied heights for the shimmer bars to look like a chart
          const heights = [40, 65, 30, 80, 50, 95, 25, 70, 60, 85, 45, 75];
          return (
            <Skeleton 
              key={i} 
              className="w-full rounded-t-sm opacity-60 dark:opacity-40" 
              style={{ height: \`\${heights[i]}%\` }} 
            />
          );
        })}
      </div>
    </div>
  );
}
