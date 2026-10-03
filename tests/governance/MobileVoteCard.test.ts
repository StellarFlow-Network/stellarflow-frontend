import { describe, expect, it } from "vitest";
import type {
  MobileVoteCardProposal,
  MobileVoteSubmission,
  VoteChoice,
} from "@/components/governance/MobileVoteCard";

describe("MobileVoteCard Data Contract and Calculations", () => {
  const mockProposal: MobileVoteCardProposal = {
    id: "SFP-12",
    title: "Whitelist West African GHS/XLM Asset Pair Feed",
    description: "Enable automated oracle aggregation and high-throughput corridors",
    proposer: "GA5THZLKMNPQRSXYZABCDEFGHIJKLMNBC9A",
    status: "Active",
    votesFor: 785000,
    votesAgainst: 120000,
    quorumThreshold: 60,
    endsInLedgers: 4200,
  };

  it("calculates vote percentages accurately", () => {
    const totalVotes = (mockProposal.votesFor ?? 0) + (mockProposal.votesAgainst ?? 0);
    expect(totalVotes).toBe(905000);

    const forPercentage = ((mockProposal.votesFor ?? 0) / totalVotes) * 100;
    const againstPercentage = ((mockProposal.votesAgainst ?? 0) / totalVotes) * 100;

    expect(forPercentage).toBeCloseTo(86.74, 1);
    expect(againstPercentage).toBeCloseTo(13.26, 1);
    expect(forPercentage + againstPercentage).toBeCloseTo(100, 5);
  });

  it("calculates DAO quorum impact percentage correctly", () => {
    const votingPower = 12450;
    const totalStakingPower = 2850000;
    const impactPercentage = (votingPower / totalStakingPower) * 100;

    expect(impactPercentage).toBeCloseTo(0.4368, 2);
    expect(Number(impactPercentage.toFixed(2))).toBe(0.44);
  });

  it("handles whale voting power calculations", () => {
    const whaleVotingPower = 500000;
    const totalStakingPower = 2850000;
    const impactPercentage = (whaleVotingPower / totalStakingPower) * 100;

    expect(impactPercentage).toBeCloseTo(17.54, 2);
  });

  it("formats vote submission record properly", () => {
    const submission: MobileVoteSubmission = {
      proposalId: mockProposal.id,
      voteChoice: "For",
      votingPower: 12450,
      gasFeeXLM: "0.000015",
      transactionHash: "0x" + "a".repeat(64),
      timestamp: new Date().toISOString(),
    };

    expect(submission.proposalId).toBe("SFP-12");
    expect(submission.voteChoice).toBe<VoteChoice>("For");
    expect(submission.votingPower).toBeGreaterThan(0);
    expect(submission.gasFeeXLM).toMatch(/^\d+\.\d+$/);
    expect(submission.transactionHash).toHaveLength(66);
    expect(Date.parse(submission.timestamp)).not.toBeNaN();
  });

  it("validates swipe threshold trigger condition", () => {
    const maxDragX = 260; // example slider track width minus thumb
    const thresholdPercentage = 0.8;
    const requiredThresholdX = maxDragX * thresholdPercentage;

    const dragBelowThreshold = 180;
    const dragAboveThreshold = 220;

    expect(dragBelowThreshold / maxDragX < thresholdPercentage).toBe(true);
    expect(dragAboveThreshold / maxDragX >= thresholdPercentage).toBe(true);
    expect(requiredThresholdX).toBe(208);
  });
});
