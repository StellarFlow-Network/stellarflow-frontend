/**
 * JSON Stream Optimizer
 * Handles complex JSON data compression for streaming
 * Converts un-nested JSON blocks to flat, key-indexed arrays
 */

export const flattenJsonPayload = (complexJson) => {
  const flattened = {};
  
  const flatten = (obj, prefix = '') => {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];
        const newKey = prefix ? `${prefix}.${key}` : key;
        
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
          flatten(value, newKey);
        } else {
          flattened[newKey] = value;
        }
      }
    }
  };
  
  flatten(complexJson);
  return flattened;
};

export const compressStreamPayload = (dataArray) => {
  return dataArray.map(item => flattenJsonPayload(item));
};

export const createKeyIndexedArray = (dataArray) => {
  const indexed = {};
  dataArray.forEach((item, index) => {
    indexed[index] = flattenJsonPayload(item);
  });
  return indexed;
};
