type RequestKey = string;

class RequestController {
  private inflightRequests = new Map<RequestKey, Promise<unknown>>();

  dedupe<T>(key: RequestKey, requestFn: () => Promise<T>): Promise<T> {
    const existingRequest = this.inflightRequests.get(key);

    if (existingRequest) {
      return existingRequest as Promise<T>;
    }

    const request = requestFn().finally(() => {
      this.inflightRequests.delete(key);
    });

    this.inflightRequests.set(key, request);
    return request;
  }

  clear(key?: RequestKey) {
    if (key) {
      this.inflightRequests.delete(key);
      return;
    }

    this.inflightRequests.clear();
  }
}

export const requestController = new RequestController();
