'use client';

import React, { memo, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FaWallet, FaBell, FaCircleUser, FaRightFromBracket } from 'react-icons/fa6';
import { useProgressBar } from './TopLoadingBar';

const Nav = memo(() => {
  const hasAnomaly = true;
  const router = useRouter();

  const handleConnectWallet = useCallback(async () => {
    start();
    await new Promise((resolve) => setTimeout(resolve, 1200));
    done();
    alert('Connect Wallet clicked! (Add your Web3 logic here)');
  }, []);

  return (
    <main className="sticky top-0 z-50 bg-zinc-950 border-b border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        
        {/* Left Side: Logo + Title */}
        <div className="flex items-center gap-3">
          {/* StellarFlow Logo*/}
          <div className="shrink-0">
            <Image
              src="/sf.png"
              alt="StellarFlow Logo"
              width={48}
              height={48}
              className="rounded-full object-contain"
              priority
            />
          </div>

          {/* Title */}
          <h1 className="text-lg sm:text-2xl md:text-3xl font-bold tracking-tighter leading-none">
            Impact Oracle:{' '}
            <span className="text-[#99DC1B]">Africa</span>
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleConnectWallet}
            className="wallet-btn group flex items-center gap-2.5 sm:gap-3 
                       px-5 sm:px-7 py-3 rounded-2xl font-semibold 
                       text-sm sm:text-base transition-all duration-300 
                       hover:shadow-xl active:scale-95 whitespace-nowrap"
          >
            <Wallet className="w-5 h-5 transition-transform group-hover:rotate-12" />
            <span>Connect <span className='max-md:hidden'>Wallet</span></span>
          </button>

          <button
            aria-label="System anomaly alerts"
            className="relative p-2 rounded-xl hover:bg-zinc-800 transition-colors"
            onClick={() => alert('View current system anomalies (implement dashboard logic)')}
          >
            <Bell className="w-6 h-6 text-slate-200" />
            {hasAnomaly && (
              <span className="absolute -top-1 -right-1 inline-flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600" />
              </span>
            )}
          </button>

          <Link
            href="/admin/settings"
            prefetch={false}
            onMouseEnter={() => router.prefetch('/admin/settings')}
            aria-label="Admin settings"
            className="p-2 rounded-xl hover:bg-zinc-800 transition-colors"
          >
            <CircleUser className="w-6 h-6 text-slate-200" />
          </Link>

          <button
            aria-label="Sign out"
            className="p-2 rounded-xl hover:bg-zinc-800 transition-colors"
            onClick={() => alert('Sign out (implement)')}
          >
            <LogOut className="w-6 h-6 text-slate-200" />
          </button>
        </div>

      </div>
    </main>
);

export default memo(Nav);