import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import type { CornerInfo, ViewerTabItem } from '../../../types/viewer'
import StackView from './StackView.vue'

vi.mock('./ViewerCanvasStage.vue', () => ({
  default: {
    name: 'ViewerCanvasStage',
    props: ['alt', 'lightSurface', 'stageSurfaceClass', 'viewportKey'],
    template:
      '<div class="viewer-canvas-stage-stub" :data-alt="alt" :data-light-surface="lightSurface ? \'true\' : \'false\'" :data-stage-surface-class="stageSurfaceClass" :data-viewport-key="viewportKey"></div>'
  }
}))

const cornerInfo: CornerInfo = {
  topLeft: [],
  topRight: [],
  bottomLeft: [],
  bottomRight: []
}

function createStackTab(overrides: Partial<ViewerTabItem> = {}): ViewerTabItem {
  return {
    key: 'series-1::stack',
    seriesId: 'series-1',
    seriesTitle: 'Series 1',
    title: 'Series 1 / Stack',
    viewType: 'Stack',
    viewId: 'view-1',
    imageSrc: 'blob:stack-image',
    sliceLabel: '1 / 10',
    windowLabel: 'WW 400 / WL 40',
    orientation: {
      top: 'A',
      right: 'L',
      bottom: 'P',
      left: 'R',
      volumeQuaternion: null
    },
    transformState: {
      rotationDegrees: 0,
      horFlip: false,
      verFlip: false
    },
    ...overrides
  } as ViewerTabItem
}

function mountStackView(activeTab: ViewerTabItem) {
  return mount(StackView, {
    props: {
      activeOperation: 'stack:window',
      activeTab,
      cornerInfo
    }
  })
}

describe('StackView PET surface', () => {
  it('uses a white light surface for standalone PET tabs', () => {
    const wrapper = mountStackView(
      createStackTab({
        key: 'pet::PET',
        title: 'PET FDG SUV / PET',
        viewType: 'PET',
        petInfo: {
          seriesId: 'pet',
          petUnit: 'SUVbw',
          petWindowMin: 0,
          petWindowMax: 8,
          pseudocolorPreset: 'bwinverse'
        }
      })
    )

    const stage = wrapper.find('.viewer-canvas-stage-stub')
    expect(stage.attributes('data-alt')).toBe('PET')
    expect(stage.attributes('data-light-surface')).toBe('true')
    expect(stage.attributes('data-stage-surface-class')).toBe('viewer-stage-surface--white viewer-stage-surface--pet-standalone')
    wrapper.unmount()
  })

  it('keeps regular Stack tabs on the default dark surface', () => {
    const wrapper = mountStackView(createStackTab())

    const stage = wrapper.find('.viewer-canvas-stage-stub')
    expect(stage.attributes('data-alt')).toBe('Stack')
    expect(stage.attributes('data-light-surface')).toBe('false')
    expect(stage.attributes('data-stage-surface-class')).toBe('')
    wrapper.unmount()
  })
})
