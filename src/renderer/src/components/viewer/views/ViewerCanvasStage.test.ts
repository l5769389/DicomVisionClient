import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import ViewerCanvasStage from './ViewerCanvasStage.vue'
import type { CornerInfo, OrientationInfo } from '../../../types/viewer'

const emptyCornerInfo: CornerInfo = {
  topLeft: [],
  topRight: [],
  bottomLeft: [],
  bottomRight: []
}

const emptyOrientation: OrientationInfo = {
  top: null,
  right: null,
  bottom: null,
  left: null,
  volumeQuaternion: null
}

const overlayStubs = {
  VolumeOrientationCube: { template: '<div />' },
  ViewportAnnotationOverlay: { template: '<div />' },
  ViewportCornerOverlay: { template: '<div />' },
  ViewportCrosshairOverlay: { template: '<div />' },
  ViewportMtfOverlay: { template: '<div />' },
  ViewportMeasurementOverlay: { template: '<div />' },
  ViewportOrientationOverlay: { template: '<div />' },
  ViewportQaWaterOverlay: { template: '<div />' },
  ViewportScaleBarOverlay: { template: '<div />' }
}

function mountStage(imageSrc = 'blob:frame-1') {
  return mount(ViewerCanvasStage, {
    props: {
      alt: 'Stack',
      cornerInfo: emptyCornerInfo,
      imageSrc,
      orientation: emptyOrientation,
      placeholder: 'Preview',
      viewportKey: 'single'
    },
    global: {
      stubs: overlayStubs
    }
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('ViewerCanvasStage layout metrics', () => {
  it('coalesces resize and image changes into one layout measurement per animation frame', async () => {
    let resizeCallback: ResizeObserverCallback = () => undefined
    class ResizeObserverStub {
      observe = vi.fn()
      unobserve = vi.fn()
      disconnect = vi.fn()

      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback
      }
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)

    const rafCallbacks: FrameRequestCallback[] = []
    const requestAnimationFrameSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      rafCallbacks.push(callback)
      return rafCallbacks.length
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      () =>
        ({
          left: 0,
          top: 0,
          right: 100,
          bottom: 80,
          width: 100,
          height: 80,
          x: 0,
          y: 0,
          toJSON: () => ({})
        }) as DOMRect
    )
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(100)
    vi.spyOn(HTMLImageElement.prototype, 'naturalHeight', 'get').mockReturnValue(80)

    const wrapper = mountStage()
    await nextTick()

    resizeCallback([], {} as ResizeObserver)
    resizeCallback([], {} as ResizeObserver)
    await wrapper.setProps({ imageSrc: 'blob:frame-2' })
    await wrapper.setProps({ imageSrc: 'blob:frame-3' })

    expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(1)

    rafCallbacks.shift()?.(16)
    resizeCallback([], {} as ResizeObserver)

    expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(2)

    wrapper.unmount()
  })
})
