import { useCallback } from 'react';
import { stopEventPropagation, createIsolatedClickHandler } from '../utils/eventPropagationManager';

/**
 * Hook for managing isolated cell click events
 * Prevents status icon clicks from bubbling to parent row handlers
 */
export const useIsolatedCellClick = (onCellClick, options = {}) => {
  const {
    isolateByDefault = true,
    stopPropagation: shouldStop = true,
    preventDefault: shouldPrevent = false
  } = options;

  const handleClick = useCallback((e) => {
    if (shouldStop) {
      stopEventPropagation(e);
    }
    
    if (shouldPrevent && e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }

    if (typeof onCellClick === 'function') {
      onCellClick(e);
    }
  }, [onCellClick, shouldStop, shouldPrevent]);

  const createStatusIconHandler = useCallback((iconClickHandler) => {
    return (e) => {
      stopEventPropagation(e);
      if (typeof iconClickHandler === 'function') {
        iconClickHandler(e);
      }
    };
  }, []);

  const createRowHandler = useCallback((rowClickHandler) => {
    return (e) => {
      // Only trigger row handler if click originated from row, not status icons
      if (e.target.closest('[data-isolated-click]')) {
        return; // Stop propagation to row handler
      }
      if (typeof rowClickHandler === 'function') {
        rowClickHandler(e);
      }
    };
  }, []);

  return {
    handleClick,
    createStatusIconHandler,
    createRowHandler,
    stopPropagation: stopEventPropagation
  };
};
