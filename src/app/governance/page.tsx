"use client";

import React, { useState } from 'react';
import { WalletProvider, useWallet, useWalletStatus, useWalletActions } from '@/app/hooks/useWalletState';
import Icon from '@/components/icons/Icon';
import { ICON_IDS } from '@/components/icons/iconIds';
import { ProposalList, type ProposalRecord } from '@/components/governance/ProposalList';
import { DelegateDirectory } from '@/components/governance/DelegateDirectory';
import ProposalCreationModal, { type ProposalSubmission } from '@/components/governance/ProposalCreationModal';
import type { Delegate } from '@/types/delegation';

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
  const [section, setSection] = useState<'proposals' | 'delegates'>('proposals');
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'archived'>('all');
  const [voteTarget, setVoteTarget] = useState<ProposalRecord | null>(null);
  const [isProposalModalOpen, setIsProposalModalOpen] = useState(false);
  const [proposals, setProposals] = useState<ProposalRecord[]>(MOCK_PROPOSALS);
  const [walletBalance, setWalletBalance] = useState(120000);
  const minimumThreshold = 250000;

  const TABS: { key: typeof activeTab; label: string }[] = [
    { key: 'all',      label: 'All Ballots' },
    { key: 'active',   label: 'Active' },
    { key: 'archived', label: 'Archived' },
  ];

  const SECTION_SWITCHER: { key: typeof section; label: string; icon: keyof typeof ICON_IDS }[] = [
    { key: 'proposals', label: 'Proposals', icon: 'vote' },
    { key: 'delegates', label: 'Delegates', icon: 'users' },
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
      endsInLedgers: 1440,
    };

    setProposals((current) => [nextProposal, ...current]);
    setWalletBalance((current) => Math.max(0, current - 1000));
    setIsProposalModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 p-8">

      {/* Header */}
      <GovernanceWalletControl onCreateProposal={() => setIsProposalModalOpen(true)} />

      {/* Stats — context-aware based on section */}
      {section === 'proposals' ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <StatCard title="Total Staking Power" value="2.85M SF" icon={<Icon id={ICON_IDS.vote} size={20} className="text-blue-400" />} subtitle="Active voting weights" />
          <StatCard title="Active Ballots" value="2 Proposals" icon={<Icon id={ICON_IDS.clock} size={20} className="text-yellow-500" />} subtitle="Awaiting validation signatures" />
          <StatCard title="Voter Turnout Avg" value="74.2%" icon={<Icon id={ICON_IDS.users} size={20} className="text-green-400" />} subtitle="High network coordinator interest" />
          <StatCard title="Passing Invariants" value="100%" icon={<Icon id={ICON_IDS.checkCircle} size={20} className="text-emerald-400" />} subtitle="All parameters safe" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <StatCard title="Registered Delegates" value="5 Delegates" icon={<Icon id={ICON_IDS.users} size={20} className="text-blue-400" />} subtitle="Trusted community representatives" />
          <StatCard title="Total Delegated" value="5.36M XLM" icon={<Icon id={ICON_IDS.coins} size={20} className="text-yellow-500" />} subtitle="Voting power delegated" />
          <StatCard title="Avg Delegators" value="657 / Delegate" icon={<Icon id={ICON_IDS.vote} size={20} className="text-green-400" />} subtitle="Community participation" />
          <StatCard title="Proposals Voted" value="100% Coverage" icon={<Icon id={ICON_IDS.checkCircle} size={20} className="text-emerald-400" />} subtitle="All active proposals covered" />
        </div>
      )}

      {/* Section Switcher (Proposals / Delegates) */}
      <div className="flex border-b border-gray-800 mb-6 gap-6">
        {SECTION_SWITCHER.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setSection(key)}
            className={`flex items-center gap-2 pb-3 text-sm font-medium relative ${
              section === key
                ? 'text-blue-400 border-b-2 border-blue-500'
                : 'text-gray-500'
            }`}
          >
            {section !== key && (
              <span className="absolute inset-0 bg-white/4 opacity-0 hover:opacity-100 transition-opacity duration-200 pointer-events-none" />
            )}
            <Icon id={ICON_IDS[icon]} size={16} />
            <span className="relative z-10">{label}</span>
          </button>
        ))}
      </div>

      {/* Conditional Content */}
      {section === 'proposals' ? (
        <>
          {/* Proposal Filtering Tabs */}
          <div className="flex border-b border-gray-800 mb-6 gap-6">
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`pb-3 text-sm font-medium capitalize relative ${
                  activeTab === key
                    ? 'text-blue-400 border-b-2 border-blue-500'
                    : 'text-gray-500'
                }`}
              >
                {activeTab !== key && (
                  <span className="absolute inset-0 bg-white/4 opacity-0 hover:opacity-100 transition-opacity duration-200 pointer-events-none" />
                )}
                <span className="relative z-10">{label}</span>
              </button>
            ))}
          </div>

          {/* Proposal List */}
          <ProposalList proposals={proposals} filter={activeTab} />
        </>
      ) : (
        /* Delegate Directory */
        <DelegateDirectory delegates={MOCK_DELEGATES} />
      )}

      <ProposalCreationModal
        isOpen={isProposalModalOpen}
        onClose={() => setIsProposalModalOpen(false)}
        onSubmit={handleProposalSubmit}
        walletBalance={walletBalance}
        minimumThreshold={minimumThreshold}
      />

    </div>
  );
}

// --- Sub-components ---
function StatCard({ title, value, icon, subtitle }: { title: string, value: string, icon: React.ReactNode, subtitle: string }) {
  return (
    <div className="bg-[#161b22] border border-gray-800 p-6 rounded-xl">
      <div className="flex justify-between items-start mb-2">
        <span className="text-gray-400 text-sm font-medium">{title}</span>
        {icon}
      </div>
      <div className="text-2xl font-bold mb-1 tracking-tight">{value}</div>
      <div className="text-xs text-gray-500">{subtitle}</div>
    </div>
  );
}
