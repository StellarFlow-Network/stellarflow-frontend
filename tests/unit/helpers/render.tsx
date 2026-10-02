import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

/**
 * Renders a React element to static HTML for assertions.
 *
 * React's server renderer inserts `<!-- -->` separators between adjacent text
 * nodes; stripping them keeps the collected markup readable and makes string
 * assertions such as `Balance: 0 XLM` match.
 */
export function renderToHtml(element: ReactElement): string {
  return renderToStaticMarkup(element).replace(/<!--[\s\S]*?-->/g, '');
}
