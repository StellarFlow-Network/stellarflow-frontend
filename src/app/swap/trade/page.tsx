import { Asset, Networks } from "@stellar/stellar-sdk";
import SwapCard from "@/components/swap/SwapCard";
import type { TokenOption } from "@/components/swap/SwapForm";

const USDC_ISSUER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const EURT_ISSUER = "GAP5LETOV6YIE62YAM56STDANPRDO73F7ZPJNPE2L5UIDXAK66AZ7DVC";

const tokens: TokenOption[] = [
  {
    symbol: "XLM",
    name: "Stellar Lumens",
    address: Asset.native().contractId(Networks.TESTNET),
    decimals: 7,
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    address: new Asset("USDC", USDC_ISSUER).contractId(Networks.TESTNET),
    decimals: 7,
  },
  {
    symbol: "EURT",
    name: "Euro Tether",
    address: new Asset("EURT", EURT_ISSUER).contractId(Networks.TESTNET),
    decimals: 7,
  },
];

export const metadata = {
  title: "Instant Swap | StellarFlow",
  description: "Swap Stellar assets with live quotes and configurable slippage.",
};

export default function InstantSwapPage() {
  return (
    <main className="min-h-screen bg-gray-950 px-4 py-12 text-white">
      <div className="mx-auto mb-8 max-w-lg">
        <p className="text-sm font-semibold uppercase tracking-wider text-blue-400">Trade</p>
        <h1 className="mt-2 text-3xl font-bold">Instant asset swap</h1>
        <p className="mt-2 text-sm text-gray-400">
          Select assets, review the quote, and configure your slippage tolerance.
        </p>
      </div>
      <SwapCard tokens={tokens} />
    </main>
  );
}
