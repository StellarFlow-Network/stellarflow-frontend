import React from "react";

export function FoundationSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: "2.5rem" }}>
      <h2 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "0.25rem" }}>{title}</h2>
      {description && (
        <p style={{ fontSize: "0.875rem", color: "var(--muted)", marginBottom: "1rem" }}>{description}</p>
      )}
      {children}
    </section>
  );
}

export function TokenGrid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
        gap: "1rem",
      }}
    >
      {children}
    </div>
  );
}

export function TokenCard({
  label,
  value,
  swatch,
}: {
  label: string;
  value: string;
  swatch?: React.ReactNode;
}) {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "0.75rem",
        overflow: "hidden",
        background: "var(--surface)",
      }}
    >
      {swatch}
      <div style={{ padding: "0.625rem 0.75rem" }}>
        <p style={{ fontSize: "0.8125rem", fontWeight: 500, margin: 0 }}>{label}</p>
        <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: "0.125rem 0 0", fontFamily: "monospace" }}>
          {value}
        </p>
      </div>
    </div>
  );
}
