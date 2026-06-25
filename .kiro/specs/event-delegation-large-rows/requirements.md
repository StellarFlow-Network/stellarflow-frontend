# Requirements Document

## Introduction

The StellarFlow frontend currently renders large data tables — including the Consumer Subscriptions table, the Relayer Management table, and the Relayer Status table — by mapping over data arrays and rendering individual row components (`ConsumerTableRow`, `RelayerManagementRow`, `RelayerRow`). Each interactive element inside those rows (e.g. "View Contract" buttons, action menus) attaches its own React synthetic event handler, resulting in a handler-per-row allocation that grows linearly with table size.

This feature migrates all per-row interactive event handling in those tables to a centralized event-delegation model. A single `onClick` listener is attached to the parent `<tbody>` (or its wrapping container) rather than to individual rows. Delegated handlers identify the target row and action by reading `data-*` attributes stamped onto the row's interactive elements, then dispatch the correct action through a centralized handler function. The migration must preserve all existing user-facing behavior, maintain React 19 / Next.js 16 compatibility, and introduce no new third-party dependencies.

## Glossary

- **DelegatedTable**: A table component that uses a single parent-level `onClick` handler to process all row interactions via event delegation.
- **DelegationHandler**: The centralized function that receives a delegated click event, reads `data-*` attributes from the event target or its closest interactive ancestor, and dispatches the correct action.
- **Row_Action**: A discrete user-triggered operation associated with a single table row (e.g., "view-contract", "open-menu", "copy-address").
- **data-row-id**: An HTML `data-*` attribute placed on a row's interactive element (or the `<tr>` itself) that stores the unique identifier of the row's record.
- **data-action**: An HTML `data-*` attribute placed on a row's interactive element that identifies the Row_Action to perform.
- **ConsumerTable**: The table rendered on the Consumer Subscriptions page (`/consumers`) that displays `ConsumerTableRecord` rows via `ConsumerTableRow`.
- **RelayerManagementTable**: The table rendered on the Relayer Management page (`/relayers`) that displays `RelayerManagementRecord` rows via `RelayerManagementRow`.
- **RelayerStatusTable**: The shared component (`RelayerStatusTable.tsx`) that renders `Relayer` rows via the inner `RelayerRow` component.
- **Event_Bubbling**: The DOM mechanism by which a click event on a child element propagates upward through its ancestors, enabling a parent listener to intercept it.
- **closest()**: The native DOM method used to walk up the DOM tree from the event target until an element matching a given CSS selector is found.

---

## Requirements

### Requirement 1: Centralized DelegationHandler Utility

**User Story:** As a frontend engineer, I want a reusable delegation handler utility, so that all tables can share a single, tested implementation rather than duplicating event-routing logic per component.

#### Acceptance Criteria

1. THE DelegationHandler SHALL accept a `React.MouseEvent<HTMLElement>` and a handler map of type `Record<string, (rowId: string, event: React.MouseEvent<HTMLElement>) => void>`.
2. WHEN a click event is dispatched, THE DelegationHandler SHALL search for the nearest ancestor-or-self of `event.target` that carries a `data-action` attribute, bounded by the `<tbody>` element on which the handler is registered, without traversing outside that boundary.
3. WHEN `event.target` is `null` or not an `Element`, THE DelegationHandler SHALL return immediately without invoking any callback and without throwing an error.
4. WHEN no element with a `data-action` attribute exists within the traversal boundary, THE DelegationHandler SHALL return without invoking any callback and without throwing an error.
5. WHEN a `data-action` attribute is found but its value is not a key in the handler map, THE DelegationHandler SHALL emit a `console.warn` message that includes the unrecognised action string and return without invoking any callback.
6. IF the resolved element carries both a `data-action` key present in the handler map and a non-empty `data-row-id` attribute, THEN THE DelegationHandler SHALL invoke the matching callback synchronously, passing the `data-row-id` string value as the first argument and the original event as the second argument.
7. IF the resolved element carries a recognised `data-action` but `data-row-id` is absent or empty, THEN THE DelegationHandler SHALL emit a `console.warn` message identifying the missing `data-row-id` and return without invoking any callback.
8. IF the handler map argument is `null`, `undefined`, or an empty object at call time, THEN THE DelegationHandler SHALL return immediately without traversing the DOM and without throwing an error.
9. THE DelegationHandler SHALL be exported as a named pure function `handleDelegatedClick` from a dedicated utility module at `src/utils/tableDelegation.ts`, with no side-effects outside the function body.

---

### Requirement 2: ConsumerTable Event Delegation

**User Story:** As a user of the Consumer Subscriptions page, I want clicking "View Contract" to open the contract details without perceiving any behavioral change, so that the migration is transparent to me regardless of how many consumer rows are displayed.

#### Acceptance Criteria

1. THE ConsumerTable SHALL attach a single `onClick` handler to the `<tbody>` element that wraps all `ConsumerTableRow` instances.
2. THE ConsumerTableRow SHALL NOT attach any `onClick` handler directly to the "View Contract" `<button>` element.
3. WHEN a consumer row is rendered, THE ConsumerTableRow SHALL set `data-action` to the string `"view-contract"` and `data-row-id` to the string value of that consumer record's unique identifier on the "View Contract" `<button>` element.
4. WHEN the delegated `onClick` fires on the `<tbody>` and the click target's nearest ancestor-or-self `<button>` within the row carries `data-action="view-contract"`, THE ConsumerTable SHALL invoke the `onViewContract` callback with the string value of that button's `data-row-id` attribute as its sole argument.
5. IF a click event reaches the `<tbody>` handler and no `data-action` attribute exists in the event path up to the `<tbody>`, THEN THE ConsumerTable SHALL NOT invoke the `onViewContract` callback.
6. THE ConsumerTable SHALL register the `onClick` handler on the `<tbody>` exactly once on mount and SHALL NOT re-register it when rows are added to or removed from the table.

---

### Requirement 3: RelayerManagementTable Event Delegation

**User Story:** As a user of the Relayer Management page, I want the row action menu to open correctly when I click the "more options" icon, so that relayer management actions remain fully functional after the delegation migration.

#### Acceptance Criteria

1. THE RelayerManagementTable SHALL attach a single `onClick` handler to the `<tbody>` element that wraps all `RelayerManagementRow` instances.
2. THE RelayerManagementRow SHALL NOT attach any `onClick` handler directly to the action menu `<button>` element.
3. WHEN a relayer management row is rendered, THE RelayerManagementRow SHALL stamp `data-action="open-menu"` and `data-row-id` set to the string value of that relayer record's unique identifier on the action menu `<button>` element.
4. WHEN the delegated `onClick` fires on the `<tbody>` and `event.target.closest('[data-action]')` resolves to an element with `data-action="open-menu"`, IF that element also carries a non-empty `data-row-id`, THEN THE RelayerManagementTable SHALL invoke `onOpenMenu` with signature `(relayerId: string) => void`, passing the `data-row-id` value as `relayerId`.
5. IF a click event reaches the `<tbody>` handler and `event.target.closest('[data-action]')` returns `null` or an element whose `data-action` value is not `"open-menu"`, THEN THE RelayerManagementTable SHALL NOT invoke the `onOpenMenu` callback.
6. WHERE the RelayerManagementTable renders more than 500 rows, THE RelayerManagementTable SHALL maintain a maximum of one `onClick` event listener on the `<tbody>` element regardless of row count.

---

### Requirement 4: RelayerStatusTable Event Delegation

**User Story:** As a user viewing the Relayer Status widget, I want any row-level interactions to continue working correctly, so that the delegation refactor does not break the embedded status table used across multiple pages.

#### Acceptance Criteria

1. THE RelayerStatusTable SHALL attach a single `onClick` handler to the `<tbody>` element that wraps all `RelayerRow` instances.
2. THE RelayerRow SHALL NOT attach any `onClick` handler directly to any element within its `<tr>` subtree.
3. IF a `RelayerRow` renders an interactive element that supports a Row_Action, THEN THE RelayerRow SHALL place `data-action` set to the action string and `data-row-id` set to the relayer record's unique identifier on that interactive element itself.
4. WHEN the delegated `onClick` fires on the `<tbody>` and `event.target.closest('[data-action]')` bounded by the `<tbody>` resolves to an element whose `data-action` value is a key in the registered handler map, THE RelayerStatusTable SHALL invoke `onRowAction(relayerId: string, action: string)` with the resolved `data-row-id` and `data-action` values.
5. IF a click event reaches the `<tbody>` handler and no `data-action` attribute exists in the event path up to the `<tbody>`, THEN THE RelayerStatusTable SHALL perform no action and SHALL NOT invoke `onRowAction`.
6. WHEN the delegated `onClick` fires on the `<tbody>` and the resolved `data-action` value is not a key in the registered handler map, THE RelayerStatusTable SHALL NOT invoke `onRowAction` and SHALL allow the DelegationHandler to emit its standard unrecognised-action warning.

---

### Requirement 5: data-* Attribute Contract

**User Story:** As a frontend engineer, I want a clearly defined contract for `data-*` attribute naming and placement, so that all table components follow a consistent pattern that the DelegationHandler can rely on.

#### Acceptance Criteria

1. THE DelegatedTable SHALL place `data-action` and `data-row-id` attributes on the same DOM element — specifically the element that is matched by `event.target.closest('[data-action]')` from the user's click point.
2. WHEN a `data-action` value is defined for a table component, THE DelegatedTable SHALL enumerate all valid `data-action` strings for that component in a `@remarks` JSDoc block on the component function, formatted as a bulleted list.
3. THE DelegatedTable SHALL use kebab-case strings for all `data-action` values (e.g., `"view-contract"`, `"open-menu"`, `"copy-address"`).
4. IF a Row_Action requires additional context beyond `data-row-id`, THEN THE DelegatedTable SHALL encode that context in one or more additional `data-*` attributes on the same element as `data-action` and `data-row-id` (e.g., `data-contract-address`).
5. THE DelegatedTable SHALL ensure that `data-row-id` values are stable across re-renders by deriving them exclusively from the record's primary `id` field, without appending indexes, timestamps, or other volatile values.
6. WHEN THE DelegationHandler encounters additional `data-*` attributes on the resolved element alongside `data-action` and `data-row-id`, THE DelegationHandler SHALL collect those attributes into a `Record<string, string>` and pass it as a third argument to the matching callback with signature `(rowId: string, event: React.MouseEvent<HTMLElement>, extraData: Record<string, string>) => void`.

---

### Requirement 6: No Behavioral Regression

**User Story:** As a product owner, I want all existing table interactions to work identically after the migration, so that users experience no disruption.

#### Acceptance Criteria

1. WHEN a user clicks "View Contract" on any ConsumerTableRow after migration, THE ConsumerTable SHALL invoke `onViewContract` with the same consumer identifier that the pre-migration per-row handler would have used, as defined in Requirement 2 criterion 4.
2. WHEN a user clicks the action menu icon on any RelayerManagementRow after migration, THE RelayerManagementTable SHALL invoke `onOpenMenu` with the same relayer identifier that the pre-migration per-row handler would have used, as defined in Requirement 3 criterion 4.
3. THE ConsumerTable and RelayerManagementTable SHALL NOT pass the delegation handler function as a prop to `ConsumerTableRow` or `RelayerManagementRow` respectively, ensuring row components are not forced to re-render when the handler reference changes.
4. WHEN the DelegationHandler is used as a `<tbody>` `onClick` prop, THE ConsumerTable and RelayerManagementTable SHALL wrap the handler in `React.useCallback` whose dependency array contains only the action-callback map object, and that map object SHALL itself be referentially stable across renders unless its callbacks change.
5. WHEN an error is thrown synchronously inside a Row_Action callback invoked by THE DelegationHandler, THE DelegationHandler SHALL not wrap the callback invocation in a try/catch block, allowing the error to propagate synchronously to React's error boundary mechanism.

---

### Requirement 7: Memory and Performance Constraints

**User Story:** As a performance-conscious engineer, I want the delegation approach to reduce total event listener count at scale, so that memory usage and scroll performance improve when tables grow beyond 500 rows.

#### Acceptance Criteria

1. WHEN a DelegatedTable mounts with N rows (N ≥ 1), THE DelegatedTable SHALL register exactly one `onClick` listener on the `<tbody>` element, not N listeners.
2. WHEN rows are added or removed from a DelegatedTable, THE DelegatedTable SHALL NOT register additional `onClick` listeners on the `<tbody>` element.
3. WHEN a DelegatedTable unmounts, THE DelegatedTable SHALL release the `<tbody>` `onClick` listener such that zero `onClick` listeners remain registered on that `<tbody>` element after unmount.
4. WHEN the number of rendered rows increases from 100 to 10,000 while DOM nesting depth per row remains constant, THE DelegationHandler's time to resolve the target element from a click event SHALL NOT increase proportionally to the row count increase.
5. WHILE a DelegatedTable is rendering 1000 or more rows and the user performs continuous vertical scrolling for 5 seconds on a reference device (a mid-range laptop with hardware acceleration enabled), THE DelegatedTable SHALL maintain a frame rate of at least 60 fps as measured by the browser's performance profiler, without introducing frame drops attributable to click-event listener registration.
