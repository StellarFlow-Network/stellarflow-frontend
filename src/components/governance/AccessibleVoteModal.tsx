'use client';

import React, { useEffect, useRef } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

export interface AccessibleVoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function AccessibleVoteModal({
  isOpen,
  onClose,
  title = 'Cast Governance Vote',
  children,
}: AccessibleVoteModalProps) {
  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-modal="true"
          aria-labelledby="accessible-vote-modal-title"
          className="fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] rounded-xl border border-gray-800 bg-[#0d1117] p-6 text-gray-100 shadow-2xl focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          <div className="flex items-center justify-between border-b border-gray-800 pb-4 mb-4">
            <DialogPrimitive.Title
              id="accessible-vote-modal-title"
              className="text-lg font-bold text-gray-100"
            >
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <button
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-800 hover:text-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </DialogPrimitive.Close>
          </div>
          <div className="space-y-4">
            {children}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
