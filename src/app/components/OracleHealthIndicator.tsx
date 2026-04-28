import * as React from "react";
import PulseCanvas from "@/app/components/PulseCanvas";

type OracleStatus = "Online" | "Offline" | "Lagging";

interface OracleHealthIndicatorProps {
  status?: OracleStatus;
}

const statusConfig: Record<
  OracleStatus,
  {
    label: string;
    textColor: string;
    dotColor: string;
    dotGlow: string;
    pulse: boolean;
    pulseColor: string;
  }
> = {
  Online: {
    label: "Online",
    textColor: "text-[#39FF14]",
    dotColor: "#39FF14",
    dotGlow: "shadow-[0_0_8px_3px_rgba(57,255,20,0.8)]",
    pulse: true,
    pulseColor: "#39FF14",
  },
  Offline: {
    label: "Offline",
    textColor: "text-red-500",
    dotColor: "#EF4444",
    dotGlow: "shadow-[0_0_8px_3px_rgba(239,68,68,0.7)]",
    pulse: false,
    pulseColor: "#EF4444",
  },
  Lagging: {
    label: "Lagging",
    textColor: "text-yellow-400",
    dotColor: "#FACC15",
    dotGlow: "shadow-[0_0_8px_3px_rgba(250,204,21,0.7)]",
    pulse: false,
    pulseColor: "#FACC15",
  },
};

const OracleHealthIndicator = ({ status = "Online" }: OracleHealthIndicatorProps) => {
  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-2">
      {/* Label */}
      <span className="text-sm font-bold font-mono tracking-widest text-zinc-400">
        Oracle Health:
      </span>

      {/* Status text */}
      <span className={`text-sm font-bold font-mono tracking-widest ${config.textColor}`}>
        [ {config.label} ]
      </span>

      {/* Status dot with canvas-based pulse */}
      <div className="relative flex items-center justify-center w-4 h-4 ml-1">
        {config.pulse ? (
          // Offscreen canvas pulse animation for online state
          <PulseCanvas
            width={24}
            height={24}
            nodeCount={1}
            pulseColor={config.pulseColor}
            glowColor={config.pulseColor}
            pulseSpeed={0.05}
            className="absolute inset-0"
            aria-hidden="true"
          />
        ) : (
          // Static glow for offline/lagging states
          <div
            className="absolute w-4 h-4 rounded-full"
            style={{
              backgroundColor: config.dotColor,
              boxShadow: config.dotGlow.replace("shadow-", ""),
            }}
            aria-hidden="true"
          />
        )}
        {/* Core dot */}
        <div
          className={`relative w-3 h-3 rounded-full ${config.pulse ? "" : "animate-pulse"}`}
          style={{ backgroundColor: config.dotColor }}
        />
      </div>
    </div>
  );
};

export default OracleHealthIndicator;
