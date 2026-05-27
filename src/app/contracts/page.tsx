"use client";

import React, { useState } from 'react';
import { 
  Cpu, 
  Upload, 
  ShieldAlert, 
  Zap, 
  Lock, 
  Unlock, 
  History, 
  Code2, 
  CheckCircle2, 
  AlertTriangle 
} from 'lucide-react';
import { CONTRACT_HEALTH_ICON_VARIANTS } from '@/lib/classNameVariants';

export default function ContractsPage() {
  const [isHalted, setIsHalted] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0); // percent
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  async function uploadFileInChunks(
    file: File,
    onProgress: (percent: number) => void,
    signal?: AbortSignal,
  ) {
    const CHUNK_SIZE = 256 * 1024; // 256 KB
    const total = file.size;
    const totalChunks = Math.ceil(total / CHUNK_SIZE);
    const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    let uploaded = 0;

    for (let index = 0; index < totalChunks; index++) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

      const start = index * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, total);
      const chunk = file.slice(start, end);

      const headers: Record<string, string> = {
        'X-Upload-Id': uploadId,
        'X-Chunk-Index': String(index),
        'X-Total-Chunks': String(totalChunks),
      };

      const res = await fetch('/api/contracts/upload-wasm', {
        method: 'POST',
        headers,
        body: chunk,
        signal,
      });

      if (!res.ok) {
        throw new Error(`Chunk ${index} failed: ${res.status}`);
      }

      uploaded += end - start;
      const percent = Math.round((uploaded / total) * 100);
      onProgress(percent);
    }

    // Finalize upload
    const finalize = await fetch('/api/contracts/upload-complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uploadId, fileName: file.name }),
      signal,
    });

    if (!finalize.ok) {
      throw new Error('Failed to finalize upload');
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 p-8">
      {/* --- Header Section --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <p className="text-sm text-gray-500 mb-1">Admin / Infrastructure</p>
          <h1 className="text-3xl font-bold tracking-tight">Smart Contract Logic</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[#161b22] px-3 py-1.5 rounded-full border border-gray-800">
             <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
             <span className="text-xs font-mono uppercase text-gray-400">Mainnet: Active</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* --- Left Column: Contract Deployment --- */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* WASM Upgrade Section */}
          <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Upload size={20} className="text-blue-400" />
              Upgrade Contract WASM
            </h2>
            <div className="border-2 border-dashed border-gray-800 rounded-lg p-6 transition-colors group">
              <div className="flex items-center gap-6 p-6">
                <div className="p-4 bg-blue-500/10 rounded-full group-hover:scale-110 transition-transform">
                  <Code2 size={32} className="text-blue-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium mb-1">Upload new .wasm binary</p>
                  <p className="text-xs text-gray-500">Max file size: 10MB. Ensure code is pre-compiled for Soroban.</p>

                  <div className="mt-4 flex items-center gap-3">
                    <input
                      type="file"
                      accept=".wasm"
                      disabled={uploading}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        // kick off chunked upload
                        setUploadMessage(null);
                        setUploadProgress(0);
                        const controller = new AbortController();
                        setAbortController(controller);
                        try {
                          setUploading(true);
                          await uploadFileInChunks(file, (percent) => setUploadProgress(percent), controller.signal);
                          setUploadMessage('Upload complete');
                        } catch (err) {
                          if ((err as any)?.name === 'AbortError') {
                            setUploadMessage('Upload cancelled');
                          } else {
                            setUploadMessage('Upload failed');
                            // eslint-disable-next-line no-console
                            console.error('Chunked upload error', err);
                          }
                        } finally {
                          setUploading(false);
                          setAbortController(null);
                          // clear the file input
                          (e.target as HTMLInputElement).value = '';
                        }
                      }}
                      className="text-sm"
                    />

                    {uploading ? (
                      <button
                        onClick={() => abortController?.abort()}
                        className="text-xs bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded border border-gray-700 transition-all"
                      >
                        Cancel
                      </button>
                    ) : null}
                  </div>

                  {uploading || uploadProgress > 0 ? (
                    <div className="mt-4">
                      <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
                        <div
                          style={{ width: `${uploadProgress}%` }}
                          className="h-3 bg-blue-500 transition-[width]"
                        />
                      </div>
                      <div className="text-xs text-gray-400 mt-1">{uploadProgress}%</div>
                      {uploadMessage && <div className="text-xs text-gray-300 mt-1">{uploadMessage}</div>}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="mt-4 p-4 bg-[#0d1117] rounded-lg border border-gray-800 flex justify-between items-center">
              <div>
                <p className="text-xs text-gray-500 uppercase font-bold">Current WASM Hash</p>
                <p className="text-sm font-mono text-gray-300">8f2a...7e1b9c4d</p>
              </div>
              <button className="text-xs bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded border border-gray-700 transition-all">
                Verify on Ledger
              </button>
            </div>
          </div>

          {/* Configuration Grid */}
          <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <Zap size={20} className="text-yellow-400" />
              Protocol Parameters
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs text-gray-500 uppercase font-bold">Update Frequency (Heartbeat)</label>
                <div className="flex gap-2">
                  <input type="number" defaultValue={60} className="bg-[#0d1117] border border-gray-700 rounded-md py-2 px-3 text-sm w-full focus:outline-none focus:border-blue-500" />
                  <span className="flex items-center text-sm text-gray-500">Sec</span>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-gray-500 uppercase font-bold">Deviation Threshold</label>
                <div className="flex gap-2">
                  <input type="number" defaultValue={2.5} className="bg-[#0d1117] border border-gray-700 rounded-md py-2 px-3 text-sm w-full focus:outline-none focus:border-blue-500" />
                  <span className="flex items-center text-sm text-gray-500">%</span>
                </div>
              </div>
            </div>
            <button className="mt-6 w-full py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors">
              Submit Parameter Update
            </button>
          </div>
        </div>

        {/* --- Right Column: Safety & Security --- */}
        <div className="space-y-6">
          
          {/* Emergency Halt Section */}
          <div className={`border p-6 rounded-xl transition-all ${isHalted ? 'bg-red-900/10 border-red-500' : 'bg-[#161b22] border-gray-800'}`}>
            <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
              <ShieldAlert size={20} className={isHalted ? 'text-red-500' : 'text-gray-400'} />
              Emergency Halt
            </h2>
            <p className="text-xs text-gray-500 mb-6">
              Instantly pauses all price updates across the network. Use only in case of data compromise or critical failure.
            </p>
            <button 
              onClick={() => setIsHalted(!isHalted)}
              className={`w-full py-3 rounded-lg flex items-center justify-center gap-2 font-bold transition-all ${
                isHalted 
                ? 'bg-green-600 hover:bg-green-700 text-white' 
                : 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/20'
              }`}
            >
              {isHalted ? <Unlock size={18} /> : <Lock size={18} />}
              {isHalted ? 'RESUME ORACLE' : 'HALT ALL OPERATIONS'}
            </button>
          </div>

          {/* Verification Status */}
          <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6">
            <h3 className="text-sm font-semibold mb-4 text-gray-400 uppercase tracking-wider">Storage Health</h3>
            <div className="space-y-4">
              <HealthItem label="State Expiration (TTL)" value="340,201 Ledgers" status="safe" />
              <HealthItem label="Instance Storage" value="1.2 KB / 64 KB" status="safe" />
              <HealthItem label="Contract Balance" value="450.25 XLM" status="warning" />
            </div>
          </div>

          {/* Audit History Snippet */}
          <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6">
            <h3 className="text-sm font-semibold mb-4 text-gray-400 flex items-center gap-2 uppercase tracking-wider">
              <History size={16} />
              Recent Changes
            </h3>
            <div className="space-y-3 font-mono text-[10px]">
              <div className="flex justify-between border-b border-gray-800 pb-2">
                <span className="text-blue-400">WASM_UPGRADE</span>
                <span className="text-gray-500">2d ago</span>
              </div>
              <div className="flex justify-between border-b border-gray-800 pb-2">
                <span className="text-yellow-400">PARAM_HEARTBEAT</span>
                <span className="text-gray-500">5d ago</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// --- Sub-components ---

const HealthItem = React.memo(function HealthItem({ label, value, status }: { label: string, value: string, status: 'safe' | 'warning' | 'error' }) {
  const iconComponent = status === 'safe' 
    ? <CheckCircle2 size={14} className={CONTRACT_HEALTH_ICON_VARIANTS[status]} />
    : <AlertTriangle size={14} className={CONTRACT_HEALTH_ICON_VARIANTS[status]} />;

  return (
    <div className="flex justify-between items-center">
      <div className="text-xs text-gray-300">{label}</div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-gray-500">{value}</span>
        {iconComponent}
      </div>
    </div>
  );
}, (prev, next) => 
  prev.label === next.label && 
  prev.value === next.value && 
  prev.status === next.status
);
