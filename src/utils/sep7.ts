/**
 * SEP-0007 Stellar URI Parser
 * 
 * Parses Stellar payment URIs according to SEP-0007 specification:
 * web+stellar:pay?destination=<address>&amount=<amount>&asset=<asset>&memo=<memo>&valid_after=<timestamp>
 * 
 * Reference: https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0007.md
 */

export interface SEP7PaymentData {
  destination: string;
  amount?: string;
  asset?: string;
  memo?: string;
  memoType?: string;
  validAfter?: number; // Unix timestamp in seconds
  isExpired: boolean;
}

/**
 * Parse a SEP-0007 URI into prefill data for payment forms
 * 
 * @param uri - The SEP-0007 URI string (e.g., "web+stellar:pay?destination=G...")
 * @returns Parsed payment data or null if invalid
 */
export function uriToPrefillData(uri: string): SEP7PaymentData | null {
  try {
    // Check if it's a valid SEP-0007 URI
    if (!uri.startsWith('web+stellar:pay')) {
      return null;
    }

    // Extract the query string
    const queryStart = uri.indexOf('?');
    if (queryStart === -1) {
      return null;
    }

    const queryString = uri.substring(queryStart + 1);
    const params = new URLSearchParams(queryString);

    // Destination is required
    const destination = params.get('destination');
    if (!destination) {
      return null;
    }

    // Parse optional fields
    const amount = params.get('amount') || undefined;
    const asset = params.get('asset_code') || params.get('asset') || 'XLM';
    const memo = params.get('memo') || undefined;
    const memoType = params.get('memo_type') || undefined;
    const validAfterStr = params.get('valid_after');

    // Parse valid_after timestamp
    let validAfter: number | undefined;
    let isExpired = false;

    if (validAfterStr) {
      validAfter = parseInt(validAfterStr, 10);
      
      // Check if the link has expired
      // valid_after means the payment is only valid AFTER this time
      // If current time is PAST valid_after, it has expired
      if (!isNaN(validAfter)) {
        const currentTime = Math.floor(Date.now() / 1000); // Current Unix timestamp
        isExpired = currentTime > validAfter;
      }
    }

    return {
      destination,
      amount,
      asset,
      memo,
      memoType,
      validAfter,
      isExpired,
    };
  } catch (error) {
    console.error('Failed to parse SEP-0007 URI:', error);
    return null;
  }
}

/**
 * Check if a SEP-0007 payment link has expired
 * 
 * @param validAfter - Unix timestamp in seconds
 * @returns true if expired, false otherwise
 */
export function isPaymentLinkExpired(validAfter?: number): boolean {
  if (!validAfter) {
    return false;
  }

  const currentTime = Math.floor(Date.now() / 1000);
  return currentTime > validAfter;
}

/**
 * Format a Unix timestamp for display
 * 
 * @param timestamp - Unix timestamp in seconds
 * @returns Formatted date string
 */
export function formatExpiryTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString();
}

/**
 * Validate a Stellar public key (G-address)
 * 
 * @param address - The address to validate
 * @returns true if valid, false otherwise
 */
export function isValidStellarAddress(address: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(address);
}

/**
 * Build a SEP-0007 URI from payment data
 * 
 * @param data - Payment data
 * @returns SEP-0007 URI string
 */
export function buildSEP7URI(data: {
  destination: string;
  amount?: string;
  asset?: string;
  memo?: string;
  memoType?: string;
  validAfter?: number;
}): string {
  const params = new URLSearchParams();
  
  params.set('destination', data.destination);
  
  if (data.amount) {
    params.set('amount', data.amount);
  }
  
  if (data.asset && data.asset !== 'XLM') {
    params.set('asset_code', data.asset);
  }
  
  if (data.memo) {
    params.set('memo', data.memo);
  }
  
  if (data.memoType) {
    params.set('memo_type', data.memoType);
  }
  
  if (data.validAfter) {
    params.set('valid_after', data.validAfter.toString());
  }
  
  return `web+stellar:pay?${params.toString()}`;
}
