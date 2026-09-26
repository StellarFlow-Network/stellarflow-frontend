/**
 * src/components/ui/index.ts
 *
 * Barrel file — re-exports public UI components and utilities.
 */

export {
  AddressBadge,
  JazziconAvatar,
  truncateAddress,
  generateAvatarColors,
  type AddressBadgeProps,
  type AddressBadgeSize,
  type JazziconAvatarProps,
  type TruncateAddressOptions,
  type AvatarPalette,
} from "./AddressBadge";

export { AnimatedActionButton, PageTransition } from "./PageTransition";

export {
  ErrorBoundary,
  DefaultErrorFallback,
  type ErrorBoundaryProps,
} from "./ErrorBoundary";

export { DeFiTooltip, type DeFiTooltipProps } from "./DeFiTooltip";
export { DeFiTerm, type DeFiTermProps } from "./DeFiTerm";

export {
  IdenticonAvatar,
  IDENTICON_SIZE_PX,
  IDENTICON_GRID,
  DARK_UI_BACKGROUND,
  fnv1a32,
  generateIdenticonPalette,
  buildIdenticonMatrix,
  meetsWcagAaOnDark,
  type IdenticonAvatarProps,
  type IdenticonAvatarSize,
  type IdenticonPalette,
} from "./IdenticonAvatar";
