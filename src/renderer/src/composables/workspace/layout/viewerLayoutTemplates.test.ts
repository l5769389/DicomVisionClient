import { describe, expect, it } from 'vitest'
import {
  createUniformLayoutTemplate,
  createCustomViewerLayoutOptionValue,
  createViewerLayoutOptionValue,
  parseViewerLayoutOptionValue,
  VIEWER_LAYOUT_PRESETS
} from './viewerLayoutTemplates'

describe('viewerLayoutTemplates', () => {
  it('creates one stack slot per uniform layout cell', () => {
    const template = createUniformLayoutTemplate(2, 3)

    expect(template.rows).toBe(2)
    expect(template.columns).toBe(3)
    expect(template.slots).toHaveLength(6)
    expect(template.slots[4]).toMatchObject({
      id: 'slot-2-2',
      row: 1,
      column: 1,
      rowSpan: 1,
      columnSpan: 1,
      viewType: 'Stack'
    })
  })

  it('parses preset and custom toolbar option values', () => {
    const preset = VIEWER_LAYOUT_PRESETS.find((item) => item.rows === 2 && item.columns === 2)
    expect(preset).toBeTruthy()

    expect(parseViewerLayoutOptionValue(createViewerLayoutOptionValue(preset!))).toMatchObject({
      key: 'preset:2x2',
      rows: 2,
      columns: 2,
      source: 'preset'
    })
    expect(parseViewerLayoutOptionValue('layout:custom:3x4')).toMatchObject({
      key: 'custom:3x4',
      rows: 3,
      columns: 4,
      source: 'custom'
    })
  })

  it('formats custom toolbar values with clamped grid dimensions', () => {
    expect(createCustomViewerLayoutOptionValue(3, 4)).toBe('layout:custom:3x4')
    expect(createCustomViewerLayoutOptionValue(0, 99)).toBe('layout:custom:1x6')
  })
})
