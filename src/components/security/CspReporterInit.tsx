"use client";

import { useEffect } from "react";
import { initCspReporter } from "@/utils/cspReporter";

/**
 * CspReporterInit — Client component mounting the CSP securitypolicyviolation listener.
 * Mounts at the root of the application so any CSP violation triggered across
 * any route is caught silently and reported to /api/v1/security/csp-report.
 */
export function CspReporterInit() {
  useEffect(() => {
    initCspReporter();
  }, []);

  return null;
}

export default CspReporterInit;
