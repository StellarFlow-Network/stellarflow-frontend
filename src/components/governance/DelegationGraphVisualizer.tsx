"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import DOMPurify from "isomorphic-dompurify";
import { formatAddress, shortenAddress } from "@/utils/addressUtils";
import { useWallet } from "@/app/hooks/useWalletState";
import { useToast } from "@/components/ui/ToastQueue";
import Icon from "@/components/icons/Icon";
import { ICON_IDS } from "@/components/icons/iconIds";
import type {
  Delegate,
  DelegationGraphData,
  DelegationGraphNode,
  DelegationGraphLink,
  DelegateVoteRecord,
} from "@/types/delegation";

// ─────────────────────────────────────────────────────────────────────────────
// Types & Simulation Data Structures
// ─────────────────────────────────────────────────────────────────────────────

export interface DelegationGraphVisualizerProps {
  delegates?: Delegate[];
  customData?: DelegationGraphData;
  onSelectDelegate?: (delegate: Delegate) => void;
  className?: string;
  height?: number | string;
}

interface SimNode extends DelegationGraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx: number | null;
  fy: number | null;
  radius: number;
  color: string;
  ringColor: string;
}

interface SimLink {
  id: string;
  source: SimNode;
  target: SimNode;
  amount: number;
  status: "active" | "pending";
}

// ─────────────────────────────────────────────────────────────────────────────
// Color & Category Helpers
// ─────────────────────────────────────────────────────────────────────────────

const TAG_COLOR_MAP: Record<string, { bg: string; text: string; hex: string; ring: string }> = {
  infrastructure: { bg: "bg-blue-900/40", text: "text-blue-300", hex: "#3b82f6", ring: "#60a5fa" },
  community: { bg: "bg-emerald-900/40", text: "text-emerald-300", hex: "#10b981", ring: "#34d399" },
  security: { bg: "bg-red-900/40", text: "text-red-300", hex: "#ef4444", ring: "#f87171" },
  governance: { bg: "bg-purple-900/40", text: "text-purple-300", hex: "#a855f7", ring: "#c084fc" },
  africa: { bg: "bg-amber-900/40", text: "text-amber-300", hex: "#f59e0b", ring: "#fbbf24" },
  oracle: { bg: "bg-cyan-900/40", text: "text-cyan-300", hex: "#06b6d4", ring: "#22d3ee" },
};

function getNodeColor(node: DelegationGraphNode): { hex: string; ring: string } {
  if (node.type === "member") {
    return { hex: "#475569", ring: "#64748b" };
  }
  const primaryTag = node.tags?.[0]?.toLowerCase();
  if (primaryTag && TAG_COLOR_MAP[primaryTag]) {
    return {
      hex: TAG_COLOR_MAP[primaryTag].hex,
      ring: TAG_COLOR_MAP[primaryTag].ring,
    };
  }
  return { hex: "#f59e0b", ring: "#fbbf24" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Default Delegators / Link Mock Generator
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_MEMBER_WALLETS = [
  { address: "GA5K8ZLKMNPQRSXYZABCDEFGHIJKLMN001", name: "YieldVault Core", weight: 340000 },
  { address: "GDF92ZLKMNPQRSXYZABCDEFGHIJKLMN002", name: "Horizon Pool", weight: 280000 },
  { address: "GB7LXVLKMNPQRSXYZABCDEFGHIJKLMN003", name: "Stellar Builders", weight: 190000 },
  { address: "GAK29VLKMNPQRSXYZABCDEFGHIJKLMN004", name: "African Liquidity Hub", weight: 620000 },
  { address: "GC4H1VLKMNPQRSXYZABCDEFGHIJKLMN005", name: "Soroban Dev Guild", weight: 540000 },
  { address: "GDM33VLKMNPQRSXYZABCDEFGHIJKLMN006", name: "Pan-African Treasury", weight: 450000 },
  { address: "GB2XPQLKMNPQRSXYZABCDEFGHIJKLMN007", name: "Oracle Security Fund", weight: 310000 },
  { address: "GAH94QLKMNPQRSXYZABCDEFGHIJKLMN008", name: "Bridge Validator #4", weight: 250000 },
  { address: "GDR17QLKMNPQRSXYZABCDEFGHIJKLMN009", name: "Kenia Governance Node", weight: 240000 },
  { address: "GCL80QLKMNPQRSXYZABCDEFGHIJKLMN010", name: "Lagos Community Pool", weight: 180000 },
  { address: "GC7P2QLKMNPQRSXYZABCDEFGHIJKLMN011", name: "Slashing Sentinel", weight: 220000 },
  { address: "GA1QVQLKMNPQRSXYZABCDEFGHIJKLMN012", name: "Zero-Day Reserve", weight: 130000 },
  { address: "GAA87VLKMNPQRSXYZABCDEFGHIJKLMN013", name: "Anchor Ops Cape", weight: 210000 },
  { address: "GEE44VLKMNPQRSXYZABCDEFGHIJKLMN014", name: "Nairobi Stakers", weight: 175000 },
];

function generateDefaultGraphData(delegates: Delegate[]): DelegationGraphData {
  const nodes: DelegationGraphNode[] = [];
  const links: DelegationGraphLink[] = [];

  // Add delegate nodes
  delegates.forEach((d) => {
    nodes.push({
      id: d.id,
      name: d.name,
      address: d.address,
      type: "delegate",
      votingPower: d.totalDelegatedPower,
      delegatorCount: d.delegatorCount,
      tags: d.tags,
      platformStatement: d.platformStatement,
      votingHistory: d.votingHistory,
      joinedAt: d.joinedAt,
      avatarUrl: d.avatarUrl,
      delegateData: d,
    });
  });

  // Distribute member wallets across delegates to simulate active delegation relationships
  if (delegates.length > 0) {
    MOCK_MEMBER_WALLETS.forEach((member, idx) => {
      const targetDelegate = delegates[idx % delegates.length];
      const memberNodeId = `mem-${idx + 1}`;

      nodes.push({
        id: memberNodeId,
        name: member.name,
        address: member.address,
        type: "member",
        votingPower: member.weight,
      });

      links.push({
        id: `link-${memberNodeId}-${targetDelegate.id}`,
        source: memberNodeId,
        target: targetDelegate.id,
        amount: member.weight,
        status: "active",
      });
    });
  }

  return { nodes, links };
}

// ─────────────────────────────────────────────────────────────────────────────
// Component: Delegate Profile Drawer
// ─────────────────────────────────────────────────────────────────────────────

interface DelegateProfileDrawerProps {
  delegate: Delegate | null;
  memberNode: DelegationGraphNode | null;
  isOpen: boolean;
  onClose: () => void;
  onDelegateAction?: (delegate: Delegate) => void;
  delegatingMembers?: { name: string; address: string; amount: number }[];
  targetDelegateForMember?: Delegate | null;
}

const DelegateProfileDrawer = React.memo(function DelegateProfileDrawer({
  delegate,
  memberNode,
  isOpen,
  onClose,
  onDelegateAction,
  delegatingMembers = [],
  targetDelegateForMember,
}: DelegateProfileDrawerProps) {
  const [copied, setCopied] = useState(false);
  const [delegateAmount, setDelegateAmount] = useState("100");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addToast } = useToast();

  const handleCopy = useCallback((text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      addToast({
        title: "Address Copied",
        description: `${shortenAddress(text)} copied to clipboard`,
        type: "info",
      });
    }
  }, [addToast]);

  const handleQuickDelegate = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!delegate) return;
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      addToast({
        title: "Delegation Confirmed",
        description: `Delegated ${delegateAmount} XLM to ${delegate.name}`,
        type: "success",
      });
      if (onDelegateAction) onDelegateAction(delegate);
      onClose();
    }, 600);
  }, [delegate, delegateAmount, addToast, onDelegateAction, onClose]);

  // Keyboard escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || (!delegate && !memberNode)) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Container */}
      <div
        className="fixed inset-y-0 right-0 w-full max-w-md bg-[#161b22] border-l border-gray-800 shadow-2xl z-50 overflow-y-auto flex flex-col"
        role="dialog"
        aria-labelledby="drawer-title"
        aria-modal="true"
      >
        {/* Top Header */}
        <div className="sticky top-0 bg-[#161b22]/95 backdrop-blur-md border-b border-gray-800 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-900/30 text-blue-400 border border-blue-800/40">
              <Icon id={ICON_IDS.bookOpen} size={16} />
            </span>
            <h2 id="drawer-title" className="text-base font-semibold text-gray-100">
              {delegate ? "Delegate Profile" : "DAO Member Details"}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close drawer"
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <Icon id={ICON_IDS.xCircle} size={18} />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="p-6 space-y-6 flex-1">
          {delegate ? (
            /* DELEGATE PROFILE VIEW */
            <>
              {/* Profile Card Header */}
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/20 via-blue-500/20 to-purple-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold text-xl shadow-lg shrink-0">
                  {delegate.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-gray-100 truncate">
                      {delegate.name}
                    </h3>
                    <span className="p-0.5 rounded-full text-emerald-400 bg-emerald-950/40" title="Verified Delegate">
                      <Icon id={ICON_IDS.checkCircle} size={14} />
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono text-xs text-gray-400">
                      {shortenAddress(delegate.address)}
                    </span>
                    <button
                      onClick={() => handleCopy(delegate.address)}
                      className="text-gray-500 hover:text-gray-300 text-xs transition-colors"
                      title="Copy full address"
                    >
                      <Icon id={ICON_IDS.copy} size={12} />
                    </button>
                    {copied && (
                      <span className="text-[10px] text-emerald-400 font-medium">Copied!</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Tags */}
              {delegate.tags && delegate.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {delegate.tags.map((tag) => {
                    const style = TAG_COLOR_MAP[tag.toLowerCase()] || {
                      bg: "bg-gray-800",
                      text: "text-gray-300",
                    };
                    return (
                      <span
                        key={tag}
                        className={`px-2.5 py-0.5 rounded-md text-[11px] font-medium border uppercase tracking-wider ${style.bg} ${style.text} border-current/20`}
                      >
                        {tag}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 bg-[#0d1117] rounded-xl border border-gray-800">
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
                    <Icon id={ICON_IDS.vote} size={14} className="text-amber-400" />
                    <span>Total Delegated</span>
                  </div>
                  <p className="text-lg font-bold text-gray-100 tabular-nums">
                    {delegate.totalDelegatedPower.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-gray-500 uppercase">XLM Voting Weight</p>
                </div>

                <div className="p-3.5 bg-[#0d1117] rounded-xl border border-gray-800">
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
                    <Icon id={ICON_IDS.users} size={14} className="text-blue-400" />
                    <span>Delegators</span>
                  </div>
                  <p className="text-lg font-bold text-gray-100 tabular-nums">
                    {delegate.delegatorCount}
                  </p>
                  <p className="text-[10px] text-gray-500 uppercase">Active Wallets</p>
                </div>
              </div>

              {/* Platform Statement */}
              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Icon id={ICON_IDS.fileText} size={13} />
                  Platform Statement
                </h4>
                <div className="p-3.5 bg-[#0d1117] rounded-xl border border-gray-800 text-sm text-gray-300 leading-relaxed">
                  <p
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(delegate.platformStatement || "No platform statement available."),
                    }}
                  />
                </div>
              </div>

              {/* Connected Active Delegators (from network graph) */}
              {delegatingMembers.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Icon id={ICON_IDS.network} size={13} className="text-cyan-400" />
                      Active Delegators in Graph ({delegatingMembers.length})
                    </span>
                  </h4>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {delegatingMembers.map((m, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2.5 bg-[#0d1117] rounded-lg border border-gray-800/80 text-xs"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="font-medium text-gray-200 truncate">{m.name}</p>
                          <p className="font-mono text-[10px] text-gray-500">{shortenAddress(m.address)}</p>
                        </div>
                        <span className="font-semibold text-amber-400 font-mono shrink-0">
                          {m.amount.toLocaleString()} XLM
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Voting History */}
              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Icon id={ICON_IDS.history} size={13} />
                  Recent Voting Record ({delegate.votingHistory.length})
                </h4>
                <div className="space-y-2">
                  {delegate.votingHistory.length === 0 ? (
                    <p className="text-xs text-gray-500 italic p-3 bg-[#0d1117] rounded-xl border border-gray-800">
                      No on-chain governance votes recorded yet.
                    </p>
                  ) : (
                    delegate.votingHistory.slice(0, 5).map((vote, idx) => {
                      const voteBadgeColor =
                        vote.voteType === "For"
                          ? "bg-emerald-950/40 text-emerald-400 border-emerald-800/40"
                          : vote.voteType === "Against"
                            ? "bg-red-950/40 text-red-400 border-red-800/40"
                            : "bg-gray-800 text-gray-300 border-gray-700";

                      return (
                        <div
                          key={`${vote.proposalId}-${idx}`}
                          className="p-3 bg-[#0d1117] rounded-xl border border-gray-800 space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-[11px] text-blue-400 font-medium">
                              {vote.proposalId}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${voteBadgeColor}`}
                            >
                              {vote.voteType}
                            </span>
                          </div>
                          <p className="text-xs text-gray-300 font-medium truncate">
                            {vote.proposalTitle}
                          </p>
                          <div className="flex items-center justify-between text-[10px] text-gray-500 pt-0.5">
                            <span>Power: {vote.votingPower.toLocaleString()} VP</span>
                            <span>{new Date(vote.timestamp).toLocaleDateString()}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Quick Delegate Action Form */}
              <div className="p-4 bg-[#0d1117] rounded-xl border border-blue-900/40 space-y-3">
                <h4 className="text-xs font-semibold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Icon id={ICON_IDS.key} size={13} />
                  Delegate Voting Power
                </h4>
                <form onSubmit={handleQuickDelegate} className="space-y-3">
                  <div>
                    <label
                      htmlFor="drawer-vp-amount"
                      className="block text-[11px] text-gray-400 mb-1"
                    >
                      Weight to Delegate (XLM)
                    </label>
                    <input
                      id="drawer-vp-amount"
                      type="number"
                      min="1"
                      value={delegateAmount}
                      onChange={(e) => setDelegateAmount(e.target.value)}
                      className="w-full bg-[#161b22] border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting || !delegateAmount || Number(delegateAmount) <= 0}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Icon id={ICON_IDS.key} size={14} />
                    {isSubmitting ? "Delegating..." : `Delegate ${delegateAmount} XLM`}
                  </button>
                </form>
              </div>
            </>
          ) : (
            /* MEMBER WALLET DETAIL VIEW */
            memberNode && (
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                    <Icon id={ICON_IDS.wallet} size={22} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-100">
                      {memberNode.name}
                    </h3>
                    <p className="font-mono text-xs text-gray-400">
                      {shortenAddress(memberNode.address)}
                    </p>
                  </div>
                </div>

                <div className="p-3.5 bg-[#0d1117] rounded-xl border border-gray-800 space-y-1">
                  <p className="text-xs text-gray-400">Delegated Voting Weight</p>
                  <p className="text-xl font-bold text-amber-400 tabular-nums">
                    {memberNode.votingPower.toLocaleString()} XLM
                  </p>
                </div>

                {targetDelegateForMember && (
                  <div className="p-3.5 bg-[#0d1117] rounded-xl border border-gray-800 space-y-2">
                    <p className="text-xs text-gray-400 uppercase tracking-wide">
                      Active Delegation To
                    </p>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-100">
                          {targetDelegateForMember.name}
                        </p>
                        <p className="font-mono text-xs text-gray-500">
                          {shortenAddress(targetDelegateForMember.address)}
                        </p>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/40 text-emerald-400 border border-emerald-800/40 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Active
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )
          )}
        </div>
      </div>
    </>
  );
});
DelegateProfileDrawer.displayName = "DelegateProfileDrawer";

// ─────────────────────────────────────────────────────────────────────────────
// Main Component: DelegationGraphVisualizer
// ─────────────────────────────────────────────────────────────────────────────

export function DelegationGraphVisualizer({
  delegates = [],
  customData,
  onSelectDelegate,
  className = "",
  height = 620,
}: DelegationGraphVisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Search & Filtering States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string>("all");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  // Drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeDrawerDelegate, setActiveDrawerDelegate] = useState<Delegate | null>(null);
  const [activeDrawerMember, setActiveDrawerMember] = useState<DelegationGraphNode | null>(null);

  // Simulation & Viewport refs
  const simNodesRef = useRef<SimNode[]>([]);
  const simLinksRef = useRef<SimLink[]>([]);
  const animFrameIdRef = useRef<number | null>(null);
  const alphaRef = useRef<number>(1.0);
  const transformRef = useRef<{ x: number; y: number; k: number }>({ x: 0, y: 0, k: 1 });
  const targetTransformRef = useRef<{ x: number; y: number; k: number } | null>(null);

  // Dragging state
  const isDraggingRef = useRef(false);
  const draggedNodeRef = useRef<SimNode | null>(null);
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hoveredNodeRef = useRef<SimNode | null>(null);
  const pulsePhaseRef = useRef<number>(0);

  // 1. Initialize Graph Data
  const graphData = useMemo(() => {
    if (customData) return customData;
    return generateDefaultGraphData(delegates);
  }, [delegates, customData]);

  // Compute node sizing scale based on voting power
  const { minPower, maxPower } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    graphData.nodes.forEach((n) => {
      if (n.type === "delegate") {
        if (n.votingPower < min) min = n.votingPower;
        if (n.votingPower > max) max = n.votingPower;
      }
    });
    return {
      minPower: min === Infinity ? 0 : min,
      maxPower: max === -Infinity ? 1000000 : max,
    };
  }, [graphData]);

  // 2. Setup Nodes and Links for Force Simulation
  useEffect(() => {
    const width = containerRef.current?.clientWidth || 800;
    const canvasHeight = typeof height === "number" ? height : 600;
    const centerX = width / 2;
    const centerY = canvasHeight / 2;

    const simNodes: SimNode[] = graphData.nodes.map((n, i) => {
      // Proportional radius calculation
      let radius: number;
      if (n.type === "delegate") {
        const norm = (n.votingPower - minPower) / (maxPower - minPower || 1);
        radius = Math.round(26 + norm * 26); // 26px to 52px
      } else {
        radius = Math.round(10 + Math.min(6, (n.votingPower / 500000) * 6)); // 10px to 16px
      }

      const colors = getNodeColor(n);
      const angle = (i / graphData.nodes.length) * 2 * Math.PI;
      const initialDist = n.type === "delegate" ? 140 : 260 + (i % 3) * 30;

      return {
        ...n,
        x: centerX + Math.cos(angle) * initialDist + (Math.random() - 0.5) * 40,
        y: centerY + Math.sin(angle) * initialDist + (Math.random() - 0.5) * 40,
        vx: 0,
        vy: 0,
        fx: null,
        fy: null,
        radius,
        color: colors.hex,
        ringColor: colors.ring,
      };
    });

    const nodeMap = new Map<string, SimNode>();
    simNodes.forEach((n) => nodeMap.set(n.id, n));

    const simLinks: SimLink[] = [];
    graphData.links.forEach((l) => {
      const src = nodeMap.get(l.source);
      const tgt = nodeMap.get(l.target);
      if (src && tgt) {
        simLinks.push({
          id: l.id,
          source: src,
          target: tgt,
          amount: l.amount,
          status: l.status,
        });
      }
    });

    simNodesRef.current = simNodes;
    simLinksRef.current = simLinks;
    alphaRef.current = 1.0; // restart simulation cooling
  }, [graphData, minPower, maxPower, height]);

  // Center & focus view on specific node smoothly
  const focusOnNode = useCallback((node: SimNode, targetZoom = 1.35) => {
    const width = containerRef.current?.clientWidth || 800;
    const canvasHeight = typeof height === "number" ? height : 600;

    targetTransformRef.current = {
      x: width / 2 - node.x * targetZoom,
      y: canvasHeight / 2 - node.y * targetZoom,
      k: targetZoom,
    };
    alphaRef.current = Math.max(alphaRef.current, 0.2); // slight wake-up
  }, [height]);

  // 3. Smooth 60fps Force-Directed Physics & Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let isRunning = true;

    const render = () => {
      if (!isRunning) return;

      const width = containerRef.current?.clientWidth || 800;
      const canvasHeight = typeof height === "number" ? height : 600;
      const dpr = window.devicePixelRatio || 1;

      // Ensure canvas dimensions match container
      if (canvas.width !== width * dpr || canvas.height !== canvasHeight * dpr) {
        canvas.width = width * dpr;
        canvas.height = canvasHeight * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${canvasHeight}px`;
      }

      pulsePhaseRef.current += 0.04;

      // Smooth Camera Lerp
      if (targetTransformRef.current) {
        const cur = transformRef.current;
        const tgt = targetTransformRef.current;
        cur.x += (tgt.x - cur.x) * 0.12;
        cur.y += (tgt.y - cur.y) * 0.12;
        cur.k += (tgt.k - cur.k) * 0.12;
        if (
          Math.abs(tgt.x - cur.x) < 0.5 &&
          Math.abs(tgt.y - cur.y) < 0.5 &&
          Math.abs(tgt.k - cur.k) < 0.005
        ) {
          cur.x = tgt.x;
          cur.y = tgt.y;
          cur.k = tgt.k;
          targetTransformRef.current = null;
        }
      }

      // PHYSICS TICK (D3-style force simulation mechanics)
      if (!isPaused && alphaRef.current > 0.002) {
        const nodes = simNodesRef.current;
        const links = simLinksRef.current;
        const alpha = alphaRef.current;
        const centerX = width / 2;
        const centerY = canvasHeight / 2;

        // Force 1: Center gravity
        for (let i = 0; i < nodes.length; i++) {
          const n = nodes[i];
          if (n.fx !== null && n.fy !== null) continue;
          n.vx += (centerX - n.x) * 0.015 * alpha;
          n.vy += (centerY - n.y) * 0.015 * alpha;
        }

        // Force 2: Repulsion (Charge)
        for (let i = 0; i < nodes.length; i++) {
          const n1 = nodes[i];
          for (let j = i + 1; j < nodes.length; j++) {
            const n2 = nodes[j];
            const dx = n2.x - n1.x;
            const dy = n2.y - n1.y;
            const distSq = dx * dx + dy * dy || 1;
            const dist = Math.sqrt(distSq);

            // Repulsion strength proportional to node radii
            const repStrength = (n1.radius * n2.radius * 35) / distSq;
            const fx = (dx / dist) * repStrength * alpha;
            const fy = (dy / dist) * repStrength * alpha;

            if (n1.fx === null) {
              n1.vx -= fx;
              n1.vy -= fy;
            }
            if (n2.fx === null) {
              n2.vx += fx;
              n2.vy += fy;
            }

            // Collision resolution
            const minDist = n1.radius + n2.radius + 18;
            if (dist < minDist) {
              const overlap = (minDist - dist) * 0.5 * alpha;
              const ox = (dx / dist) * overlap;
              const oy = (dy / dist) * overlap;
              if (n1.fx === null) {
                n1.vx -= ox;
                n1.vy -= oy;
              }
              if (n2.fx === null) {
                n2.vx += ox;
                n2.vy += oy;
              }
            }
          }
        }

        // Force 3: Links (Hooke's spring force)
        for (let i = 0; i < links.length; i++) {
          const link = links[i];
          const src = link.source;
          const tgt = link.target;
          const dx = tgt.x - src.x;
          const dy = tgt.y - src.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const desiredDist = src.radius + tgt.radius + 70;
          const spring = (dist - desiredDist) * 0.04 * alpha;
          const sx = (dx / dist) * spring;
          const sy = (dy / dist) * spring;

          if (src.fx === null) {
            src.vx += sx;
            src.vy += sy;
          }
          if (tgt.fx === null) {
            tgt.vx -= sx;
            tgt.vy -= sy;
          }
        }

        // Apply velocities with damping decay
        const velocityDecay = 0.88;
        for (let i = 0; i < nodes.length; i++) {
          const n = nodes[i];
          if (n.fx !== null && n.fy !== null) {
            n.x = n.fx;
            n.y = n.fy;
            n.vx = 0;
            n.vy = 0;
          } else {
            n.vx *= velocityDecay;
            n.vy *= velocityDecay;
            n.x += n.vx;
            n.y += n.vy;
          }
        }

        // Alpha decay cooling
        alphaRef.current = Math.max(0.001, alphaRef.current * 0.992);
      }

      // ─── RENDERING ───
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, canvasHeight);

      // Background grid / subtle starfield glow
      ctx.fillStyle = "#0c1017";
      ctx.fillRect(0, 0, width, canvasHeight);

      // Grid dots
      ctx.save();
      const dotSpacing = 32;
      ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
      for (let x = 0; x < width; x += dotSpacing) {
        for (let y = 0; y < canvasHeight; y += dotSpacing) {
          ctx.beginPath();
          ctx.arc(x, y, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();

      // Transform viewport (pan & zoom)
      const { x: px, y: py, k: zoom } = transformRef.current;
      ctx.save();
      ctx.translate(px, py);
      ctx.scale(zoom, zoom);

      const nodes = simNodesRef.current;
      const links = simLinksRef.current;
      const selectedId = selectedNodeId;
      const hovered = hoveredNodeRef.current;

      // Determine active highlighted nodes & links
      const highlightedNodeIds = new Set<string>();
      if (selectedId) {
        highlightedNodeIds.add(selectedId);
        links.forEach((l) => {
          if (l.source.id === selectedId) highlightedNodeIds.add(l.target.id);
          if (l.target.id === selectedId) highlightedNodeIds.add(l.source.id);
        });
      }

      // Draw Links with Directional Arrows
      for (let i = 0; i < links.length; i++) {
        const link = links[i];
        const src = link.source;
        const tgt = link.target;

        const isLinkHighlighted =
          !selectedId ||
          src.id === selectedId ||
          tgt.id === selectedId;

        const dx = tgt.x - src.x;
        const dy = tgt.y - src.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const angle = Math.atan2(dy, dx);

        // Arrow tip lands just outside target's radius
        const targetRadius = tgt.radius + 3;
        const arrowX = tgt.x - Math.cos(angle) * targetRadius;
        const arrowY = tgt.y - Math.sin(angle) * targetRadius;

        // Line starts outside source's radius
        const startX = src.x + Math.cos(angle) * src.radius;
        const startY = src.y + Math.sin(angle) * src.radius;

        ctx.save();
        if (selectedId && !isLinkHighlighted) {
          ctx.globalAlpha = 0.12;
        } else {
          ctx.globalAlpha = 0.75;
        }

        // Link line
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(arrowX, arrowY);

        if (isLinkHighlighted && selectedId) {
          ctx.strokeStyle = "#38bdf8";
          ctx.lineWidth = 2.4;
          ctx.shadowColor = "rgba(56, 189, 248, 0.6)";
          ctx.shadowBlur = 6;
        } else {
          ctx.strokeStyle = "rgba(96, 165, 250, 0.35)";
          ctx.lineWidth = 1.6;
        }
        ctx.stroke();

        // Directional Arrow Head (pointing to target delegate)
        const arrowHeadLength = 9;
        const arrowHeadAngle = 0.42;

        ctx.beginPath();
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(
          arrowX - arrowHeadLength * Math.cos(angle - arrowHeadAngle),
          arrowY - arrowHeadLength * Math.sin(angle - arrowHeadAngle)
        );
        ctx.lineTo(
          arrowX - (arrowHeadLength * 0.7) * Math.cos(angle),
          arrowY - (arrowHeadLength * 0.7) * Math.sin(angle)
        );
        ctx.lineTo(
          arrowX - arrowHeadLength * Math.cos(angle + arrowHeadAngle),
          arrowY - arrowHeadLength * Math.sin(angle + arrowHeadAngle)
        );
        ctx.closePath();
        ctx.fillStyle = isLinkHighlighted && selectedId ? "#38bdf8" : "rgba(96, 165, 250, 0.75)";
        ctx.fill();

        // Active Flow Pulse particle moving along link
        if (link.status === "active") {
          const t = ((pulsePhaseRef.current + i * 0.3) % 1 + 1) % 1;
          const pulseX = startX + (arrowX - startX) * t;
          const pulseY = startY + (arrowY - startY) * t;

          ctx.beginPath();
          ctx.arc(pulseX, pulseY, 2.2, 0, Math.PI * 2);
          ctx.fillStyle = "#38bdf8";
          ctx.shadowColor = "#38bdf8";
          ctx.shadowBlur = 8;
          ctx.fill();
        }

        ctx.restore();
      }

      // Draw Nodes
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const isSelected = n.id === selectedId;
        const isHovered = hovered?.id === n.id;
        const isDimmed = selectedId ? !highlightedNodeIds.has(n.id) : false;

        ctx.save();
        if (isDimmed) {
          ctx.globalAlpha = 0.2;
        }

        // Selection / Hover Pulsing Halo
        if (isSelected || isHovered) {
          const pulse = (Math.sin(pulsePhaseRef.current * 2) + 1) * 0.5;
          const haloRadius = n.radius + 6 + pulse * 6;
          ctx.beginPath();
          ctx.arc(n.x, n.y, haloRadius, 0, Math.PI * 2);
          ctx.fillStyle = isSelected
            ? "rgba(56, 189, 248, 0.2)"
            : "rgba(251, 191, 36, 0.18)";
          ctx.fill();

          ctx.beginPath();
          ctx.arc(n.x, n.y, haloRadius, 0, Math.PI * 2);
          ctx.strokeStyle = isSelected ? "#38bdf8" : "#fbbf24";
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Outer Glow
        if (n.type === "delegate") {
          const grad = ctx.createRadialGradient(n.x, n.y, n.radius * 0.6, n.x, n.y, n.radius + 10);
          grad.addColorStop(0, "rgba(0, 0, 0, 0)");
          grad.addColorStop(1, `${n.color}22`);
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.radius + 10, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();
        }

        // Main Node Circle Body
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx.fillStyle = n.type === "delegate" ? "#161b22" : "#1e293b";
        ctx.fill();

        // Stroke Ring
        ctx.lineWidth = n.type === "delegate" ? 3 : 1.8;
        ctx.strokeStyle = n.ringColor;
        ctx.stroke();

        // Inner Emblem / Icon / Monogram
        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        if (n.type === "delegate") {
          ctx.fillStyle = n.ringColor;
          ctx.font = `bold ${Math.round(n.radius * 0.52)}px sans-serif`;
          ctx.fillText(n.name.slice(0, 2).toUpperCase(), n.x, n.y);
        } else {
          // Member node small center dot
          ctx.fillStyle = "#94a3b8";
          ctx.beginPath();
          ctx.arc(n.x, n.y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();

        // Node Labels (Delegate Name & Voting Power)
        if (n.type === "delegate" || isSelected || isHovered) {
          const labelText = n.type === "delegate" ? n.name : shortenAddress(n.address);
          const powerText = `${(n.votingPower / 1000).toFixed(0)}K VP`;

          ctx.font = `600 ${n.type === "delegate" ? 12 : 10}px sans-serif`;
          const textWidth = ctx.measureText(labelText).width;

          // Pill Background for crisp readability
          const pillWidth = Math.max(textWidth + 14, 60);
          const pillHeight = 22;
          const pillX = n.x - pillWidth / 2;
          const pillY = n.y + n.radius + 7;

          ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
          ctx.strokeStyle = isSelected ? "#38bdf8" : "rgba(75, 85, 99, 0.6)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(pillX, pillY, pillWidth, pillHeight, 6);
          ctx.fill();
          ctx.stroke();

          // Text rendering
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = isSelected ? "#38bdf8" : "#f1f5f9";
          ctx.fillText(labelText, n.x, pillY + pillHeight / 2);

          // Sub-label for voting power on delegates
          if (n.type === "delegate") {
            ctx.font = "bold 9px monospace";
            ctx.fillStyle = "#fbbf24";
            ctx.fillText(powerText, n.x, pillY + pillHeight + 11);
          }
        }

        ctx.restore();
      }

      ctx.restore(); // restore viewport transform
      ctx.restore(); // restore scale

      animFrameIdRef.current = requestAnimationFrame(render);
    };

    animFrameIdRef.current = requestAnimationFrame(render);

    return () => {
      isRunning = false;
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [height, selectedNodeId, isPaused]);

  // 4. Mouse / Touch Interactions (Pan, Zoom, Drag, Click)
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const { x: px, y: py, k: zoom } = transformRef.current;
    const worldX = (clientX - px) / zoom;
    const worldY = (clientY - py) / zoom;

    // Hit test nodes (from top to bottom)
    const nodes = simNodesRef.current;
    let clickedNode: SimNode | null = null;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      const dx = worldX - n.x;
      const dy = worldY - n.y;
      if (dx * dx + dy * dy <= n.radius * n.radius) {
        clickedNode = n;
        break;
      }
    }

    if (clickedNode) {
      isDraggingRef.current = true;
      draggedNodeRef.current = clickedNode;
      // Canvas simulation nodes are deliberately mutable and live in simNodesRef,
      // not React state; pin the node in the physics model while it is dragged.
      // eslint-disable-next-line react-hooks/immutability -- mutable D3-style simulation model held in a ref
      clickedNode.fx = clickedNode.x;
      clickedNode.fy = clickedNode.y;
      alphaRef.current = Math.max(alphaRef.current, 0.3); // wake physics
    } else {
      isDraggingRef.current = false;
      draggedNodeRef.current = null;
    }

    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const dx = e.clientX - lastMousePosRef.current.x;
    const dy = e.clientY - lastMousePosRef.current.y;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };

    const { x: px, y: py, k: zoom } = transformRef.current;

    // Dragging node
    if (draggedNodeRef.current) {
      const worldX = (clientX - px) / zoom;
      const worldY = (clientY - py) / zoom;
      draggedNodeRef.current.fx = worldX;
      draggedNodeRef.current.fy = worldY;
      alphaRef.current = Math.max(alphaRef.current, 0.2);
      return;
    }

    // Panning canvas
    if (e.buttons === 1) {
      transformRef.current.x += dx;
      transformRef.current.y += dy;
      return;
    }

    // Hover detection
    const worldX = (clientX - px) / zoom;
    const worldY = (clientY - py) / zoom;
    const nodes = simNodesRef.current;
    let hit: SimNode | null = null;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      const hdx = worldX - n.x;
      const hdy = worldY - n.y;
      if (hdx * hdx + hdy * hdy <= (n.radius + 6) * (n.radius + 6)) {
        hit = n;
        break;
      }
    }
    hoveredNodeRef.current = hit;
    canvas.style.cursor = hit ? "pointer" : e.buttons === 1 ? "grabbing" : "grab";
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (canvas && canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }

    if (draggedNodeRef.current) {
      draggedNodeRef.current.fx = null;
      draggedNodeRef.current.fy = null;
      draggedNodeRef.current = null;
    }
    isDraggingRef.current = false;
  }, []);

  // Node Click: opens Delegate Profile Drawer & focuses view
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const { x: px, y: py, k: zoom } = transformRef.current;
    const worldX = (clientX - px) / zoom;
    const worldY = (clientY - py) / zoom;

    const nodes = simNodesRef.current;
    let clickedNode: SimNode | null = null;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      const dx = worldX - n.x;
      const dy = worldY - n.y;
      if (dx * dx + dy * dy <= (n.radius + 4) * (n.radius + 4)) {
        clickedNode = n;
        break;
      }
    }

    if (clickedNode) {
      setSelectedNodeId(clickedNode.id);
      focusOnNode(clickedNode);

      if (clickedNode.type === "delegate") {
        setActiveDrawerDelegate(clickedNode.delegateData || null);
        setActiveDrawerMember(null);
        setIsDrawerOpen(true);
        if (onSelectDelegate && clickedNode.delegateData) {
          onSelectDelegate(clickedNode.delegateData);
        }
      } else {
        setActiveDrawerDelegate(null);
        setActiveDrawerMember(clickedNode);
        setIsDrawerOpen(true);
      }
    }
  }, [focusOnNode, onSelectDelegate]);

  // Wheel Zoom
  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    const cur = transformRef.current;
    const newK = Math.max(0.35, Math.min(3.2, cur.k * zoomFactor));

    cur.x = mouseX - (mouseX - cur.x) * (newK / cur.k);
    cur.y = mouseY - (mouseY - cur.y) * (newK / cur.k);
    cur.k = newK;
  }, []);

  // 5. Controls: Zoom In / Zoom Out / Reset View
  const handleZoomIn = useCallback(() => {
    const width = containerRef.current?.clientWidth || 800;
    const canvasHeight = typeof height === "number" ? height : 600;
    const cur = transformRef.current;
    const newK = Math.min(3.2, cur.k * 1.3);
    targetTransformRef.current = {
      x: width / 2 - (width / 2 - cur.x) * (newK / cur.k),
      y: canvasHeight / 2 - (canvasHeight / 2 - cur.y) * (newK / cur.k),
      k: newK,
    };
  }, [height]);

  const handleZoomOut = useCallback(() => {
    const width = containerRef.current?.clientWidth || 800;
    const canvasHeight = typeof height === "number" ? height : 600;
    const cur = transformRef.current;
    const newK = Math.max(0.35, cur.k / 1.3);
    targetTransformRef.current = {
      x: width / 2 - (width / 2 - cur.x) * (newK / cur.k),
      y: canvasHeight / 2 - (canvasHeight / 2 - cur.y) * (newK / cur.k),
      k: newK,
    };
  }, [height]);

  const handleResetView = useCallback(() => {
    targetTransformRef.current = { x: 0, y: 0, k: 1 };
    setSelectedNodeId(null);
    alphaRef.current = 0.5; // gentle reheat
  }, []);

  // 6. Search Filter & Target Highlighting
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return simNodesRef.current.filter((n) => {
      const matchName = n.name.toLowerCase().includes(q);
      const matchAddress = n.address.toLowerCase().includes(q);
      const matchTag = n.tags?.some((t) => t.toLowerCase().includes(q));
      return matchName || matchAddress || matchTag;
    });
  }, [searchQuery]);

  const handleSelectSearchNode = useCallback((node: SimNode) => {
    setSelectedNodeId(node.id);
    focusOnNode(node, 1.45);
    setSearchQuery("");

    if (node.type === "delegate") {
      setActiveDrawerDelegate(node.delegateData || null);
      setActiveDrawerMember(null);
      setIsDrawerOpen(true);
      if (onSelectDelegate && node.delegateData) {
        onSelectDelegate(node.delegateData);
      }
    } else {
      setActiveDrawerDelegate(null);
      setActiveDrawerMember(node);
      setIsDrawerOpen(true);
    }
  }, [focusOnNode, onSelectDelegate]);

  // Compute members delegating to the currently open delegate in drawer
  const drawerDelegatingMembers = useMemo(() => {
    if (!activeDrawerDelegate) return [];
    return simLinksRef.current
      .filter((l) => l.target.address === activeDrawerDelegate.address)
      .map((l) => ({
        name: l.source.name,
        address: l.source.address,
        amount: l.amount,
      }));
  }, [activeDrawerDelegate]);

  // Target delegate for member drawer
  const targetDelegateForMember = useMemo(() => {
    if (!activeDrawerMember) return null;
    const link = simLinksRef.current.find((l) => l.source.id === activeDrawerMember.id);
    return link?.target.delegateData || null;
  }, [activeDrawerMember]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full rounded-2xl bg-[#0c1017] border border-gray-800 overflow-hidden shadow-2xl ${className}`}
      style={{ height }}
    >
      {/* ─── Top Floating Glassmorphism Controls Header ─── */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        {/* Search Bar */}
        <div className="relative pointer-events-auto w-full sm:w-80">
          <div className="relative flex items-center bg-[#161b22]/90 backdrop-blur-md border border-gray-700/80 rounded-xl px-3 py-2 shadow-lg focus-within:border-blue-500 transition-colors">
            <span className="text-gray-400 mr-2">
              <Icon id={ICON_IDS.search} size={15} />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search wallet, delegate, tag..."
              className="w-full bg-transparent text-sm text-gray-100 placeholder-gray-500 focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="text-gray-400 hover:text-gray-200 transition-colors"
                aria-label="Clear search"
              >
                <Icon id={ICON_IDS.xCircle} size={14} />
              </button>
            )}
          </div>

          {/* Search Dropdown Results */}
          {searchQuery && searchResults.length > 0 && (
            <div className="absolute top-full mt-2 left-0 right-0 bg-[#161b22] border border-gray-700 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto z-30">
              {searchResults.map((node) => (
                <button
                  key={node.id}
                  onClick={() => handleSelectSearchNode(node)}
                  className="w-full text-left px-3.5 py-2.5 hover:bg-blue-900/30 border-b border-gray-800 last:border-0 flex items-center justify-between text-xs transition-colors"
                >
                  <div className="min-w-0 pr-2">
                    <p className="font-semibold text-gray-100 truncate">{node.name}</p>
                    <p className="font-mono text-[10px] text-gray-400 truncate">
                      {shortenAddress(node.address)}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                      node.type === "delegate"
                        ? "bg-amber-950/40 text-amber-400 border border-amber-800/40"
                        : "bg-slate-800 text-slate-300 border border-slate-700"
                    }`}
                  >
                    {node.type}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Action Controls (Zoom, Reset, Pause) */}
        <div className="flex items-center gap-1.5 bg-[#161b22]/90 backdrop-blur-md border border-gray-700/80 rounded-xl p-1 shadow-lg pointer-events-auto">
          <button
            onClick={handleZoomIn}
            className="p-2 text-gray-300 hover:text-white hover:bg-gray-800/80 rounded-lg transition-colors"
            title="Zoom In (+)"
            aria-label="Zoom in"
          >
            <Icon id={ICON_IDS.plus} size={15} />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-2 text-gray-300 hover:text-white hover:bg-gray-800/80 rounded-lg transition-colors"
            title="Zoom Out (-)"
            aria-label="Zoom out"
          >
            <Icon id={ICON_IDS.minus} size={15} />
          </button>
          <button
            onClick={handleResetView}
            className="p-2 text-gray-300 hover:text-white hover:bg-gray-800/80 rounded-lg transition-colors"
            title="Recenter / Reset View"
            aria-label="Reset view"
          >
            <Icon id={ICON_IDS.refresh} size={15} />
          </button>
          <button
            onClick={() => setIsPaused((prev) => !prev)}
            className={`p-2 rounded-lg transition-colors ${
              isPaused
                ? "text-amber-400 bg-amber-950/40"
                : "text-gray-300 hover:text-white hover:bg-gray-800/80"
            }`}
            title={isPaused ? "Resume Force Layout" : "Pause Force Layout"}
            aria-label={isPaused ? "Resume simulation" : "Pause simulation"}
          >
            <Icon id={isPaused ? ICON_IDS.play : ICON_IDS.lock} size={15} />
          </button>
        </div>
      </div>

      {/* ─── Bottom-Left Graph Legend ─── */}
      <div className="absolute bottom-4 left-4 z-20 pointer-events-auto bg-[#161b22]/90 backdrop-blur-md border border-gray-700/80 rounded-xl p-3 shadow-lg text-[11px] space-y-2 hidden md:block">
        <p className="font-semibold text-gray-300 uppercase tracking-wider text-[10px]">
          Network Topology Legend
        </p>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-full border-2 border-amber-400 bg-amber-950/40" />
          <span className="text-gray-300">Delegate (Size proportional to VP)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full border border-slate-500 bg-slate-700" />
          <span className="text-gray-300">DAO Member / Delegator</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-0.5 bg-blue-400 relative">
            <span className="absolute -top-1 right-0 border-y-2 border-y-transparent border-l-4 border-l-blue-400" />
          </span>
          <span className="text-gray-300">Active Delegation Flow</span>
        </div>
      </div>

      {/* ─── Bottom-Right Interactive Hint ─── */}
      <div className="absolute bottom-4 right-4 z-20 pointer-events-none hidden sm:flex items-center gap-2 text-xs text-gray-500 bg-[#161b22]/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-gray-800">
        <Icon id={ICON_IDS.activity} size={13} className="text-blue-400" />
        <span>Click node to open profile drawer • Drag to rearrange • Scroll to zoom</span>
      </div>

      {/* ─── Canvas Render Surface (60fps) ─── */}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={handleCanvasClick}
        onWheel={handleWheel}
        className="w-full h-full block touch-none"
      />

      {/* ─── Delegate Profile Slide-Over Drawer ─── */}
      <DelegateProfileDrawer
        delegate={activeDrawerDelegate}
        memberNode={activeDrawerMember}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        delegatingMembers={drawerDelegatingMembers}
        targetDelegateForMember={targetDelegateForMember}
      />
    </div>
  );
}

export default DelegationGraphVisualizer;
