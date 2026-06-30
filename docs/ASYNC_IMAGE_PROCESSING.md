# Asynchronous Image Processing for Large Chart Assets

## Overview

This document describes the asynchronous image processing system implemented for handling large chart assets in StellarFlow. The system uses Web Workers to offload image decoding, resizing, and thumbnail generation from the main thread, ensuring smooth UI interactions even with heavy image operations.

## Architecture

### Components

1. **Image Worker** (`src/app/images/image-worker.ts`)
   - Dedicated Web Worker for image processing
   - Handles decoding, resizing, and thumbnail generation
   - Uses browser-native `createImageBitmap` for efficient async decoding
   - Falls back to synchronous processing if Worker is unavailable

2. **useImageWorker Hook** (`src/app/images/useImageWorker.ts`)
   - React hook for accessing image worker functionality
   - Provides automatic fallback to synchronous processing
   - Handles timeout management and error recovery
   - Manages worker lifecycle and cleanup

3. **OptimizedImage Component** (`src/app/components/OptimizedImage.tsx`)
   - Enhanced Next.js Image component with async decoding
   - Progressive loading with low-quality placeholders
   - Smooth fade-in transitions
   - Configurable async/progressive loading options

4. **AsyncChartImage Component** (`src/app/components/AsyncChartImage.tsx`)
   - Specialized component for large chart assets
   - Canvas-based rendering for optimal performance
   - Thumbnail → full-resolution progressive loading
   - Priority loading support for critical charts
   - Built-in error handling and loading states

5. **Image Utilities** (`src/app/images/imageUtils.ts`)
   - Buffer chunking for large images
   - Quality scaling calculations
   - Format detection (JPEG, PNG, WebP)
   - Size estimation and optimization helpers

## Features

### Async Image Decoding
- Uses `createImageBitmap` for non-blocking image decoding
- Offloads decoding to Web Worker to keep main thread responsive
- Automatic fallback to synchronous decoding when Workers unavailable

### Progressive Loading
- Low-quality thumbnail loads first for immediate feedback
- Full-resolution image loads progressively in background
- Smooth fade-in transition when full image ready
- Configurable placeholder quality and size

### Image Resizing
- WebP format conversion for better compression
- Quality-based sizing to meet file size targets
- Aspect ratio preservation
- Configurable max dimensions

### Chunking Support
- Split large images into manageable chunks
- Parallel processing capability
- Memory-efficient for very large assets
- Reassembly utilities

## Usage

### Basic Usage with OptimizedImage

```tsx
import OptimizedImage from "@/app/components/OptimizedImage";

<OptimizedImage
  src="/chart.png"
  width={800}
  height={450}
  alt="Traffic chart"
  enableAsyncDecode={true}
  enableProgressiveLoading={true}
  placeholderQuality={0.3}
/>
```

### Large Chart Assets with AsyncChartImage

```tsx
import AsyncChartImage from "@/app/components/AsyncChartImage";

<AsyncChartImage
  src="/large-chart.png"
  alt="Network traffic chart"
  width={1200}
  height={675}
  priority={false}
  maxDimension={1200}
  thumbnailQuality={0.5}
  onLoadingComplete={() => console.log('Chart loaded')}
  onError={(error) => console.error(error)}
/>
```

### Using Image Worker Directly

```tsx
import { useImageWorker } from "@/app/images/useImageWorker";

function MyComponent() {
  const { decodeImage, resizeImage, generateThumbnail } = useImageWorker();

  const processImage = async (buffer: ArrayBuffer) => {
    // Decode image
    const bitmap = await decodeImage("image-id", buffer);
    
    // Resize image
    const resized = await resizeImage("resize-id", buffer, {
      width: 800,
      height: 600,
      quality: 0.9,
      format: "webp",
    });
    
    // Generate thumbnail
    const thumbnail = await generateThumbnail("thumb-id", buffer, {
      maxSize: 200,
      quality: 0.7,
    });
  };
}
```

### Using Image Utilities

```tsx
import {
  chunkImageBuffer,
  assembleImageChunks,
  calculateOptimalDimensions,
  detectImageFormat,
} from "@/app/images/imageUtils";

// Chunk large image
const chunks = chunkImageBuffer(buffer, 500); // 500KB chunks

// Reassemble chunks
const fullBuffer = assembleImageChunks(chunks);

// Calculate optimal dimensions
const { width, height } = calculateOptimalDimensions(1920, 1080, 1200);

// Detect format
const format = detectImageFormat(buffer);
```

## Performance Benefits

### Main Thread Protection
- Image decoding and processing runs in Web Worker
- UI remains responsive during heavy image operations
- No blocking of critical interaction lanes

### Progressive Enhancement
- Users see content immediately with low-quality placeholders
- Full-resolution loads in background without blocking
- Smooth transitions improve perceived performance

### Memory Efficiency
- Chunking prevents memory spikes with large images
- Web Worker isolation protects main thread memory
- Automatic cleanup of temporary blob URLs

### Fallback Reliability
- Graceful degradation when Workers unavailable
- Synchronous fallback ensures functionality everywhere
- Timeout handling prevents hanging operations

## Browser Support

- **Workers**: Supported in all modern browsers
- **createImageBitmap**: Chrome 52+, Firefox 42+, Safari 15.4+, Edge 79+
- **OffscreenCanvas**: Chrome 69+, Firefox 105+, Safari 16.4+, Edge 79+
- **Fallback**: Synchronous processing works everywhere

## Configuration

### Worker Timeout
Default timeout is 15 seconds. Adjust in `useImageWorker.ts`:

```typescript
const DEFAULT_TIMEOUT_MS = 15_000;
```

### Progressive Loading Threshold
Images larger than 100KB use progressive loading by default. Adjust in `imageUtils.ts`:

```typescript
export function shouldProcessAsync(imageSizeKB: number, thresholdKB: number = 100)
```

### Quality Defaults
- WebP: 0.92
- JPEG: 0.85
- PNG: 1.0 (lossless)

## Integration with Existing Chart System

The async image processing system integrates seamlessly with the existing chart worker system:

- **Chart Worker**: Handles data calculations (windowing, aggregation, sparklines)
- **Image Worker**: Handles image processing (decoding, resizing, thumbnails)
- Both workers operate independently without conflicts
- DashboardTrafficChart uses both systems for optimal performance

## Best Practices

1. **Use AsyncChartImage for charts larger than 500KB**
2. **Enable progressive loading for non-critical images**
3. **Use priority flag for above-the-fold charts**
4. **Set appropriate maxDimension to limit memory usage**
5. **Monitor performance with browser DevTools**
6. **Test on mobile devices with limited memory**

## Troubleshooting

### Images not loading progressively
- Check that `enableProgressiveLoading` is enabled
- Verify image size exceeds threshold (default 100KB)
- Ensure Worker is available (check browser console)

### Worker timeout errors
- Increase timeout in `useImageWorker.ts`
- Check image size isn't excessively large
- Verify network connectivity for remote images

### Memory issues
- Reduce `maxDimension` for large images
- Use chunking for very large assets
- Monitor memory usage in DevTools

## Future Enhancements

- [ ] Add WebCodecs API support for better performance
- [ ] Implement GPU-accelerated processing
- [ ] Add caching for processed images
- [ ] Support for additional formats (AVIF, HEIC)
- [ ] Batch processing for multiple images
- [ ] Progressive JPEG support
