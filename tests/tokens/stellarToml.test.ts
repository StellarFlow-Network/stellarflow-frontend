import { describe, expect, it } from "vitest";
import {
  normalizeStellarDomain,
  parseStellarTomlCurrencies,
} from "@/lib/stellarToml";

describe("Stellar TOML asset resolution helpers", () => {
  it("normalizes a bare domain to an HTTPS hostname", () => {
    expect(normalizeStellarDomain("UltraStellar.com")).toBe("ultrastellar.com");
  });

  it("rejects non-HTTPS and path-based asset domains", () => {
    expect(() => normalizeStellarDomain("http://example.com")).toThrow(/HTTPS/);
    expect(() => normalizeStellarDomain("example.com/assets")).toThrow(/without a path/);
  });

  it("parses official currency metadata and ignores unrelated sections", () => {
    const currencies = parseStellarTomlCurrencies(`
[DOCUMENTATION]
ORG_NAME = "Example issuer"

[[CURRENCIES]]
code = "USD"
issuer = "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWXYZ23"
image = "https://assets.example.com/usd.png"
`);

    expect(currencies).toEqual([{
      code: "USD",
      issuer: "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWXYZ23",
      image: "https://assets.example.com/usd.png",
    }]);
  });
});
