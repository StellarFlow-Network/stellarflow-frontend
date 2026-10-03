export interface ProposalVote {
  id: string;
  voter: string;
  proposalId: string;
  voteType: 'For' | 'Against' | 'Abstain';
  votingPower: number;
  timestamp: string;
  transactionHash: string;
  status: 'confirmed' | 'pending' | 'failed';
}

export interface Proposal {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'passed' | 'rejected' | 'pending';
  startDate: string;
  endDate: string;
  totalVotesFor: number;
  totalVotesAgainst: number;
  totalVotingPower: number;
}