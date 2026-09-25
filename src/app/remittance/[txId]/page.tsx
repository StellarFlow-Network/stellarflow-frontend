import { notFound } from "next/navigation";
import RemittanceStatusClient from "./RemittanceStatusClient";

/**
 * RemittanceStatusPage  —  /remittance/[txId]
 *
 * Server component wrapper required by `output: export`: it provides
 * `generateStaticParams()` (which a "use client" page cannot export) and
 * hands the resolved transaction id to the presentational client shell.
 *
 * Static export cannot enumerate arbitrary transaction ids, so the
 * documented demo transaction is the prerendered instance of this route.
 */

interface RemittanceStatusPageProps {
  params: Promise<{ txId: string }>;
}

export function generateStaticParams() {
  return [{ txId: "abc123ef" }];
}

export default async function RemittanceStatusPage({
  params,
}: RemittanceStatusPageProps) {
  const { txId } = await params;

  // Reject obviously invalid IDs early (< 4 chars or > 128 chars)
  if (!txId || txId.length < 4 || txId.length > 128) {
    notFound();
  }

  return <RemittanceStatusClient txId={txId} />;
}
