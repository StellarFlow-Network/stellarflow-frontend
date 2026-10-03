import { useState, useCallback, useMemo } from 'react';

/**
 * useDialogState Hook
 * 
 * A performant hook for managing multiple dialog/sheet states with automatic cleanup.
 * 
 * Benefits:
 * - Manages multiple dialog states efficiently
 * - Prevents stale closures
 * - Type-safe dialog keys
 * - Automatic state cleanup
 * - Provides helper methods for common patterns
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const dialogs = useDialogState(['settings', 'notifications', 'help']);
 *   
 *   return (
 *     <>
 *       <button onClick={() => dialogs.open('settings')}>Settings</button>
 *       <button onClick={() => dialogs.open('notifications')}>Notifications</button>
 *       
 *       <OptimizedDialog
 *         isOpen={dialogs.isOpen('settings')}
 *         onClose={() => dialogs.close('settings')}
 *       >
 *         <SettingsContent />
 *       </OptimizedDialog>
 *       
 *       <OptimizedSheet
 *         isOpen={dialogs.isOpen('notifications')}
 *         onClose={() => dialogs.close('notifications')}
 *       >
 *         <NotificationsContent />
 *       </OptimizedSheet>
 *     </>
 *   );
 * }
 * ```
 */

type DialogKey = string;

interface DialogState {
  [key: DialogKey]: boolean;
}

export interface UseDialogStateReturn {
  /** Check if a dialog is open */
  isOpen: (key: DialogKey) => boolean;
  /** Open a specific dialog */
  open: (key: DialogKey) => void;
  /** Close a specific dialog */
  close: (key: DialogKey) => void;
  /** Toggle a specific dialog */
  toggle: (key: DialogKey) => void;
  /** Close all dialogs */
  closeAll: () => void;
  /** Check if any dialog is open */
  hasAnyOpen: () => boolean;
  /** Get all open dialog keys */
  getOpenDialogs: () => DialogKey[];
  /** Get the raw state object (rarely needed) */
  state: DialogState;
}

export function useDialogState(keys: DialogKey[] = []): UseDialogStateReturn {
  // Initialize state with all dialogs closed
  const [state, setState] = useState<DialogState>(() =>
    keys.reduce((acc, key) => ({ ...acc, [key]: false }), {})
  );

  // Check if a dialog is open
  const isOpen = useCallback(
    (key: DialogKey): boolean => {
      return state[key] ?? false;
    },
    [state]
  );

  // Open a specific dialog
  const open = useCallback((key: DialogKey) => {
    setState((prev) => ({ ...prev, [key]: true }));
  }, []);

  // Close a specific dialog
  const close = useCallback((key: DialogKey) => {
    setState((prev) => ({ ...prev, [key]: false }));
  }, []);

  // Toggle a specific dialog
  const toggle = useCallback((key: DialogKey) => {
    setState((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // Close all dialogs
  const closeAll = useCallback(() => {
    setState((prev) => {
      const newState = { ...prev };
      Object.keys(newState).forEach((key) => {
        newState[key] = false;
      });
      return newState;
    });
  }, []);

  // Check if any dialog is open
  const hasAnyOpen = useCallback((): boolean => {
    return Object.values(state).some((isOpen) => isOpen);
  }, [state]);

  // Get all open dialog keys
  const getOpenDialogs = useCallback((): DialogKey[] => {
    return Object.entries(state)
      .filter(([_, isOpen]) => isOpen)
      .map(([key]) => key);
  }, [state]);

  // Memoize the return object to prevent unnecessary re-renders
  return useMemo(
    () => ({
      isOpen,
      open,
      close,
      toggle,
      closeAll,
      hasAnyOpen,
      getOpenDialogs,
      state,
    }),
    [isOpen, open, close, toggle, closeAll, hasAnyOpen, getOpenDialogs, state]
  );
}

/**
 * useSimpleDialog Hook
 * 
 * Simplified version for managing a single dialog state.
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const [isOpen, { open, close, toggle }] = useSimpleDialog();
 *   
 *   return (
 *     <>
 *       <button onClick={open}>Open Dialog</button>
 *       
 *       <OptimizedDialog isOpen={isOpen} onClose={close}>
 *         <DialogContent />
 *       </OptimizedDialog>
 *     </>
 *   );
 * }
 * ```
 */
export function useSimpleDialog(
  initialState = false
): [boolean, { open: () => void; close: () => void; toggle: () => void }] {
  const [isOpen, setIsOpen] = useState(initialState);

  const handlers = useMemo(
    () => ({
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      toggle: () => setIsOpen((prev) => !prev),
    }),
    []
  );

  return [isOpen, handlers];
}

/**
 * useDialogStack Hook
 * 
 * Manages a stack of dialogs with automatic z-index management.
 * Useful when you need to open dialogs on top of other dialogs.
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const dialogStack = useDialogStack();
 *   
 *   return (
 *     <>
 *       <button onClick={() => dialogStack.push('settings')}>Open Settings</button>
 *       
 *       <OptimizedDialog
 *         isOpen={dialogStack.isOpen('settings')}
 *         onClose={() => dialogStack.pop()}
 *         style={{ zIndex: dialogStack.getZIndex('settings') }}
 *       >
 *         <SettingsContent />
 *         <button onClick={() => dialogStack.push('confirm')}>
 *           Open Confirmation
 *         </button>
 *       </OptimizedDialog>
 *       
 *       <OptimizedDialog
 *         isOpen={dialogStack.isOpen('confirm')}
 *         onClose={() => dialogStack.pop()}
 *         style={{ zIndex: dialogStack.getZIndex('confirm') }}
 *       >
 *         <ConfirmationContent />
 *       </OptimizedDialog>
 *     </>
 *   );
 * }
 * ```
 */
export interface UseDialogStackReturn {
  /** Check if a dialog is in the stack */
  isOpen: (key: DialogKey) => boolean;
  /** Push a dialog onto the stack */
  push: (key: DialogKey) => void;
  /** Pop the top dialog from the stack */
  pop: () => void;
  /** Close a specific dialog (removes from stack) */
  close: (key: DialogKey) => void;
  /** Close all dialogs */
  closeAll: () => void;
  /** Get z-index for a dialog (higher = on top) */
  getZIndex: (key: DialogKey) => number;
  /** Get the current stack */
  stack: DialogKey[];
}

export function useDialogStack(baseZIndex = 50): UseDialogStackReturn {
  const [stack, setStack] = useState<DialogKey[]>([]);

  const isOpen = useCallback(
    (key: DialogKey): boolean => {
      return stack.includes(key);
    },
    [stack]
  );

  const push = useCallback((key: DialogKey) => {
    setStack((prev) => {
      // Don't add if already in stack
      if (prev.includes(key)) return prev;
      return [...prev, key];
    });
  }, []);

  const pop = useCallback(() => {
    setStack((prev) => prev.slice(0, -1));
  }, []);

  const close = useCallback((key: DialogKey) => {
    setStack((prev) => prev.filter((k) => k !== key));
  }, []);

  const closeAll = useCallback(() => {
    setStack([]);
  }, []);

  const getZIndex = useCallback(
    (key: DialogKey): number => {
      const index = stack.indexOf(key);
      if (index === -1) return baseZIndex;
      return baseZIndex + index;
    },
    [stack, baseZIndex]
  );

  return useMemo(
    () => ({
      isOpen,
      push,
      pop,
      close,
      closeAll,
      getZIndex,
      stack,
    }),
    [isOpen, push, pop, close, closeAll, getZIndex, stack]
  );
}
