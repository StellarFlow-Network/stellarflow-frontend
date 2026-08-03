/**
 * src/components/ui/index.ts
 *
 * Barrel file — re-exports every public symbol from the ui/ component
 * directory so consumers can import from a single stable path:
 *
 *   import { AddressBadge, truncateAddress, JazziconAvatar } from '@/components/ui'
 */

export {
  // Component
  AddressBadge,
  // Sub-component (useful when embedding the avatar standalone)
  JazziconAvatar,
  // Pure helpers
  truncateAddress,
  generateAvatarColors,
  // TypeScript interfaces & types
  type AddressBadgeProps,
  type AddressBadgeSize,
  type AddressBadgeSize,
  type JazziconAvatarProps,
  type TruncateAddressOptions,
  type AvatarPalette,
} from "./AddressBadge";

export { AnimatedActionButton, PageTransition } from "./PageTransition";
