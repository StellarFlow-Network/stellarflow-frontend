'use client';

/**
 * CodeSnippetBlock.tsx
 *
 * Reusable code block component with syntax highlighting and one-click copy functionality.
 *
 * Features:
 *   • Syntax highlighting for Rust, JavaScript, and cURL (simple token-based)
 *   • Copy-to-clipboard button with animated checkmark feedback
 *   • Language label with color coding
 *   • Responsive design with horizontal scroll for long lines
 *   • Keyboard-accessible copy button
 *   • SSR-safe (no clipboard access during server rendering)
 *
 * Design principles:
 *   • No external syntax highlighting library dependency (lightweight)
 *   • Simple regex-based tokenization for basic highlighting
 *   • Smooth animation feedback on successful copy
 *   • Accessible button with proper ARIA labels
 */

import React, { useCallback, useState, useRef, useEffect } from 'react';
import Icon from '@/components/icons/Icon';
import { ICON_IDS } from '@/components/icons/iconIds';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type CodeLanguage = 'rust' | 'javascript' | 'curl' | 'json' | 'typescript';

export interface CodeSnippetBlockProps {
  /** The code snippet to display */
  code: string;
  /** Programming language for syntax highlighting and label */
  language: CodeLanguage;
  /** Optional custom class name for the wrapper */
  className?: string;
  /** Optional maximum height with scroll (default: no limit) */
  maxHeight?: string;
  /** Callback fired after successful copy */
  onCopy?: (code: string) => void;
  /** Show line numbers (default: false) */
  showLineNumbers?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Language Configuration
// ─────────────────────────────────────────────────────────────────────────────

const LANGUAGE_CONFIG: Record<CodeLanguage, { label: string; color: string }> = {
  rust: { label: 'Rust', color: 'bg-orange-600' },
  javascript: { label: 'JavaScript', color: 'bg-yellow-500' },
  typescript: { label: 'TypeScript', color: 'bg-blue-600' },
  curl: { label: 'cURL', color: 'bg-green-600' },
  json: { label: 'JSON', color: 'bg-gray-600' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Simple Syntax Highlighting (Regex-based)
// ─────────────────────────────────────────────────────────────────────────────

interface Token {
  type: 'keyword' | 'string' | 'number' | 'comment' | 'function' | 'operator' | 'default';
  text: string;
}

const LANGUAGE_PATTERNS: Record<CodeLanguage, RegExp[]> = {
  rust: [
    { pattern: /(fn|let|mut|pub|use|mod|struct|enum|impl|for|while|if|else|match|return|async|await|unsafe)\b/g, type: 'keyword' },
    { pattern: /\/\/.*$/gm, type: 'comment' },
    { pattern: /"[^"]*"/g, type: 'string' },
    { pattern: /\b\d+\b/g, type: 'number' },
    { pattern: /\b[a-zA-Z_][a-zA-Z0-9_]*\s*\(/g, type: 'function' },
  ],
  javascript: [
    { pattern: /(const|let|var|function|return|if|else|for|while|async|await|import|export|from|class|extends|new|this)\b/g, type: 'keyword' },
    { pattern: /\/\/.*$|\/\*[\s\S]*?\*\//gm, type: 'comment' },
    { pattern: /"[^"]*"|'[^']*'|`[^`]*`/g, type: 'string' },
    { pattern: /\b\d+\b/g, type: 'number' },
    { pattern: /\b[a-zA-Z_$][a-zA-Z0-9_$]*\s*\(/g, type: 'function' },
  ],
  typescript: [
    { pattern: /(const|let|var|function|return|if|else|for|while|async|await|import|export|from|class|extends|new|this|interface|type|enum)\b/g, type: 'keyword' },
    { pattern: /\/\/.*$|\/\*[\s\S]*?\*\//gm, type: 'comment' },
    { pattern: /"[^"]*"|'[^']*'|`[^`]*`/g, type: 'string' },
    { pattern: /\b\d+\b/g, type: 'number' },
    { pattern: /\b[a-zA-Z_$][a-zA-Z0-9_$]*\s*\(/g, type: 'function' },
  ],
  curl: [
    { pattern: /(curl|GET|POST|PUT|DELETE|HEAD|OPTIONS)\b/gi, type: 'keyword' },
    { pattern: /--[a-z-]+/gi, type: 'keyword' },
    { pattern: /-H|-d|-X|-i|-v|-k|-u/gi, type: 'operator' },
    { pattern: /"[^"]*"|'[^']*'/g, type: 'string' },
    { pattern: /\\/g, type: 'operator' },
  ],
  json: [
    { pattern: /"[^"]*":/g, type: 'keyword' },
    { pattern: /"[^"]*"/g, type: 'string' },
    { pattern: /\b(true|false|null)\b/g, type: 'keyword' },
    { pattern: /\b\d+(\.\d+)?\b/g, type: 'number' },
  ],
};

function tokenizeCode(code: string, language: CodeLanguage): Token[] {
  const patterns = LANGUAGE_PATTERNS[language] || [];
  const tokens: Token[] = [];
  let remaining = code;

  // Simple tokenization - split by patterns and tag matches
  for (const { pattern, type } of patterns) {
    const matches = Array.from(remaining.matchAll(pattern));
    if (matches.length === 0) continue;

    // Build tokens by iterating through matches
    let lastIndex = 0;
    for (const match of matches) {
      const matchIndex = match.index ?? 0;
      const matchText = match[0];

      // Add default token for text before match
      if (matchIndex > lastIndex) {
        tokens.push({ type: 'default', text: remaining.slice(lastIndex, matchIndex) });
      }

      // Add matched token
      tokens.push({ type, text: matchText });
      lastIndex = matchIndex + matchText.length;
    }

    // Add remaining text after last match
    if (lastIndex < remaining.length) {
      tokens.push({ type: 'default', text: remaining.slice(lastIndex) });
    }

    remaining = '';
    break; // Only apply first pattern pass for simplicity
  }

  // If no patterns matched, return entire code as default
  if (tokens.length === 0) {
    return [{ type: 'default', text: code }];
  }

  return tokens;
}

// ─────────────────────────────────────────────────────────────────────────────
// Token Styling
// ─────────────────────────────────────────────────────────────────────────────

const TOKEN_STYLES: Record<Token['type'], string> = {
  keyword: 'text-purple-400 font-semibold',
  string: 'text-green-400',
  number: 'text-orange-400',
  comment: 'text-gray-500 italic',
  function: 'text-blue-400',
  operator: 'text-pink-400',
  default: 'text-gray-300',
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export const CodeSnippetBlock = React.memo(function CodeSnippetBlock({
  code,
  language,
  className = '',
  maxHeight,
  onCopy,
  showLineNumbers = false,
}: CodeSnippetBlockProps) {
  const [copied, setCopied] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const preRef = useRef<HTMLPreElement>(null);

  // SSR safety: only enable clipboard after mount
  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleCopy = useCallback(async () => {
    if (!isClient || typeof navigator === 'undefined' || !navigator.clipboard) {
      return;
    }

    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      onCopy?.(code);

      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => {
        setCopied(false);
        copyTimerRef.current = null;
      }, 2000);
    } catch (error) {
      console.warn('Failed to copy code to clipboard:', error);
    }
  }, [code, isClient, onCopy]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const langConfig = LANGUAGE_CONFIG[language];
  const tokens = tokenizeCode(code, language);

  // Calculate line numbers if enabled
  const lines = code.split('\n');

  return (
    <div className={`relative rounded-lg bg-gray-900 border border-gray-800 overflow-hidden ${className}`}>
      {/* Header with language label and copy button */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800/50 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded text-xs font-semibold text-white ${langConfig.color}`}>
            {langConfig.label}
          </span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          disabled={!isClient}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium text-gray-300 bg-gray-700/50 hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label="Copy code to clipboard"
          title="Copy code to clipboard"
        >
          <Icon
            id={copied ? ICON_IDS.check : ICON_IDS.copy}
            size={14}
            className={copied ? 'text-green-400' : ''}
            aria-hidden
          />
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>

      {/* Code content with optional scroll */}
      <div
        className={`relative ${maxHeight ? 'overflow-y-auto' : ''}`}
        style={maxHeight ? { maxHeight } : undefined}
      >
        <pre
          ref={preRef}
          className="p-4 overflow-x-auto text-sm font-mono leading-relaxed"
          tabIndex={0}
          role="code"
          aria-label={`${langConfig.label} code snippet`}
        >
          <code className="flex">
            {showLineNumbers && (
              <div className="mr-4 text-gray-600 select-none text-right" aria-hidden>
                {lines.map((_, i) => (
                  <div key={i} className="leading-relaxed">
                    {i + 1}
                  </div>
                ))}
              </div>
            )}
            <div className="flex-1">
              {tokens.map((token, index) => (
                <span key={index} className={TOKEN_STYLES[token.type]}>
                  {token.text}
                </span>
              ))}
            </div>
          </code>
        </pre>
      </div>
    </div>
  );
});

CodeSnippetBlock.displayName = 'CodeSnippetBlock';
