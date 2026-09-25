/**
 * src/components/amm/index.ts
 *
 * Barrel file — re-exports public AMM components and utilities.
 */

export {
  ILMitigationScoreWidget,
  type ILMitigationScoreWidgetProps,
} from "./ILMitigationScoreWidget";

export {
  computeIlMitigation,
  computeIlMitigationForPosition,
  type IlMitigationInput,
  type IlMitigationPositionInput,
  type IlMitigationScore,
  type IlMitigationStatus,
} from "./ilMitigationScore";
