import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ProposalCreationModal from '../ProposalCreationModal';

describe('ProposalCreationModal', () => {
  const baseProps = {
    isOpen: true,
    onClose: jest.fn(),
    onSubmit: jest.fn(),
    walletBalance: 120000,
    minimumThreshold: 250000,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('blocks submission when the wallet is below the minimum proposal threshold', async () => {
    render(<ProposalCreationModal {...baseProps} />);

    fireEvent.change(screen.getByLabelText(/proposal title/i), {
      target: { value: 'Increase relayer fee cap' },
    });
    fireEvent.change(screen.getByLabelText(/proposal description/i), {
      target: { value: 'This proposal updates the relayer fee cap.' },
    });
    fireEvent.change(screen.getByLabelText(/proposal rationale/i), {
      target: { value: 'This helps maintain network reliability.' },
    });

    fireEvent.click(screen.getByRole('button', { name: /submit proposal/i }));

    await waitFor(() => {
      expect(screen.getByText(/minimum proposal threshold/i)).toBeInTheDocument();
    });
    expect(baseProps.onSubmit).not.toHaveBeenCalled();
  });

  it('submits a proposal with upgrade parameters when the threshold is met', async () => {
    render(
      <ProposalCreationModal
        {...baseProps}
        walletBalance={500000}
      />,
    );

    fireEvent.change(screen.getByLabelText(/proposal title/i), {
      target: { value: 'Upgrade oracle aggregator' },
    });
    fireEvent.change(screen.getByLabelText(/proposal description/i), {
      target: { value: 'Deploy the new oracle aggregator contract.' },
    });
    fireEvent.change(screen.getByLabelText(/proposal rationale/i), {
      target: { value: 'This improves uptime and decentralization.' },
    });

    fireEvent.click(screen.getByRole('button', { name: /add parameter/i }));
    fireEvent.change(screen.getByLabelText(/parameter name/i), {
      target: { value: 'feeCap' },
    });
    fireEvent.change(screen.getByLabelText(/parameter value/i), {
      target: { value: '250000' },
    });

    fireEvent.click(screen.getByRole('button', { name: /submit proposal/i }));

    await waitFor(() => {
      expect(baseProps.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Upgrade oracle aggregator',
          parameters: expect.arrayContaining([
            expect.objectContaining({ name: 'feeCap', value: '250000' }),
          ]),
        }),
      );
    });
  });
});
