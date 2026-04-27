/**
 * Central API Service
 * Provides a unified fetch wrapper with error handling for 401 and 500 errors
 * Returns standardized response object: { data, error }
 */

interface ApiResponse<T> {
  data?: T;
  error?: {
    status: number;
    message: string;
    code?: string;
  };
}

interface ApiRequestOptions extends RequestInit {
  headers?: Record<string, string>;
  timeout?: number;
}

/**
 * Central fetch wrapper with error handling
 * @param url - API endpoint URL
 * @param options - Fetch options with optional timeout
 * @returns Promise with standardized response object { data, error }
 */
export async function apiCall<T = unknown>(
  url: string,
  options: ApiRequestOptions = {}
): Promise<ApiResponse<T>> {
  const { timeout = 30000, ...fetchOptions } = options;

  try {
    // Set default headers
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    // Create abort controller for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Execute fetch request
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Parse response body
    const contentType = response.headers.get("content-type");
    let responseData: T;

    if (contentType?.includes("application/json")) {
      responseData = await response.json();
    } else {
      responseData = (await response.text()) as T;
    }

    // Handle 401 Unauthorized
    if (response.status === 401) {
      return {
        error: {
          status: 401,
          message: "Unauthorized. Please login again.",
          code: "UNAUTHORIZED",
        },
      };
    }

    // Handle 500 Internal Server Error
    if (response.status === 500) {
      return {
        error: {
          status: 500,
          message: "Internal server error. Please try again later.",
          code: "SERVER_ERROR",
        },
      };
    }

    // Handle other HTTP error statuses
    if (!response.ok) {
      return {
        error: {
          status: response.status,
          message: `HTTP Error: ${response.statusText}`,
          code: `HTTP_${response.status}`,
        },
      };
    }

    // Return successful response
    return {
      data: responseData,
    };
  } catch (error) {
    // Handle network errors, timeouts, and other exceptions
    if (error instanceof TypeError) {
      if (error.message.includes("fetch")) {
        return {
          error: {
            status: 0,
            message: "Network error. Please check your connection.",
            code: "NETWORK_ERROR",
          },
        };
      }
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      return {
        error: {
          status: 0,
          message: `Request timeout after ${30000}ms.`,
          code: "TIMEOUT_ERROR",
        },
      };
    }

    // Generic catch-all for unexpected errors
    return {
      error: {
        status: 0,
        message:
          error instanceof Error ? error.message : "An unexpected error occurred.",
        code: "UNKNOWN_ERROR",
      },
    };
  }
}

/**
 * GET request helper
 */
export async function apiGet<T = unknown>(
  url: string,
  options?: ApiRequestOptions
): Promise<ApiResponse<T>> {
  return apiCall<T>(url, { ...options, method: "GET" });
}

/**
 * POST request helper
 */
export async function apiPost<T = unknown>(
  url: string,
  body?: unknown,
  options?: ApiRequestOptions
): Promise<ApiResponse<T>> {
  return apiCall<T>(url, {
    ...options,
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * PUT request helper
 */
export async function apiPut<T = unknown>(
  url: string,
  body?: unknown,
  options?: ApiRequestOptions
): Promise<ApiResponse<T>> {
  return apiCall<T>(url, {
    ...options,
    method: "PUT",
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * DELETE request helper
 */
export async function apiDelete<T = unknown>(
  url: string,
  options?: ApiRequestOptions
): Promise<ApiResponse<T>> {
  return apiCall<T>(url, { ...options, method: "DELETE" });
}

/**
 * PATCH request helper
 */
export async function apiPatch<T = unknown>(
  url: string,
  body?: unknown,
  options?: ApiRequestOptions
): Promise<ApiResponse<T>> {
  return apiCall<T>(url, {
    ...options,
    method: "PATCH",
    body: body ? JSON.stringify(body) : undefined,
  });
}
