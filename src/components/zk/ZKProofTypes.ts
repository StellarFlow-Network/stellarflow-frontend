export interface ZKProofStage {
  id: string;
  label: string;
  description: string;
}

export const ZK_PROOF_STAGES: ZKProofStage[] = [
  {
    id: "compiling-witness",
    label: "Compiling Witness",
    description: "Building the witness from private inputs",
  },
  {
    id: "computing-proof",
    label: "Computing Proof",
    description: "Generating Groth16 zero-knowledge proof",
  },
  {
    id: "verifying-proof",
    label: "Verifying Local Proof",
    description: "Checking proof validity before submission",
  },
  {
    id: "submitting-payload",
    label: "Submitting Payload",
    description: "Sending proof to the network",
  },
];

export interface ZKProofProgressState {
  currentStage: number;
  stageProgress: number;
  overallProgress: number;
  cpuThreads: number;
  estimatedTimeRemaining: number;
  error: string | null;
  isComplete: boolean;
}

export type ZKProofStatus = "idle" | "running" | "completed" | "error";

export interface ZKProofConfig {
  onComplete?: (proof: string) => void;
  onError?: (error: string) => void;
  maxRetries?: number;
}