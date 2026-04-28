"use client";

import React, { useState } from 'react';
import { 
  FileText, 
  Search, 
  Download, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  ExternalLink,
  ShieldAlert,
  Database,
  Terminal,
  Wifi,
  WifiOff
} from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { motion, AnimatePresence } from 'framer-motion';

import { LogEntry } from './types';

// --- Mock Data ---
const MOCK_LOGS: LogEntry[] = [
  { id: '101', timestamp: '2026-04-28 12:40:01', type: 'transaction', severity: 'info', message: 'Price Update: NGN/XLM set to 1450.22', actor: 'VTPass Lagos', txHash: '0xabc...123' },
  { id: '102', timestamp: '2026-04-28 12:35:12', type: 'security', severity: 'critical', message: 'Unauthorized API attempt detected from IP 192.168.1.1', actor: 'System Guard' },
  { id: '103', timestamp: '2026-04-28 12:30:45', type: 'system', severity: 'warning', message: 'Regional Failover: Switching to Frankfurt Secondary', actor: 'Network Orchestrator' },
  { id: '104', timestamp: '2026-04-28 12:20:10', type: 'transaction', severity: 'info', message: 'Price Update: KES/XLM set to 132.45', actor: 'Binance Pan-Africa', txHash: '0xdef...456' },
];

export default function LogsPage() {
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredResults, setFilteredResults] = useState<any[]>(MOCK_LOGS.map(l => ({ item: l })));
  const [isSearching, setIsSearching] = React.useState(false);
  const workerRef = React.useRef<Worker | null>(null);

  React.useEffect(() => {
    // Initialize worker
    workerRef.current = new Worker(new URL('./search-worker.ts', import.meta.url));
    
    workerRef.current.onmessage = (e) => {
      if (e.data.type === 'RESULTS') {
        setFilteredResults(e.data.payload.results);
        setIsSearching(false);
      }
    };

    workerRef.current.postMessage({ type: 'INIT', payload: { logs: MOCK_LOGS } });

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  // Handle search with debounce logic
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (workerRef.current) {
        setIsSearching(true);
        workerRef.current.postMessage({ 
          type: 'SEARCH', 
          payload: { query: searchQuery, logs: MOCK_LOGS } 
        });
      }
    }, 150); // Faster response for premium feel

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const displayedResults = filteredResults.filter(res => 
    filter === 'all' || res.item.severity === filter
  );

  // Virtualization setup
  const parentRef = React.useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: displayedResults.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64, // Estimate based on typical row height
    overscan: 10,
  });

  const [isOnline, setIsOnline] = useState(true);
  React.useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 p-8">
      {/* --- Header Section --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <p className="text-sm text-gray-500 mb-1">Admin / Audit</p>
          <h1 className="text-3xl font-bold tracking-tight">System Logs</h1>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => {
              const headers = ['Timestamp', 'Type', 'Severity', 'Message', 'Actor', 'Hash'];
              const csv = [
                headers.join(','),
                ...displayedResults.map(r => [
                  r.item.timestamp,
                  r.item.type,
                  r.item.severity,
                  `"${r.item.message.replace(/"/g, '""')}"`,
                  r.item.actor,
                  r.item.txHash || ''
                ].join(','))
              ].join('\n');
              
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.setAttribute('hidden', '');
              a.setAttribute('href', url);
              a.setAttribute('download', `stellarflow_logs_${new Date().toISOString().split('T')[0]}.csv`);
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
            }}
            className="flex items-center gap-2 bg-[#161b22] border border-gray-700 hover:bg-gray-800 text-gray-300 px-4 py-2 rounded-lg transition-all text-sm group"
          >
            <Download size={16} className="group-hover:translate-y-0.5 transition-transform" />
            Export CSV
          </button>
          <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-all text-sm font-medium">
            <Terminal size={16} />
            Live Console
          </button>
        </div>
      </div>

      {/* --- Filter & Search Bar --- */}
      <div className="bg-[#161b22] border border-gray-800 rounded-xl p-4 mb-6 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${isSearching ? 'text-blue-500 animate-pulse' : 'text-gray-500'}`} size={18} />
          <input 
            type="text" 
            placeholder="Filter logs by message, actor, or hash..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0d1117] border border-gray-700 rounded-md py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter size={18} className="text-gray-500" />
          <select 
            className="bg-[#0d1117] border border-gray-700 rounded-md py-2 px-4 text-sm focus:outline-none"
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All Severities</option>
            <option value="info">Info Only</option>
            <option value="warning">Warnings</option>
            <option value="critical">Critical Errors</option>
          </select>
        </div>
      </div>

      {/* --- Logs Virtual Table --- */}
      <div className="bg-[#161b22] border border-gray-800 rounded-xl overflow-hidden mb-6 relative">
        <AnimatePresence>
          {!isOnline && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-0 inset-x-0 z-20 bg-yellow-500/90 text-black py-1.5 px-4 flex items-center justify-center gap-2 text-xs font-bold"
            >
              <WifiOff size={14} />
              Operating in Offline Mode — Cached data is being shown
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-[140px_120px_100px_1fr_150px_120px] text-gray-500 text-[10px] uppercase tracking-wider border-b border-gray-800 bg-[#0d1117]/80 backdrop-blur-md sticky top-0 z-10">
          <div className="px-6 py-4 font-medium">Timestamp</div>
          <div className="px-6 py-4 font-medium">Type</div>
          <div className="px-6 py-4 font-medium">Severity</div>
          <div className="px-6 py-4 font-medium">Event Message</div>
          <div className="px-6 py-4 font-medium">Actor</div>
          <div className="px-6 py-4 font-medium text-right">Reference</div>
        </div>

        <div 
          ref={parentRef}
          className="overflow-auto max-h-[600px] scrollbar-thin scrollbar-thumb-gray-700"
        >
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const result = displayedResults[virtualRow.index];
              const log = result.item;
              const matches = result.matches || [];
              
              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className="grid grid-cols-[140px_120px_100px_1fr_150px_120px] border-b border-gray-800/50 hover:bg-[#1c2128] transition-colors group font-mono text-[13px] items-center"
                >
                  <div className="px-6 py-4 text-gray-400 whitespace-nowrap">
                    {log.timestamp}
                  </div>
                  <div className="px-6 py-4">
                    <span className="flex items-center gap-2 text-gray-200">
                      {log.type === 'transaction' && <Database size={14} className="text-blue-400" />}
                      {log.type === 'security' && <ShieldAlert size={14} className="text-red-400" />}
                      {log.type === 'system' && <FileText size={14} className="text-gray-400" />}
                      <span className="capitalize">{log.type}</span>
                    </span>
                  </div>
                  <div className="px-6 py-4">
                    <SeverityIndicator severity={log.severity} />
                  </div>
                  <div className="px-6 py-4 truncate text-gray-200">
                    <SearchHighlight text={log.message} matches={matches.find((m: any) => m.key === 'message')?.indices} />
                  </div>
                  <div className="px-6 py-4 text-gray-400 truncate">
                    <SearchHighlight text={log.actor} matches={matches.find((m: any) => m.key === 'actor')?.indices} />
                  </div>
                  <div className="px-6 py-4 text-right">
                    {log.txHash ? (
                      <button className="text-blue-500 hover:text-blue-400 flex items-center gap-1 justify-end ml-auto group/hash">
                        <span className="text-xs uppercase group-hover/hash:underline">
                          <SearchHighlight text={log.txHash} matches={matches.find((m: any) => m.key === 'txHash')?.indices} />
                        </span>
                        <ExternalLink size={12} />
                      </button>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </div>
                </div>
              );
            })}
            
            {displayedResults.length === 0 && (
              <div className="px-6 py-20 text-center text-gray-500 h-full flex flex-col items-center justify-center gap-2">
                <Search size={32} className="opacity-20" />
                <p>No logs matching "{searchQuery}"</p>
              </div>
            )}
          </div>
        </div>

        {/* --- Pagination Footer --- */}
        <div className="p-4 border-t border-gray-800 flex justify-between items-center text-sm text-gray-500">
          <span>Showing {displayedResults.length} of {MOCK_LOGS.length} entries</span>
          <div className="flex gap-2">
            <button className="p-2 border border-gray-700 rounded-md hover:bg-gray-800 disabled:opacity-50" disabled>
              <ChevronLeft size={16} />
            </button>
            <button className="p-2 border border-gray-700 rounded-md hover:bg-gray-800">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Sub-components ---

function SearchHighlight({ text, matches }: { text: string; matches?: [number, number][] }) {
  if (!matches || matches.length === 0) return <span>{text}</span>;

  const result = [];
  let lastIndex = 0;

  matches.forEach(([start, end], idx) => {
    // Add text before match
    if (start > lastIndex) {
      result.push(text.slice(lastIndex, start));
    }
    // Add highlighted match
    result.push(
      <mark key={idx} className="bg-[#CBF34D]/30 text-[#CBF34D] rounded-sm px-0.5 border-b border-[#CBF34D]/50 no-underline">
        {text.slice(start, end + 1)}
      </mark>
    );
    lastIndex = end + 1;
  });

  // Add remaining text
  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }

  return <span>{result}</span>;
}

function SeverityIndicator({ severity }: { severity: 'info' | 'warning' | 'critical' }) {
  const styles = {
    info: "text-blue-400 bg-blue-400/10",
    warning: "text-yellow-500 bg-yellow-500/10",
    critical: "text-red-500 bg-red-500/10",
  };

  return (
    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full w-fit border border-transparent ${styles[severity]}`}>
      <div className={`w-1.5 h-1.5 rounded-full fill-current ${severity === 'critical' ? 'animate-pulse' : ''}`} style={{ backgroundColor: 'currentColor' }} />
      <span className="text-[11px] font-bold uppercase">{severity}</span>
    </div>
  );
}
