import * as React from "react";
import PulseCanvas from "@/app/components/PulseCanvas";

type HealthStatus = "ACTIVE" | "INACTIVE" | "WARNING";

interface GlobalHealthIndicatorProps {
  status?: HealthStatus;
}

const statusConfig: Record<
  HealthStatus,
  { label: string; textColor: string; dotColor: string; dotGlow: string; pulseColor: string }
> = {
  ACTIVE: {
    label: "ACTIVE",
    textColor: "text-[#39FF14]",
    dotColor: "#39FF14",
    dotGlow: "shadow-[0_0_8px_3px_rgba(57,255,20,0.8)]",
    pulseColor: "#39FF14",
  },
  INACTIVE: {
    label: "INACTIVE",
    textColor: "text-zinc-400",
    dotColor: "#A1A1AA",
    dotGlow: "shadow-[0_0_6px_2px_rgba(161,161,170,0.4)]",
    pulseColor: "#A1A1AA",
  },
  WARNING: {
    label: "WARNING",
    textColor: "text-yellow-400",
    dotColor: "#FACC15",
    dotGlow: "shadow-[0_0_8px_3px_rgba(250,204,33,0.7)]",
    pulseColor: "#FACC15",
  },
};

const GlobalHealthIndicator = ({ status = "ACTIVE" }: GlobalHealthIndicatorProps) => {
  const config = statusConfig[status];
  const isActive = status === "ACTIVE";

  return (
    <div className="flex items-center gap-2">
      {/* Label */}
      <span className={`text-sm font-bold font-mono tracking-widest ${config.textColor}`}>
        Global Health:
      </span>

      {/* Status */}
      <span className={`text-sm font-bold font-mono tracking-widest ${config.textColor}`}>
        [ {config.label.charAt(0) + config.label.slice(1).toLowerCase()} ]
      </span>

      {/* Canvas-based pulse orb */}
      <div className="relative flex items-center justify-center w-4 h-4 ml-1">
        {isActive ? (
          // Offscreen canvas pulse animation for active state
          <PulseCanvas
            width={24}
            height={24}
            nodeCount={1}
            pulseColor={config.pulseColor}
            glowColor={config.pulseColor}
            pulseSpeed={0.04}
            className="absolute inset-0"
            aria-hidden="true"
          />
        ) : (
          // Static glow for inactive/warning states
          <div
            className={`absolute w-4 h-4 rounded-full ${config.dotGlow}`}
            aria-hidden="true"
          />
        )}
        {/* Core dot */}
        <div
          className={`relative w-3 h-3 rounded-full`}
          style={{ backgroundColor: config.dotColor }}
        />
      </div>
    </div>
  );
};

export default GlobalHealthIndicator;
