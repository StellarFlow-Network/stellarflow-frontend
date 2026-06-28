/**
 * Image processing utilities for chunking, quality scaling, and format conversion.
 * These utilities work with ArrayBuffer data for efficient processing in Web Workers.
 */

export interface ImageChunk {
  id: number;
  data: ArrayBuffer;
  totalChunks: number;
}

export interface QualityScaleOptions {
  targetSizeKB?: number;
  maxDimension?: number;
  format?: "jpeg" | "png" | "webp";
}

/**
 * Splits a large image buffer into smaller chunks for progressive loading
 * or parallel processing. Useful for very large chart assets.
 */
export function chunkImageBuffer(
  buffer: ArrayBuffer,
  chunkSizeKB: number = 500,
): ImageChunk[] {
  const totalBytes = buffer.byteLength;
  const chunkSize = chunkSizeKB * 1024;
  const totalChunks = Math.ceil(totalBytes / chunkSize);
  const chunks: ImageChunk[] = [];

  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, totalBytes);
    const chunkData = buffer.slice(start, end);
    
    chunks.push({
      id: i,
      data: chunkData,
      totalChunks,
    });
  }

  return chunks;
}

/**
 * Reassembles image chunks back into a single buffer.
 */
export function assembleImageChunks(chunks: ImageChunk[]): ArrayBuffer {
  // Sort chunks by ID to ensure correct order
  const sortedChunks = [...chunks].sort((a, b) => a.id - b.id);
  
  // Calculate total size
  const totalSize = sortedChunks.reduce((sum, chunk) => sum + chunk.data.byteLength, 0);
  
  // Create a new buffer and copy chunks
  const result = new ArrayBuffer(totalSize);
  const view = new Uint8Array(result);
  
  let offset = 0;
  for (const chunk of sortedChunks) {
    const chunkView = new Uint8Array(chunk.data);
    view.set(chunkView, offset);
    offset += chunk.data.byteLength;
  }
  
  return result;
}

/**
 * Calculates appropriate quality settings based on target file size.
 * Returns quality value (0-1) for image encoding.
 */
export function calculateQualityForTargetSize(
  currentSizeKB: number,
  targetSizeKB: number,
  currentQuality: number = 0.92,
): number {
  if (currentSizeKB <= targetSizeKB) {
    return currentQuality;
  }
  
  const ratio = targetSizeKB / currentSizeKB;
  // Quality doesn't scale linearly with size, use a more aggressive curve
  return Math.max(0.1, Math.min(0.95, currentQuality * Math.sqrt(ratio)));
}

/**
 * Calculates optimal dimensions for an image based on max dimension constraint
 * while maintaining aspect ratio.
 */
export function calculateOptimalDimensions(
  width: number,
  height: number,
  maxDimension: number,
): { width: number; height: number } {
  if (width <= maxDimension && height <= maxDimension) {
    return { width, height };
  }
  
  const scale = maxDimension / Math.max(width, height);
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

/**
 * Estimates file size for an image based on dimensions, format, and quality.
 * This is a rough estimation for planning purposes.
 */
export function estimateImageSize(
  width: number,
  height: number,
  format: "jpeg" | "png" | "webp" = "webp",
  quality: number = 0.92,
): number {
  const pixels = width * height;
  
  // Base bytes per pixel estimates (very rough)
  const bytesPerPixel: Record<string, number> = {
    jpeg: 0.25,
    png: 1.5,
    webp: 0.2,
  };
  
  const baseSize = pixels * bytesPerPixel[format];
  const qualityFactor = format === "png" ? 1 : quality;
  
  return Math.round(baseSize * qualityFactor / 1024); // Return in KB
}

/**
 * Determines if an image should be processed asynchronously based on size.
 * Returns true for images larger than the threshold.
 */
export function shouldProcessAsync(imageSizeKB: number, thresholdKB: number = 100): boolean {
  return imageSizeKB > thresholdKB;
}

/**
 * Validates image buffer format by checking magic bytes.
 * Returns the detected format or null if unknown.
 */
export function detectImageFormat(buffer: ArrayBuffer): "jpeg" | "png" | "webp" | null {
  const view = new Uint8Array(buffer.slice(0, 12));
  
  // JPEG: FF D8 FF
  if (view[0] === 0xFF && view[1] === 0xD8 && view[2] === 0xFF) {
    return "jpeg";
  }
  
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    view[0] === 0x89 &&
    view[1] === 0x50 &&
    view[2] === 0x4E &&
    view[3] === 0x47 &&
    view[4] === 0x0D &&
    view[5] === 0x0A &&
    view[6] === 0x1A &&
    view[7] === 0x0A
  ) {
    return "png";
  }
  
  // WebP: 52 49 46 46 ... 57 45 42 50
  if (
    view[0] === 0x52 &&
    view[1] === 0x49 &&
    view[2] === 0x46 &&
    view[3] === 0x46 &&
    view[8] === 0x57 &&
    view[9] === 0x45 &&
    view[10] === 0x42 &&
    view[11] === 0x50
  ) {
    return "webp";
  }
  
  return null;
}

/**
 * Gets recommended quality settings for different image types.
 */
export function getRecommendedQuality(format: "jpeg" | "png" | "webp"): number {
  const qualityMap: Record<string, number> = {
    jpeg: 0.85,
    png: 1.0, // PNG is lossless
    webp: 0.92,
  };
  
  return qualityMap[format] ?? 0.92;
}
