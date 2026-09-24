import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DeFiTooltip } from '../DeFiTooltip';
import { getGlossaryTerm } from '@/lib/defiGlossary';

describe('DeFiTooltip Accessibility Component', () => {
  it('renders trigger button with correct ARIA attributes', () => {
    render(<DeFiTooltip termKey="slippage">Max Slippage</DeFiTooltip>);

    const trigger = screen.getByRole('button', { name: /max slippage/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
  });

  it('opens tooltip overlay on mouseenter and updates ARIA attributes', async () => {
    render(<DeFiTooltip termKey="slippage">Slippage</DeFiTooltip>);

    const trigger = screen.getByRole('button', { name: /slippage/i });
    fireEvent.mouseEnter(trigger);

    await waitFor(() => {
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
    });

    const glossaryItem = getGlossaryTerm('slippage');
    expect(screen.getByText(glossaryItem!.shortDefinition)).toBeInTheDocument();
  });

  it('renders Knowledge Base direct documentation link inside overlay', async () => {
    render(<DeFiTooltip termKey="twap">TWAP</DeFiTooltip>);

    const trigger = screen.getByRole('button', { name: /twap/i });
    fireEvent.mouseEnter(trigger);

    await waitFor(() => {
      const link = screen.getByRole('link', { name: /learn more about twap \(time-weighted average price\) in the knowledge base/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(link).toHaveAttribute('href', 'https://docs.stellarflow.network/glossary/twap');
    });
  });

  it('dismisses tooltip on Escape key press', async () => {
    render(<DeFiTooltip termKey="health-factor">Health Factor</DeFiTooltip>);

    const trigger = screen.getByRole('button', { name: /health factor/i });
    fireEvent.mouseEnter(trigger);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });
  });
});
