"use client";

import React, { use } from "react";
import RemittanceTrackingPage from "@/components/remittance/RemittanceTrackingPage";

interface PageProps {
  params: Promise<{ referenceId: string }>;
}

export default function AppRemittanceTrackingPage({ params }: PageProps) {
  const resolvedParams = use(params);
  return <RemittanceTrackingPage />;
}
