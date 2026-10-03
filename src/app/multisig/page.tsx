import React from "react";
import { parseMultisigApprovalParams } from "@/services/multisigNotifications";
import { MultisigDesk } from "./MultisigDesk";

/**
 * Multi-signature desk.
 *
 * Reads `?filter=pending&request=<id>` on the server and hands it to the client
 * desk, so the co-signer notification badge / push click (#962) can deep link
 * straight into the approval queue without losing server rendering.
 */
export default async function MultisigPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { filter, requestId } = parseMultisigApprovalParams(await searchParams);

  return <MultisigDesk initialFilter={filter} highlightRequestId={requestId} />;
}
