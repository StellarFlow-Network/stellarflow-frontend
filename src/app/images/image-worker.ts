/// <reference lib="webworker" />
//
// Image Processing Worker
//
// Offloads heavy image operations (decoding, resizing, thumbnail generation)
// to a dedicated Web Worker to keep the main thread responsive for UI interactions.
// Uses browser-native createImageBitmap for efficient async decoding.

import type {
  ImageWorkerInboundMessage,
  ImageWorkerOutboundMessage,
} from "./image-worker-types";

const ctx = self as unknown as DedicatedWorkerGlobalScope;

function post(message: ImageWorkerOutboundMessage) {
  ctx.postMessage(message);
}

async function decodeImage(imageData: ArrayBuffer): Promise<ImageBitmap> {
  const blob = new Blob([imageData]);
  return createImageBitmap(blob);
}

async function resizeImage(
  imageData: ArrayBuffer,
  options: { width: number; height: number; quality?: number; format?: "jpeg" | "png" | "webp" },
): Promise<ArrayBuffer> {
  const bitmap = await decodeImage(imageData);
  
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
}

async function generateThumbnail(
  imageData: ArrayBuffer,
  options: { maxSize?: number; quality?: number } = {},
): Promise<ArrayBuffer> {
  const bitmap = await decodeImage(imageData);
  const maxSize = options.maxSize ?? 200;
  
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
  
  const quality = options.quality ?? 0.85;
  const blob = await canvas.convertToBlob({
    type: "image/webp",
    quality,
  });
  
  return blob.arrayBuffer();
}

ctx.addEventListener(
  "message",
  (event: MessageEvent<ImageWorkerInboundMessage>) => {
    const { type, payload } = event.data;

    (async () => {
      try {
        switch (type) {
          case "DECODE_IMAGE": {
            const bitmap = await decodeImage(payload.imageData);
            post({
              type: "DECODE_RESULT",
              payload: { id: payload.id, result: bitmap },
            });
            break;
          }

          case "RESIZE_IMAGE": {
            if (!payload.options || !payload.options.width || !payload.options.height) {
              throw new Error("Resize options with width and height are required");
            }
            const result = await resizeImage(payload.imageData, {
              width: payload.options.width,
              height: payload.options.height,
              quality: payload.options.quality,
              format: payload.options.format,
            });
            post({
              type: "RESIZE_RESULT",
              payload: { id: payload.id, result },
            });
            break;
          }

          case "GENERATE_THUMBNAIL": {
            const result = await generateThumbnail(
              payload.imageData,
              payload.options ?? {},
            );
            post({
              type: "THUMBNAIL_RESULT",
              payload: { id: payload.id, result },
            });
            break;
          }

          default: {
            const unknown = type as string;
            post({
              type: "IMAGE_ERROR",
              payload: {
                id: payload.id,
                error: `Unknown image worker message type: ${unknown}`,
              },
            });
          }
        }
      } catch (err) {
        post({
          type: "IMAGE_ERROR",
          payload: {
            id: payload.id,
            error: err instanceof Error ? err.message : String(err),
          },
        });
      }
    })();
  },
);
