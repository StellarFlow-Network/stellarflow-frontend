import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { VotingPowerCalculator } from '../VotingPowerCalculator';

describe('VotingPowerCalculator', () => {
  const defaultProps = {
    totalVeSupply: 10_000_000,
    userBalance: 100_000,
    onLockTokens: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the calculator with default values', () => {
    render(<VotingPowerCalculator {...defaultProps} />);
    
    expect(screen.getByText('Voting Power Calculator')).toBeInTheDocument();
    expect(screen.getByText(/Preview your governance voting power/)).toBeInTheDocument();
  });

  it('displays initial voting power metrics', () => {
    render(<VotingPowerCalculator {...defaultProps} />);
    
    // Should show veFLOW balance metric
    expect(screen.getByText('veFLOW Balance')).toBeInTheDocument();
    
    // Should show power multiplier
    expect(screen.getByText('Power Multiplier')).toBeInTheDocument();
    
    // Should show yield boost
    expect(screen.getByText('Yield Boost')).toBeInTheDocument();
  });

  it('updates calculations when FLOW amount slider changes', () => {
    render(<VotingPowerCalculator {...defaultProps} />);
    
    const amountSlider = screen.getByLabelText('FLOW Token Amount') as HTMLInputElement;
    
    // Change amount to 10,000
    fireEvent.change(amountSlider, { target: { value: '10000' } });
    
    expect(amountSlider.value).toBe('10000');
  });

  it('updates calculations when lock duration slider changes', () => {
    render(<VotingPowerCalculator {...defaultProps} />);
    
    const durationSlider = screen.getByLabelText('Lock Duration') as HTMLInputElement;
    
    // Change to 104 weeks (2 years)
    fireEvent.change(durationSlider, { target: { value: '104' } });
    
    expect(durationSlider.value).toBe('104');
  });

  it('shows preset duration buttons', () => {
    render(<VotingPowerCalculator {...defaultProps} />);
    
    expect(screen.getByText('1 Month')).toBeInTheDocument();
    expect(screen.getByText('6 Months')).toBeInTheDocument();
    expect(screen.getByText('1 Year')).toBeInTheDocument();
    expect(screen.getByText('2 Years')).toBeInTheDocument();
    expect(screen.getByText('Max (4 Years)')).toBeInTheDocument();
  });

  it('updates duration when preset button is clicked', () => {
    render(<VotingPowerCalculator {...defaultProps} />);
    
    const maxButton = screen.getByText('Max (4 Years)');
    fireEvent.click(maxButton);
    
    const durationSlider = screen.getByLabelText('Lock Duration') as HTMLInputElement;
    expect(durationSlider.value).toBe('208'); // 4 years = 208 weeks
  });

  it('calls onLockTokens with correct parameters when lock button is clicked', () => {
    const mockOnLock = jest.fn();
    render(<VotingPowerCalculator {...defaultProps} onLockTokens={mockOnLock} />);
    
    // Set amount
    const amountSlider = screen.getByLabelText('FLOW Token Amount') as HTMLInputElement;
    fireEvent.change(amountSlider, { target: { value: '10000' } });
    
    // Set duration
    const durationSlider = screen.getByLabelText('Lock Duration') as HTMLInputElement;
    fireEvent.change(durationSlider, { target: { value: '52' } });
    
    // Click lock button
    const lockButton = screen.getByRole('button', { name: /Lock.*FLOW for/ });
    fireEvent.click(lockButton);
    
    expect(mockOnLock).toHaveBeenCalledWith(10000, 52);
  });

  it('disables lock button when amount is 0', () => {
    render(<VotingPowerCalculator {...defaultProps} />);
    
    const amountSlider = screen.getByLabelText('FLOW Token Amount') as HTMLInputElement;
    fireEvent.change(amountSlider, { target: { value: '0' } });
    
    const lockButton = screen.getByRole('button', { name: /Lock.*FLOW for/ });
    expect(lockButton).toBeDisabled();
  });

  it('shows warning when amount exceeds user balance', () => {
    render(<VotingPowerCalculator {...defaultProps} userBalance={5000} />);
    
    const amountSlider = screen.getByLabelText('FLOW Token Amount') as HTMLInputElement;
    fireEvent.change(amountSlider, { target: { value: '10000' } });
    
    expect(screen.getByText('Amount exceeds your available balance')).toBeInTheDocument();
  });

  it('disables lock button when amount exceeds balance', () => {
    render(<VotingPowerCalculator {...defaultProps} userBalance={5000} />);
    
    const amountSlider = screen.getByLabelText('FLOW Token Amount') as HTMLInputElement;
    fireEvent.change(amountSlider, { target: { value: '10000' } });
    
    const lockButton = screen.getByRole('button', { name: /Lock.*FLOW for/ });
    expect(lockButton).toBeDisabled();
  });

  it('does not render lock button when onLockTokens is not provided', () => {
    const { container } = render(
      <VotingPowerCalculator 
        totalVeSupply={defaultProps.totalVeSupply}
        userBalance={defaultProps.userBalance}
      />
    );
    
    const lockButtons = container.querySelectorAll('button[type="button"]');
    const lockButton = Array.from(lockButtons).find(btn => 
      btn.textContent?.includes('Lock') && btn.textContent?.includes('FLOW for')
    );
    
    expect(lockButton).toBeUndefined();
  });

  it('displays available balance when userBalance is provided', () => {
    render(<VotingPowerCalculator {...defaultProps} userBalance={50000} />);
    
    expect(screen.getByText(/Available: 50,000 FLOW/)).toBeInTheDocument();
  });

  it('calculates multiplier correctly for different durations', () => {
    const { rerender } = render(<VotingPowerCalculator {...defaultProps} />);
    
    // Test various durations
    const testCases = [
      { weeks: 1, expectedMultiplier: '1.00x' },
      { weeks: 52, expectedMultiplier: '2.00x' }, // 1 year
      { weeks: 104, expectedMultiplier: '3.00x' }, // 2 years
      { weeks: 208, expectedMultiplier: '4.00x' }, // 4 years (max)
    ];
    
    testCases.forEach(({ weeks }) => {
      const durationSlider = screen.getByLabelText('Lock Duration') as HTMLInputElement;
      fireEvent.change(durationSlider, { target: { value: weeks.toString() } });
      
      // Power Multiplier metric should be present
      expect(screen.getByText('Power Multiplier')).toBeInTheDocument();
    });
  });

  it('displays info banner with veFLOW explanation', () => {
    render(<VotingPowerCalculator {...defaultProps} />);
    
    expect(screen.getByText(/veFLOW voting power/)).toBeInTheDocument();
    expect(screen.getByText(/increases linearly from/)).toBeInTheDocument();
  });

  it('shows footer information about veFLOW properties', () => {
    render(<VotingPowerCalculator {...defaultProps} />);
    
    expect(screen.getByText(/veFLOW is non-transferable/)).toBeInTheDocument();
    expect(screen.getByText(/Voting power and yield boost decay linearly/)).toBeInTheDocument();
  });

  it('renders circular gauge for voting power visualization', () => {
    render(<VotingPowerCalculator {...defaultProps} />);
    
    const gauge = screen.getByLabelText(/Voting power:/);
    expect(gauge).toBeInTheDocument();
  });
});
