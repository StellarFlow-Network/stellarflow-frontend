import React from 'react';
import { render, screen } from '@testing-library/react';
import { OfflineBanner } from '../pwa/OfflineBanner';

// Mock the useOnlineStatus hook
jest.mock('../../hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => ({
    isOnline: false,
    lastOfflineTime: new Date('2024-01-01T10:00:00Z'),
    lastOnlineTime: new Date('2024-01-01T09:00:00Z'),
  }),
}));

describe('OfflineBanner', () => {
  it('renders offline banner when offline', () => {
    render(<OfflineBanner />);
    
    expect(screen.getByText(/you're currently offline/i)).toBeInTheDocument();
    expect(screen.getByText(/connection lost/i)).toBeInTheDocument();
  });

  it('does not render when online', () => {
    // Mock online status
    jest.doMock('../../hooks/useOnlineStatus', () => ({
      useOnlineStatus: () => ({
        isOnline: true,
        lastOfflineTime: null,
        lastOnlineTime: new Date('2024-01-01T10:00:00Z'),
      }),
    }));

    const { container } = render(<OfflineBanner />);
    expect(container.firstChild).toBeNull();
  });
});