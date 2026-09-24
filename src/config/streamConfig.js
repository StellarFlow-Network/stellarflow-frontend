export const STREAM_CONFIG = {
  USE_FLAT_ARRAYS: true,
  KEY_INDEXED_FORMAT: true,
  BATCH_SIZE: 50,
  COMPRESSION_ENABLED: true,
  MAX_PARSE_WORKERS: 4,
  DEBOUNCE_RENDER_MS: 100
};

export const initializeStreamOptimization = () => {
  return {
    ...STREAM_CONFIG,
    timestamp: Date.now()
  };
};
