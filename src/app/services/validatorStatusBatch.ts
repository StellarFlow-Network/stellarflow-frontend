export interface ValidatorStatusMetadata {
  address: string;
  status: 'Healthy' | 'Delayed' | 'Offline';
  updatedAt: string;
}

type PendingRequest = {
  resolve: (status: ValidatorStatusMetadata) => void;
  reject: (reason?: unknown) => void;
};

const pendingRequests = new Map<string, PendingRequest[]>();

let flushScheduled = false;

async function fetchValidatorStatusBatch(addresses: string[]): Promise<ValidatorStatusMetadata[]> {
  const response = await fetch('/api/validator-status', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ addresses }),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch validator status batch');
  }

  const json = await response.json();
  return json.data as ValidatorStatusMetadata[];
}

async function flushPendingRequests() {
  flushScheduled = false;
  const addresses = Array.from(pendingRequests.keys());
  if (addresses.length === 0) return;

  const requests = new Map(pendingRequests);
  pendingRequests.clear();

  try {
    const results = await fetchValidatorStatusBatch(addresses);
    const resultMap = new Map(results.map((entry) => [entry.address, entry]));

    for (const address of addresses) {
      const handlers = requests.get(address) ?? [];
      const status =
        resultMap.get(address) ?? {
          address,
          status: 'Delayed',
          updatedAt: new Date().toISOString(),
        };

      handlers.forEach((handler) => handler.resolve(status));
    }
  } catch (error) {
    for (const handlers of requests.values()) {
      handlers.forEach((handler) => handler.reject(error));
    }
  }
}

function scheduleFlush() {
  if (flushScheduled) return;
  flushScheduled = true;
  Promise.resolve().then(flushPendingRequests);
}

export function requestValidatorStatus(address: string): Promise<ValidatorStatusMetadata> {
  return new Promise((resolve, reject) => {
    const existing = pendingRequests.get(address);
    if (existing) {
      existing.push({ resolve, reject });
    } else {
      pendingRequests.set(address, [{ resolve, reject }]);
    }

    scheduleFlush();
  });
}
