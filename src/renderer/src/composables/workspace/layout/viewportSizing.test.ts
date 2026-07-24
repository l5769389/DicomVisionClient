import { describe, expect, it } from 'vitest'
import type { ViewerTabItem } from '../../../types/viewer'
import {
  buildViewportFrameStyle,
  resolveMprLayoutAspectRatio,
  resolveViewportFrameAspectRatio
} from './viewportSizing'

function createTab(viewType: ViewerTabItem['viewType'], overrides: Partial<ViewerTabItem> = {}): ViewerTabItem {
  return {
    key: `tab-${viewType}`,
    seriesId: 'series-1',
    seriesTitle: 'Series',
    title: 'Series',
    viewType,
    viewId: '',
    imageSrc: '',
    sliceLabel: '',
    windowLabel: '',
    cornerInfo: { topLeft: [], topRight: [], bottomLeft: [], bottomRight: [] },
    orientation: { top: null, right: null, bottom: null, left: null, volumeQuaternion: null },
    ...overrides
  } as ViewerTabItem
}

describe('viewport sizing', () => {
  it('resolves fixed ratios for every imaging view family', () => {
    expect(resolveViewportFrameAspectRatio(createTab('Stack'), 'quad')).toBe(1)
    expect(resolveViewportFrameAspectRatio(createTab('PET'), 'quad')).toBe(1)
    expect(resolveViewportFrameAspectRatio(createTab('Montage'), 'quad')).toBe(1)
    expect(resolveViewportFrameAspectRatio(createTab('3D'), 'quad')).toBe(1)
    expect(resolveViewportFrameAspectRatio(createTab('CompareStack'), 'quad')).toBe(2)
    expect(resolveViewportFrameAspectRatio(createTab('PETCTFusion'), 'quad')).toBe(1)
    expect(resolveViewportFrameAspectRatio(createTab('MPR'), 'three-columns')).toBe(3)
    expect(resolveViewportFrameAspectRatio(createTab('4D'), 'three-rows')).toBe(1 / 3)
    expect(resolveViewportFrameAspectRatio(createTab('Layout', {
      layoutTemplate: { key: '2x3', label: '2 x 3', rows: 2, columns: 3, slots: [], source: 'preset' }
    }), 'quad')).toBe(1.5)
    expect(resolveViewportFrameAspectRatio(createTab('Tag'), 'quad')).toBeNull()
  })

  it('covers all MPR layout aspect policies', () => {
    expect(resolveMprLayoutAspectRatio('three-columns')).toBe(3)
    expect(resolveMprLayoutAspectRatio('three-rows')).toBe(1 / 3)
    expect(resolveMprLayoutAspectRatio('right-primary')).toBe(1)
    expect(resolveMprLayoutAspectRatio('quad')).toBe(1)
    expect(resolveMprLayoutAspectRatio('mpr-3d')).toBe(1)
  })

  it('fills the host when enabled and exposes a fixed ratio when disabled', () => {
    expect(buildViewportFrameStyle(true, 2)).toEqual({ width: '100%', height: '100%' })
    expect(buildViewportFrameStyle(false, 2)).toMatchObject({
      '--viewer-fixed-aspect-ratio': '2',
      aspectRatio: '2',
      maxWidth: '100%',
      maxHeight: '100%'
    })
  })
})
