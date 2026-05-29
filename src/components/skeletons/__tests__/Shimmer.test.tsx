import React from 'react';
import { render } from '@testing-library/react';
import { Shimmer } from '../Shimmer';

jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, style }: any) => (
      <div className={className} style={style}>{children}</div>
    ),
  },
}));

describe('Shimmer Component', () => {
  it('renders without crashing and has motion div', () => {
    const { container } = render(<Shimmer className="test-class" />);
    const shimmerDiv = container.firstChild as HTMLElement;
    expect(shimmerDiv).toBeInTheDocument();
    expect(shimmerDiv).toHaveClass('test-class');
  });
});
