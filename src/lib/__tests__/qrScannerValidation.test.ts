import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseAndValidateStellarQR } from "../qrScannerValidation.ts";

describe("QRScannerModal Stellar QR Code Parser & Validator (#912)", () => {
  const VALID_PUBKEY = "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ";
  const VALID_MUXED = "MA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAAAAAAAAAAAZQU7Y";
  const VALID_FEDERATION = "alice*stellarflow.io";

  it("validates and extracts standard Stellar public key (G...)", () => {
    const result = parseAndValidateStellarQR(VALID_PUBKEY);
    assert.equal(result.valid, true);
    assert.equal(result.data?.destination, VALID_PUBKEY);
  });

  it("validates and extracts Muxed account (M...)", () => {
    const result = parseAndValidateStellarQR(VALID_MUXED);
    assert.equal(result.valid, true);
    assert.equal(result.data?.destination, VALID_MUXED);
  });

  it("validates and extracts Federation address", () => {
    const result = parseAndValidateStellarQR(VALID_FEDERATION);
    assert.equal(result.valid, true);
    assert.equal(result.data?.destination, VALID_FEDERATION);
  });

  it("parses valid SEP-07 payment URI with query parameters", () => {
    const uri = `web+stellar:pay?destination=${VALID_PUBKEY}&amount=50.25&asset_code=USDC&asset_issuer=${VALID_PUBKEY}&memo=Invoice1234&memo_type=text`;
    const result = parseAndValidateStellarQR(uri);
    assert.equal(result.valid, true);
    assert.equal(result.data?.destination, VALID_PUBKEY);
    assert.equal(result.data?.amount, "50.25");
    assert.equal(result.data?.assetCode, "USDC");
    assert.equal(result.data?.assetIssuer, VALID_PUBKEY);
    assert.equal(result.data?.memo, "Invoice1234");
    assert.equal(result.data?.memoType, "text");
  });

  it("rejects SEP-07 URI with invalid destination", () => {
    const badUri = "web+stellar:pay?destination=INVALID_ADDRESS&amount=10";
    const result = parseAndValidateStellarQR(badUri);
    assert.equal(result.valid, false);
    assert.ok(result.error?.includes("invalid Stellar destination"));
  });

  it("rejects arbitrary invalid non-Stellar string", () => {
    const randomString = "https://example.com/not-a-stellar-code";
    const result = parseAndValidateStellarQR(randomString);
    assert.equal(result.valid, false);
    assert.ok(result.error?.includes("does not contain a valid Stellar address"));
  });

  it("rejects empty or whitespace string", () => {
    const result = parseAndValidateStellarQR("   ");
    assert.equal(result.valid, false);
    assert.ok(result.error?.includes("Empty QR code"));
  });
});
