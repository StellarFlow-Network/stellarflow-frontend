'use client';

import React, { useState, useRef, useId, useEffect } from 'react';
import { ExternalLink, HelpCircle, AlertTriangle, BookOpen } from 'lucide-react';
import { getGlossaryTerm, GlossaryTerm } from '@/lib/defiGlossary';

export interface DeFiTooltipProps {
  /** Known term key in glossary (e.g., 'slippage', 'twap', 'impermanent-loss', 'health-factor') */
  termKey?: string;
  /** Override title */
  title?: string;
  /** Override short definition */
  shortDefinition?: string;
  /** Override detailed explanation */
  detailedExplanation?: string;
  /** Override docs knowledge base URL */
  docsUrl?: string;
  /** Tooltip popover positioning */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** Custom trigger element */
  children?: React.ReactNode;
  /** Include info icon next to trigger */
  showIcon?: boolean;
  /** Additional CSS class names */
  className?: string;
  /** Delay in ms before closing tooltip on mouseleave (allows hovering into content) */
  closeDelay?: number;
}

export const DeFiTooltip: React.FC<DeFiTooltipProps> = ({
  termKey,
  title,
  shortDefinition,
  detailedExplanation,
  docsUrl,
  position = 'top',
  children,
  showIcon = false,
  className = '',
  closeDelay = 200,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const tooltipId = useId();

  // Retrieve glossary term fallback if termKey provided
  const glossaryItem: GlossaryTerm | undefined = termKey ? getGlossaryTerm(termKey) : undefined;

  const displayTitle = title || glossaryItem?.term || termKey || 'DeFi Term';
  const displayShortDef = shortDefinition || glossaryItem?.shortDefinition || '';
  const displayDetail = detailedExplanation || glossaryItem?.detailedExplanation || '';
  const displayDocsUrl = docsUrl || glossaryItem?.docsUrl || 'https://docs.stellarflow.network';
  const displayFormula = glossaryItem?.formula;
  const displayWarning = glossaryItem?.warningThreshold;

  // Clear pending timers
  const clearTimer = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const handleOpen = () => {
    clearTimer();
    setIsOpen(true);
  };

  const handleClose = () => {
    clearTimer();
    closeTimerRef.current = setTimeout(() => {
      setIsOpen(false);
    }, closeDelay);
  };

  // Keyboard accessibility: Escape key dismissal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => clearTimer();
  }, []);

  // Position styling classes
  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }[position];

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 -mt-1 border-t-slate-800 dark:border-t-slate-900 border-x-transparent border-b-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 -mb-1 border-b-slate-800 dark:border-b-slate-900 border-x-transparent border-t-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 -ml-1 border-l-slate-800 dark:border-l-slate-900 border-y-transparent border-r-transparent',
    right: 'right-full top-1/2 -translate-y-1/2 -mr-1 border-r-slate-800 dark:border-r-slate-900 border-y-transparent border-l-transparent',
  }[position];

  return (
    <span className={`relative inline-flex items-center ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex items-center gap-1 font-medium underline decoration-dotted decoration-sky-400 underline-offset-4 cursor-help focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1 rounded transition-colors hover:text-sky-500 text-inherit"
        onMouseEnter={handleOpen}
        onMouseLeave={handleClose}
        onFocus={handleOpen}
        onBlur={handleClose}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-describedby={isOpen ? tooltipId : undefined}
      >
        {children || displayTitle}
        {showIcon && (
          <HelpCircle className="w-3.5 h-3.5 opacity-70 hover:opacity-100 transition-opacity text-sky-500" />
        )}
      </button>

      {/* Tooltip Overlay */}
      {isOpen && (
        <div
          ref={tooltipRef}
          id={tooltipId}
          role="dialog"
          aria-label={`${displayTitle} definition`}
          className={`absolute z-50 w-72 sm:w-80 p-4 rounded-xl shadow-2xl bg-slate-900 text-slate-100 border border-slate-700/80 text-xs sm:text-sm animate-in fade-in zoom-in-95 duration-150 ${positionClasses}`}
          onMouseEnter={handleOpen}
          onMouseLeave={handleClose}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-2 mb-2">
            <span className="font-semibold text-slate-100 flex items-center gap-1.5 text-sm">
              <BookOpen className="w-4 h-4 text-sky-400 shrink-0" />
              {displayTitle}
            </span>
            {glossaryItem?.category && (
              <span className="text-[10px] uppercase font-mono tracking-wider px-1.5 py-0.5 rounded bg-slate-800 text-sky-300 border border-slate-700">
                {glossaryItem.category}
              </span>
            )}
          </div>

          {/* Body */}
          <div className="space-y-2 text-slate-300 leading-relaxed">
            <p className="font-medium text-slate-200">{displayShortDef}</p>
            {displayDetail && <p className="text-xs text-slate-400">{displayDetail}</p>}

            {/* Formula box if present */}
            {displayFormula && (
              <div className="p-2 rounded bg-slate-950 font-mono text-[11px] text-sky-300 border border-slate-800/80 overflow-x-auto">
                {displayFormula}
              </div>
            )}

            {/* Warning callout if present */}
            {displayWarning && (
              <div className="flex items-start gap-1.5 p-2 rounded bg-amber-950/40 text-amber-300 text-[11px] border border-amber-800/50">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
                <span>{displayWarning}</span>
              </div>
            )}
          </div>

          {/* Footer Knowledge Base Link */}
          <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between">
            <a
              href={displayDocsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-xs font-semibold text-sky-400 hover:text-sky-300 hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-400 rounded px-1 transition-colors"
              aria-label={`Learn more about ${displayTitle} in the knowledge base`}
            >
              <span>Learn more in Knowledge Base</span>
              <ExternalLink className="w-3.5 h-3.5 ml-1 shrink-0" />
            </a>
          </div>

          {/* Pointer Arrow */}
          <div className={`absolute w-0 h-0 border-4 ${arrowClasses}`} aria-hidden="true" />
        </div>
      )}
    </span>
  );
};

export default DeFiTooltip;
