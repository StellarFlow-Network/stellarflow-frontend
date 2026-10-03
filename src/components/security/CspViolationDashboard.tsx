"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Filter,
  Search,
  ExternalLink,
  Copy,
  Check,
  Terminal,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Bug,
  Activity,
  Sliders,
} from "lucide-react";
import type {
  CspAggregatedMetrics,
  CspIncidentRecord,
  CspSeverity,
} from "@/lib/security/cspViolationStore";
import { reportManualCspViolation } from "@/utils/cspReporter";

interface CspViolationDashboardProps {
  className?: string;
}

export function CspViolationDashboard({ className = "" }: CspViolationDashboardProps) {
  const [metrics, setMetrics] = useState<CspAggregatedMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDirectiveFilter, setSelectedDirectiveFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedIncidentId, setExpandedIncidentId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationNotice, setSimulationNotice] = useState<string | null>(null);

  // Fetch metrics from API
  const fetchMetrics = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/security/csp-report");
      if (res.ok) {
        const data = await res.json();
        if (data.metrics) {
          setMetrics(data.metrics);
        }
      }
    } catch (err) {
      console.error("Failed to load CSP metrics:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    // Auto-poll every 30 seconds for live monitoring
    const timer = setInterval(fetchMetrics, 30_000);
    return () => clearInterval(timer);
  }, [fetchMetrics]);

  // Simulate an application CSP violation
  const handleSimulateViolation = async (directive = "script-src") => {
    setIsSimulating(true);
    try {
      await fetch("/api/v1/security/csp-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blockedURI: `https://rogue-cdn-tracker-${Math.floor(Math.random() * 100)}.xyz/payload.js`,
          violatedDirective: directive,
          documentURI: window.location.href,
          disposition: "enforce",
          statusCode: 0,
          sample: "eval('malicious_injection_payload')",
          sourceFile: "https://stellarflow.io/_next/static/chunks/app.js",
          lineNumber: 42,
          columnNumber: 15,
        }),
      });

      setSimulationNotice(`Simulated ${directive} violation recorded!`);
      setTimeout(() => setSimulationNotice(null), 3000);
      await fetchMetrics();
    } catch {
      // ignore
    } finally {
      setIsSimulating(false);
    }
  };

  // Simulate a browser extension noise event (should be filtered)
  const handleSimulateExtensionNoise = async () => {
    setIsSimulating(true);
    try {
      await reportManualCspViolation({
        blockedURI: "chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn/inpage.js",
        violatedDirective: "script-src",
        sourceFile: "chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn/contentscript.js",
        documentURI: window.location.href,
        disposition: "enforce",
        statusCode: 0,
        sample: "window.ethereum = ...",
      });

      setSimulationNotice("Extension noise event filtered out successfully!");
      setTimeout(() => setSimulationNotice(null), 3500);
      await fetchMetrics();
    } catch {
      // ignore
    } finally {
      setIsSimulating(false);
    }
  };

  const handleCopyPayload = (id: string, incident: CspIncidentRecord) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(JSON.stringify(incident, null, 2));
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // Filtered incidents
  const filteredIncidents = useMemo(() => {
    if (!metrics?.recentIncidents) return [];
    return metrics.recentIncidents.filter((incident) => {
      const matchesDirective =
        selectedDirectiveFilter === "all" ||
        incident.violatedDirective.toLowerCase() === selectedDirectiveFilter.toLowerCase();
      const matchesSearch =
        searchQuery === "" ||
        incident.blockedURI.toLowerCase().includes(searchQuery.toLowerCase()) ||
        incident.documentURI.toLowerCase().includes(searchQuery.toLowerCase()) ||
        incident.violatedDirective.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesDirective && matchesSearch;
    });
  }, [metrics?.recentIncidents, selectedDirectiveFilter, searchQuery]);

  const severityColor = (severity: CspSeverity) => {
    switch (severity) {
      case "Critical":
        return "text-red-400 bg-red-950/40 border-red-500/40";
      case "High":
        return "text-orange-400 bg-orange-950/40 border-orange-500/40";
      case "Medium":
        return "text-yellow-400 bg-yellow-950/40 border-yellow-500/40";
      case "Low":
        return "text-blue-400 bg-blue-950/40 border-blue-500/40";
    }
  };

  return (
    <div
      className={`rounded-2xl bg-[#0d1117] border border-gray-800 p-5 sm:p-6 space-y-6 text-gray-100 ${className}`}
      data-testid="csp-violation-dashboard"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-400">
              <ShieldAlert size={18} />
            </span>
            <h2 className="text-lg font-bold text-gray-100 tracking-tight">
              Content Security Policy (CSP) Telemetry
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              Active Collector
            </span>
          </div>
          <p className="text-xs text-gray-400">
            Real-time aggregation of browser security violations and automated extension noise filtering.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={fetchMetrics}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-medium text-gray-300 transition-colors"
            title="Refresh metrics"
          >
            <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => handleSimulateViolation("script-src")}
            disabled={isSimulating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/40 border border-red-500/30 text-xs font-medium text-red-300 transition-colors"
          >
            <Bug size={13} />
            <span>Simulate Violation</span>
          </button>

          <button
            type="button"
            onClick={handleSimulateExtensionNoise}
            disabled={isSimulating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-950/40 hover:bg-blue-900/40 border border-blue-500/30 text-xs font-medium text-blue-300 transition-colors"
          >
            <Sparkles size={13} />
            <span>Test Noise Filter</span>
          </button>
        </div>
      </div>

      {/* Simulation Feedback Alert */}
      {simulationNotice && (
        <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between animate-in fade-in">
          <span>{simulationNotice}</span>
          <ShieldCheck size={14} className="text-emerald-400" />
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Violations */}
        <div className="p-4 rounded-xl bg-[#161b22] border border-gray-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Total Violations</span>
            <Activity size={14} className="text-blue-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-gray-100">
            {metrics ? metrics.totalViolations : "—"}
          </div>
          <div className="text-[11px] text-gray-500 flex items-center gap-1.5">
            <span className="text-emerald-400">{metrics?.enforcedViolations ?? 0} blocked</span>
            <span>•</span>
            <span className="text-yellow-400">{metrics?.reportOnlyViolations ?? 0} report</span>
          </div>
        </div>

        {/* Critical & High Severity */}
        <div className="p-4 rounded-xl bg-[#161b22] border border-gray-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Critical & High</span>
            <AlertTriangle size={14} className="text-red-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-red-400">
            {metrics ? metrics.criticalSeverityCount + metrics.highSeverityCount : "—"}
          </div>
          <div className="text-[11px] text-gray-500">
            {metrics?.criticalSeverityCount ?? 0} script/object risks
          </div>
        </div>

        {/* Filtered Extension Noise */}
        <div className="p-4 rounded-xl bg-[#161b22] border border-gray-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Extension Noise Filtered</span>
            <ShieldCheck size={14} className="text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">
            {metrics ? metrics.extensionNoiseFiltered : "—"}
          </div>
          <div className="text-[11px] text-emerald-400/80">
            100% false positive suppression
          </div>
        </div>

        {/* Impacted Directives */}
        <div className="p-4 rounded-xl bg-[#161b22] border border-gray-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Impacted Directives</span>
            <Sliders size={14} className="text-purple-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-purple-400">
            {metrics ? metrics.directiveMetrics.length : "—"}
          </div>
          <div className="text-[11px] text-gray-500">
            {metrics?.uniqueBlockedOrigins ?? 0} unique target origins
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────
          Directive Aggregation Breakdown
         ────────────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold uppercase tracking-wider text-gray-400">
            Aggregated by Violated Directive
          </span>
          <span className="text-[11px] text-gray-500">
            Click directive to filter incidents
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {metrics?.directiveMetrics && metrics.directiveMetrics.length > 0 ? (
            metrics.directiveMetrics.map((dm) => {
              const isSelected = selectedDirectiveFilter.toLowerCase() === dm.directive.toLowerCase();
              return (
                <button
                  key={dm.directive}
                  type="button"
                  onClick={() =>
                    setSelectedDirectiveFilter(isSelected ? "all" : dm.directive)
                  }
                  className={`p-3.5 rounded-xl border text-left transition-all relative overflow-hidden ${
                    isSelected
                      ? "bg-blue-950/30 border-blue-500/60 ring-2 ring-blue-500/40"
                      : "bg-[#161b22] border-gray-800 hover:border-gray-700"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono font-bold text-sm text-gray-200">
                      {dm.directive}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border ${severityColor(
                        dm.severity
                      )}`}
                    >
                      {dm.severity}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs font-mono text-gray-400">
                    <span>{dm.count} violations</span>
                    <span>{dm.percentage.toFixed(0)}%</span>
                  </div>

                  {/* Percentage bar */}
                  <div className="h-1.5 w-full bg-gray-800 rounded-full mt-2 overflow-hidden">
                    <div
                      className={`h-full ${
                        dm.severity === "Critical"
                          ? "bg-red-500"
                          : dm.severity === "High"
                          ? "bg-orange-500"
                          : dm.severity === "Medium"
                          ? "bg-yellow-500"
                          : "bg-blue-500"
                      }`}
                      style={{ width: `${Math.max(dm.percentage, 4)}%` }}
                    />
                  </div>

                  {dm.lastBlockedURI && (
                    <div className="mt-2 text-[10px] text-gray-500 truncate" title={dm.lastBlockedURI}>
                      Last: {dm.lastBlockedURI}
                    </div>
                  )}
                </button>
              );
            })
          ) : (
            <div className="col-span-full py-8 text-center text-gray-500 text-sm">
              No CSP violations recorded yet.
            </div>
          )}
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────
          Recent Incident Logs Table & Filters
         ────────────────────────────────────────────────────────────────── */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Live Incident Stream ({filteredIncidents.length})
            </span>
            {selectedDirectiveFilter !== "all" && (
              <button
                type="button"
                onClick={() => setSelectedDirectiveFilter("all")}
                className="text-[11px] text-blue-400 hover:underline"
              >
                Clear filter ({selectedDirectiveFilter})
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Search filter */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-2.5 text-gray-500" />
              <input
                type="text"
                placeholder="Search URI or directive..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-lg bg-[#161b22] border border-gray-800 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Directive selector */}
            <select
              value={selectedDirectiveFilter}
              onChange={(e) => setSelectedDirectiveFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-[#161b22] border border-gray-800 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
              aria-label="Filter by directive"
            >
              <option value="all">All Directives</option>
              {metrics?.directiveMetrics.map((dm) => (
                <option key={dm.directive} value={dm.directive}>
                  {dm.directive} ({dm.count})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Incident List */}
        <div className="border border-gray-800 rounded-xl overflow-hidden divide-y divide-gray-800/80 bg-[#161b22]">
          {filteredIncidents.length > 0 ? (
            filteredIncidents.map((incident) => {
              const isExpanded = expandedIncidentId === incident.id;
              return (
                <div key={incident.id} className="p-3.5 space-y-2 hover:bg-gray-800/30 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border ${severityColor(
                          incident.severity
                        )}`}
                      >
                        {incident.violatedDirective}
                      </span>
                      <span className="font-mono text-gray-200 truncate max-w-xs sm:max-w-md">
                        {incident.blockedURI}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 text-gray-400 text-[11px] font-mono">
                      <span>{new Date(incident.timestamp).toLocaleTimeString()}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                          incident.disposition === "enforce"
                            ? "bg-red-950/60 text-red-400 border border-red-500/30"
                            : "bg-gray-800 text-gray-400"
                        }`}
                      >
                        {incident.disposition}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedIncidentId(isExpanded ? null : incident.id)
                        }
                        className="text-gray-400 hover:text-gray-200 transition-colors"
                        aria-label="Toggle details"
                      >
                        {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </button>
                    </div>
                  </div>

                  {/* Document URI Subtext */}
                  <div className="text-[11px] text-gray-500 truncate">
                    Document: <span className="text-gray-400">{incident.documentURI}</span>
                  </div>

                  {/* Expandable JSON Detail View */}
                  {isExpanded && (
                    <div className="pt-2 text-xs space-y-2 border-t border-gray-800 animate-in fade-in">
                      <div className="flex items-center justify-between text-[11px] text-gray-400">
                        <span className="flex items-center gap-1 font-mono">
                          <Terminal size={12} /> Payload Forensics
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyPayload(incident.id, incident)}
                          className="flex items-center gap-1 text-blue-400 hover:text-blue-300"
                        >
                          {copiedId === incident.id ? (
                            <>
                              <Check size={11} className="text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy size={11} />
                              <span>Copy JSON</span>
                            </>
                          )}
                        </button>
                      </div>

                      <pre className="p-3 rounded-lg bg-black/60 border border-gray-800 font-mono text-[11px] text-gray-300 overflow-x-auto select-all max-h-48">
                        {JSON.stringify(incident, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="py-12 text-center text-gray-500 text-xs">
              No matching CSP incidents found for the selected criteria.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CspViolationDashboard;
