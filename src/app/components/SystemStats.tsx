'use client';

import React from 'react';
import { useHealthStatus } from '@/hooks/useHealthStatus';

interface HealthIndicatorProps {
  label: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp?: number;
}

function HealthIndicator({ label, status, timestamp }: HealthIndicatorProps) {
  const statusColors: Record<string, string> = {
    healthy: 'bg-green-500',
    degraded: 'bg-yellow-500',
    unhealthy: 'bg-red-500',
  };

  const color = statusColors[status] || 'bg-gray-500';

  return (
    <div  className="flex flex-col items-center md:items-start gap-1">
      <div className="flex items-center gap-2">
        <h3 className="text-[#39FF14] font-bold text-sm md:text-base tracking-widest">
          {label}
        </h3>
        {showDot && (
          <div className="relative flex items-center justify-center">
            <div className="absolute w-4 h-4 rounded-full bg-[#39FF14] animate-ping opacity-30" />
            <div className="w-3 h-3 rounded-full bg-[#39FF14] shadow-[0_0_8px_3px_rgba(57,255,20,0.8)]" />
          </div>
        )}
      </div>
    <p
  className="
    text-[#39FF14]
    text-7xl
    md:text-9xl
    font-black
    leading-none
    font-mono
    tabular-nums
    min-w-[4ch]
    text-center
  "
>
  {value}
</p>
    </div>
  );
}

/**
 * System Stats Component
 * Displays health status using batched health check endpoint
 * Consolidates GlobalHealthIndicator and OracleHealthIndicator into single request
 */
export function SystemStats() {
  const { health, loading, error, refetch } = useHealthStatus();

  if (loading) {
    return (
      <div className="space-y-2 p-4">
        <div className="h-12 bg-gray-200 rounded animate-pulse" />
        <div className="h-12 bg-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded">
        <p className="text-red-700 text-sm font-medium">Health check failed</p>
        <p className="text-red-600 text-xs mt-1">{error.message}</p>
        <button
          onClick={refetch}
          className="mt-2 px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!health) {
    return <div className="text-gray-500 text-sm">No health data available</div>;
  }

  return (
    <div className="space-y-3 p-4 bg-white border border-gray-200 rounded-lg">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold text-sm">System Status</h3>
        <button
          onClick={refetch}
          className="text-xs px-2 py-1 text-blue-600 hover:bg-blue-50 rounded"
        >
          Refresh
        </button>
      </div>

      <HealthIndicator
        label="Global Health"
        status={health.global.status}
        timestamp={health.global.timestamp}
      />

      <HealthIndicator
        label="Oracle Health"
        status={health.oracle.status}
        timestamp={health.oracle.timestamp}
      />

      <div className="text-xs text-gray-400 pt-2 border-t">
        Last updated: {new Date(health.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
}