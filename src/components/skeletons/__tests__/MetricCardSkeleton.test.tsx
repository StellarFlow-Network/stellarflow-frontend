import React from 'react';
import { render } from '@testing-library/react';
import { MetricCardSkeleton } from '../MetricCardSkeleton';

describe('MetricCardSkeleton Component', () => {
  it('renders correct number of skeleton cards for the count prop', () => {
    const { container, rerender } = render(<MetricCardSkeleton count={4} />);
    // Since MetricCardSkeleton renders a Fragment containing divs with bg-[#0A121E]
    expect(container.querySelectorAll('.bg-\\[\\#0A121E\\]')).toHaveLength(4);

    rerender(<MetricCardSkeleton count={2} />);
    expect(container.querySelectorAll('.bg-\\[\\#0A121E\\]')).toHaveLength(2);
  });
});
