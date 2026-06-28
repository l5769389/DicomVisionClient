import { describe, expect, it } from 'vitest'
import { createDicomTagPaginationItems } from './dicomTagPagination'

function labels(total: number, current: number, expanded: boolean): string[] {
  return createDicomTagPaginationItems(total, current, expanded).map((item) =>
    item.type === 'page' ? String(item.page) : '...'
  )
}

describe('DicomTagView pagination', () => {
  it('keeps middle pages collapsed until the ellipsis is expanded', () => {
    expect(labels(99, 50, false)).toEqual(['1', '...', '49', '50', '51', '...', '99'])
    expect(labels(99, 50, true)).toEqual(['1', '...', '46', '47', '48', '49', '50', '51', '52', '53', '54', '...', '99'])
  })

  it('renders all pages when the series is short', () => {
    expect(labels(5, 3, false)).toEqual(['1', '2', '3', '4', '5'])
  })
})
