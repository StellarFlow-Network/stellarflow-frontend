'use client';

import { useState } from 'react';
import Image from 'next/image';

type TokenIconProps = {
  src?: string;
  alt?: string;
  size?: number;
  symbol?: string;
  className?: string;
};

export function TokenIcon({
  src,
  alt = 'Token logo',
  size = 24,
  symbol = 'XLM',
  className = '',
}: TokenIconProps) {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`inline-flex shrink-0 items-center justify-center rounded-full bg-slate-200 font-mono text-[10px] font-bold text-slate-700 ${className}`}
        aria-label={`${symbol} fallback icon`}
      >
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="h-full w-full p-1"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v12M6 12h12" />
        </svg>
      </div>
    );
  }

  return (
    <div
      style={{ width: size, height: size }}
      className={`relative inline-block shrink-0 overflow-hidden rounded-full bg-slate-100 ${className}`}
    >
      <Image
        src={src}
        alt={alt}
        width={size}
        height={size}
        quality={90}
        onError={() => setHasError(true)}
        className="h-full w-full object-cover transition-opacity duration-200"
      />
    </div>
  );
}
