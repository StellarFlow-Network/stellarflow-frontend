import { XdrFields } from './worker-types';

export interface LogEntry {
  id: string;
  timestamp: string;
  type: 'transaction' | 'security' | 'system';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  actor: string;
  txHash?: string;
  decodedData?: XdrFields;
}

export interface FuseMatch {
  key: string;
  indices: [number, number][];
}

export interface FilteredLogResult {
  item: LogEntry;
  matches?: FuseMatch[];
}
