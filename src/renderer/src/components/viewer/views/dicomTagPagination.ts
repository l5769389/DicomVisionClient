export type DicomTagPaginationItem =
  | { type: 'page'; page: number }
  | { type: 'ellipsis'; key: string }

function createPageRange(start: number, end: number): number[] {
  const safeStart = Math.max(1, Math.trunc(start))
  const safeEnd = Math.max(safeStart, Math.trunc(end))
  return Array.from({ length: safeEnd - safeStart + 1 }, (_, index) => safeStart + index)
}

export function createDicomTagPaginationItems(totalCount: number, currentPage: number): DicomTagPaginationItem[] {
  const total = Math.max(1, Math.trunc(totalCount))
  const current = Math.max(1, Math.min(total, Math.trunc(currentPage)))
  if (total <= 7) {
    return createPageRange(1, total).map((page) => ({ type: 'page', page }))
  }

  if (current <= 4) {
    return [
      ...createPageRange(1, 5).map((page) => ({ type: 'page' as const, page })),
      { type: 'ellipsis', key: 'middle' },
      { type: 'page', page: total }
    ]
  }

  if (current >= total - 3) {
    return [
      { type: 'page', page: 1 },
      { type: 'ellipsis', key: 'middle' },
      ...createPageRange(total - 4, total).map((page) => ({ type: 'page' as const, page }))
    ]
  }

  return [
    { type: 'page', page: 1 },
    { type: 'ellipsis', key: 'left' },
    ...createPageRange(current - 1, current + 1).map((page) => ({ type: 'page' as const, page })),
    { type: 'ellipsis', key: 'right' },
    { type: 'page', page: total }
  ]
}
