/**
 * Optimized Components Index
 * 
 * This module exports performant, conditionally-rendered components
 * that follow React best practices for DOM efficiency.
 * 
 * All components in this module:
 * - Use conditional rendering to remove from DOM when not visible
 * - Clean up event listeners and side effects on unmount
 * - Support smooth animations via AnimatePresence
 * - Include full accessibility features
 * - Are fully typed with TypeScript
 * 
 * @see docs/DOM_OPTIMIZATION.md for implementation guide
 * @see docs/QUICK_REFERENCE_DOM_OPTIMIZATION.md for quick reference
 */

// Dialog Components
export { OptimizedDialog, default as Dialog } from '../OptimizedDialog';
export type { OptimizedDialogProps } from '../OptimizedDialog';

// Sheet/Panel Components
export { OptimizedSheet, default as Sheet } from '../OptimizedSheet';
export type { OptimizedSheetProps } from '../OptimizedSheet';

// State Management Hooks
export {
  useDialogState,
  useSimpleDialog,
  useDialogStack,
} from '../../hooks/useDialogState';
export type {
  UseDialogStateReturn,
  UseDialogStackReturn,
} from '../../hooks/useDialogState';

/**
 * Usage Examples:
 * 
 * @example Single Dialog
 * ```tsx
 * import { Dialog, useSimpleDialog } from '@/app/components/optimized';
 * 
 * function MyComponent() {
 *   const [isOpen, { open, close }] = useSimpleDialog();
 *   
 *   return (
 *     <>
 *       <button onClick={open}>Open Dialog</button>
 *       <Dialog isOpen={isOpen} onClose={close} title="Settings">
 *         <SettingsForm />
 *       </Dialog>
 *     </>
 *   );
 * }
 * ```
 * 
 * @example Multiple Dialogs
 * ```tsx
 * import { Dialog, Sheet, useDialogState } from '@/app/components/optimized';
 * 
 * function Dashboard() {
 *   const dialogs = useDialogState(['settings', 'notifications']);
 *   
 *   return (
 *     <>
 *       <button onClick={() => dialogs.open('settings')}>Settings</button>
 *       <button onClick={() => dialogs.open('notifications')}>Notifications</button>
 *       
 *       <Dialog
 *         isOpen={dialogs.isOpen('settings')}
 *         onClose={() => dialogs.close('settings')}
 *       >
 *         <SettingsContent />
 *       </Dialog>
 *       
 *       <Sheet
 *         isOpen={dialogs.isOpen('notifications')}
 *         onClose={() => dialogs.close('notifications')}
 *         position="right"
 *       >
 *         <NotificationsList />
 *       </Sheet>
 *     </>
 *   );
 * }
 * ```
 * 
 * @example Stacked Dialogs
 * ```tsx
 * import { Dialog, useDialogStack } from '@/app/components/optimized';
 * 
 * function ComplexFlow() {
 *   const stack = useDialogStack();
 *   
 *   return (
 *     <>
 *       <button onClick={() => stack.push('step1')}>Start</button>
 *       
 *       <Dialog
 *         isOpen={stack.isOpen('step1')}
 *         onClose={() => stack.pop()}
 *         style={{ zIndex: stack.getZIndex('step1') }}
 *       >
 *         <button onClick={() => stack.push('step2')}>Next</button>
 *       </Dialog>
 *       
 *       <Dialog
 *         isOpen={stack.isOpen('step2')}
 *         onClose={() => stack.pop()}
 *         style={{ zIndex: stack.getZIndex('step2') }}
 *       >
 *         <FinalStep />
 *       </Dialog>
 *     </>
 *   );
 * }
 * ```
 */

// Re-export common types for convenience
export type DialogSize = 'sm' | 'md' | 'lg' | 'xl';
export type SheetPosition = 'top' | 'right' | 'bottom' | 'left';
export type SheetSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';
