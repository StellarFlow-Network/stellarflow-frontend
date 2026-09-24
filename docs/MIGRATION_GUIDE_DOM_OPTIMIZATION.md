# Migration Guide: DOM Optimization

## Overview
This guide helps you migrate existing components from CSS-based visibility hiding to conditional rendering for improved DOM efficiency.

## Quick Reference

### Before (CSS-based hiding)
```tsx
// ❌ Element stays in DOM with opacity: 0
<div style={{ opacity: isVisible ? 1 : 0 }}>
  <ExpensiveComponent />
</div>

// ❌ Element stays in DOM with display: none
<div className={isVisible ? '' : 'hidden'}>
  <ExpensiveComponent />
</div>
```

### After (Conditional rendering)
```tsx
// ✅ Element completely removed when not visible
{isVisible && (
  <ExpensiveComponent />
)}
```

## Step-by-Step Migration

### 1. Identify Components to Migrate

Search your codebase for patterns that keep elements in DOM:

```bash
# Find opacity-based hiding
grep -r "opacity.*0" src/

# Find display-based hiding  
grep -r "display.*none" src/

# Find visibility-based hiding
grep -r "visibility.*hidden" src/

# Find conditional class hiding
grep -r "className=.*hidden" src/
```

### 2. Analyze Component Lifecycle

Before migrating, understand:
- **When the component mounts/unmounts**
- **What side effects it has** (timers, subscriptions, listeners)
- **If it needs animations** on enter/exit
- **If it holds important state** that should persist

### 3. Migration Patterns

#### Pattern 1: Simple Toggle

**Before:**
```tsx
function Panel() {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div>
      <button onClick={() => setIsOpen(!isOpen)}>Toggle</button>
      <div style={{ display: isOpen ? 'block' : 'none' }}>
        <PanelContent />
      </div>
    </div>
  );
}
```

**After:**
```tsx
function Panel() {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div>
      <button onClick={() => setIsOpen(!isOpen)}>Toggle</button>
      {isOpen && (
        <PanelContent />
      )}
    </div>
  );
}
```

#### Pattern 2: With Animation

**Before:**
```tsx
function AnimatedPanel() {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div>
      <button onClick={() => setIsOpen(!isOpen)}>Toggle</button>
      <div 
        className="transition-opacity duration-300"
        style={{ opacity: isOpen ? 1 : 0 }}
      >
        <PanelContent />
      </div>
    </div>
  );
}
```

**After:**
```tsx
import { AnimatePresence, motion } from 'framer-motion';

function AnimatedPanel() {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div>
      <button onClick={() => setIsOpen(!isOpen)}>Toggle</button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <PanelContent />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

#### Pattern 3: Modal/Dialog

**Before:**
```tsx
function Modal({ isOpen, onClose, children }) {
  return (
    <div style={{ display: isOpen ? 'flex' : 'none' }}>
      <div className="backdrop" onClick={onClose} />
      <div className="modal-content">
        {children}
      </div>
    </div>
  );
}
```

**After:**
```tsx
function Modal({ isOpen, onClose, children }) {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="backdrop" onClick={onClose} />
      <div className="modal-content">
        {children}
      </div>
    </div>
  );
}

// Or use the OptimizedDialog component
import OptimizedDialog from '@/app/components/OptimizedDialog';

function MyComponent() {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <>
      <button onClick={() => setIsOpen(true)}>Open</button>
      <OptimizedDialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="My Dialog"
      >
        <DialogContent />
      </OptimizedDialog>
    </>
  );
}
```

#### Pattern 4: Side Panel/Drawer

**Before:**
```tsx
function SidePanel({ isOpen }) {
  return (
    <div 
      className="fixed right-0 top-0 h-full w-80 bg-gray-900 transition-transform"
      style={{ transform: isOpen ? 'translateX(0)' : 'translateX(100%)' }}
    >
      <PanelContent />
    </div>
  );
}
```

**After:**
```tsx
import OptimizedSheet from '@/app/components/OptimizedSheet';

function SidePanel({ isOpen, onClose }) {
  return (
    <OptimizedSheet
      isOpen={isOpen}
      onClose={onClose}
      position="right"
      size="md"
    >
      <PanelContent />
    </OptimizedSheet>
  );
}
```

### 4. Handle State Preservation

If your component needs to preserve state between hide/show cycles:

**Option A: Lift state up**
```tsx
// Move state to parent component
function Parent() {
  const [panelData, setPanelData] = useState(initialData);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  
  return (
    <>
      <button onClick={() => setIsPanelOpen(true)}>Open</button>
      {isPanelOpen && (
        <Panel data={panelData} onChange={setPanelData} />
      )}
    </>
  );
}
```

**Option B: Use sessionStorage/localStorage**
```tsx
function Panel({ isOpen, onClose }) {
  const [data, setData] = useState(() => {
    const saved = sessionStorage.getItem('panel-data');
    return saved ? JSON.parse(saved) : initialData;
  });
  
  useEffect(() => {
    sessionStorage.setItem('panel-data', JSON.stringify(data));
  }, [data]);
  
  if (!isOpen) return null;
  
  return <PanelContent data={data} onChange={setData} />;
}
```

### 5. Handle Cleanup Properly

Ensure side effects are cleaned up when component unmounts:

```tsx
function Panel({ isOpen }) {
  useEffect(() => {
    if (!isOpen) return;
    
    // Setup side effect
    const timer = setInterval(() => {
      console.log('Polling...');
    }, 1000);
    
    // Cleanup when component unmounts
    return () => clearInterval(timer);
  }, [isOpen]);
  
  if (!isOpen) return null;
  
  return <PanelContent />;
}
```

### 6. Update Tests

After migration, update your tests:

```tsx
// Before: Test for visibility style
expect(panel).toHaveStyle({ display: 'none' });

// After: Test for presence in DOM
expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

// Or for presence
expect(screen.getByRole('dialog')).toBeInTheDocument();
```

## Component-Specific Migration

### FloatingSidebar.tsx ✅ Already Optimized
```tsx
// Active indicators already use conditional rendering
{isActive && (
  <span className="active-indicator" />
)}

// Tooltips already use conditional rendering
{isHovered && (
  <span className="tooltip">{label}</span>
)}
```

### nav.jsx ✅ Already Optimized
```tsx
// Notification badge already uses conditional rendering
{hasAnomaly && (
  <span className="badge">
    {/* Badge content */}
  </span>
)}
```

### TopLoadingBar.tsx ✅ Already Optimized
```tsx
// Progress bar already uses conditional rendering
{visible && <TrickleBar width={width} />}
```

## Common Pitfalls

### ❌ Pitfall 1: Forgetting to handle null
```tsx
// Wrong: Can cause React errors
const Panel = ({ isOpen, children }) => (
  isOpen && <div>{children}</div>
);

// Right: Explicit return or fragment
const Panel = ({ isOpen, children }) => {
  if (!isOpen) return null;
  return <div>{children}</div>;
};
```

### ❌ Pitfall 2: Losing animation on exit
```tsx
// Wrong: Component removed immediately, no exit animation
{isOpen && (
  <motion.div animate={{ opacity: 1 }}>
    Content
  </motion.div>
)}

// Right: Use AnimatePresence for exit animation
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

### ❌ Pitfall 3: Not cleaning up side effects
```tsx
// Wrong: Timer continues even after unmount
function Panel({ isOpen }) {
  setInterval(() => fetchData(), 1000);
  if (!isOpen) return null;
  return <div>Content</div>;
}

// Right: Clean up on unmount
function Panel({ isOpen }) {
  useEffect(() => {
    if (!isOpen) return;
    const id = setInterval(() => fetchData(), 1000);
    return () => clearInterval(id);
  }, [isOpen]);
  
  if (!isOpen) return null;
  return <div>Content</div>;
}
```

## Verification Checklist

After migration, verify:

- [ ] Component is not in DOM when closed (check DevTools Elements)
- [ ] No console errors when opening/closing
- [ ] Animations work smoothly (if applicable)
- [ ] State is preserved if needed
- [ ] Event listeners are cleaned up properly
- [ ] No memory leaks (check DevTools Memory)
- [ ] Tests pass with updated assertions
- [ ] Accessibility features still work (keyboard navigation, screen readers)

## Performance Testing

Before and after migration, measure:

```tsx
// Count DOM nodes
console.log('DOM nodes:', document.getElementsByTagName('*').length);

// Measure memory (Chrome DevTools)
// 1. Take heap snapshot with dialog closed
// 2. Open dialog
// 3. Close dialog  
// 4. Take another heap snapshot
// 5. Compare - should see nodes freed after close

// Measure render performance
import { Profiler } from 'react';

<Profiler
  id="Panel"
  onRender={(id, phase, actualDuration) => {
    console.log(`${id} ${phase} took ${actualDuration}ms`);
  }}
>
  {isOpen && <Panel />}
</Profiler>
```

## Rollback Plan

If issues arise after migration:

1. **Revert the conditional rendering**
2. **Add a feature flag** to toggle between old/new behavior
3. **Test thoroughly** in staging
4. **Monitor performance metrics** in production
5. **Gradually roll out** to users

```tsx
// Feature flag approach
const USE_OPTIMIZED_RENDERING = process.env.NEXT_PUBLIC_OPTIMIZED_RENDERING === 'true';

function Panel({ isOpen }) {
  if (USE_OPTIMIZED_RENDERING) {
    // New: conditional rendering
    if (!isOpen) return null;
    return <PanelContent />;
  } else {
    // Old: CSS hiding
    return (
      <div style={{ display: isOpen ? 'block' : 'none' }}>
        <PanelContent />
      </div>
    );
  }
}
```

## Resources

- [React Conditional Rendering Docs](https://react.dev/learn/conditional-rendering)
- [Framer Motion AnimatePresence](https://www.framer.com/motion/animate-presence/)
- [Web.dev: DOM Size Performance](https://web.dev/dom-size/)
- [OptimizedDialog Component](../src/app/components/OptimizedDialog.tsx)
- [OptimizedSheet Component](../src/app/components/OptimizedSheet.tsx)
- [Example Usage](../src/app/components/examples/DialogSheetExample.tsx)
