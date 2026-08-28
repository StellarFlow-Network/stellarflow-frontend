'use client';

import React from 'react';
import { readIndexedLogs } from '@/app/logs/indexedLogStorage';
import type { LogEntry } from '@/app/logs/types';

// Console warning capture
interface ConsoleWarning {
  timestamp: string;
  level: 'warn' | 'error';
  message: string;
}

const MAX_CONSOLE_WARNINGS = 50;
const consoleWarnings: ConsoleWarning[] = [];

function captureConsole(level: 'warn' | 'error') {
  const original = console[level];
  console[level] = (...args: unknown[]) => {
    const entry: ConsoleWarning = {
      timestamp: new Date().toISOString(),
      level,
      message: args.map(String).join(' '),
    };
    consoleWarnings.push(entry);
    if (consoleWarnings.length > MAX_CONSOLE_WARNINGS) {
      consoleWarnings.shift();
    }
    original.apply(console, args);
  };
}

captureConsole('warn');
captureConsole('error');

// Wallet extension state
interface WalletExtensionState {
  freighter?: { isConnected: boolean; publicKey: string | null };
  albedo?: { isConnected: boolean; publicKey: string | null };
}

function getWalletExtensionState(): WalletExtensionState {
  const state: WalletExtensionState = {};
  const win = window as unknown as Record<string, any>;

  if (win.freighter) {
    state.freighter = {
      isConnected: win.freighter.isConnected?.() ?? false,
      publicKey: win.freighter.publicKey ?? null,
    };
  }
  if (win.albedo) {
    state.albedo = {
      isConnected: true,
      publicKey: win.albedo.publicKey ?? null,
    };
  }
  return state;
}

// Sanitization
const SENSITIVE_KEY_PATTERN = /secret|private|mnemonic|seed|password|passphrase|recovery/i;
const PII_PATTERN = /\b[\w.-]+@[\w.-]+\.\w+\|\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/;
const SECRET_KEY_PATTERN = /^[A-Z2-7]{56}$/;

function sanitizeValue(key: string, value: unknown): unknown {
  if (typeof value === 'string') {
    if (SENSITIVE_KEY_PATTERN.test(key) || PII_PATTERN.test(value) || SECRET_KEY_PATTERN.test(value)) {
      return '[REDACTED]';
    }
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(key, item));
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      clean[k] = sanitizeValue(k, v);
    }
    return clean;
  }
  return value;
}

interface BugReportData {
  generatedAt: string;
  appVersion: string;
  logs: LogEntry[];
  consoleWarnings: ConsoleWarning[];
  walletExtensionState: WalletExtensionState;
}

async function compileBugReportLog(): Promise<BugReportData> {
  let logs: LogEntry[] = [];
  try {
    logs = (await readIndexedLogs()) ?? [];
  } catch {
    // Ignore and continue with empty logs.
  }

  const data: BugReportData = {
    generatedAt: new Date().toISOString(),
    appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? 'unknown',
    logs,
    consoleWarnings: consoleWarnings.slice(),
    walletExtensionState: getWalletExtensionState(),
  };

  return sanitizeValue('', data) as BugReportData;
}

function downloadBugReportLog() {
  compileBugReportLog().then((data) => {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tug-report-${new Date().toISOString().replace(/:.]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

interface CommandPaletteProps {
  className?: string;
}

export function CommandPalette({ className }: CommandPaletteProps) {
  return (
    <div className={className}>
      <button
        type="button"
        onClick={downloadBugReportLog}
        className="btn btn-secondary"
      >
        Download Bug Report Log
      </button>
    </div>
  );
}

export default CommandPalette;