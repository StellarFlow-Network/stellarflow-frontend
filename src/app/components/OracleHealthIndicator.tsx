import React from "react";

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
    /** animate-pulse is only applied for the Online state per guardrail */
    pulse: boolean;
  }
> = {
  Online: {
    label: "Online",
    textColor: "text-[#39FF14]",
    dotColor: "bg-[#39FF14]",
    dotGlow: "shadow-[0_0_8px_3px_rgba(57,255,20,0.8)]",
    pulse: true,
  },
  Offline: {
    label: "Offline",
    textColor: "text-red-500",
    dotColor: "bg-red-500",
    dotGlow: "shadow-[0_0_8px_3px_rgba(239,68,68,0.7)]",
    pulse: false,
  },
  Lagging: {
    label: "Lagging",
    textColor: "text-yellow-400",
    dotColor: "bg-yellow-400",
    dotGlow: "shadow-[0_0_8px_3px_rgba(250,204,21,0.7)]",
    pulse: false,
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

      {/* Status dot */}
      <div className="relative flex items-center justify-center w-4 h-4 ml-1">
        {/* Ping ring — only for Online */}
        {config.pulse && (
          <div
            className={`absolute w-4 h-4 rounded-full ${config.dotColor} animate-ping opacity-30`}
          />
        )}
        {/* Core dot — animate-pulse only for Online */}
        <div
          className={[
            "relative w-3 h-3 rounded-full",
            config.dotColor,
            config.dotGlow,
            config.pulse ? "animate-pulse" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        />
      </div>
    </div>
  );
};

export default OracleHealthIndicator;
