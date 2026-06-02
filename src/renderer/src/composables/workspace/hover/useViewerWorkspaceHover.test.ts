import { computed } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import type { CornerInfo } from '../../../types/viewer'
import { useViewerWorkspaceHover } from './useViewerWorkspaceHover'

vi.mock('../../../services/socket', () => ({
  emitViewHover: vi.fn()
}))

function createHoverHelpers() {
  return useViewerWorkspaceHover({
    activeTab: computed(() => null),
    activeViewportKey: { value: 'single' },
    updateHoverCornerInfoByViewId: vi.fn()
  })
}

function createCornerInfo(bottomRight: string[]): CornerInfo {
  return {
    topLeft: [],
    topRight: [],
    bottomLeft: [],
    bottomRight
  }
}

describe('useViewerWorkspaceHover corner info', () => {
  it('preserves fixed zoom and pan offset lines when stripping hover cursor lines', () => {
    const hover = createHoverHelpers()
    const cornerInfo = createCornerInfo(['Zoom:1.25x', 'X:12 Y:-4', 'Cursor X:210 Y:99'])

    expect(hover.stripHoverCornerInfo(cornerInfo).bottomRight).toEqual(['Zoom:1.25x', 'X:12 Y:-4'])
  })

  it('updates the single X/Y coordinate line when hover pixels are available', () => {
    const hover = createHoverHelpers()
    const cornerInfo = createCornerInfo(['Zoom:1.25x', 'X:12 Y:-4'])

    expect(hover.withHoverCornerInfo(cornerInfo, 99, 210).bottomRight).toEqual([
      'Zoom:1.25x',
      'X:210 Y:99'
    ])
  })

  it('normalizes existing cursor coordinate lines into the single X/Y line', () => {
    const hover = createHoverHelpers()
    const cornerInfo = createCornerInfo(['Zoom:1.25x', 'Cursor X:210 Y:99'])

    expect(hover.withHoverCornerInfo(cornerInfo).bottomRight).toEqual([
      'Zoom:1.25x',
      'X:210 Y:99'
    ])
  })
})

