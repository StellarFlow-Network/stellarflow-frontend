"use client";

import React, { Suspense } from "react";
import { PushNotificationProvider } from "./PushNotificationProvider";

/**
 * Suspense boundary required by Next.js when using useSearchParams.
 */
export function PushNotificationRoot({
  children,
  walletAddress,
}: {
  children: React.ReactNode;
  walletAddress?: string | null;
}) {
  return (
    <Suspense fallback={<>{children}</>}>
      <PushNotificationProvider walletAddress={walletAddress}>
        {children}
      </PushNotificationProvider>
    </Suspense>
  );
}

export default PushNotificationRoot;
