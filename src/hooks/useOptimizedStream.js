import { useState, useCallback } from 'react';
import { compressStreamPayload, createKeyIndexedArray } from '../utils/jsonStreamOptimizer';

export const useOptimizedStream = () => {
  const [streamData, setStreamData] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const processStreamChunk = useCallback((chunk) => {
    setIsProcessing(true);
    
    // Flatten and compress payload to minimize parsing workload
    const compressedData = compressStreamPayload(chunk);
    const keyIndexed = createKeyIndexedArray(compressedData);
    
    // Batch updates to reduce re-renders
    setStreamData(prev => [...prev, ...compressedData]);
    setIsProcessing(false);
    
    return keyIndexed;
  }, []);

  return { streamData, processStreamChunk, isProcessing };
};
