import { describe, expect, it } from 'vitest'
import { createDicomTagPaginationItems } from './dicomTagPagination'

function labels(total: number, current: number): string[] {
  return createDicomTagPaginationItems(total, current).map((item) =>
    item.type === 'page' ? String(item.page) : '...'
  )
}

describe('DicomTagView pagination', () => {
  it('keeps middle pages collapsed with non-interactive ellipses', () => {
    expect(labels(99, 50)).toEqual(['1', '...', '49', '50', '51', '...', '99'])
  })

  it('renders all pages when the series is short', () => {
    expect(labels(5, 3)).toEqual(['1', '2', '3', '4', '5'])
  })
})
