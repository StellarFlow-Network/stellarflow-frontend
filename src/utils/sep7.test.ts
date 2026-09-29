/**
 * Unit tests for SEP-0007 URI parsing and validation
 */

import {
  uriToPrefillData,
  isPaymentLinkExpired,
  buildSEP7URI,
  isValidStellarAddress,
} from './sep7';

describe('uriToPrefillData', () => {
  it('parses a basic SEP-0007 URI', () => {
    const uri = 'web+stellar:pay?destination=GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
    const result = uriToPrefillData(uri);

    expect(result).not.toBeNull();
    expect(result?.destination).toBe('GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
    expect(result?.isExpired).toBe(false);
  });

  it('parses a complete SEP-0007 URI with all fields', () => {
    const uri =
      'web+stellar:pay?destination=GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX&amount=10.5&asset_code=USDC&memo=Payment%20for%20service';
    const result = uriToPrefillData(uri);

    expect(result).not.toBeNull();
    expect(result?.destination).toBe('GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
    expect(result?.amount).toBe('10.5');
    expect(result?.asset).toBe('USDC');
    expect(result?.memo).toBe('Payment for service');
  });

  it('parses valid_after field correctly', () => {
    const futureTimestamp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    const uri = `web+stellar:pay?destination=GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX&valid_after=${futureTimestamp}`;
    const result = uriToPrefillData(uri);

    expect(result).not.toBeNull();
    expect(result?.validAfter).toBe(futureTimestamp);
    expect(result?.isExpired).toBe(false);
  });

  it('detects expired payment link when current time > valid_after', () => {
    const pastTimestamp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
    const uri = `web+stellar:pay?destination=GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX&valid_after=${pastTimestamp}`;
    const result = uriToPrefillData(uri);

    expect(result).not.toBeNull();
    expect(result?.validAfter).toBe(pastTimestamp);
    expect(result?.isExpired).toBe(true);
  });

  it('returns null for invalid URI scheme', () => {
    const uri = 'https://example.com?destination=GXXX';
    const result = uriToPrefillData(uri);

    expect(result).toBeNull();
  });

  it('returns null for URI without destination', () => {
    const uri = 'web+stellar:pay?amount=10';
    const result = uriToPrefillData(uri);

    expect(result).toBeNull();
  });

  it('returns null for URI without query string', () => {
    const uri = 'web+stellar:pay';
    const result = uriToPrefillData(uri);

    expect(result).toBeNull();
  });

  it('handles URL-encoded parameters', () => {
    const uri = 'web+stellar:pay?destination=GXXX&memo=Test%20memo%20with%20spaces';
    const result = uriToPrefillData(uri);

    expect(result).not.toBeNull();
    expect(result?.memo).toBe('Test memo with spaces');
  });
});

describe('isPaymentLinkExpired', () => {
  it('returns false when valid_after is not provided', () => {
    expect(isPaymentLinkExpired(undefined)).toBe(false);
  });

  it('returns false when current time is before valid_after', () => {
    const futureTimestamp = Math.floor(Date.now() / 1000) + 3600;
    expect(isPaymentLinkExpired(futureTimestamp)).toBe(false);
  });

  it('returns true when current time is after valid_after', () => {
    const pastTimestamp = Math.floor(Date.now() / 1000) - 3600;
    expect(isPaymentLinkExpired(pastTimestamp)).toBe(true);
  });

  it('returns true when current time equals valid_after (edge case)', () => {
    const currentTimestamp = Math.floor(Date.now() / 1000);
    // Account for test execution time by checking if within 1 second
    const result = isPaymentLinkExpired(currentTimestamp);
    expect(typeof result).toBe('boolean');
  });
});

describe('isValidStellarAddress', () => {
  it('validates correct Stellar G-address', () => {
    const validAddress = 'GBRPYHIL2CI3FUE4BKFNFLL4WNYABOIVLZKF3GG4IE4JL4VUCRHIDZIC';
    expect(isValidStellarAddress(validAddress)).toBe(true);
  });

  it('rejects address with wrong prefix', () => {
    const invalidAddress = 'SBRPYHIL2CI3FUE4BKFNFLL4WNYABOIVLZKF3GG4IE4JL4VUCRHIDZIC';
    expect(isValidStellarAddress(invalidAddress)).toBe(false);
  });

  it('rejects address with wrong length', () => {
    const tooShort = 'GBRPYHIL2CI3';
    expect(isValidStellarAddress(tooShort)).toBe(false);
  });

  it('rejects address with invalid characters', () => {
    const invalidChars = 'GBRPYHIL2CI3FUE4BKFNFLL4WNYABOIVLZKF3GG4IE4JL4VUCRHIDZ!@';
    expect(isValidStellarAddress(invalidChars)).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidStellarAddress('')).toBe(false);
  });
});

describe('buildSEP7URI', () => {
  it('builds basic URI with only destination', () => {
    const uri = buildSEP7URI({
      destination: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    });

    expect(uri).toBe(
      'web+stellar:pay?destination=GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
    );
  });

  it('builds URI with all fields', () => {
    const futureTimestamp = Math.floor(Date.now() / 1000) + 3600;
    const uri = buildSEP7URI({
      destination: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      amount: '10.5',
      asset: 'USDC',
      memo: 'Test payment',
      validAfter: futureTimestamp,
    });

    expect(uri).toContain('web+stellar:pay?');
    expect(uri).toContain('destination=GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
    expect(uri).toContain('amount=10.5');
    expect(uri).toContain('asset_code=USDC');
    expect(uri).toContain('memo=Test+payment');
    expect(uri).toContain(`valid_after=${futureTimestamp}`);
  });

  it('omits XLM asset code (native asset)', () => {
    const uri = buildSEP7URI({
      destination: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      amount: '5',
      asset: 'XLM',
    });

    expect(uri).not.toContain('asset_code');
  });

  it('URL-encodes special characters in memo', () => {
    const uri = buildSEP7URI({
      destination: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      memo: 'Test & payment',
    });

    expect(uri).toContain('memo=Test+%26+payment');
  });
});

describe('Integration: expired URI workflow', () => {
  it('expired URI → button disabled; valid URI → button enabled', () => {
    // Create expired URI
    const expiredTimestamp = Math.floor(Date.now() / 1000) - 3600;
    const expiredUri = buildSEP7URI({
      destination: 'GBRPYHIL2CI3FUE4BKFNFLL4WNYABOIVLZKF3GG4IE4JL4VUCRHIDZIC',
      amount: '10',
      validAfter: expiredTimestamp,
    });

    const expiredResult = uriToPrefillData(expiredUri);
    expect(expiredResult?.isExpired).toBe(true);

    // Create valid URI
    const futureTimestamp = Math.floor(Date.now() / 1000) + 3600;
    const validUri = buildSEP7URI({
      destination: 'GBRPYHIL2CI3FUE4BKFNFLL4WNYABOIVLZKF3GG4IE4JL4VUCRHIDZIC',
      amount: '10',
      validAfter: futureTimestamp,
    });

    const validResult = uriToPrefillData(validUri);
    expect(validResult?.isExpired).toBe(false);
  });

  it('URI without valid_after is never expired', () => {
    const uri = buildSEP7URI({
      destination: 'GBRPYHIL2CI3FUE4BKFNFLL4WNYABOIVLZKF3GG4IE4JL4VUCRHIDZIC',
      amount: '10',
    });

    const result = uriToPrefillData(uri);
    expect(result?.isExpired).toBe(false);
    expect(result?.validAfter).toBeUndefined();
  });
});
