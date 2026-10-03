"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Icon from "@/components/icons/Icon";
import { ICON_IDS } from "@/components/icons/iconIds";
import { ZK_PROOF_STAGES, ZKProofProgressState, ZKProofStatus, type ZKProofConfig } from "./ZKProofTypes";

const STAGE_ESTIMATED_TIMES = [15, 45, 10, 5]; // seconds per stage

export interface ZKProofProgressLoaderProps {
  /** Trigger the proof generation */
  isActive: boolean;
  /** Configuration callbacks */
  config?: ZKProofConfig;
  /** Custom className */
  className?: string;
  /** Show compact version */
  compact?: boolean;
}

export function ZKProofProgressLoader({
  isActive,
  config,
  className = "",
  compact = false,
}: ZKProofProgressLoaderProps) {
  const [progressState, setProgressState] = useState<ZKProofProgressState>({
    currentStage: 0,
    stageProgress: 0,
    overallProgress: 0,
    cpuThreads: navigator.hardwareConcurrency || 4,
    estimatedTimeRemaining: STAGE_ESTIMATED_TIMES.reduce((a, b) => a + b, 0),
    error: null,
    isComplete: false,
  });
  const [status, setStatus] = useState<ZKProofStatus>("idle");
  const [retryCount, setRetryCount] = useState(0);
  const animationFrameRef = useRef<number | null>(null);
  const stageStartTimeRef = useRef<number>(0);
  const maxRetries = config?.maxRetries ?? 3;
  const simulationRef = useRef<{ running: boolean; cancelled: boolean }>({ running: false, cancelled: false });

  const resetState = useCallback(() => {
    setProgressState({
      currentStage: 0,
      stageProgress: 0,
      overallProgress: 0,
      cpuThreads: navigator.hardwareConcurrency || 4,
      estimatedTimeRemaining: STAGE_ESTIMATED_TIMES.reduce((a, b) => a + b, 0),
      error: null,
      isComplete: false,
    });
    setStatus("idle");
    setRetryCount(0);
    simulationRef.current = { running: false, cancelled: false };
  }, []);

  const updateProgress = useCallback(() => {
    setProgressState((prev) => {
      if (!isActive || status !== "running") return prev;

      const now = Date.now();
      const elapsed = (now - stageStartTimeRef.current) / 1000;
      const stageEstimate = STAGE_ESTIMATED_TIMES[prev.currentStage] || 5;
      const stageProgress = Math.min(100, (elapsed / stageEstimate) * 100);

      // Calculate overall progress
      const completedStages = prev.currentStage;
      const overallProgress = Math.min(
        99,
        (completedStages / ZK_PROOF_STAGES.length) * 100 + (stageProgress / ZK_PROOF_STAGES.length)
      );

      // Estimate remaining time
      const remainingStages = STAGE_ESTIMATED_TIMES.slice(prev.currentStage);
      const currentStageRemaining = Math.max(0, stageEstimate - elapsed);
      const estimatedTimeRemaining = currentStageRemaining + remainingStages.slice(1).reduce((a, b) => a + b, 0);

      // Simulate CPU thread fluctuation
      const baseThreads = navigator.hardwareConcurrency || 4;
      const cpuThreads = Math.max(1, baseThreads - Math.floor(Math.random() * 2));

      // Check if stage is complete
      if (stageProgress >= 100 && prev.currentStage < ZK_PROOF_STAGES.length - 1) {
        stageStartTimeRef.current = Date.now();
        return {
          ...prev,
          currentStage: prev.currentStage + 1,
          stageProgress: 0,
          overallProgress,
          estimatedTimeRemaining,
          cpuThreads,
        };
      }

      // Check if all stages complete
      if (stageProgress >= 100 && prev.currentStage === ZK_PROOF_STAGES.length - 1) {
        return {
          ...prev,
          stageProgress: 100,
          overallProgress: 100,
          estimatedTimeRemaining: 0,
          cpuThreads,
          isComplete: true,
        };
      }

      return {
        ...prev,
        stageProgress,
        overallProgress,
        estimatedTimeRemaining,
        cpuThreads,
      };
    });
  }, [isActive, status]);

  // Animation loop for progress updates
  useEffect(() => {
    if (isActive && status === "running") {
      const tick = () => {
        updateProgress();
        animationFrameRef.current = requestAnimationFrame(tick);
      };
      animationFrameRef.current = requestAnimationFrame(tick);
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isActive, status, updateProgress]);

  // Main effect for running the proof generation simulation
  useEffect(() => {
    if (!isActive) {
      if (simulationRef.current.running) {
        simulationRef.current.cancelled = true;
        simulationRef.current.running = false;
      }
      return;
    }

    // Start simulation
    if (!simulationRef.current.running) {
      simulationRef.current = { running: true, cancelled: false };
      setStatus("running");
      stageStartTimeRef.current = Date.now();

      // Simulate the proof generation process
      const simulateProofGeneration = async () => {
        try {
          for (let i = 0; i < ZK_PROOF_STAGES.length; i++) {
            if (simulationRef.current.cancelled || status !== "running") break;
            const stageTime = STAGE_ESTIMATED_TIMES[i] * 1000;
            await new Promise((resolve) => setTimeout(resolve, stageTime));
          }

          if (!simulationRef.current.cancelled && status === "running") {
            setProgressState((prev) => ({
              ...prev,
              overallProgress: 100,
              stageProgress: 100,
              estimatedTimeRemaining: 0,
              isComplete: true,
            }));
            setStatus("completed");
            simulationRef.current.running = false;
            config?.onComplete?.("mock-proof-" + Date.now());
          }
        } catch (err) {
          if (!simulationRef.current.cancelled) {
            const errorMessage = err instanceof Error ? err.message : "Proof generation failed";
            setProgressState((prev) => ({ ...prev, error: errorMessage }));
            setStatus("error");
            simulationRef.current.running = false;
            config?.onError?.(errorMessage);
          }
        }
      };

      simulateProofGeneration();
    }

    return () => {
      simulationRef.current.cancelled = true;
      simulationRef.current.running = false;
    };
  }, [isActive, config, status]);

  const handleRetry = useCallback(() => {
    if (retryCount >= maxRetries) return;
    setRetryCount((c) => c + 1);
    resetState();
    stageStartTimeRef.current = Date.now();
    setStatus("running");
  }, [retryCount, maxRetries, resetState]);

  const handleDismiss = useCallback(() => {
    config?.onError?.("Dismissed by user");
    resetState();
  }, [config, resetState]);

  const currentStage = ZK_PROOF_STAGES[progressState.currentStage];
  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${Math.ceil(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.ceil(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  if (!isActive && status === "idle") {
    return null;
  }

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        className={`flex items-center gap-3 p-3 bg-[#161b22] border border-gray-800 rounded-lg ${className}`}
      >
        <div className="relative w-8 h-8">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="#2d3748"
              strokeWidth="4"
            />
            <motion.circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="#39FF14"
              strokeWidth="4"
              strokeDasharray={283}
              strokeDashoffset={283 * (1 - progressState.overallProgress / 100)}
              strokeLinecap="round"
              className="transition-all duration-300"
              animate={{ strokeDashoffset: 283 * (1 - progressState.overallProgress / 100) }}
            />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">
            {currentStage?.label ?? "Generating proof…"}
          </p>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden mt-1">
            <motion.div
              className="h-full bg-blue-500"
              initial={{ width: 0 }}
              animate={{ width: `${progressState.overallProgress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
        {status === "error" && (
          <button
            onClick={handleRetry}
            disabled={retryCount >= maxRetries}
            className="px-2 py-1 text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50"
          >
            Retry
          </button>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm ${className}`}
    >
      <motion.div
        className="w-full max-w-lg bg-[#161b22] border border-gray-800 rounded-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Zero-Knowledge Proof Generation"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Icon id={ICON_IDS.shield} size={20} className="text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Generating ZK Proof</h2>
              <p className="text-xs text-gray-500">Groth16 shielded transfer</p>
            </div>
          </div>
          {status === "completed" && (
            <span className="flex items-center gap-1 text-xs font-medium text-emerald-400">
              <Icon id={ICON_IDS.checkCircle} size={12} />
              Complete
            </span>
          )}
        </div>

        {/* Progress Bar */}
        <div className="h-1 bg-gray-800 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
            initial={{ width: 0 }}
            animate={{ width: `${progressState.overallProgress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>

        {/* Stage Indicators */}
        <div className="p-4 space-y-3">
          {ZK_PROOF_STAGES.map((stage, index) => {
            const isCurrent = index === progressState.currentStage;
            const isComplete = index < progressState.currentStage;
            const isError = status === "error" && isCurrent;

            return (
              <motion.div
                key={stage.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  isCurrent ? "bg-blue-500/10 border border-blue-500/30" : "bg-[#0d1117] border border-gray-700"
                } ${isError && "border-rose-500/30"}`}
              >
                {/* Stage Icon */}
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    isComplete
                      ? "bg-emerald-500/20 text-emerald-400"
                      : isCurrent
                      ? "bg-blue-500/20 text-blue-400 animate-pulse"
                      : isError
                      ? "bg-rose-500/20 text-rose-400"
                      : "bg-gray-700/50 text-gray-500"
                  }`}
                >
                  {isComplete ? (
                    <Icon id={ICON_IDS.check} size={16} />
                  ) : isCurrent ? (
                    <Icon id={ICON_IDS.rotateCcw} size={16} className="animate-spin" />
                  ) : isError ? (
                    <Icon id={ICON_IDS.alertTriangle} size={16} />
                  ) : (
                    <span className="text-xs font-bold">{index + 1}</span>
                  )}
                </div>

                {/* Stage Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className={`text-sm font-medium ${isCurrent ? "text-blue-400" : "text-white"}`}>
                      {stage.label}
                    </p>
                    {isCurrent && (
                      <span className="text-xs font-mono text-blue-400">
                        {Math.round(progressState.stageProgress)}%
                      </span>
                    )}
                    {isComplete && (
                      <span className="text-xs text-emerald-400">Done</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate">{stage.description}</p>
                  {isCurrent && progressState.stageProgress > 0 && (
                    <div className="h-1 bg-gray-800 rounded-full overflow-hidden mt-2">
                      <motion.div
                        className="h-full bg-blue-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${progressState.stageProgress}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Stats Panel */}
        <AnimatePresence mode="wait">
          {status === "running" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-gray-800 p-4 bg-[#0d1117]"
            >
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold font-mono text-[#39FF14]">
                    {progressState.cpuThreads}
                  </p>
                  <p className="text-xs text-gray-500">CPU Threads</p>
                </div>
                <div>
                  <p className="text-2xl font-bold font-mono text-blue-400">
                    {formatTime(progressState.estimatedTimeRemaining)}
                  </p>
                  <p className="text-xs text-gray-500">Est. Remaining</p>
                </div>
                <div>
                  <p className="text-2xl font-bold font-mono text-white">
                    {Math.round(progressState.overallProgress)}%
                  </p>
                  <p className="text-xs text-gray-500">Overall Progress</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error State */}
        <AnimatePresence mode="wait">
          {status === "error" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="border-t border-gray-800 p-4 bg-rose-500/10"
            >
              <div className="flex items-center gap-3 text-rose-400 mb-3">
                <Icon id={ICON_IDS.alertTriangle} size={20} />
                <div>
                  <p className="font-medium">Proof Generation Failed</p>
                  <p className="text-sm text-gray-400">{progressState.error}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleRetry}
                  disabled={retryCount >= maxRetries}
                  className="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-600/50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                >
                  <Icon id={ICON_IDS.refreshCcw} size={16} className="inline-block mr-1" />
                  {retryCount >= maxRetries ? "Max Retries Reached" : `Retry (${retryCount + 1}/${maxRetries})`}
                </button>
                <button
                  onClick={handleDismiss}
                  className="flex-1 px-4 py-2 border border-gray-700 hover:border-gray-600 text-gray-300 rounded-lg font-medium transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Complete State */}
        <AnimatePresence mode="wait">
          {status === "completed" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="border-t border-gray-800 p-4 bg-emerald-500/10"
            >
              <div className="flex items-center gap-3 text-emerald-400 mb-3">
                <Icon id={ICON_IDS.checkCircle} size={20} />
                <div>
                  <p className="font-medium">Proof Generated Successfully</p>
                  <p className="text-sm text-gray-400">Ready for submission</p>
                </div>
              </div>
              <button
                onClick={handleDismiss}
                className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
              >
                Continue
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}