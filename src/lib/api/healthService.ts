interface HealthBatchResponse {
  global: {
    status: 'ACTIVE' | 'INACTIVE' | 'WARNING';
  };
  oracle: {
    status: 'Online' | 'Offline' | 'Lagging';
  };
}

export async function fetchBatchedHealth(): Promise<HealthBatchResponse> {
  try {
    const apiUrl = '/api/health/batch';

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching batched health:', error);
    return {
      global: { status: 'WARNING' },
      oracle: { status: 'Offline' },
    };
  }
}