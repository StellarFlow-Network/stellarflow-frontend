import DOMPurify from "isomorphic-dompurify";
import React from "react";

/**
 * Escapes special script-injection characters in user inputs (like memos or notes).
 * Replaces <, >, &, ", ', and / with their respective safe HTML entity representations.
 *
 * @param value The raw string to escape.
 * @returns The escaped, safe plain text string.
 */
export function escapeHtml(value: string): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

/**
 * Cleans incoming HTML or Markdown strings using DOMPurify.
 * Whitelists common styling, layout, and document structure tags.
 *
 * @param content The raw, potentially unsafe HTML or Markdown string.
 * @returns The sanitized, safe HTML string.
 */
export function sanitizeHtml(content: string): string {
  if (typeof content !== "string") return "";
  return DOMPurify.sanitize(content, {
    USE_PROFILES: { html: true },
    ALLOWED_TAGS: [
      "p",
      "br",
      "strong",
      "em",
      "u",
      "s",
      "ol",
      "ul",
      "li",
      "a",
      "code",
      "pre",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "span",
      "blockquote",
    ],
    ALLOWED_ATTR: ["href", "target", "rel", "class", "id"],
  }) as string;
}

interface SafeHTMLProps {
  content: string;
  className?: string;
  as?: keyof React.JSX.IntrinsicElements;
}

/**
 * SafeHTML component handles HTML rendering without raw dangerouslySetInnerHTML usage
 * across components. It sanitizes the content under the hood before inserting.
 */
export function SafeHTML({
  content,
  className,
  as: Component = "div",
}: SafeHTMLProps) {
  const sanitized = sanitizeHtml(content);
  return React.createElement(Component, {
    className,
    dangerouslySetInnerHTML: { __html: sanitized },
  });
}
