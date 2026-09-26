/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import {
  IdenticonAvatar,
  IDENTICON_SIZE_PX,
  IDENTICON_GRID,
  fnv1a32,
  generateIdenticonPalette,
  buildIdenticonMatrix,
  meetsWcagAaOnDark,
} from './IdenticonAvatar';

const ADDRESS_A = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM';
const ADDRESS_B = 'CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB3QY';

describe('IdenticonAvatar', () => {
  describe('determinism', () => {
    it('produces identical SVG markup for the same address', () => {
      const { container: first } = render(<IdenticonAvatar address={ADDRESS_A} />);
      const { container: second } = render(<IdenticonAvatar address={ADDRESS_A} />);
      expect(first.innerHTML).toBe(second.innerHTML);
    });

    it('produces different markup for different addresses', () => {
      const { container: first } = render(<IdenticonAvatar address={ADDRESS_A} />);
      const { container: second } = render(<IdenticonAvatar address={ADDRESS_B} />);
      expect(first.innerHTML).not.toBe(second.innerHTML);
    });

    it('generates a stable hash for a given input', () => {
      expect(fnv1a32(ADDRESS_A)).toBe(fnv1a32(ADDRESS_A));
      expect(fnv1a32(ADDRESS_A)).not.toBe(fnv1a32(ADDRESS_B));
    });

    it('builds a mirrored, deterministic matrix', () => {
      const matrix = buildIdenticonMatrix(ADDRESS_A);
      expect(matrix).toHaveLength(IDENTICON_GRID);
      matrix.forEach((row) => {
        expect(row).toHaveLength(IDENTICON_GRID);
        // Horizontal mirror symmetry.
        expect(row).toEqual([...row].reverse());
      });
      expect(buildIdenticonMatrix(ADDRESS_A)).toEqual(matrix);
    });
  });

  describe('sizes', () => {
    it('maps named presets to the documented pixel dimensions', () => {
      expect(IDENTICON_SIZE_PX).toEqual({ sm: 16, md: 24, lg: 40 });
    });

    it.each([
      ['sm', 16],
      ['md', 24],
      ['lg', 40],
    ] as const)('renders %s at %dpx', (size, px) => {
      render(<IdenticonAvatar address={ADDRESS_A} size={size} />);
      const svg = screen.getByTestId('identicon-avatar');
      expect(svg).toHaveAttribute('width', String(px));
      expect(svg).toHaveAttribute('height', String(px));
    });

    it('defaults to md (24px)', () => {
      render(<IdenticonAvatar address={ADDRESS_A} />);
      expect(screen.getByTestId('identicon-avatar')).toHaveAttribute('width', '24');
    });
  });

  describe('initial overlay', () => {
    it('renders no text overlay by default', () => {
      render(<IdenticonAvatar address={ADDRESS_A} />);
      expect(screen.queryByTestId('identicon-initial')).not.toBeInTheDocument();
    });

    it('renders the uppercased first character of the initial', () => {
      render(<IdenticonAvatar address={ADDRESS_A} initial="usdc" />);
      expect(screen.getByTestId('identicon-initial')).toHaveTextContent('U');
    });
  });

  describe('accessibility & rendering', () => {
    it('exposes an accessible label', () => {
      render(<IdenticonAvatar address={ADDRESS_A} aria-label="USDC asset avatar" />);
      expect(screen.getByRole('img', { name: 'USDC asset avatar' })).toBeInTheDocument();
    });

    it('renders inline SVG without any external image request', () => {
      const { container } = render(<IdenticonAvatar address={ADDRESS_A} />);
      expect(container.querySelector('svg')).toBeInTheDocument();
      expect(container.querySelector('img')).toBeNull();
    });
  });

  describe('WCAG contrast', () => {
    it('keeps foreground colours AA-compliant against the dark UI background', () => {
      const addresses = [ADDRESS_A, ADDRESS_B, 'CXYZ', 'asset-1', 'asset-2', 'asset-3'];
      addresses.forEach((address) => {
        const palette = generateIdenticonPalette(address);
        expect(meetsWcagAaOnDark(palette)).toBe(true);
      });
    });

    it('is deterministic for the same address', () => {
      expect(generateIdenticonPalette(ADDRESS_A)).toEqual(
        generateIdenticonPalette(ADDRESS_A),
      );
    });
  });
});
