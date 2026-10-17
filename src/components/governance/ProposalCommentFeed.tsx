import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface WalletSigner {
  address: string;
  signMessage: (message: string) => Promise<string>;
}

export interface VoteBadge {
  choice: "YES" | "NO" | "ABSTAIN";
  weight: string;
}

export interface ProposalComment {
  id: string;
  proposalId: string;
  parentId: string | null;
  author: string;
  content: string;
  createdAt: string;
  signature: string;
  vote?: VoteBadge | null;
}

export interface CommentFeedTransport {
  listComments: (proposalId: string) => Promise<ProposalComment[]>;
  postComment: (input: {
    proposalId: string;
    parentId: string | null;
    author: string;
    content: string;
    signature: string;
  }) => Promise<ProposalComment>;
  subscribe: (proposalId: string, onComment: (c: ProposalComment) => void) => () => void;
  reportComment: (input: { commentId: string; reporter: string; reason: string; details: string }) => Promise<void>;
}

export interface ProposalCommentFeedProps {
  proposalId: string;
  transport: CommentFeedTransport;
  wallet?: WalletSigner | null;
  vote?: VoteBadge | null;
}

const SIGNATURE_PREFIX = "Sign this message to authenticate your governance comment";

const REPORT_REASONS = [
  "Spam or advertising",
  "Harassment or hate speech",
  "Misinformation",
  "Off-topic",
  "Other",
] as const;

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(digest);
}

async function buildSignatureMessage(params: {
  proposalId: string;
  parentId: string | null;
  author: string;
  content: string;
  nonce: string;
  timestamp: string;
}): Promise<string> {
  const contentHash = await sha256Hex(params.content);
  return [
    SIGNATURE_PREFIX,
    `Proposal: ${params.proposalId}`,
    `Parent: ${params.parentId ?? "root"}`,
    `Author: ${params.author.toLowerCase()}`,
    `Timestamp: ${params.timestamp}`,
    `Nonce: ${params.nonce}`,
    `Content-SHA256: ${contentHash}`,
  ].join("\n");
}

function normalizeAddress(address: string): string {
  return address.trim().toLowerCase();
}

function shortAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}￥${address.slice(-4)}`;
}

function avatarColors(address: string): [string, string] {
  const normalized = normalizeAddress(address).replace(/[^a-f0-9]/g, "");
  const base = normalized.padEnd(12, "0");
  const hueA = parseInt(base.slice(0, 4), 16) % 360;
  const hueB = (hueA + 120 + (parseInt(base.slice(4, 8), 16) % 120)) % 360;
  return [`hsl(${hueA}, 70%, 55%)`, `hsl(${hueB}, 70%, 45%)`];
}

function avatarPattern(address: string): boolean[][] {
  const normalized = normalizeAddress(address).replace(/[^a-f0-9]/g, "").padEnd(32, "0");
  const grid: boolean[][] = [];
  for (let y = 0; y < 5; y += 1) {
    const row: boolean[] = [];
    for (let x = 0; x < 3; x += 1) {
      const idx = y * 3 + x;
      const val = parseInt(normalized.slice(idx * 2, idx * 2 + 2), 16);
      row.push(val % 2 === 0);
    }
    grid.push([row[0], row[1], row[2], row[1], row[0]]);
  }
  return grid;
}

const AddressAvatar: React.FC<{ address: string; size?: number }> = ({ address, size = 40 }) => {
  const [colorA, colorB] = avatarColors(address);
  const pattern = avatarPattern(address);
  const cell = size / 5;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`Avatar for ${shortAddress(address)}`}
      style={{ borderRadius: 8, flexShrink: 0 }}
    >
      <rect width={size} height={size} fill={colorA} />
      {pattern.map((row, y) =>
        row.map((filled, x) =>
          filled ? (
            <rect
              key={`${x}-${y}`}
              x={x * cell}
              y={y * cell}
              width={cell}
              height={cell}
              fill={colorB}
            />
          ) : null,
        ),
      )}
    </svg>
  );
};

const VoteBadgeTag: React.FC<{ vote: VoteBadge }> = ({ vote }) => {
  const colors = {
    YES: { bg: "#ecfdf5", fg: "#047e45", border: "#abf5d0" },
    NO: { bg: "#fef2f2", fg: "#b42318", border: "#fecaca" },
    ABSTAIN: { bg: "#f3f4f6", fg: "#344054", border: "#d1d5db" },
  } as const;
  const palette = colors[vote.choice];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 12,
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: 999,
        background: palette.bg,
        color: palette.fg,
        border: `1px solid ${palette.border}`,
      }}
    >
      Voted {vote.choice} with {vote.weight} DAO
    </span>
  );
};

interface ThreadNode {
  comment: ProposalComment;
  children: ThreadNode[];
}

function buildThread(comments: ProposalComment[]): ThreadNode[] {
  const byId = new Map<string, ThreadNode>();
  comments.forEach((c) => byId.set(c.id, { comment: c, children: [] }));
  const roots: ThreadNode[] = [];
  comments.forEach((c) => {
    const node = byId.get(c.id)!;
    if (c.parentId && byId.has(c.parentId)) {
      byId.get(c.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  const sort = (nodes: ThreadNode[]): void => {
    nodes.sort((a, b) => a.comment.createdAt.localeCompare(b.comment.createdAt));
    nodes.forEach((n) => sort(n.children));
  };
  sort(roots);
  return roots;
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function randomNonce(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const ProposalCommentFeed: React.FC<ProposalCommentFeedProps> = ({
  proposalId,
  transport,
  wallet,
  vote,
}) => {
  const [comments, setComments] = useState<ProposalComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<ProposalComment | null>(null);
  const [reportReason, setReportReason] = useState<string>(REPORT_REASONS[0]);
  const [reportDetails, setReportDetails] = useState("");
  const [reportStatus, setReportStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [reportError, setReportError] = useState<string | null>(null);
  const feedRef = useRef<HTMLElement | null>(null);

  const mergeComment = useCallback((inner: ProposalComment) => {
    setComments((prev) => {
      const existing = prev.findIndex((c) => c.id === inner.id);
      if (existing >= 0) {
        const next = prev.slice();
        next[existing] = inner;
        return next;
      }
      return [...prev, inner];
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    transport
      .listComments(proposalId)
      .then((initial) => {
        if (cancelled) return;
        setComments(initial);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Unable to load comments.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const unsubscribe = transport.subscribe(proposalId, (inner) => {
      if (!cancelled) mergeComment(inner);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [proposalId, transport, mergeComment]);

  const thread = useMemo(() => buildThread(comments), [comments]);

  const handleSubmit = async () => {
    setSubmitError(null);
    const content = draft.trim();
    if (!content) {
      setSubmitError("Comment cannot be empty.");
      return;
    }
    if (!wallet) {
      setSubmitError("Connect a wallet to post a comment.");
      return;
    }
    setSubmitting(true);
    try {
      const author = normalizeAddress(wallet.address);
      const timestamp = new Date().toISOString();
      const nonce = randomNonce();
      const message = await buildSignatureMessage({
        proposalId,
        parentId: replyTo,
        author,
        content,
        nonce,
        timestamp,
      });
      const signature = await wallet.signMessage(message);
      if (!signature) {
        throw new Error("Wallet did not return a signature.");
      }
      const posted = await transport.postComment({
        proposalId,
        parentId: replyTo,
        author,
        content,
        signature,
      });
      mergeComment(posted);
      setDraft("");
      setReplyTo(null);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Unable to post comment.");
    } finally {
      setSubmitting(false);
    }
  };

  const openReport = (comment: ProposalComment) => {
    setReportTarget(comment);
    setReportReason(REPORT_REASONS[0]);
    setReportDetails("");
    setReportStatus("idle");
    setReportError(null);
  };

  const closeReport = () => {
    setReportTarget(null);
    setReportStatus("idle");
    setReportError(null);
  };

  const submitReport = async () => {
    if (!reportTarget) return;
    if (!wallet) {
      setReportError("Connect a wallet to report a comment.");
      setReportStatus("error");
      return;
    }
    setReportStatus("submitting");
    setReportError(null);
    try {
      await transport.reportComment({
        commentId: reportTarget.id,
        reporter: normalizeAddress(wallet.address),
        reason: reportReason,
        details: reportDetails.trim(),
      });
      setReportStatus("done");
    } catch (err) {
      setReportError(err instanceof Error ? err.message : "Unable to submit report.");
      setReportStatus("error");
    }
  };

  const renderNode = (node: ThreadNode, depth = 0): React.ReactNode => {
    const { comment } = node;
    return (
      <div key={comment.id} style={{ marginLeft: depth * 24, marginTop: 12 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <AddressAvatar address={comment.author} size={40} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <strong>{shortAddress(comment.author)}</strong>
              <span style={{ color: "#6b7280", fontSize: 12 }}>
                {formatTimestamp(comment.createdAt)}
              </span>
              {comment.vote ? <VoteBadgeTag vote={comment.vote} /> : null}
            </div>
            <p style={{ margin: "6px 0 8px", whiteSpace: "pre-wrap" }}>{comment.content}</p>
            <div style={{ display: "flex", gap: 12 }}>
              <button type="button" onClick={() => setReplyTo(comment.id)}>Reply</button>
              <button type="button" onClick={() => openReport(comment)}>Report</button>
            </div>
          </div>
        </div>
        {node.children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  };

  return (
    <section ref={feedRef}>
      <h3>Discussion</h3>
      {loading ? <p>Loading comments…</p> : null}
      {loadError ? <p style={{ color: "#b42318" }}>{loadError}</p> : null}
      {thread.length === 0 && !loading ? <p>No comments yet.</p> : null}
      {thread.map((node) => renderNode(node))}

      <div style={{ marginTop: 24 }}>
        {replyTo ? (
          <p style={{ fontSize: 12 }}>
            Replying to comment <strong>{replyTo}</strong>. <button type="button" onClick={() => setReplyTo(null)}>Cancel</button>
          </p>
        ) : null}
        <textarea
          value={draft}
          onChange={(e)=> setDraft(e.target.value)}
          placeholder="Share your thoughts on this proposal…"
          rows={4}
          style={{ width: "100%", padding: 8 }}
        />
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
          <button type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Signing & posting…" : "Post comment"}
          </button>
          {!wallet ? <span style={{ color: "#6b7280", fontSize: 12 }}>Connect your wallet to comment.</span> : null}
        </div>
        {submitError ? <p style={{ color: "#b42318" }}>{submitError}</p> : null}
      </div>

      {reportTarget ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
          }}
        >
          <div style={{ background: "white", padding: 20, borderRadius: 12, width: 400, maxWidth: "90%" }}>
            <h4>Report comment</h4>
            <p style={{ fontSize: 12 }}>{shortAddress(reportTarget.author)}: “{reportTarget.content.slice(0, 80)}”</p>
            <label style={{ display: "block", marginTop: 12 }}>
              Reason
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                style={{ display: "block", width: "100%", padding: 6 }}
              >
                {REPORT_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "block", marginTop: 12 }}>
              Details
              <textarea
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                rows={3}
                style={{ display: "block", width: "100%", padding: 6 }}
              />
            </label>
            {reportStatus === "done" ? <p>Thanks — your report was submitted.</p> : null}
            {reportError ? <p style={{ color: "#b42318" }}>{reportError}</p> : null}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button type="button" onClick={closeReport}>Close</button>
              <button
                type="button"
                onClick={submitReport}
                disabled={reportStatus === "submitting" || reportStatus === "done"}
              >
                {reportStatus === "submitting" ? "Submitting…" : "Submit report"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};
