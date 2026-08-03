/**
 * Unit tests for the beneficiary banking-domain library (#535).
 * Run: node --experimental-strip-types --test src/lib/beneficiaries.test.ts
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  COUNTRY_BANKING_RULES,
  isValidIban,
  isValidAccountNumber,
  isValidRoutingCode,
  isValidSwiftBic,
  validateBeneficiary,
  addBeneficiary,
  removeBeneficiary,
  clearBeneficiaries,
  loadSavedBeneficiaries,
  BENEFICIARIES_STORAGE_KEY,
} from "./beneficiaries.ts";

test("isValidIban accepts a structurally valid GB IBAN", () => {
  // Valid GB29 NWBK 6016 1331 9268 19 (reference IBAN).
  assert.equal(isValidIban("GB29 NWBK 6016 1331 9268 19", 22), true);
});

test("isValidIban rejects wrong-length and invalid-checksum IBANs", () => {
  assert.equal(isValidIban("GB29 NWBK 6016 1331 9268 1", 22), false);
  assert.equal(isValidIban("GB29NWBK60161331926810", 22), false);
  assert.equal(isValidIban("", 22), false);
});

test("isValidAccountNumber enforces country length bounds and digits-only", () => {
  const ng = COUNTRY_BANKING_RULES.NG;
  assert.equal(isValidAccountNumber("0123456789", ng), true);
  assert.equal(isValidAccountNumber("12345", ng), false); // too short
  assert.equal(isValidAccountNumber("12345678901", ng), false); // too long
  assert.equal(isValidAccountNumber("01234A6789", ng), false); // non-digit
});

test("isValidRoutingCode requires 3-9 digits", () => {
  assert.equal(isValidRoutingCode("021000021"), true);
  assert.equal(isValidRoutingCode("12"), false);
  assert.equal(isValidRoutingCode("abc123"), false);
});

test("isValidSwiftBic accepts 8 and 11 character BICs", () => {
  assert.equal(isValidSwiftBic("CHASGB2L"), true);
  assert.equal(isValidSwiftBic("DEUTDEFF500"), true);
  assert.equal(isValidSwiftBic("short"), false);
  assert.equal(isValidSwiftBic("1234"), false);
});

test("validateBeneficiary: valid US beneficiary passes", () => {
  const err = validateBeneficiary({
    country: "US",
    accountHolderName: "Jane Doe",
    accountNumber: "1234567890",
    routingCode: "021000021",
    asset: "USDC",
  });
  assert.equal(err, null);
});

test("validateBeneficiary: US beneficiary requires routing code", () => {
  const err = validateBeneficiary({
    country: "US",
    accountHolderName: "Jane Doe",
    accountNumber: "1234567890",
    asset: "USDC",
  });
  assert.equal(err, "routing_required");
});

test("validateBeneficiary: GB beneficiary requires valid IBAN + SWIFT", () => {
  const missingIban = validateBeneficiary({
    country: "GB",
    accountHolderName: "Jane Doe",
    asset: "USDC",
  });
  assert.equal(missingIban, "iban_required");

  const invalidSwift = validateBeneficiary({
    country: "GB",
    accountHolderName: "Jane Doe",
    iban: "GB29 NWBK 6016 1331 9268 19",
    swiftBic: "BAD",
    asset: "USDC",
  });
  assert.equal(invalidSwift, "swift_invalid");
});

test("validateBeneficiary: country and name are required", () => {
  assert.equal(validateBeneficiary({ accountHolderName: "X", asset: "USDC" }), "country_required");
  assert.equal(
    validateBeneficiary({ country: "US", accountNumber: "1234567890", asset: "USDC" }),
    "name_required",
  );
});

test("addBeneficiary persists and dedups by country + account", () => {
  clearBeneficiaries();
  const one: Parameters<typeof addBeneficiary>[0] = {
    country: "US",
    accountHolderName: "Jane Doe",
    accountNumber: "1234567890",
    routingCode: "021000021",
    asset: "USDC",
    createdAt: Date.now(),
  };
  const afterAdd = addBeneficiary(one);
  assert.equal(afterAdd.length, 1);

  const duplicate = addBeneficiary({ ...one });
  assert.equal(duplicate.length, 1, "duplicate account must be deduped");

  const another: typeof one = {
    ...one,
    accountNumber: "0987654321",
  };
  assert.equal(addBeneficiary(another).length, 2);
  assert.equal(loadSavedBeneficiaries().length, 2);
});

test("removeBeneficiary removes by index and clear wipes everything", () => {
  clearBeneficiaries();
  const one: Parameters<typeof addBeneficiary>[0] = {
    country: "NG",
    accountHolderName: "Ada",
    accountNumber: "0123456789",
    routingCode: "058",
    asset: "USDC",
    createdAt: Date.now(),
  };
  addBeneficiary(one);
  addBeneficiary({ ...one, accountNumber: "9876543210" });
  assert.equal(removeBeneficiary(0).length, 1);
  clearBeneficiaries();
  assert.equal(loadSavedBeneficiaries().length, 0);
});

test("storage key is namespaced for beneficiaries", () => {
  assert.equal(BENEFICIARIES_STORAGE_KEY, "stellarflow.beneficiaries.v1");
});
