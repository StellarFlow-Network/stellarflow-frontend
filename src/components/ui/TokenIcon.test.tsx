import React from 'react';
import { render, screen } from '@testing-library/react';
import { TokenIcon } from './TokenIcon';

describe('TokenIcon', () => {
  it('renders SVG fallback when no src is provided', () => {
    render(<TokenIcon symbol="XLM" size={32} />);
    const fallback = screen.getByLabelText(/XLM fallback icon/i);
    expect(fallback).toBeInTheDocument();
  });

  it('renders image component when src is provided', () => {
    const testSrc = 'https://assets.coingecko.com/coins/images/100/small/stellar.png';
    render(<TokenIcon src={testSrc} alt="Stellar XLM" size={24} />);
    const img = screen.getByAltText(/Stellar XLM/i);
    expect(img).toBeInTheDocument();
  });
});
