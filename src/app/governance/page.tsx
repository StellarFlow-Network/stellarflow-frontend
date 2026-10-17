"use client";

import React, { useState, useCallback } from 'react';
import { WalletProvider, useWallet, useWalletStatus, useWalletActions } from '@/app/hooks/useWalletState';
import Icon from '@/components/icons/Icon';
import { ICON_IDS } from '@/components/icons/iconIds';
import { ProposalList, type ProposalRecord, type ProposalStatus } from '@/components/governance/ProposalList';
import { DelegateDirectory } from '@/components/governance/DelegateDirectory';
import { DelegationGraphVisualizer } from '@/components/governance/DelegationGraphVisualizer';
import ProposalCreationModal, { type ProposalSubmission } from '@/components/governance/ProposalCreationModal';
import { MobileVoteCard } from '@/components/governance/MobileVoteCard';
import type { Delegate } from '@/types/delegation';
import { ProposalCommentFeed } from '@/components/governance/ProposalCommentFeed';

// --- Mock Data ---
const MOCK_PROPOSALS: ProposalRecord[] = [
  { id: 'SFP-12', title: 'Whitelist West African GHS/XLM Asset Pair Feed', proposer: 'GA5THZLKMNPQRSXYZABCDEFGHIJKLMNBC9A', status: 'Active', votesFor: 785000, votesAgainst: 120000, quorumThreshold: 60, endsInLedgers: 4200 },
  { id: 'SFP-11', title: 'Adjust Global Deviation Threshold from 2.5% to 1.8%', proposer: 'GBC2VHZLKMNPQRSXYZABCDEFGHIJKLMLOPA', status: 'Active', votesFor: 450000, votesAgainst: 410000, quorumThreshold: 60, endsInLedgers: 1150 },
  { id: 'SFP-10', title: 'Upgrade Core Contract WASM to Release Version v1.2.0', proposer: 'GDRTVHZLKMNPQRSXYZABCDEFGHIJKLM1122', status: 'Passed', votesFor: 1200000, votesAgainst: 15000, quorumThreshold: 75, endsInLedgers: 0 },
  { id: 'SFP-09', title: 'Increase Relayer Missed-Heartbeat Penalty Weight by 2%', proposer: 'GCXXVHZLKMNPQRSXYZABCDEFGHIJKLM7766', status: 'Rejected', votesFor: 110000, votesAgainst: 920000, quorumThreshold: 50, endsInLedgers: 0 },
  { id: 'SFP-08', title: 'Deploy Oracle Aggregator Contract v2 on Mainnet', proposer: 'GAABVHZLKMNPQRSXYZABCDEFGHIJKLM3300', status: 'Executed', votesFor: 980000, votesAgainst: 22000, quorumThreshold: 75, endsInLedgers: 0 },
];

// --- Mock Delegates ---
const MOCK_DELEGATES: Delegate[] = [
  {
    id: 'del-001',
    name: 'Stellar Africa Foundation',
    address: 'GA5THZLKMNPQRSXYZABCDEFGHIJKLMNBC9A',
    platformStatement: 'Advocating for African blockchain adoption with a focus on cross-border payment rails and financial inclusion across the continent.',
    totalDelegatedPower: 1250000,
    delegatorCount: 847,
    votingHistory: [
      { proposalId: 'SFP-12', proposalTitle: 'Whitelist West African GHS/XLM Asset Pair Feed', voteType: 'For', votingPower: 1250000, timestamp: '2026-07-20T10:30:00Z', transactionHash: 'abc123def' },
      { proposalId: 'SFP-11', proposalTitle: 'Adjust Global Deviation Threshold from 2.5% to 1.8%', voteType: 'For', votingPower: 1180000, timestamp: '2026-07-15T14:00:00Z', transactionHash: 'ghi456jkl' },
      { proposalId: 'SFP-10', proposalTitle: 'Upgrade Core Contract WASM to Release Version v1.2.0', voteType: 'For', votingPower: 1220000, timestamp: '2026-07-01T08:00:00Z', transactionHash: 'mno789pqr' },
    ],
    tags: ['community', 'africa', 'governance'],
    joinedAt: '2025-03-15T00:00:00Z',
    avatarUrl: undefined,
  },
  {
    id: 'del-002',
    name: 'OracleOps Collective',
    address: 'GBC2VHZLKMNPQRSXYZABCDEFGHIJKLMLOPA',
    platformStatement: 'A team of independent oracle operators ensuring data integrity and uptime for StellarFlow price feeds. Committed to technical excellence and decentralization.',
    totalDelegatedPower: 890000,
    delegatorCount: 523,
    votingHistory: [
      { proposalId: 'SFP-11', proposalTitle: 'Adjust Global Deviation Threshold from 2.5% to 1.8%', voteType: 'Against', votingPower: 890000, timestamp: '2026-07-16T09:00:00Z', transactionHash: 'stu012vwx' },
      { proposalId: 'SFP-10', proposalTitle: 'Upgrade Core Contract WASM to Release Version v1.2.0', voteType: 'For', votingPower: 870000, timestamp: '2026-07-02T11:00:00Z', transactionHash: 'yza345bcd' },
      { proposalId: 'SFP-09', proposalTitle: 'Increase Relayer Missed-Heartbeat Penalty Weight by 2%', voteType: 'For', votingPower: 850000, timestamp: '2026-06-20T15:30:00Z', transactionHash: 'efg678hij' },
    ],
    tags: ['infrastructure', 'oracle', 'security'],
    joinedAt: '2025-06-01T00:00:00Z',
  },
  {
    id: 'del-003',
    name: 'Governance Guild Africa',
    address: 'GDRTVHZLKMNPQRSXYZABCDEFGHIJKLM1122',
    platformStatement: 'Focused on protocol governance, parameter tuning, and ensuring that African voices are represented in every on-chain vote. We research, debate, and vote.',
    totalDelegatedPower: 670000,
    delegatorCount: 412,
    votingHistory: [
      { proposalId: 'SFP-12', proposalTitle: 'Whitelist West African GHS/XLM Asset Pair Feed', voteType: 'For', votingPower: 670000, timestamp: '2026-07-21T08:00:00Z', transactionHash: 'klm901nop' },
      { proposalId: 'SFP-10', proposalTitle: 'Upgrade Core Contract WASM to Release Version v1.2.0', voteType: 'For', votingPower: 650000, timestamp: '2026-07-03T12:00:00Z', transactionHash: 'qrs234tuv' },
    ],
    tags: ['governance', 'community', 'africa'],
    joinedAt: '2025-01-10T00:00:00Z',
  },
  {
    id: 'del-004',
    name: 'NodeGuardians Security',
    address: 'GCXXVHZLKMNPQRSXYZABCDEFGHIJKLM7766',
    platformStatement: 'Security-first delegation pool. We audit every proposal for potential attack vectors, slashing risks, and contract vulnerabilities before casting our vote.',
    totalDelegatedPower: 450000,
    delegatorCount: 298,
    votingHistory: [
      { proposalId: 'SFP-11', proposalTitle: 'Adjust Global Deviation Threshold from 2.5% to 1.8%', voteType: 'Against', votingPower: 450000, timestamp: '2026-07-17T10:00:00Z', transactionHash: 'wxy567zab' },
      { proposalId: 'SFP-09', proposalTitle: 'Increase Relayer Missed-Heartbeat Penalty Weight by 2%', voteType: 'For', votingPower: 440000, timestamp: '2026-06-21T16:00:00Z', transactionHash: 'cde890fgh' },
      { proposalId: 'SFP-08', proposalTitle: 'Deploy Oracle Aggregator Contract v2 on Mainnet', voteType: 'For', votingPower: 430000, timestamp: '2026-06-10T09:00:00Z', transactionHash: 'ijk123lmn' },
    ],
    tags: ['security', 'infrastructure'],
    joinedAt: '2025-09-22T00:00:00Z',
  },
  {
    id: 'del-005',
    name: 'Pan-African Validators Union',
    address: 'GAABVHZLKMNPQRSXYZABCDEFGHIJKLM3300',
    platformStatement: 'A collective of validators across Africa working to decentralize consensus power. We believe in transparent, accountable delegation with regular community reports.',
    totalDelegatedPower: 2100000,
    delegatorCount: 1205,
    votingHistory: [
      { proposalId: 'SFP-12', proposalTitle: 'Whitelist West African GHS/XLM Asset Pair Feed', voteType: 'For', votingPower: 2100000, timestamp: '2026-07-19T14:30:00Z', transactionHash: 'opq456rst' },
      { proposalId: 'SFP-11', proposalTitle: 'Adjust Global Deviation Threshold from 2.5% to 1.8%', voteType: 'For', votingPower: 2050000, timestamp: '2026-07-14T11:00:00Z', transactionHash: 'uvw789xyz' },
      { proposalId: 'SFP-10', proposalTitle: 'Upgrade Core Contract WASM to Release Version v1.2.0', voteType: 'For', votingPower: 2080000, timestamp: '2026-07-01T07:00:00Z', transactionHash: 'abc012def' },
      { proposalId: 'SFP-09', proposalTitle: 'Increase Relayer Missed-Heartbeat Penalty Weight by 2%', voteType: 'Abstain', votingPower: 2060000, timestamp: '2026-06-19T13:00:00Z', transactionHash: 'ghi345jkl' },
      { proposalId: 'SFP-08', proposalTitle: 'Deploy Oracle Aggregator Contract v2 on Mainnet', voteType: 'For', votingPower: 2100000, timestamp: '2026-06-09T10:00:00Z', transactionHash: 'mno678pqr' },
    ],
    tags: ['community', 'africa', 'infrastructure', 'governance'],
    joinedAt: '2024-11-05T00:00:00Z',
  },
];

const GovernanceWalletControlContent = React.memo(function GovernanceWalletControlContent({
  onCreateProposal,
}: {
  onCreateProposal: () => void;
}) {
  const { wallet } = useWallet();
  const { isChecking } = useWalletStatus();
  const { refreshWalletState } = useWalletActions();

  const walletStatus = wallet?.connected
    ? wallet.publicKey
      ? `${wallet.publicKey.slice(0, 4)}...${wallet.publicKey.slice(-4)}`
      : 'Connected'
    : 'No wallet connected';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <p className="text-sm text-gray-500 mb-1">Admin / Consensus</p>
          <h1 className="text-3xl font-bold tracking-tight">Governance & Proposals</h1>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => refreshWalletState()}
            disabled={isChecking}
            className="flex items-center gap-2 bg-[#161b22] border border-gray-800 text-gray-300 px-4 py-2 rounded-lg text-sm font-medium relative overflow-hidden"
            style={{ transition: 'transform 150ms ease, box-shadow 150ms ease' }}
          >
            <span className="absolute inset-0 bg-gray-800 opacity-0 hover:opacity-100 transition-opacity duration-150 pointer-events-none" />
            <span className="relative z-10 flex items-center gap-2">
              <Icon id={ICON_IDS.wallet} size={16} className="text-purple-400" />
              {wallet?.connected ? walletStatus : 'Connect Freighter Wallet'}
            </span>
          </button>
        <button
          onClick={onCreateProposal}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium relative overflow-hidden"
          style={{ transition: 'transform 150ms ease, box-shadow 150ms ease' }}
        >
          <span className="absolute inset-0 bg-blue-700 opacity-0 transition-opacity duration-150 pointer-events-none" />
          <span className="relative z-10 flex items-center gap-2">
            <Icon id={ICON_IDS.filePlus} size={16} />
            Submit New Proposal
          </span>
        </button>
        </div>
      </div>

      <div className="mb-3 text-sm text-gray-400">
        Active wallet status: <span className="text-white">{walletStatus}</span>
      </div>
    </div>
  );
});

function GovernanceWalletControl({
  onCreateProposal,
}: {
  onCreateProposal: () => void;
}) {
  return (
    <WalletProvider>
      <GovernanceWalletControlContent onCreateProposal={onCreateProposal} />
    </WalletProvider>
  );
}

export default function GovernancePage() {
  const [section, setSection] = useState<'proposals' | 'delegates' | 'delegation-graph'>('proposals');
  const [activeTab, setActiveTab] = useState<'all' | ProposalStatus>('all');
  const [voteTarget, setVoteTarget] = useState<ProposalRecord | null>(null);
  const [isProposalModalOpen, setIsProposalModalOpen] = useState(false);
  const [proposals, setProposals] = useState<ProposalRecord[]>(MOCK_PROPOSALS);
  const [walletBalance, setWalletBalance] = useState(120000);
  const [commentTarget, setCommentTarget] = useState<ProposalRecord | null>(null);
  const minimumThreshold = 250000;

  const TABS: { key: typeof activeTab; label: string }[] = [
    { key: 'all',      label: 'All Ballots' },
    { key: 'Active',   label: 'Active' },
    { key: 'Passed',   label: 'Passed' },
    { key: 'Rejected', label: 'Rejected' },
    { key: 'Executed', label: 'Executed' },
  ];

  const SECTION_SWITCHER: { key: typeof section; label: string; icon: keyof typeof ICON_IDS }[] = [
    { key: 'proposals', label: 'Proposals', icon: 'vote' },
    { key: 'delegates', label: 'Delegates', icon: 'users' },
    { key: 'delegation-graph', label: 'Delegation Graph', icon: 'network' },
  ];

  const handleProposalSubmit = (proposal: ProposalSubmission) => {
    const nextProposal: ProposalRecord = {
      id: `SFP-${Date.now().toString().slice(-3)}`,
      title: proposal.title,
      description: proposal.description,
      proposer: 'Connected Wallet',
      status: 'Active',
      votesFor: 0,
      votesAgainst: 0,
      quorumThreshold: 60,
      endsInLedgers: 5000,
    };
    setProposals((prev) => [nextProposal, ...prev]);
    setIsProposalModalOpen(false);
  };

  const handleVote = useCallback((proposal: ProposalRecord, support: boolean) => {
    setProposals((prev) =>
      prev.map((p) =>
        p.id === proposal.id
          ? {
              ...p,
              votesFor: support ? p.votesFor + walletBalance : p.votesFor,
              votesAgainst: support ? p.votesAgainst : p.votesAgainst + walletBalance,
            }
          : p,
      ),
    );
    setVoteTarget(null);
  }, [walletBalance]);

  const filteredProposals =
    activeTab === 'all' ? proposals : proposals.filter((p) => p.status === activeTab);

  return (
    <div className="min-h-screen bg-[#0d1117] text-gray-100 p-4 md:p-8">
      <GovernanceWalletControl onCreateProposal={() => setIsProposalModalOpen(true)} />

      <div className="flex flex-wrap gap-2 mb-6">
        {SECTION_SWITCHER.map((item) => (
          <button
            key={item.key}
            onClick={() => setSection(item.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border ${
              section === item.key
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-[#161b22] border-gray-800 text-gray-300'
            }`}
          >
            <Icon id={ICON_IDS[item.icon]} size={16} />
            {item.label}
          </button>
        ))}
      </div>

      {section === 'proposals' && (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium border ${
                  activeTab === tab.key
                    ? 'bg-purple-600 border-purple-500 text-white'
                    : 'bg-[#161b22] border-gray-800 text-gray-400'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <ProposalList
            proposals={filteredProposals}
            onVote={(proposal) => setVoteTarget(proposal)}
            onComment={(proposal) => setCommentTarget(proposal)}
          />
        </>
      )}

      {section === 'delegates' && <DelegateDirectory delegates={MOCK_DELEGATES} />}

      {section === 'delegation-graph' && (
        <DelegationGraphVisualizer delegates={MOCK_DELEGATES} />
      )}

      {voteTarget && (
        <MobileVoteCard
          proposal={voteTarget}
          walletBalance={walletBalance}
          minimumThreshold={minimumThreshold}
          onVote={handleVote}
          onClose={() => setVoteTarget(null)}
        />
      )}

      {isProposalModalOpen && (
        <ProposalCreationModal
          onSubmit={handleProposalSubmit}
          onClose={() => setIsProposalModalOpen(false)}
        />
      )}

      {commentTarget && commentTarget.id && (
        <ProposalCommentFeed
          proposalId={commentTarget.id}
          proposalTitle={commentTarget.title}
          onClose={() => setCommentTarget(null)}
        />
      )}
    </div>
  );
}