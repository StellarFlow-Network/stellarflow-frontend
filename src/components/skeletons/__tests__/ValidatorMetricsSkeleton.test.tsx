import React from 'react';
import { render } from '@testing-library/react';
import { ValidatorMetricsSkeleton } from '../ValidatorMetricsSkeleton';
import { VALIDATOR_METRIC_CARD_MIN_HEIGHT_PX } from '@/types/validators';

describe('ValidatorMetricsSkeleton Component', () => {
  it('renders the expected number of metric placeholders', () => {
    const { container, rerender } = render(<ValidatorMetricsSkeleton count={4} />);
    expect(container.querySelectorAll('.bg-neutral-900')).toHaveLength(4);

    rerender(<ValidatorMetricsSkeleton count={2} />);
    expect(container.querySelectorAll('.bg-neutral-900')).toHaveLength(2);
  });

  it('reserves rigid card height to prevent layout shift', () => {
    const { container } = render(<ValidatorMetricsSkeleton count={1} />);
    const card = container.querySelector('.bg-neutral-900') as HTMLElement;
    expect(card.style.minHeight).toBe(`${VALIDATOR_METRIC_CARD_MIN_HEIGHT_PX}px`);
    expect(card.style.contain).toBe('layout paint');
  });
});
