import { useState, useEffect } from 'react';
import { getHealthStatusBatch, type HealthStatusBatch } from '@/lib/api/healthService';
import { useOnlineStatus } from '@/app/hooks/useOnlineStatus';

interface UseHealthStatusReturn {
  health: HealthStatusBatch | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useHealthStatus(): UseHealthStatusReturn {
  const [health, setHealth] = useState<HealthStatusBatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const isOnline = useOnlineStatus();

  const fetchHealth = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getHealthStatusBatch();
      setHealth(data);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      console.error('Health status fetch failed:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOnline) return;

    fetchHealth();

    // Poll every 30 seconds
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [isOnline]);

  return { health, loading, error, refetch: fetchHealth };
}