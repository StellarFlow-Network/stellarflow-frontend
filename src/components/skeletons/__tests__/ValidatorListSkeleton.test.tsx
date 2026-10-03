import React from 'react';
import { render } from '@testing-library/react';
import { ValidatorListSkeleton } from '../ValidatorListSkeleton';
import {
  VALIDATOR_TABLE_HEADER_HEIGHT_PX,
  VALIDATOR_TABLE_ROW_COUNT,
  VALIDATOR_TABLE_ROW_HEIGHT_PX,
} from '@/types/validators';

describe('ValidatorListSkeleton Component', () => {
  it('renders the default number of skeleton rows', () => {
    const { container } = render(<ValidatorListSkeleton />);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(VALIDATOR_TABLE_ROW_COUNT);
  });

  it('uses table-fixed layout and reserves total table height', () => {
    const rowCount = 3;
    const { container } = render(<ValidatorListSkeleton rowCount={rowCount} />);
    const table = container.querySelector('table');
    const wrapper = container.firstChild as HTMLElement;

    expect(table).toHaveClass('table-fixed');
    expect(wrapper.style.minHeight).toBe(
      `${VALIDATOR_TABLE_HEADER_HEIGHT_PX + rowCount * VALIDATOR_TABLE_ROW_HEIGHT_PX}px`,
    );
  });
});
