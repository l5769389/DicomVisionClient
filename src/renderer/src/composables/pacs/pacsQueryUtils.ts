export const PACS_LIMIT_MIN = 1
export const PACS_LIMIT_MAX = 200
export const PACS_LIMIT_DEFAULT = 50
export const PACS_LIMIT_PRESETS = [25, 50, 100, 200] as const
export const PACS_SERIES_LIMIT = 200

export function parsePacsDateValue(value: string): Date | null {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) {
    return null
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null
  }
  return date
}

export function formatPacsDateValue(value: unknown): string {
  if (!value) {
    return ''
  }

  const date = value instanceof Date ? value : new Date(value as string | number)
  if (!Number.isFinite(date.getTime())) {
    return ''
  }

  const year = String(date.getFullYear()).padStart(4, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function normalizePacsLimitValue(value: unknown): number {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    return PACS_LIMIT_DEFAULT
  }
  return Math.min(PACS_LIMIT_MAX, Math.max(PACS_LIMIT_MIN, Math.trunc(numericValue)))
}
