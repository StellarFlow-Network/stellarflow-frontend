import React from 'react';
import { render } from '@testing-library/react';
import { ValidatorHeartbeatCell } from '../ValidatorHeartbeatCell';
import { ValidatorStatusWidget } from '../ValidatorStatusWidget';

describe('ValidatorHeartbeatCell', () => {
  it('applies layout paint containment to the heartbeat cell', () => {
    const { container } = render(
      <table>
        <tbody>
          <tr>
            <ValidatorHeartbeatCell uptime={99.5} status="active" />
          </tr>
        </tbody>
      </table>,
    );

    const cell = container.querySelector('.validator-heartbeat-cell') as HTMLElement;
    expect(cell).toBeTruthy();
    expect(cell.tagName).toBe('TD');
  });

  it('renders pulse indicator only for active validators', () => {
    const { container, rerender } = render(
      <table>
        <tbody>
          <tr>
            <ValidatorHeartbeatCell uptime={99.5} status="active" />
          </tr>
        </tbody>
      </table>,
    );

    expect(container.querySelector('.animate-status-pulse')).toBeTruthy();

    rerender(
      <table>
        <tbody>
          <tr>
            <ValidatorHeartbeatCell uptime={78.4} status="jailed" />
          </tr>
        </tbody>
      </table>,
    );

    expect(container.querySelector('.animate-status-pulse')).toBeNull();
  });
});

describe('ValidatorStatusWidget', () => {
  it('applies dashboard status widget containment', () => {
    const { container } = render(<ValidatorStatusWidget status="active" />);
    const widget = container.firstChild as HTMLElement;
    expect(widget).toHaveClass('dashboard-status-widget');
  });
});
