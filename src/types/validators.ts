export type ValidatorStatus = 'active' | 'jailed' | 'offline';

export interface ValidatorNode {
  id: string;
  name: string;
  address: string;
  uptime: number;
  missedBlocks: number;
  slashingEvents: number;
  stakedXlm: number;
  status: ValidatorStatus;
}

/** Row count used by the audit table skeleton to reserve stable vertical space. */
export const VALIDATOR_TABLE_ROW_COUNT = 4;

/** Pixel heights matching py-3/py-4 + text-xs/text-sm line boxes on the audit table. */
export const VALIDATOR_TABLE_HEADER_HEIGHT_PX = 41;
export const VALIDATOR_TABLE_ROW_HEIGHT_PX = 53;

/** Minimum inner height for each overview metric card (p-4 + label + value). */
export const VALIDATOR_METRIC_CARD_MIN_HEIGHT_PX = 112;
