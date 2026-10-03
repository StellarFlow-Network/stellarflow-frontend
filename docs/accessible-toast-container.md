# Accessible Toast Container

## Accessibility behavior

- Informational, success, and warning notifications use `aria-live="polite"`.
- Error notifications use `aria-live="assertive"`.
- Every toast has a named dismiss button.
- Swipe is an additional interaction, not the only dismissal path.
- `useReducedMotion()` reduces movement for users who prefer less motion.
- The container is mounted once and labelled `Notifications`.

## Integration checklist

- Verify the application's existing notification store and removal API.
- Confirm the project’s CSS variable names for light and dark themes.
- Test keyboard focus, Escape behavior if required by the host system, and dismissal by button.
- Test touch swipe with Playwright on mobile emulation.
- Validate announcements with NVDA, VoiceOver, or another supported screen reader.
- Confirm that critical errors are not communicated only through an auto-disappearing toast.
