"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { parseMultisigApprovalParams } from "@/services/multisigNotifications";
import { MultisigDesk } from "./MultisigDesk";

/**
 * Multi-signature desk.
 *
 * Reads `?filter=pending&request=<id>` on the server and hands it to the client
 * desk, so the co-signer notification badge / push click (#962) can deep link
 * straight into the approval queue without losing server rendering.
 */
function MultisigPageContent() {
  const searchParams = useSearchParams();
  const { filter, requestId } = parseMultisigApprovalParams(searchParams.toString());

  return <MultisigDesk initialFilter={filter} highlightRequestId={requestId} />;
}

export default function MultisigPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#071016]" />}>
      <MultisigPageContent />
    </Suspense>
  );
}
