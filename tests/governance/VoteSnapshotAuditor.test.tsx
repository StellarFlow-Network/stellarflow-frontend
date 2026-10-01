import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  VoteSnapshotAuditor,
  explorerLedgerUrl,
  computeVotingPowerBreakdown,
  hasVotingPower,
  formatVotingPower,
} from '@/components/governance/VoteSnapshotAuditor';

const ADDRESS = 'GA5THZLKMNPQRSXYZABCDEFGHIJKLMNBC9A';

describe('VoteSnapshotAuditor helpers', () => {
  it('builds StellarExpert ledger URLs for each network', () => {
    expect(explorerLedgerUrl('testnet', 12345)).toBe(
      'https://stellar.expert/explorer/testnet/ledger/12345',
    );
    expect(explorerLedgerUrl('mainnet', 42)).toBe(
      'https://stellar.expert/explorer/public/ledger/42',
    );
    expect(explorerLedgerUrl('public', 42)).toBe(
      'https://stellar.expert/explorer/public/ledger/42',
    );
  });

  it('computes owned + delegated and clamps invalid values', () => {
    expect(computeVotingPowerBreakdown({ owned: 100, delegated: 50 })).toEqual({
      owned: 100,
      delegated: 50,
      total: 150,
    });
    expect(computeVotingPowerBreakdown({ owned: -10, delegated: undefined })).toEqual({
      owned: 0,
      delegated: 0,
      total: 0,
    });
    expect(computeVotingPowerBreakdown({})).toEqual({ owned: 0, delegated: 0, total: 0 });
  });

  it('reports whether a snapshot confers any voting power', () => {
    expect(hasVotingPower({ total: 1 })).toBe(true);
    expect(hasVotingPower({ total: 0 })).toBe(false);
  });

  it('formats voting power with grouping', () => {
    expect(formatVotingPower(1234567.891)).toBe('1,234,567.89');
  });
});

describe('VoteSnapshotAuditor', () => {
  const fetchMock = vi.fn();
  const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    delete process.env.NEXT_PUBLIC_API_URL;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalApiUrl === undefined) {
      delete process.env.NEXT_PUBLIC_API_URL;
    } else {
      process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
    }
  });

  it('queries the indexer and renders the owned/delegated breakdown', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ owned: 100, delegated: 50 }),
    });

    render(
      <VoteSnapshotAuditor
        address={ADDRESS}
        snapshotLedger={12345}
        network="testnet"
        indexerUrl="https://indexer.example/"
      />,
    );

    expect(await screen.findByTestId('snapshot-breakdown')).toBeInTheDocument();
    expect(screen.getByTestId('snapshot-owned')).toHaveTextContent('100');
    expect(screen.getByTestId('snapshot-delegated')).toHaveTextContent('50');
    expect(screen.getByTestId('snapshot-total')).toHaveTextContent('150');

    // Trailing slash in the base URL must not produce a doubled slash.
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toBe(
      `https://indexer.example/governance/voting-power?address=${encodeURIComponent(ADDRESS)}&ledger=12345`,
    );
  });

  it('shows the zero-voting-power explanation when the snapshot is zero', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ owned: 0, delegated: 0 }),
    });

    render(
      <VoteSnapshotAuditor
        address={ADDRESS}
        snapshotLedger={777}
        indexerUrl="https://indexer.example"
      />,
    );

    const zero = await screen.findByTestId('snapshot-zero');
    expect(zero).toHaveTextContent(/0 voting power/i);
    expect(screen.queryByTestId('snapshot-breakdown')).not.toBeInTheDocument();
  });

  it('surfaces an error and can retry', async () => {
    fetchMock.mockRejectedValueOnce(new Error('boom'));

    render(
      <VoteSnapshotAuditor
        address={ADDRESS}
        snapshotLedger={1}
        indexerUrl="https://indexer.example"
      />,
    );

    expect(await screen.findByTestId('snapshot-error')).toHaveTextContent('boom');

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ owned: 5, delegated: 5 }),
    });
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(await screen.findByTestId('snapshot-breakdown')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('degrades gracefully when no indexer is configured', async () => {
    render(<VoteSnapshotAuditor address={ADDRESS} snapshotLedger={9} indexerUrl="" />);

    expect(await screen.findByTestId('snapshot-unavailable')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('links to the snapshot ledger on StellarExpert', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ owned: 1, delegated: 0 }),
    });

    render(
      <VoteSnapshotAuditor
        address={ADDRESS}
        snapshotLedger={424242}
        network="mainnet"
        indexerUrl="https://indexer.example"
      />,
    );

    const link = screen.getByTestId('snapshot-explorer-link');
    expect(link).toHaveAttribute(
      'href',
      'https://stellar.expert/explorer/public/ledger/424242',
    );
  });
});
