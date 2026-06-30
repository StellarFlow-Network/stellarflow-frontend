import React from 'react';
import { render } from '@testing-library/react';
import { MapSkeleton } from '../MapSkeleton';

describe('MapSkeleton Component', () => {
  it('reserves a hard-locked height matching the map container (prevents CLS)', () => {
    const { container } = render(<MapSkeleton />);
    const skeletonDiv = container.firstChild as HTMLElement;
    expect(skeletonDiv).toBeInTheDocument();
    // Fixed height (not min-height) so the reserved box cannot grow or shift
    // when the dynamic Leaflet map and its remote tiles mount in its place.
    expect(skeletonDiv).toHaveClass('h-[320px]');
    expect(skeletonDiv).not.toHaveClass('min-h-[320px]');
    expect(skeletonDiv).toHaveClass('w-full');
  });
});
