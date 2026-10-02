// Uniswap Token List Standard Schema
// https://uniswap.org/tokenlist.schema.json

export interface TokenInfo {
  chainId: number;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
  tags?: string[];
  extensions?: Record<string, unknown>;
}

export interface TokenListVersion {
  major: number;
  minor: number;
  patch: number;
}

export interface TokenList {
  name: string;
  timestamp: string;
  version: TokenListVersion;
  tokens: TokenInfo[];
  keywords?: string[];
  tags?: Record<string, { name: string; description: string }>;
  logoURI?: string;
}

export interface TokenListMetadata {
  id: string;
  url: string;
  name: string;
  enabled: boolean;
  lastSynced: string | null;
  tokenCount: number;
  isDefault?: boolean;
}

export interface TokenListValidationError {
  field: string;
  message: string;
}
