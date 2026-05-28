import React from 'react';
import { render } from '@testing-library/react';
import { MapSkeleton } from '../MapSkeleton';

describe('MapSkeleton Component', () => {
  it('renders and matches the map container dimensions', () => {
    const { container } = render(<MapSkeleton />);
    const skeletonDiv = container.firstChild as HTMLElement;
    expect(skeletonDiv).toBeInTheDocument();
    expect(skeletonDiv).toHaveClass('min-h-[320px]');
    expect(skeletonDiv).toHaveClass('w-full');
  });
});
