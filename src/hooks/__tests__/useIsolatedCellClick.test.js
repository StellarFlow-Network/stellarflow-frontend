import { renderHook, act } from '@testing-library/react';
import { useIsolatedCellClick } from '../useIsolatedCellClick';

describe('useIsolatedCellClick Hook', () => {
  let mockEvent;

  beforeEach(() => {
    mockEvent = {
      stopPropagation: jest.fn(),
      preventDefault: jest.fn(),
      target: {
        closest: jest.fn().mockReturnValue(null)
      }
    };
  });

  test('should stop propagation on cell click', () => {
    const { result } = renderHook(() => useIsolatedCellClick(() => {}));
    
    act(() => {
      result.current.handleClick(mockEvent);
    });

    expect(mockEvent.stopPropagation).toHaveBeenCalled();
  });

  test('should create status icon handler with isolation', () => {
    const { result } = renderHook(() => useIsolatedCellClick(() => {}));
    const iconHandler = result.current.createStatusIconHandler(jest.fn());
    
    act(() => {
      iconHandler(mockEvent);
    });

    expect(mockEvent.stopPropagation).toHaveBeenCalled();
  });

  test('should create row handler that respects isolated clicks', () => {
    mockEvent.target.closest.mockReturnValue(true); // Isolated element clicked
    const rowCallback = jest.fn();
    const { result } = renderHook(() => useIsolatedCellClick(() => {}));
    const rowHandler = result.current.createRowHandler(rowCallback);
    
    act(() => {
      rowHandler(mockEvent);
    });

    expect(rowCallback).not.toHaveBeenCalled();
  });

  test('should trigger row handler for non-isolated clicks', () => {
    mockEvent.target.closest.mockReturnValue(false);
    const rowCallback = jest.fn();
    const { result } = renderHook(() => useIsolatedCellClick(() => {}));
    const rowHandler = result.current.createRowHandler(rowCallback);
    
    act(() => {
      rowHandler(mockEvent);
    });

    expect(rowCallback).toHaveBeenCalled();
  });
});
