import { NextResponse } from 'next/server';
import crypto from 'crypto';
import * as secretManager from '@/lib/secretManager';
import { logReloadEvent } from '@/lib/auditLogger';

/**
 * POST /admin/reload-secret
 *
 * Verifies the admin bearer token using timing-safe comparison, then triggers
 * a hot reload of the Stellar secret key from the configured key source.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 7.1
 */
export async function POST(request: Request): Promise<Response> {
  // ── Auth verification (Requirements 4.2, 4.3) ────────────────────────────
  const authHeader = request.headers.get('Authorization');
  const expectedToken = process.env.ADMIN_RELOAD_TOKEN ?? '';

  // Extract bearer token from header
  const bearerPrefix = 'Bearer ';
  const providedToken =
    authHeader && authHeader.startsWith(bearerPrefix)
      ? authHeader.slice(bearerPrefix.length)
      : null;

  // Reject immediately if token is missing or if the expected token is not configured
  if (!providedToken || expectedToken.length === 0) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Timing-safe comparison to prevent token enumeration attacks
  const providedBuf = Buffer.from(providedToken);
  const expectedBuf = Buffer.from(expectedToken);

  // Buffers must be the same length for timingSafeEqual; length mismatch → reject
  const tokensMatch =
    providedBuf.length === expectedBuf.length &&
    crypto.timingSafeEqual(providedBuf, expectedBuf);

  if (!tokensMatch) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Admin identity (use a masked token prefix as identity) ───────────────
  const adminIdentity =
    providedToken.length > 4
      ? `${providedToken.slice(0, 4)}****`
      : 'admin';

  // ── Trigger reload (Requirements 4.4, 4.5, 4.6) ─────────────────────────
  const timestamp = new Date().toISOString();
  const result = await secretManager.reloadFromSource();

  if (result.success) {
    logReloadEvent({
      timestamp,
      adminIdentity,
      outcome: 'success',
    });

    return NextResponse.json(
      { message: 'Key reloaded successfully', timestamp },
      { status: 200 }
    );
  } else {
    const reason = result.reason;

    logReloadEvent({
      timestamp,
      adminIdentity,
      outcome: 'failure',
      failureReason: reason,
    });

    return NextResponse.json(
      { error: `Reload failed: ${reason}`, timestamp },
      { status: 500 }
    );
  }
}
