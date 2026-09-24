# DOM Optimization Quick Reference

## 🚀 Quick Start

### Pattern: Show/Hide Component

```tsx
// ❌ BAD: Keeps in DOM
<div style={{ display: isOpen ? 'block' : 'none' }}>
  <Component />
</div>

// ✅ GOOD: Removes from DOM
{isOpen && <Component />}
```

## 📦 Available Components

### OptimizedDialog
```tsx
import OptimizedDialog from '@/app/components/OptimizedDialog';

<OptimizedDialog
  isOpen={isOpen}
  onClose={close}
  title="My Dialog"
  size="md" // sm | md | lg | xl
>
  <Content />
</OptimizedDialog>
```

### OptimizedSheet
```tsx
import OptimizedSheet from '@/app/components/OptimizedSheet';

<OptimizedSheet
  isOpen={isOpen}
  onClose={close}
  title="My Panel"
  position="right" // top | right | bottom | left
  size="md" // sm | md | lg | xl | full
>
  <Content />
</OptimizedSheet>
```

## 🎣 State Management Hooks

### Single Dialog
```tsx
import { useSimpleDialog } from '@/app/hooks/useDialogState';

const [isOpen, { open, close, toggle }] = useSimpleDialog();
```

### Multiple Dialogs
```tsx
import { useDialogState } from '@/app/hooks/useDialogState';

const dialogs = useDialogState(['settings', 'help', 'about']);

dialogs.open('settings');
dialogs.close('settings');
dialogs.isOpen('settings'); // boolean
dialogs.closeAll();
```

### Stacked Dialogs
```tsx
import { useDialogStack } from '@/app/hooks/useDialogState';

const stack = useDialogStack();

stack.push('main');      // Open
stack.push('confirm');   // Open on top
stack.pop();             // Close top
stack.getZIndex('main'); // Get z-index
```

## 📋 Common Patterns

### Modal Dialog
```tsx
function MyComponent() {
  const [isOpen, { open, close }] = useSimpleDialog();
  
  return (
    <>
      <button onClick={open}>Open</button>
      <OptimizedDialog isOpen={isOpen} onClose={close}>
        <DialogContent />
      </OptimizedDialog>
    </>
  );
}
```

### Slide-out Panel
```tsx
function MyComponent() {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <>
      <button onClick={() => setIsOpen(true)}>Open</button>
      <OptimizedSheet 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)}
        position="right"
      >
        <PanelContent />
      </OptimizedSheet>
    </>
  );
}
```

### With Animation
```tsx
import { AnimatePresence, motion } from 'framer-motion';

{isOpen && (
  <AnimatePresence>
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
    >
      <Component />
    </motion.div>
  </AnimatePresence>
)}
```

## ✅ Checklist

### When Creating New Components
- [ ] Use `{condition && <Component />}` pattern
- [ ] Or use `OptimizedDialog`/`OptimizedSheet`
- [ ] Clean up side effects in `useEffect`
- [ ] Add exit animations with `AnimatePresence` if needed
- [ ] Test DOM removal in DevTools

### When Migrating Existing Components
- [ ] Find: `style={{ display: 'none' }}`
- [ ] Find: `style={{ opacity: 0 }}`
- [ ] Find: `className="hidden"` (if state-controlled)
- [ ] Replace with conditional rendering
- [ ] Update tests: check DOM presence, not visibility
- [ ] Verify animations still work

## 🎯 When NOT to Use Conditional Rendering

### ✅ OK to Use CSS Hiding
```tsx
// Responsive design
<div className="hidden md:block">
  <DesktopView />
</div>

// Accessibility
<span className="sr-only">Hidden for visual users</span>

// Simple animations (if no performance issue)
<div className="opacity-0 transition-opacity hover:opacity-100">
  <Icon />
</div>
```

## 🐛 Common Mistakes

### ❌ Mistake 1: Falsy Values
```tsx
// Wrong: Can render "0"
{count && <Badge>{count}</Badge>}

// Right: Explicit boolean
{count > 0 && <Badge>{count}</Badge>}
```

### ❌ Mistake 2: No Cleanup
```tsx
// Wrong: Timer continues after unmount
useEffect(() => {
  setInterval(() => fetch(), 1000);
}, []);

// Right: Clean up
useEffect(() => {
  const id = setInterval(() => fetch(), 1000);
  return () => clearInterval(id);
}, []);
```

### ❌ Mistake 3: Lost Animation
```tsx
// Wrong: No exit animation
{isOpen && (
  <motion.div animate={{ opacity: 1 }}>
    Content
  </motion.div>
)}

// Right: Use AnimatePresence
<AnimatePresence>
  {isOpen && (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      Content
    </motion.div>
  )}
</AnimatePresence>
```

## 🧪 Testing

### Check DOM Removal
```tsx
// Should NOT be in document when closed
expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

// Should be in document when open
expect(screen.getByRole('dialog')).toBeInTheDocument();
```

### Verify in DevTools
1. Open Chrome DevTools → Elements
2. Find your component in DOM tree
3. Close the component
4. Verify element is removed (not just hidden)

### Check Memory
1. Open Chrome DevTools → Memory
2. Take heap snapshot with component closed
3. Open component
4. Close component
5. Take another snapshot
6. Verify memory released

## 📚 Resources

**Implementation:**
- `src/app/components/OptimizedDialog.tsx`
- `src/app/components/OptimizedSheet.tsx`
- `src/app/hooks/useDialogState.ts`

**Examples:**
- `src/app/components/examples/DialogSheetExample.tsx`

**Docs:**
- `docs/DOM_OPTIMIZATION.md` - Full guide
- `docs/MIGRATION_GUIDE_DOM_OPTIMIZATION.md` - Migration help
- `docs/DOM_OPTIMIZATION_SUMMARY.md` - Implementation summary

## 💡 Tips

1. **Always test in DevTools** to verify DOM removal
2. **Use hooks** for cleaner state management
3. **Preserve state** by lifting it up if needed
4. **Clean up effects** to prevent memory leaks
5. **Use AnimatePresence** for smooth exit animations
6. **Responsive classes are OK** (`hidden md:block`)
7. **Measure performance** before/after optimization

## 🆘 Troubleshooting

### Problem: Component state resets
**Solution:** Lift state to parent component

### Problem: Exit animation doesn't play
**Solution:** Wrap with `<AnimatePresence>`

### Problem: Memory leak
**Solution:** Add cleanup in `useEffect` return

### Problem: Element still in DOM
**Solution:** Check conditional rendering syntax

### Problem: TypeScript errors
**Solution:** Ensure all props are properly typed

---

**Quick tip:** Always start with `useSimpleDialog` or `useDialogState` hooks - they handle most common scenarios with minimal code!
