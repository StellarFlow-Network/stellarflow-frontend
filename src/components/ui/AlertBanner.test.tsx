import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AlertBanner, DEFAULT_ALERT } from './AlertBanner';

describe('AlertBanner', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders top-anchored maintenance banner with alert details', () => {
    render(<AlertBanner alert={DEFAULT_ALERT} />);
    expect(screen.getByText(/RPC Maintenance Scheduled/i)).toBeInTheDocument();
    expect(screen.getByText(/Stellar Horizon RPC nodes/i)).toBeInTheDocument();
  });

  it('dismisses banner and persists dismissed alert ID in localStorage', () => {
    render(<AlertBanner alert={DEFAULT_ALERT} />);
    const dismissBtn = screen.getByRole('button', { name: /dismiss alert banner/i });
    fireEvent.click(dismissBtn);

    expect(screen.queryByText(/RPC Maintenance Scheduled/i)).not.toBeInTheDocument();

    const stored = JSON.parse(localStorage.getItem('stellarflow_dismissed_alerts') || '[]');
    expect(stored).toContain(DEFAULT_ALERT.id);
  });
});
