import type { ViewerLayoutSlot, ViewerLayoutTemplate } from '../../../types/viewer'

export const VIEWER_LAYOUT_CUSTOM_GRID_SIZE = 6
export const VIEWER_LAYOUT_OPTION_PREFIX = 'layout:'

const LAYOUT_PRESET_DIMENSIONS: Array<[number, number]> = [
  [1, 1],
  [1, 2],
  [2, 1],
  [2, 2],
  [1, 3],
  [3, 1],
  [2, 3],
  [3, 2],
  [1, 4],
  [4, 1],
  [2, 4],
  [4, 2],
  [3, 3],
  [3, 4],
  [4, 3],
  [4, 4]
]

function clampGridSize(value: number): number {
  if (!Number.isFinite(value)) {
    return 1
  }
  return Math.min(VIEWER_LAYOUT_CUSTOM_GRID_SIZE, Math.max(1, Math.trunc(value)))
}

function createUniformSlots(rows: number, columns: number): ViewerLayoutSlot[] {
  return Array.from({ length: rows * columns }, (_, index) => {
    const row = Math.floor(index / columns)
    const column = index % columns
    return {
      id: `slot-${row + 1}-${column + 1}`,
      row,
      column,
      rowSpan: 1,
      columnSpan: 1,
      viewType: 'Stack'
    }
  })
}

export function createUniformLayoutTemplate(
  rows: number,
  columns: number,
  source: ViewerLayoutTemplate['source'] = 'custom'
): ViewerLayoutTemplate {
  const normalizedRows = clampGridSize(rows)
  const normalizedColumns = clampGridSize(columns)
  const key = `${source}:${normalizedRows}x${normalizedColumns}`
  return {
    key,
    label: `${normalizedRows} x ${normalizedColumns}`,
    rows: normalizedRows,
    columns: normalizedColumns,
    slots: createUniformSlots(normalizedRows, normalizedColumns),
    source
  }
}

export const VIEWER_LAYOUT_PRESETS: ViewerLayoutTemplate[] = LAYOUT_PRESET_DIMENSIONS.map(([rows, columns]) =>
  createUniformLayoutTemplate(rows, columns, 'preset')
)

export function createViewerLayoutOptionValue(template: ViewerLayoutTemplate): string {
  return `${VIEWER_LAYOUT_OPTION_PREFIX}${template.key}`
}

export function cloneViewerLayoutTemplate(template: ViewerLayoutTemplate): ViewerLayoutTemplate {
  return {
    ...template,
    slots: template.slots.map((slot) => ({ ...slot }))
  }
}

export function parseViewerLayoutOptionValue(value: string): ViewerLayoutTemplate | null {
  if (!value.startsWith(VIEWER_LAYOUT_OPTION_PREFIX)) {
    return null
  }

  const key = value.slice(VIEWER_LAYOUT_OPTION_PREFIX.length)
  const preset = VIEWER_LAYOUT_PRESETS.find((item) => item.key === key)
  if (preset) {
    return cloneViewerLayoutTemplate(preset)
  }

  const customMatch = key.match(/^custom:(\d+)x(\d+)$/)
  if (!customMatch) {
    return null
  }

  return createUniformLayoutTemplate(Number(customMatch[1]), Number(customMatch[2]), 'custom')
}
