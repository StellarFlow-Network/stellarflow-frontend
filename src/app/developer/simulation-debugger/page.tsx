import SimulationDebuggerPage from "./SimulationDebuggerPage";

export const metadata = {
  title: "Soroban Simulation Debugger | StellarFlow",
  description: "Inspect Soroban transaction XDR and review pre-flight RPC simulation traces.",
};

export default function Page() {
  return <SimulationDebuggerPage />;
}
