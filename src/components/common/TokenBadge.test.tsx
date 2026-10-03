import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TokenBadge } from './TokenBadge';
import type { TokenBadgeProps } from './TokenBadge';

describe('TokenBadge', () => {
  const mockAsset = {
    symbol: 'USDC',
    name: 'USD Coin',
    verified: false,
    contractId: 'CA7QYNF3GTFY5N6ZVQVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
  };

  const defaultProps: TokenBadgeProps = {
    asset: mockAsset,
    contractAddress: 'CA7QYNF3GTFY5N6ZVQVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
    issuerPublicKey: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOPQRST',
  };

  // ─────────────────────────────────────────────────────────────────────────
  // POSITIVE TESTS: Valid inputs render correctly
  // ─────────────────────────────────────────────────────────────────────────

  it('renders with valid logo URL', () => {
    const props: TokenBadgeProps = {
      ...defaultProps,
      logoUrl: 'https://example.com/usdc.png',
    };
    render(<TokenBadge {...props} />);

    const img = screen.getByAltText('USDC logo');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', expect.stringContaining('usdc.png'));
  });

  it('renders verification checkmark for verified assets', () => {
    const props: TokenBadgeProps = {
      ...defaultProps,
      asset: { ...mockAsset, verified: true },
    };
    render(<TokenBadge {...props} />);

    const badge = screen.getByLabelText('Protocol-verified asset');
    expect(badge).toBeInTheDocument();
  });

  it('does not render verification checkmark for unverified assets', () => {
    const props: TokenBadgeProps = {
      ...defaultProps,
      asset: { ...mockAsset, verified: false },
    };
    render(<TokenBadge {...props} />);

    const badge = screen.queryByLabelText('Protocol-verified asset');
    expect(badge).not.toBeInTheDocument();
  });

  it('renders cross-chain network badges when chainOrigins provided', () => {
    const props: TokenBadgeProps = {
      ...defaultProps,
      chainOrigins: ['ethereum', 'polygon'],
    };
    render(<TokenBadge {...props} />);

    expect(screen.getByLabelText('Ethereum network badge')).toBeInTheDocument();
    expect(screen.getByLabelText('Polygon network badge')).toBeInTheDocument();
  });

  it('displays tooltip with contract address on trigger click', async () => {
    const props: TokenBadgeProps = {
      ...defaultProps,
      contractAddress: 'CA7QYNF3GTFY5N6ZVQVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
    };
    render(<TokenBadge {...props} />);

    const trigger = screen.getByRole('button', {
      expanded: false,
    });
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText('Contract Address')).toBeInTheDocument();
      expect(
        screen.getByText('CA7QYNF3GTFY5N6ZVQVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV'),
      ).toBeInTheDocument();
    });
  });

  it('displays tooltip with issuer public key', async () => {
    const props: TokenBadgeProps = {
      ...defaultProps,
      issuerPublicKey:
        'GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOPQRST',
    };
    render(<TokenBadge {...props} />);

    const trigger = screen.getByRole('button', {
      expanded: false,
    });
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText('Issuer Public Key')).toBeInTheDocument();
      expect(
        screen.getByText('GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOPQRST'),
      ).toBeInTheDocument();
    });
  });

  it('renders symbol and name in badge text', () => {
    render(<TokenBadge {...defaultProps} />);

    expect(screen.getByText('USDC')).toBeInTheDocument();
    expect(screen.getByText('USD Coin')).toBeInTheDocument();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // NEGATIVE TESTS: Fallback behavior for missing/broken inputs
  // ─────────────────────────────────────────────────────────────────────────

  it('renders initials fallback when logoUrl is not provided', () => {
    const props: TokenBadgeProps = {
      ...defaultProps,
      logoUrl: undefined,
    };
    render(<TokenBadge {...props} />);

    const fallback = screen.getByLabelText('USDC fallback icon');
    expect(fallback).toBeInTheDocument();
  });

  it('renders initials fallback on image error', async () => {
    const props: TokenBadgeProps = {
      ...defaultProps,
      logoUrl: 'https://example.com/broken.png',
    };
    render(<TokenBadge {...props} />);

    const img = screen.getByAltText('USDC logo') as HTMLImageElement;
    fireEvent.error(img);

    await waitFor(() => {
      const fallback = screen.getByLabelText('USDC fallback icon');
      expect(fallback).toBeInTheDocument();
    });
  });

  it('maintains fixed container size for fallback icon (no layout shift)', () => {
    const props: TokenBadgeProps = {
      ...defaultProps,
      logoUrl: undefined,
      size: 'md',
    };
    render(<TokenBadge {...props} />);

    const fallback = screen.getByLabelText('USDC fallback icon').parentElement;
    const style = window.getComputedStyle(fallback!);

    // Fixed size container (32px for md size)
    expect(fallback).toHaveStyle('width: 32px');
    expect(fallback).toHaveStyle('height: 32px');
  });

  it('does not render cross-chain badges when chainOrigins is empty', () => {
    const props: TokenBadgeProps = {
      ...defaultProps,
      chainOrigins: [],
    };
    render(<TokenBadge {...props} />);

    expect(
      screen.queryByLabelText(/network badge/i),
    ).not.toBeInTheDocument();
  });

  it('does not render cross-chain badges when chainOrigins is undefined', () => {
    const props: TokenBadgeProps = {
      ...defaultProps,
      chainOrigins: undefined,
    };
    render(<TokenBadge {...props} />);

    expect(
      screen.queryByLabelText(/network badge/i),
    ).not.toBeInTheDocument();
  });

  it('does not render contract address section in tooltip when contractAddress is undefined', async () => {
    const props: TokenBadgeProps = {
      ...defaultProps,
      contractAddress: undefined,
      issuerPublicKey: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOPQRST',
    };
    render(<TokenBadge {...props} />);

    const trigger = screen.getByRole('button', {
      expanded: false,
    });
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(
        screen.queryByText('Contract Address'),
      ).not.toBeInTheDocument();
      expect(
        screen.getByText('Issuer Public Key'),
      ).toBeInTheDocument();
    });
  });

  it('displays fallback message when neither contractAddress nor issuerPublicKey provided', async () => {
    const props: TokenBadgeProps = {
      ...defaultProps,
      contractAddress: undefined,
      issuerPublicKey: undefined,
    };
    render(<TokenBadge {...props} />);

    const trigger = screen.getByRole('button', {
      expanded: false,
    });
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(
        screen.getByText(
          'No contract address or issuer data available',
        ),
      ).toBeInTheDocument();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // BOUNDARY TESTS: Edge cases
  // ─────────────────────────────────────────────────────────────────────────

  it('truncates contract address in badge display to 4 head + 4 tail', () => {
    const props: TokenBadgeProps = {
      ...defaultProps,
      contractAddress: 'CA7QYNF3GTFY5N6ZVQVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
    };
    render(<TokenBadge {...props} />);

    // Truncated display in badge: CA7Q…VVVV
    expect(screen.getByText('CA7Q…VVVV')).toBeInTheDocument();
  });

  it('displays full untruncated contract address in tooltip', async () => {
    const fullAddress = 'CA7QYNF3GTFY5N6ZVQVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV';
    const props: TokenBadgeProps = {
      ...defaultProps,
      contractAddress: fullAddress,
    };
    render(<TokenBadge {...props} />);

    const trigger = screen.getByRole('button', {
      expanded: false,
    });
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(fullAddress)).toBeInTheDocument();
    });
  });

  it('supports all size variants (sm, md, lg)', () => {
    const { rerender } = render(
      <TokenBadge {...defaultProps} size="sm" />,
    );
    expect(screen.getByLabelText('USDC fallback icon')).toBeInTheDocument();

    rerender(<TokenBadge {...defaultProps} size="md" />);
    expect(screen.getByLabelText('USDC fallback icon')).toBeInTheDocument();

    rerender(<TokenBadge {...defaultProps} size="lg" />);
    expect(screen.getByLabelText('USDC fallback icon')).toBeInTheDocument();
  });

  it('handles up to 2 chain badges, shows +N indicator for more', () => {
    const props: TokenBadgeProps = {
      ...defaultProps,
      chainOrigins: ['ethereum', 'polygon', 'bsc', 'stellar'],
    };
    render(<TokenBadge {...props} />);

    expect(screen.getByLabelText('Ethereum network badge')).toBeInTheDocument();
    expect(screen.getByLabelText('Polygon network badge')).toBeInTheDocument();
    expect(
      screen.queryByLabelText('BSC network badge'),
    ).not.toBeInTheDocument();
    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // REGRESSION TESTS: Accessibility and interaction patterns
  // ─────────────────────────────────────────────────────────────────────────

  it('provides aria-label for fallback icon', () => {
    render(<TokenBadge {...defaultProps} logoUrl={undefined} />);

    expect(
      screen.getByLabelText('USDC fallback icon'),
    ).toBeInTheDocument();
  });

  it('provides aria-expanded attribute on trigger', () => {
    render(<TokenBadge {...defaultProps} />);

    const trigger = screen.getByRole('button');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('updates aria-expanded when tooltip opens', async () => {
    render(<TokenBadge {...defaultProps} />);

    const trigger = screen.getByRole('button');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(trigger);

    await waitFor(() => {
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });
  });

  it('is keyboard accessible (focusable trigger)', () => {
    render(<TokenBadge {...defaultProps} />);

    const trigger = screen.getByRole('button');
    expect(trigger).toHaveAttribute('tabIndex', '0');
  });

  it('closes tooltip on Escape key', async () => {
    render(<TokenBadge {...defaultProps} />);

    const trigger = screen.getByRole('button');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('calls onCopy callback when address is copied', async () => {
    const mockOnCopy = jest.fn();
    const props: TokenBadgeProps = {
      ...defaultProps,
      contractAddress: 'CA7QYNF3GTFY5N6ZVQVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
      onCopy: mockOnCopy,
    };

    // Mock navigator.clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn(() => Promise.resolve()),
      },
    });

    render(<TokenBadge {...props} />);

    const trigger = screen.getByRole('button', {
      expanded: false,
    });
    fireEvent.click(trigger);

    await waitFor(() => {
      const copyBtn = screen.getByLabelText('Copy contract address');
      fireEvent.click(copyBtn);
    });

    await waitFor(() => {
      expect(mockOnCopy).toHaveBeenCalledWith(
        'CA7QYNF3GTFY5N6ZVQVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV',
        'address',
      );
    });
  });

  it('renders verification icon with correct aria-label', () => {
    const props: TokenBadgeProps = {
      ...defaultProps,
      asset: { ...mockAsset, verified: true },
    };
    render(<TokenBadge {...props} />);

    const badge = screen.getByLabelText('Protocol-verified asset');
    expect(badge).toBeInTheDocument();
  });

  it('applies custom className to wrapper', () => {
    const props: TokenBadgeProps = {
      ...defaultProps,
      className: 'custom-class',
    };
    const { container } = render(<TokenBadge {...props} />);

    const wrapper = container.firstChild;
    expect(wrapper).toHaveClass('custom-class');
  });

  it('handles custom asset symbols correctly', () => {
    const props: TokenBadgeProps = {
      asset: { symbol: 'XYZ', name: 'Test Asset', verified: false },
    };
    render(<TokenBadge {...props} />);

    expect(screen.getByText('XYZ')).toBeInTheDocument();
    expect(screen.getByText('Test Asset')).toBeInTheDocument();
  });
});
