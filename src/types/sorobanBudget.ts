export interface SorobanResourceMetrics {
  cpuInstructions: number;
  memoryBytes: number;
  writeBytes?: number;
  readBytes?: number;
}

export interface SorobanBudgetLimits {
  maxCpuInstructions: number;
  maxMemoryBytes: number;
}

export const DEFAULT_SOROBAN_LIMITS: SorobanBudgetLimits = {
  maxCpuInstructions: 100000000,
  maxMemoryBytes: 41943040,
};
