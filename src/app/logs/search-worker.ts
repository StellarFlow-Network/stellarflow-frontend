import Fuse from 'fuse.js';
import { LogEntry } from './types';

let fuse: Fuse<LogEntry> | null = null;

self.onmessage = (event: MessageEvent) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'INIT':
      fuse = new Fuse(payload.logs, {
        keys: ['message', 'actor', 'txHash'],
        threshold: 0.3,
        distance: 100,
        ignoreLocation: true,
        includeMatches: true,
        includeScore: true,
      });
      break;

    case 'SEARCH':
      if (!fuse) {
        self.postMessage({ type: 'RESULTS', payload: { results: [], query: payload.query } });
        return;
      }
      
      const results = payload.query 
        ? fuse.search(payload.query)
        : payload.logs.map((log: LogEntry) => ({ item: log })); // Normalize format

      self.postMessage({ 
        type: 'RESULTS', 
        payload: { 
          results, 
          query: payload.query 
        } 
      });
      break;

    default:
      console.warn(`Unknown message type: ${type}`);
  }
};
