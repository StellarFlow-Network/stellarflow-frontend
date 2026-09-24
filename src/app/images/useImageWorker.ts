import { useCallback, useEffect, useRef } from "react";
import type {
  ImageWorkerOutboundMessage,
} from "./image-worker-types";

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
}

const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Offloads image operations (decoding, resizing, thumbnail generation)
 * to a dedicated Web Worker so they run outside the main thread's critical
 * interaction lane.
 *
 * When a worker is unavailable (SSR, unsupported runtime, or instantiation
 * failure) every method transparently falls back to synchronous implementation,
 * so callers can always await a result without branching on environment.
 */
export function useImageWorker() {
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<Map<string, PendingRequest>>(new Map());

  useEffect(() => {
    if (typeof Worker === "undefined") return;

    let worker: Worker;
    try {
      worker = new Worker(new URL("./image-worker.ts", import.meta.url));
    } catch {
      return;
    }
    workerRef.current = worker;

    const handleMessage = (
      event: MessageEvent<ImageWorkerOutboundMessage>,
    ) => {
      const { type, payload } = event.data;
      const request = pendingRef.current.get(payload.id);
      if (!request) return;

      clearTimeout(request.timeoutId);
      pendingRef.current.delete(payload.id);

      if (type === "IMAGE_ERROR") {
        request.reject(new Error(payload.error));
        return;
      }
      if (type === "DECODE_RESULT" || type === "RESIZE_RESULT" || type === "THUMBNAIL_RESULT") {
        request.resolve(payload.result);
        return;
      }
    };

    worker.addEventListener("message", handleMessage);

    return () => {
      worker.removeEventListener("message", handleMessage);
      pendingRef.current.forEach(({ timeoutId, reject }: PendingRequest) => {
        clearTimeout(timeoutId);
        reject(new Error("Image worker terminated"));
      });
      pendingRef.current.clear();
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const request = useCallback(
    <T>(
      id: string,
      message: object,
      fallback: () => Promise<T>,
      timeoutMs: number = DEFAULT_TIMEOUT_MS,
    ): Promise<T> => {
      const worker = workerRef.current;
      if (!worker) {
        return fallback();
      }

      return new Promise<T>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          if (pendingRef.current.delete(id)) {
            fallback().then(resolve).catch(reject);
          }
        }, timeoutMs);

        pendingRef.current.set(id, {
          resolve: resolve as (value: unknown) => void,
          reject,
          timeoutId,
        });

        try {
          worker.postMessage(message);
        } catch (err) {
          clearTimeout(timeoutId);
          pendingRef.current.delete(id);
          fallback().then(resolve).catch(reject);
        }
      });
    },
    [],
  );

  const decodeImage = useCallback(
    async (id: string, imageData: ArrayBuffer): Promise<ImageBitmap> => {
      return request<ImageBitmap>(
        id,
        { type: "DECODE_IMAGE", payload: { id, imageData } },
        async () => {
          const blob = new Blob([imageData]);
          return createImageBitmap(blob);
        },
      );
    },
    [request],
  );

  const resizeImage = useCallback(
    async (
      id: string,
      imageData: ArrayBuffer,
      options: { width: number; height: number; quality?: number; format?: "jpeg" | "png" | "webp" },
    ): Promise<ArrayBuffer> => {
      return request<ArrayBuffer>(
        id,
        { type: "RESIZE_IMAGE", payload: { id, imageData, options } },
        async () => {
          const bitmap = await createImageBitmap(new Blob([imageData]));
          const canvas = new OffscreenCanvas(options.width, options.height);
          const canvasCtx = canvas.getContext("2d");
          
          if (!canvasCtx) {
            throw new Error("Failed to get canvas context");
          }
          
          canvasCtx.drawImage(bitmap, 0, 0, options.width, options.height);
          bitmap.close();
          
          const quality = options.quality ?? 0.92;
          const format = options.format ?? "webp";
          
          const blob = await canvas.convertToBlob({
            type: `image/${format}`,
            quality,
          });
          
          return blob.arrayBuffer();
        },
      );
    },
    [request],
  );

  const generateThumbnail = useCallback(
    async (
      id: string,
      imageData: ArrayBuffer,
      options?: { maxSize?: number; quality?: number },
    ): Promise<ArrayBuffer> => {
      return request<ArrayBuffer>(
        id,
        { type: "GENERATE_THUMBNAIL", payload: { id, imageData, options } },
        async () => {
          const bitmap = await createImageBitmap(new Blob([imageData]));
          const maxSize = options?.maxSize ?? 200;
          
          const scale = Math.min(maxSize / bitmap.width, maxSize / bitmap.height, 1);
          const width = Math.round(bitmap.width * scale);
          const height = Math.round(bitmap.height * scale);
          
          const canvas = new OffscreenCanvas(width, height);
          const canvasCtx = canvas.getContext("2d");
          
          if (!canvasCtx) {
            throw new Error("Failed to get canvas context");
          }
          
          canvasCtx.drawImage(bitmap, 0, 0, width, height);
          bitmap.close();
          
          const quality = options?.quality ?? 0.85;
          const blob = await canvas.convertToBlob({
            type: "image/webp",
            quality,
          });
          
          return blob.arrayBuffer();
        },
      );
    },
    [request],
  );

  return { decodeImage, resizeImage, generateThumbnail };
}
