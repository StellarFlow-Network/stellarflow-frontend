'use client';

import React from 'react';
import { DeFiTooltip, DeFiTooltipProps } from './DeFiTooltip';
import { getGlossaryTerm } from '@/lib/defiGlossary';

export interface DeFiTermProps extends Omit<DeFiTooltipProps, 'termKey'> {
  /** The glossary term identifier (e.g., 'slippage', 'twap', 'impermanent-loss', 'health-factor') */
  term: string;
}

/**
 * Convenient inline component wrapper for displaying technical DeFi metrics
 * with accessible tooltips and knowledge base links.
 *
 * @example
 * <DeFiTerm term="slippage">Max Slippage</DeFiTerm>
 * <DeFiTerm term="health-factor" position="bottom" showIcon />
 */
export const DeFiTerm: React.FC<DeFiTermProps> = ({ term, children, ...props }) => {
  const glossary = getGlossaryTerm(term);
  const label = children || glossary?.term || term;

  return (
    <DeFiTooltip termKey={term} {...props}>
      {label}
    </DeFiTooltip>
  );
};

export default DeFiTerm;
