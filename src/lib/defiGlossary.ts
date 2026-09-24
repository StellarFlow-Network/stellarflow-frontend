export interface GlossaryTerm {
  id: string;
  term: string;
  shortDefinition: string;
  detailedExplanation: string;
  category: 'trading' | 'oracles' | 'lending' | 'liquidity' | 'soroban';
  docsUrl: string;
  learnMoreText?: string;
  formula?: string;
  warningThreshold?: string;
}

export const DEFI_GLOSSARY: Record<string, GlossaryTerm> = {
  slippage: {
    id: 'slippage',
    term: 'Slippage',
    shortDefinition: 'Difference between expected trade execution price and actual settlement price.',
    detailedExplanation:
      'Slippage occurs when market liquidity changes or when large orders move the order book before your transaction settles on the Stellar network.',
    category: 'trading',
    docsUrl: 'https://docs.stellarflow.network/glossary/slippage',
    learnMoreText: 'Learn about slippage tolerance settings',
    formula: 'Slippage % = |Expected Price - Executed Price| / Expected Price * 100',
    warningThreshold: 'High slippage (>1.0%) increases vulnerability to front-running.',
  },
  twap: {
    id: 'twap',
    term: 'TWAP (Time-Weighted Average Price)',
    shortDefinition: 'Average asset price calculated across discrete time intervals to resist price manipulation.',
    detailedExplanation:
      'TWAP oracles aggregate exchange rates over rolling time windows, preventing single-block flash loan exploits or sudden price spikes from distorting valuation metrics.',
    category: 'oracles',
    docsUrl: 'https://docs.stellarflow.network/glossary/twap',
    learnMoreText: 'Read about StellarFlow TWAP oracle design',
    formula: 'TWAP = ∑(Price_t * Δt) / Total_Time',
  },
  'impermanent-loss': {
    id: 'impermanent-loss',
    term: 'Impermanent Loss',
    shortDefinition: 'Temporary loss of value experienced by liquidity providers due to price divergence.',
    detailedExplanation:
      'Occurs when the price ratio of pooled assets changes compared to when they were deposited into an automated market maker (AMM) pool. It becomes permanent only upon withdrawal.',
    category: 'liquidity',
    docsUrl: 'https://docs.stellarflow.network/glossary/impermanent-loss',
    learnMoreText: 'Calculate potential impermanent loss scenarios',
    warningThreshold: 'Higher volatility between paired tokens leads to higher impermanent loss risk.',
  },
  'health-factor': {
    id: 'health-factor',
    term: 'Health Factor',
    shortDefinition: 'Safety metric indicating collateralization coverage of your borrowed assets.',
    detailedExplanation:
      'Determines the liquidation safety margin for open credit positions. A health factor above 1.0 indicates safe collateralization; falling below 1.0 triggers automated liquidation.',
    category: 'lending',
    docsUrl: 'https://docs.stellarflow.network/glossary/health-factor',
    learnMoreText: 'Learn how health factor liquidation works',
    formula: 'Health Factor = (Collateral Value * Liquidation Threshold) / Total Borrowed Value',
    warningThreshold: 'A Health Factor < 1.15 is considered high risk for liquidation.',
  },
  apy: {
    id: 'apy',
    term: 'APY (Annual Percentage Yield)',
    shortDefinition: 'Real annual rate of return earned on investments including compounding interest.',
    detailedExplanation:
      'Reflects the total annualized return earned on staked assets or liquidity pool deposits, accounting for interest compounding frequency over 365 days.',
    category: 'liquidity',
    docsUrl: 'https://docs.stellarflow.network/glossary/apy',
    learnMoreText: 'Understand yield compounding mechanics',
  },
  tvl: {
    id: 'tvl',
    term: 'TVL (Total Value Locked)',
    shortDefinition: 'Aggregate USD value of all assets deposited in protocol smart contracts.',
    detailedExplanation:
      'Measures protocol liquidity depth and market adoption across liquidity pools, yield vaults, and collateralized escrow contracts.',
    category: 'liquidity',
    docsUrl: 'https://docs.stellarflow.network/glossary/tvl',
    learnMoreText: 'View protocol-wide TVL analytics',
  },
  'soroban-budget': {
    id: 'soroban-budget',
    term: 'Soroban Resource Budget',
    shortDefinition: 'Execution CPU instruction and RAM memory limits for Soroban smart contracts.',
    detailedExplanation:
      'Stellar Soroban smart contracts consume execution CPU instructions and read/write ledger entries bounded by strict resource quotas per transaction.',
    category: 'soroban',
    docsUrl: 'https://docs.stellarflow.network/glossary/soroban-budget',
    learnMoreText: 'Explore Soroban transaction metering',
  },
  'gas-fee': {
    id: 'gas-fee',
    term: 'Base Network Fee (Gas)',
    shortDefinition: 'Micro-payment in XLM required to process on-chain operations on Stellar.',
    detailedExplanation:
      'Network transaction fee paid to validators to prevent network spam and include operations in Stellar ledgers.',
    category: 'soroban',
    docsUrl: 'https://docs.stellarflow.network/glossary/gas-fee',
    learnMoreText: 'Learn about Stellar fee metering',
  },
};

/**
 * Retrieve a glossary term by key or return a fallback object.
 */
export function getGlossaryTerm(termId: string): GlossaryTerm | undefined {
  if (!termId) return undefined;
  const key = termId.toLowerCase().trim();
  return DEFI_GLOSSARY[key];
}

/**
 * Search the glossary by query string.
 */
export function searchGlossary(query: string): GlossaryTerm[] {
  if (!query) return Object.values(DEFI_GLOSSARY);
  const q = query.toLowerCase().trim();
  return Object.values(DEFI_GLOSSARY).filter(
    (item) =>
      item.term.toLowerCase().includes(q) ||
      item.shortDefinition.toLowerCase().includes(q) ||
      item.detailedExplanation.toLowerCase().includes(q)
  );
}

/**
 * Get all available glossary terms.
 */
export function getAllGlossaryTerms(): GlossaryTerm[] {
  return Object.values(DEFI_GLOSSARY);
}
