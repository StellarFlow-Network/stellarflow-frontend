/**
 * Pure text utilities for building highlighted parts from match indices.
 * Kept side-effect free and deterministic so callers can memoize results.
 */
export type HighlightPart = { type: 'text'; text: string } | { type: 'match'; text: string };

export function buildHighlightedParts(text: string, matches?: [number, number][]): HighlightPart[] {
  if (!matches || matches.length === 0) return [{ type: 'text', text }];

  const parts: HighlightPart[] = [];
  let lastIndex = 0;

  for (const [start, end] of matches) {
    if (start > lastIndex) {
      parts.push({ type: 'text', text: text.slice(lastIndex, start) });
    }
    parts.push({ type: 'match', text: text.slice(start, end + 1) });
    lastIndex = end + 1;
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', text: text.slice(lastIndex) });
  }

  return parts;
}
