# Component Examples

This directory contains example implementations demonstrating best practices for component patterns in the StellarFlow application.

## Available Examples

### DialogSheetExample.tsx

**Purpose:** Demonstrates proper usage of `OptimizedDialog` and `OptimizedSheet` components with conditional rendering for optimal DOM efficiency.

**What it shows:**
- Multiple dialogs and sheets controlled independently
- Proper state management patterns
- Elements completely removed from DOM when closed
- Smooth animations on open/close
- Performance benefits visualization

**How to use:**

1. **View in isolation** (recommended for testing):
   ```tsx
   // Create a page at src/app/examples/dialogs/page.tsx
   import DialogSheetExample from '@/app/components/examples/DialogSheetExample';
   
   export default function Page() {
     return <DialogSheetExample />;
   }
   ```
   Then navigate to `/examples/dialogs` in your browser.

2. **Import specific patterns:**
   ```tsx
   // See the source code for individual patterns to copy
   import { DialogSheetExample } from '@/app/components/examples/DialogSheetExample';
   ```

**Key learnings:**
- How to manage multiple dialog states
- When to use `OptimizedDialog` vs `OptimizedSheet`
- Proper cleanup and conditional rendering
- Performance testing in DevTools

## Testing Examples

### In Browser
1. Open example page
2. Open Chrome DevTools (F12)
3. Go to Elements tab
4. Open a dialog/sheet
5. Observe DOM nodes being added
6. Close the dialog/sheet
7. Verify nodes are completely removed (not just hidden)

### Performance Testing
1. Open example page
2. Open Chrome DevTools → Performance
3. Start recording
4. Open and close dialogs multiple times
5. Stop recording
6. Analyze:
   - DOM node count changes
   - Memory allocation/deallocation
   - Render performance

## Creating New Examples

When adding new examples:

1. **File naming:** Use descriptive names with `Example` suffix
   ```
   MyPatternExample.tsx
   ```

2. **Structure:**
   ```tsx
   "use client";
   
   import React, { useState } from "react";
   
   /**
    * MyPatternExample Component
    * 
    * Brief description of what this example demonstrates.
    * 
    * Key features:
    * - Feature 1
    * - Feature 2
    */
   
   export function MyPatternExample() {
     // Implementation
   }
   
   export default MyPatternExample;
   ```

3. **Include:**
   - Clear comments explaining the pattern
   - Multiple variations if applicable
   - Performance notes
   - Common pitfalls to avoid

4. **Update this README** with:
   - Example name and purpose
   - What it demonstrates
   - How to use it
   - Key learnings

## Best Practices Demonstrated

### 1. Conditional Rendering
All examples show proper conditional rendering:
```tsx
{isOpen && <Component />}
```
Not:
```tsx
<div style={{ display: isOpen ? 'block' : 'none' }}>
  <Component />
</div>
```

### 2. State Management
Examples use appropriate hooks:
- `useSimpleDialog` for single dialogs
- `useDialogState` for multiple dialogs
- `useDialogStack` for nested dialogs

### 3. Cleanup
All examples properly clean up side effects:
```tsx
useEffect(() => {
  // Setup
  const cleanup = setup();
  
  // Cleanup
  return () => cleanup();
}, []);
```

### 4. Accessibility
Examples include:
- ARIA attributes
- Keyboard navigation
- Focus management
- Screen reader support

## Related Documentation

- **Implementation Guide:** `docs/DOM_OPTIMIZATION.md`
- **Migration Guide:** `docs/MIGRATION_GUIDE_DOM_OPTIMIZATION.md`
- **Quick Reference:** `docs/QUICK_REFERENCE_DOM_OPTIMIZATION.md`
- **Summary:** `docs/DOM_OPTIMIZATION_SUMMARY.md`

## Component Documentation

- **OptimizedDialog:** `src/app/components/OptimizedDialog.tsx`
- **OptimizedSheet:** `src/app/components/OptimizedSheet.tsx`
- **State Hooks:** `src/app/hooks/useDialogState.ts`

## Need Help?

1. Check the example source code for implementation details
2. Review the related documentation above
3. Test in DevTools to understand the behavior
4. Look at existing components that follow the pattern:
   - `TopLoadingBar.tsx` - Conditional rendering
   - `FloatingSidebar.tsx` - Active states
   - `nav.jsx` - Notification badges

## Contributing Examples

When contributing new examples:

1. Ensure they demonstrate a unique pattern or use case
2. Add comprehensive comments
3. Test thoroughly in multiple browsers
4. Update this README
5. Link from relevant documentation

---

**Remember:** These examples are learning tools. Feel free to experiment, modify, and adapt them to your needs!
