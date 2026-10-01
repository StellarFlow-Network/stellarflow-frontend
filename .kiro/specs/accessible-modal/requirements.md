# Requirements Document

## Introduction

This feature introduces `AccessibleModal`, a reusable, accessible modal dialog container for the StellarFlow frontend. The component is built on `@radix-ui/react-dialog` to guarantee native focus management, keyboard accessibility, and screen-reader semantics out of the box. It replaces ad-hoc dialog implementations scattered across the codebase with a single, well-tested primitive that satisfies WCAG 2.1 AA contrast and interaction requirements, renders a translucent blurred backdrop with a fade-in animation, supports responsive viewport heights with an auto-scrolling body region, and closes cleanly on both Escape key press and backdrop click.

The component is placed at `src/components/common/AccessibleModal.tsx` and exported through `src/components/common/index.ts`.

> **Dependency note:** `@radix-ui/react-dialog` must be added to `package.json` before the component can be used. It is already referenced by `AccessibleVoteModal` in the governance feature but is not yet declared as a project dependency.

---

## Glossary

- **AccessibleModal**: The reusable modal dialog container being specified here.
- **Dialog_Root**: The `@radix-ui/react-dialog` `Root` primitive that manages open/closed state.
- **Dialog_Overlay**: The `@radix-ui/react-dialog` `Overlay` primitive rendered as the translucent blurred backdrop.
- **Dialog_Content**: The `@radix-ui/react-dialog` `Content` primitive that hosts the modal panel and enforces the focus trap.
- **Dialog_Title**: The `@radix-ui/react-dialog` `Title` primitive used for the accessible modal heading.
- **Dialog_Close**: The `@radix-ui/react-dialog` `Close` primitive wrapping the dismiss button.
- **Focus_Trap**: The browser-native mechanism provided by `@radix-ui/react-dialog` that prevents keyboard focus from leaving the modal while it is open.
- **WCAG_AA**: Web Content Accessibility Guidelines 2.1 Level AA — minimum contrast ratio of 4.5:1 for normal text and 3:1 for large text/UI components.
- **Fade_In_Animation**: A CSS opacity transition from 0 → 1 triggered when the modal opens, implemented via Radix `data-[state=open]` / `data-[state=closed]` attributes combined with Tailwind animation utilities.
- **Modal_Body**: The scrollable content area inside the modal panel that houses consumer-supplied `children`.
- **Viewport_Height**: The visible browser window height used to constrain the modal panel so it never overflows off-screen.

---

## Requirements

### Requirement 1: Package Dependency

**User Story:** As a developer, I want `@radix-ui/react-dialog` declared as a project dependency, so that the `AccessibleModal` component can be imported and built without resolution errors.

#### Acceptance Criteria

1. THE Project SHALL list `@radix-ui/react-dialog` as a `dependency` entry in `package.json`.
2. WHEN a developer runs the project install command, THE Package_Manager SHALL resolve `@radix-ui/react-dialog` without version conflicts.

---

### Requirement 2: Component Location and Export

**User Story:** As a developer, I want `AccessibleModal` exported from the common component index, so that I can import it with a single, consistent path across the codebase.

#### Acceptance Criteria

1. THE AccessibleModal SHALL be implemented in `src/components/common/AccessibleModal.tsx`.
2. THE `src/components/common/index.ts` barrel file SHALL re-export `AccessibleModal` and its `AccessibleModalProps` type.
3. WHEN a consumer imports `{ AccessibleModal } from '@/components/common'`, THE Module_Resolver SHALL resolve the import without error.

---

### Requirement 3: Radix UI Dialog Integration

**User Story:** As a developer, I want the modal to use `@radix-ui/react-dialog` as its foundation, so that focus management and screen-reader semantics are handled by a battle-tested primitive rather than custom code.

#### Acceptance Criteria

1. THE AccessibleModal SHALL compose `Dialog_Root`, `Dialog_Overlay`, `Dialog_Content`, `Dialog_Title`, and `Dialog_Close` from `@radix-ui/react-dialog`.
2. THE Dialog_Content SHALL render inside a `DialogPrimitive.Portal` so it is appended to `document.body` and stacks above all other page content.
3. WHEN the `isOpen` prop is `true`, THE Dialog_Root SHALL set its `open` state to `true`.
4. WHEN the `onClose` callback is supplied and the dialog state changes to closed, THE Dialog_Root SHALL call `onClose`.

---

### Requirement 4: Keyboard Accessibility — Escape to Close

**User Story:** As a keyboard user, I want pressing Escape to dismiss the modal, so that I can quickly exit without using a mouse.

#### Acceptance Criteria

1. WHEN the modal is open and the user presses the Escape key, THE AccessibleModal SHALL close by invoking `onClose`.
2. THE Escape key handling SHALL be provided by `@radix-ui/react-dialog` natively and SHALL NOT be reimplemented with a manual `keydown` listener inside the component.
3. WHEN a consumer passes `preventEscapeClose={true}`, THE AccessibleModal SHALL suppress the default Escape close behavior by setting `onEscapeKeyDown` to call `event.preventDefault()`.

---

### Requirement 5: Focus Trap

**User Story:** As a keyboard or assistive-technology user, I want focus to remain inside the modal while it is open, so that I cannot accidentally interact with content behind the dialog.

#### Acceptance Criteria

1. WHILE the modal is open, THE Focus_Trap SHALL confine Tab and Shift+Tab navigation to interactive elements within the `Dialog_Content`.
2. THE Focus_Trap SHALL be enforced by `@radix-ui/react-dialog` natively without custom implementation.
3. WHEN the modal closes, THE Focus_Trap SHALL release focus and THE AccessibleModal SHALL return focus to the element that was focused before the modal opened.

---

### Requirement 6: Backdrop — Translucent Blurred Overlay

**User Story:** As a user, I want to see a translucent blurred backdrop when the modal is open, so that the modal visually separates from the page content behind it.

#### Acceptance Criteria

1. WHEN the modal opens, THE Dialog_Overlay SHALL render a full-viewport overlay with `background-color: rgba(0, 0, 0, 0.6)` or darker and a `backdrop-filter: blur(4px)` or stronger.
2. THE Dialog_Overlay position SHALL be `fixed` with `inset: 0` so it covers the entire viewport including scrolled areas.
3. WHEN the user clicks the Dialog_Overlay outside the modal panel, THE AccessibleModal SHALL invoke `onClose`.
4. WHEN a consumer passes `preventBackdropClose={true}`, THE AccessibleModal SHALL suppress backdrop-click closing by setting `onInteractOutside` to call `event.preventDefault()`.

---

### Requirement 7: Fade-In / Fade-Out Animation

**User Story:** As a user, I want the modal and backdrop to fade in when opening and fade out when closing, so that the transition feels smooth rather than jarring.

#### Acceptance Criteria

1. WHEN the modal transitions to the open state, THE Dialog_Overlay SHALL animate its opacity from 0 to 1 within 200 ms.
2. WHEN the modal transitions to the open state, THE Dialog_Content SHALL animate its opacity from 0 to 1 and scale from 0.95 to 1 within 200 ms.
3. WHEN the modal transitions to the closed state, THE Dialog_Overlay and Dialog_Content SHALL reverse their enter animations before unmounting.
4. THE animations SHALL use Tailwind CSS `data-[state=open]` and `data-[state=closed]` utilities so that no JavaScript animation library is required.
5. WHERE `prefers-reduced-motion: reduce` is set in the operating system, THE animations SHALL be disabled or reduced to a simple opacity crossfade of 0 ms duration.

---

### Requirement 8: Responsive Viewport Height and Scrollable Body

**User Story:** As a user on any screen size, I want the modal to fit within the viewport with a scrollable content area, so that long modal content is always reachable without breaking the page layout.

#### Acceptance Criteria

1. THE Dialog_Content SHALL apply `max-height: calc(100dvh - 4rem)` (or equivalent responsive constraint) so the panel never extends beyond the visible viewport.
2. THE Modal_Body SHALL apply `overflow-y: auto` so that content taller than the available height becomes independently scrollable.
3. THE Dialog_Content SHALL be centered horizontally and vertically in the viewport using `position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%)`.
4. WHEN the viewport width is less than 640 px (mobile breakpoint), THE Dialog_Content SHALL span full width with a minimum horizontal margin of 1 rem on each side.
5. THE Dialog_Content SHALL support configurable max-width through a `size` prop accepting `'sm' | 'md' | 'lg' | 'xl' | 'full'`, defaulting to `'md'` (`max-width: 28rem`).

---

### Requirement 9: WCAG AA Color Contrast

**User Story:** As a user with low vision or a color deficiency, I want modal text and interactive controls to meet WCAG AA contrast standards, so that I can read and use the modal without assistive contrast tooling.

#### Acceptance Criteria

1. THE modal header text rendered inside `Dialog_Title` SHALL have a contrast ratio of at least 4.5:1 against its background color at normal text sizes (under 18 pt / 24 px).
2. THE close button icon and label SHALL have a contrast ratio of at least 3:1 against the button background in its default and hover states.
3. THE close button SHALL have a visible focus indicator with a contrast ratio of at least 3:1 against the surrounding surface.
4. WHERE the StellarFlow dark theme is active, THE default modal surface color SHALL be `#161b22` and the default header text SHALL be `#ededed`, producing a contrast ratio above 12:1.
5. WHERE the StellarFlow light theme is active, THE default modal surface color SHALL be `#ffffff` and the default header text SHALL be `#171717`, producing a contrast ratio above 17:1.

---

### Requirement 10: Accessible Markup and ARIA

**User Story:** As a screen-reader user, I want the modal to announce itself correctly and expose a readable title, so that I understand the context of the dialog without visual inspection.

#### Acceptance Criteria

1. THE Dialog_Content SHALL carry `aria-modal="true"` so that screen readers restrict virtual-cursor browsing to the modal.
2. THE Dialog_Content SHALL be associated with its heading via `aria-labelledby` pointing to the `Dialog_Title` element ID.
3. WHEN a consumer provides a `description` prop, THE Dialog_Content SHALL be associated with a `DialogPrimitive.Description` element via `aria-describedby`.
4. THE Dialog_Title SHALL always be rendered, even when hidden visually via a `visuallyHidden` prop, so that a screen reader always announces the modal name.
5. WHEN `visuallyHidden` is `true`, THE Dialog_Title SHALL apply the `sr-only` Tailwind utility class to hide it visually while preserving it in the accessibility tree.

---

### Requirement 11: Close Button

**User Story:** As a mouse or touch user, I want a clearly visible close button in the modal header, so that I can dismiss the modal without knowing the keyboard shortcut.

#### Acceptance Criteria

1. THE AccessibleModal SHALL render a `Dialog_Close` button in the top-right corner of the header.
2. THE close button SHALL display an `×` (times) icon from `lucide-react` with a minimum touch target of 44 × 44 CSS pixels.
3. THE close button SHALL have an `aria-label` of `"Close modal"` or a consumer-overridable `closeLabel` prop value.
4. WHEN a consumer passes `showCloseButton={false}`, THE AccessibleModal SHALL not render the close button.

---

### Requirement 12: Consumer API — Props

**User Story:** As a developer, I want a clean, predictable props API for `AccessibleModal`, so that I can integrate it into different features without reading the implementation source.

#### Acceptance Criteria

1. THE AccessibleModal SHALL accept an `isOpen: boolean` prop to control the open/closed state.
2. THE AccessibleModal SHALL accept an `onClose: () => void` prop called when the modal requests dismissal.
3. THE AccessibleModal SHALL accept a `title: string` prop rendered as the accessible dialog heading.
4. THE AccessibleModal SHALL accept a `children: React.ReactNode` prop rendered inside the scrollable Modal_Body.
5. THE AccessibleModal SHALL accept optional props: `description`, `size`, `showCloseButton`, `closeLabel`, `preventEscapeClose`, `preventBackdropClose`, `className`, and `visuallyHidden`.
6. THE AccessibleModal SHALL be typed with an exported `AccessibleModalProps` TypeScript interface so consumers have full type safety.
