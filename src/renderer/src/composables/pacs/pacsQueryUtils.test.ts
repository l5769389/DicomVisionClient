import { describe, expect, it } from 'vitest'
import {
  createPacsDefaultStudyDateRange,
  formatPacsDateValue,
  normalizePacsLimitValue,
  PACS_LIMIT_DEFAULT,
  PACS_LIMIT_MAX,
  PACS_LIMIT_MIN,
  PACS_LIMIT_PRESETS,
  parsePacsDateValue
} from './pacsQueryUtils'

describe('pacsQueryUtils', () => {
  it('parses and formats valid PACS date values', () => {
    const parsed = parsePacsDateValue('2026-05-27')

    expect(parsed).not.toBeNull()
    expect(parsed?.getFullYear()).toBe(2026)
    expect(parsed?.getMonth()).toBe(4)
    expect(parsed?.getDate()).toBe(27)
    expect(formatPacsDateValue(parsed)).toBe('2026-05-27')
  })

  it('rejects malformed and impossible dates', () => {
    expect(parsePacsDateValue('20260527')).toBeNull()
    expect(parsePacsDateValue('2026-02-30')).toBeNull()
    expect(parsePacsDateValue('')).toBeNull()
    expect(formatPacsDateValue('not-a-date')).toBe('')
  })

  it('normalizes PACS result limits into the supported range', () => {
    expect(PACS_LIMIT_PRESETS).toEqual([25, 50, 100, 200])
    expect(normalizePacsLimitValue('80.9')).toBe(80)
    expect(normalizePacsLimitValue(-1)).toBe(PACS_LIMIT_MIN)
    expect(normalizePacsLimitValue(999)).toBe(PACS_LIMIT_MAX)
    expect(normalizePacsLimitValue('invalid')).toBe(PACS_LIMIT_DEFAULT)
  })

  it('creates the default one-year PACS study date range', () => {
    expect(createPacsDefaultStudyDateRange(new Date(2026, 5, 5))).toEqual({
      from: '2025-06-05',
      to: '2026-06-05'
    })
    expect(createPacsDefaultStudyDateRange(new Date(2024, 1, 29))).toEqual({
      from: '2023-02-28',
      to: '2024-02-29'
    })
  })
})
