export interface ImageWorkerInboundMessage {
  type: "DECODE_IMAGE" | "RESIZE_IMAGE" | "GENERATE_THUMBNAIL" | "PROCESS_CHUNK";
  payload: {
    id: string;
    imageData: ArrayBuffer;
    options?: {
      width?: number;
      height?: number;
      quality?: number;
      format?: "jpeg" | "png" | "webp";
    };
  };
}

export interface ImageWorkerOutboundMessage {
  type: "DECODE_RESULT" | "RESIZE_RESULT" | "THUMBNAIL_RESULT" | "CHUNK_RESULT" | "IMAGE_ERROR";
  payload: {
    id: string;
    result?: ArrayBuffer | ImageBitmap;
    error?: string;
    progress?: number;
  };
}

export interface DecodeImagePayload {
  id: string;
  imageData: ArrayBuffer;
}

export interface ResizeImagePayload {
  id: string;
  imageData: ArrayBuffer;
  options: {
    width: number;
    height: number;
    quality?: number;
    format?: "jpeg" | "png" | "webp";
  };
}

export interface GenerateThumbnailPayload {
  id: string;
  imageData: ArrayBuffer;
  options?: {
    maxSize?: number;
    quality?: number;
  };
}
