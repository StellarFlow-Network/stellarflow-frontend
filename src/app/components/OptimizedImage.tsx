"use client";

import { useState, useEffect, useRef } from "react";
import Image, { ImageProps } from "next/image";
import { useImageWorker } from "../images/useImageWorker";

interface OptimizedImageProps extends Omit<ImageProps, "width" | "height"> {
  width: number;
  height: number;
  enableAsyncDecode?: boolean;
  enableProgressiveLoading?: boolean;
  placeholderQuality?: number;
}

export default function OptimizedImage({
  width,
  height,
  style,
  className,
  enableAsyncDecode = true,
  enableProgressiveLoading = true,
  placeholderQuality = 0.3,
  src,
  ...props
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [decodedSrc, setDecodedSrc] = useState<string | null>(null);
  const { decodeImage, generateThumbnail } = useImageWorker();
  const imageIdRef = useRef<string>(`img-${Date.now()}-${Math.random()}`);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enableAsyncDecode || typeof src !== "string") {
      setDecodedSrc(src as string);
      setIsLoaded(true);
      return;
    }

    let cancelled = false;

    const processImage = async () => {
      try {
        const response = await fetch(src as string);
        const buffer = await response.arrayBuffer();

        if (cancelled) return;

        if (enableProgressiveLoading) {
          const thumbnailBuffer = await generateThumbnail(
            `${imageIdRef.current}-thumb`,
            buffer,
            { maxSize: 100, quality: placeholderQuality },
          );
          const thumbnailBlob = new Blob([thumbnailBuffer]);
          const thumbnailUrl = URL.createObjectURL(thumbnailBlob);
          blobUrlRef.current = thumbnailUrl;
          
          if (!cancelled) {
            setDecodedSrc(thumbnailUrl);
            setIsLoaded(true);
          }

          await new Promise(resolve => setTimeout(resolve, 100));

          if (cancelled) {
            URL.revokeObjectURL(thumbnailUrl);
            return;
          }

          await decodeImage(`${imageIdRef.current}-full`, buffer);
          
          if (!cancelled) {
            setDecodedSrc(src as string);
            URL.revokeObjectURL(thumbnailUrl);
            blobUrlRef.current = null;
          }
        } else {
          await decodeImage(imageIdRef.current, buffer);
          if (!cancelled) {
            setDecodedSrc(src as string);
            setIsLoaded(true);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setDecodedSrc(src as string);
          setIsLoaded(true);
        }
      }
    };

    processImage();

    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [src, enableAsyncDecode, enableProgressiveLoading, placeholderQuality, decodeImage, generateThumbnail]);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  return (
    <div
      style={{ aspectRatio: `${width} / ${height}`, ...style }}
      className={`relative ${className || ""}`}
    >
      {!decodedSrc && enableProgressiveLoading && (
        <div
          className="absolute inset-0 bg-gray-800 animate-pulse"
          style={{ aspectRatio: `${width} / ${height}` }}
        />
      )}
      {decodedSrc && (
        <Image
          width={width}
          height={height}
          src={decodedSrc}
          onLoad={handleLoad}
          className={`transition-opacity duration-300 ${isLoaded ? "opacity-100" : "opacity-0"}`}
          {...props}
        />
      )}
    </div>
  );
}
