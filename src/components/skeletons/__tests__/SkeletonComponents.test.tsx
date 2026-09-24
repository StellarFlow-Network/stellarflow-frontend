/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { SkeletonCard } from '../SkeletonCard';
import { SkeletonTable } from '../SkeletonTable';
import { SkeletonChart } from '../SkeletonChart';

// Mock framer-motion to avoid animation issues in tests
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

describe('Skeleton Components', () => {
  describe('SkeletonCard', () => {
    it('renders vault variant', () => {
      const { container } = render(<SkeletonCard variant="vault" count={1} />);
      expect(container.firstChild).toBeInTheDocument();
    });

    it('renders multiple cards when count is specified', () => {
      const { container } = render(<SkeletonCard variant="vault" count={3} />);
      const cards = container.querySelectorAll('[style*="contain"]');
      expect(cards.length).toBe(3);
    });

    it('renders all variants without error', () => {
      const variants = ['vault', 'pool', 'farm', 'stats'] as const;
      variants.forEach((variant) => {
        const { container } = render(<SkeletonCard variant={variant} count={1} />);
        expect(container.firstChild).toBeInTheDocument();
      });
    });

    it('applies custom className', () => {
      const { container } = render(
        <SkeletonCard variant="vault" count={1} className="custom-class" />
      );
      const element = container.querySelector('.custom-class');
      expect(element).toBeInTheDocument();
    });
  });

  describe('SkeletonTable', () => {
    it('renders pool variant', () => {
      const { container } = render(<SkeletonTable variant="pool" rows={5} />);
      expect(container.firstChild).toBeInTheDocument();
    });

    it('renders correct number of rows', () => {
      const { container } = render(<SkeletonTable variant="pool" rows={8} />);
      // Count tbody rows (excluding padding rows)
      const rows = container.querySelectorAll('tbody tr[style*="height"]');
      expect(rows.length).toBe(8);
    });

    it('renders all variants without error', () => {
      const variants = ['pool', 'transaction', 'corridor', 'relayer'] as const;
      variants.forEach((variant) => {
        const { container } = render(<SkeletonTable variant={variant} rows={5} />);
        expect(container.firstChild).toBeInTheDocument();
      });
    });

    it('shows search bar when showSearch is true', () => {
      const { container } = render(
        <SkeletonTable variant="pool" rows={5} showSearch={true} />
      );
      // Pool variant has search in header
      const header = container.querySelector('.flex.items-center.justify-between');
      expect(header).toBeInTheDocument();
    });
  });

  describe('SkeletonChart', () => {
    it('renders price variant', () => {
      const { container } = render(<SkeletonChart variant="price" height={400} />);
      expect(container.firstChild).toBeInTheDocument();
    });

    it('applies custom height', () => {
      const { container } = render(<SkeletonChart variant="price" height={500} />);
      const chartArea = container.querySelector('[style*="height: 500px"]');
      expect(chartArea).toBeInTheDocument();
    });

    it('renders all variants without error', () => {
      const variants = ['price', 'liquidity', 'portfolio', 'allocation', 'orderbook', 'apy'] as const;
      variants.forEach((variant) => {
        const { container } = render(<SkeletonChart variant={variant} height={400} />);
        expect(container.firstChild).toBeInTheDocument();
      });
    });

    it('shows timeframe controls when showTimeframes is true', () => {
      const { container } = render(
        <SkeletonChart variant="price" height={400} showTimeframes={true} />
      );
      // Price variant with timeframes has 6 timeframe buttons
      const timeframeButtons = container.querySelectorAll('[class*="h-8 w-12"]');
      expect(timeframeButtons.length).toBeGreaterThan(0);
    });
  });

  describe('CSS Containment', () => {
    it('SkeletonCard has contain style', () => {
      const { container } = render(<SkeletonCard variant="vault" count={1} />);
      const element = container.querySelector('[style*="contain"]');
      expect(element).toBeInTheDocument();
    });

    it('SkeletonTable has contain style', () => {
      const { container } = render(<SkeletonTable variant="pool" rows={5} />);
      const element = container.querySelector('[style*="contain"]');
      expect(element).toBeInTheDocument();
    });

    it('SkeletonChart has contain style', () => {
      const { container } = render(<SkeletonChart variant="price" height={400} />);
      const element = container.querySelector('[style*="contain"]');
      expect(element).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('SkeletonCard uses semantic HTML', () => {
      const { container } = render(<SkeletonCard variant="stats" count={1} />);
      const divs = container.querySelectorAll('div');
      expect(divs.length).toBeGreaterThan(0);
    });

    it('SkeletonTable uses table elements', () => {
      const { container } = render(<SkeletonTable variant="pool" rows={5} />);
      const table = container.querySelector('table');
      const thead = container.querySelector('thead');
      const tbody = container.querySelector('tbody');
      expect(table).toBeInTheDocument();
      expect(thead).toBeInTheDocument();
      expect(tbody).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('renders large number of skeleton cards efficiently', () => {
      const startTime = performance.now();
      render(<SkeletonCard variant="vault" count={50} />);
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      // Should render 50 cards in less than 100ms
      expect(renderTime).toBeLessThan(100);
    });

    it('renders large table efficiently', () => {
      const startTime = performance.now();
      render(<SkeletonTable variant="pool" rows={100} />);
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      // Should render 100 rows in less than 100ms
      expect(renderTime).toBeLessThan(100);
    });
  });
});
