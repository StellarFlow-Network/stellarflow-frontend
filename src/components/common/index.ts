/**
 * src/components/common/index.ts
 *
 * Barrel file -- re-exports public common UI components and utilities.
 */

export { TokenBadge, type TokenBadgeProps } from './TokenBadge';

export {
  SocialShareModal,
  type SocialShareModalProps,
  type SocialShareData,
  type ShareCategory,
} from './SocialShareModal';

export {
  SpreadWarningToast,
  type SpreadWarningToastProps,
  type OrderBookLevel,
  type SpreadAnalysis,
  analyzeSpread,
} from './SpreadWarningToast';
