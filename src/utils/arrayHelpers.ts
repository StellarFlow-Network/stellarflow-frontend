export interface PageRange {
  start: number;
  end: number;
}

export function getPageSize(pageSize: number): number {
  return Math.max(1, Math.floor(pageSize) || 1);
}

export function getPageIndex(page: number): number {
  return Math.max(0, Math.floor(page) - 1);
}

export function getPageBounds(page: number, pageSize: number): { start: number; endExclusive: number } {
  const size = getPageSize(pageSize);
  const index = getPageIndex(page);
  const start = index * size;
  return { start, endExclusive: start + size };
}

export function getPageItems<T>(items: T[], page: number, pageSize: number): T[] {
  const { start, endExclusive } = getPageBounds(page, pageSize);
  return items.slice(start, endExclusive);
}

export function getPageCount(totalItems: number, pageSize: number): number {
  return Math.max(1, Math.ceil(totalItems / getPageSize(pageSize)));
}

export function getPageRange(totalItems: number, page: number, pageSize: number): PageRange {
  if (totalItems === 0) return { start: 0, end: 0 };
  const size = getPageSize(pageSize);
  const pageIndex = getPageIndex(page);
  const start = Math.min(totalItems, pageIndex * size + 1);
  const end = Math.min(totalItems, start + size - 1);
  return { start, end };
}

export function clampPage(page: number, pageSize: number, totalItems: number): number {
  return Math.min(getPageCount(totalItems, pageSize), Math.max(1, Math.floor(page) || 1));
}
