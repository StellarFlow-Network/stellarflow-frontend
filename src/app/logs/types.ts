export interface LogEntry {
  id: string;
  timestamp: string;
  type: 'transaction' | 'security' | 'system';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  actor: string;
  txHash?: string;
}
