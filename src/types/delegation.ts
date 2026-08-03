export interface DelegateVoteRecord {
  proposalId: string;
  proposalTitle: string;
  voteType: 'For' | 'Against' | 'Abstain';
  votingPower: number;
  timestamp: string;
  transactionHash: string;
}

export interface Delegate {
  id: string;
  name: string;
  address: string;
  /** HTML-safe platform statement or mission description */
  platformStatement: string;
  /** Total XLM delegated to this delegate by the community */
  totalDelegatedPower: number;
  /** Number of unique delegators */
  delegatorCount: number;
  /** Recent voting history (most recent first) */
  votingHistory: DelegateVoteRecord[];
  /** Categorisation tags for filtering */
  tags: string[];
  /** ISO date string when the delegate registered */
  joinedAt: string;
  /** Optional avatar / image URL */
  avatarUrl?: string;
}

export interface DelegationTransactionPayload {
  delegateAddress: string;
  /** Amount of XLM voting weight to delegate */
  amount: string;
}

export type DelegateDirectoryFilter = 'all' | 'infrastructure' | 'community' | 'security' | 'governance';
