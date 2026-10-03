import React from 'react';
import { render } from '@testing-library/react';
import { HealthFactorGauge, HealthFactorZone } from '../HealthFactorGauge';

describe('HealthFactorGauge', () => {
  it('renders Safe zone for healthFactor above 1.5', () => {
    const { container } = render(<HealthFactorGauge healthFactor={1.8} />);
    expect(container.textContent).toContain('1.80');
    expect(container.textContent).toContain('Safe');
  });

  it('renders Warning zone for healthFactor between 1.1 and 1.5', () => {
    const { container } = render(<HealthFactorGauge healthFactor={1.3} />);
    expect(container.textContent).toContain('1.30');
    expect(container.textContent).toContain('Warning');
  });

  it('renders Critical zone for healthFactor below 1.1', () => {
    const { container } = render(<HealthFactorGauge healthFactor={0.9} />);
    expect(container.textContent).toContain('0.90');
    expect(container.textContent).toContain('Critical');
  });

  it('shows Add Collateral button only in Warning zone', () => {
    const { container, rerender } = render(
      <HealthFactorGauge healthFactor={1.3} onAddCollateral={() => {}} />,
    );
    expect(container.textContent).toContain('Add Collateral');

    rerender(<HealthFactorGauge healthFactor={1.7} onAddCollateral={() => {}} />);
    expect(container.textContent).not.toContain('Add Collateral');
  });
});
