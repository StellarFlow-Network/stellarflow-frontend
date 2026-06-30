"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useImageWorker } from "../images/useImageWorker";

interface AsyncChartImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  maxDimension?: number;
  thumbnailQuality?: number;
  onLoadingComplete?: () => void;
  onError?: (error: Error) => void;
}

export default function AsyncChartImage({
  src,
  alt,
  width = 800,
  height = 450,
  className = "",
  priority = false,
  maxDimension = 1200,
  thumbnailQuality = 0.5,
  onLoadingComplete,
  onError,
}: AsyncChartImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [currentSrc, setCurrentSrc] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { decodeImage, resizeImage, generateThumbnail } = useImageWorker();
  const imageIdRef = useRef<string>(`chart-${Date.now()}-${Math.random()}`);
  const abortControllerRef = useRef<AbortController | null>(null);

  const processChartImage = useCallback(async () => {
    if (!src) return;

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(src, { signal });
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();

      if (signal.aborted) return;

      if (priority) {
        await decodeImage(imageIdRef.current, buffer);
        setCurrentSrc(src);
      } else {
        const thumbnailBuffer = await generateThumbnail(
          `${imageIdRef.current}-thumb`,
          buffer,
          { maxSize: 200, quality: thumbnailQuality },
        );
        const thumbnailBlob = new Blob([thumbnailBuffer]);
        const thumbnailUrl = URL.createObjectURL(thumbnailBlob);
        setCurrentSrc(thumbnailUrl);

        await new Promise(resolve => setTimeout(resolve, 50));

        if (signal.aborted) {
          URL.revokeObjectURL(thumbnailUrl);
          return;
        }

        const scale = Math.min(maxDimension / width, maxDimension / height, 1);
        const targetWidth = Math.round(width * scale);
        const targetHeight = Math.round(height * scale);

        const resizedBuffer = await resizeImage(
          `${imageIdRef.current}-resized`,
          buffer,
          { width: targetWidth, height: targetHeight, quality: 0.95, format: "webp" },
        );

        if (signal.aborted) {
          URL.revokeObjectURL(thumbnailUrl);
          return;
        }

        const resizedBlob = new Blob([resizedBuffer]);
        const resizedUrl = URL.createObjectURL(resizedBlob);
        setCurrentSrc(resizedUrl);
        URL.revokeObjectURL(thumbnailUrl);

        await decodeImage(`${imageIdRef.current}-final`, resizedBuffer);
      }

      setIsLoading(false);
      onLoadingComplete?.();
    } catch (err) {
      if (signal.aborted) return;
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setIsLoading(false);
      onError?.(error);
    }
  }, [src, priority, width, height, maxDimension, thumbnailQuality, decodeImage, resizeImage, generateThumbnail, onLoadingComplete, onError]);

  useEffect(() => {
    processChartImage();

    return () => {
      abortControllerRef.current?.abort();
      if (currentSrc && currentSrc.startsWith("blob:")) {
        URL.revokeObjectURL(currentSrc);
      }
    };
  }, [processChartImage]);

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentSrc) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = currentSrc;
  }, [currentSrc]);

  useEffect(() => {
    if (!isLoading && currentSrc) {
      renderCanvas();
    }
  }, [isLoading, currentSrc, renderCanvas]);

  if (error) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-900/50 text-red-400 ${className}`}
        style={{ width, height }}
      >
        <div className="text-center">
          <p className="text-sm">Failed to load chart</p>
          <p className="text-xs text-gray-500 mt-1">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} style={{ width, height }}>
      {isLoading && (
        <div className="absolute inset-0 bg-gray-800 animate-pulse flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className={`w-full h-full transition-opacity duration-300 ${isLoading ? "opacity-0" : "opacity-100"}`}
        aria-label={alt}
      />
    </div>
  );
}
