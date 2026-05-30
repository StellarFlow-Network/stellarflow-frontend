"use client";

import Image, { ImageProps } from "next/image";

interface OptimizedImageProps extends Omit<ImageProps, "width" | "height"> {
  width: number;
  height: number;
}

export default function OptimizedImage({
  width,
  height,
  style,
  className,
  ...props
}: OptimizedImageProps) {
  return (
    <Image
      width={width}
      height={height}
      style={{ aspectRatio: `${width} / ${height}`, ...style }}
      className={className}
      {...props}
    />
  );
}
