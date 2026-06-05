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
  ViewportCornerOverlay: { template: '<div class="corner-overlay-stub" />' },
  ViewportCrosshairOverlay: { template: '<div class="crosshair-overlay-stub" />' },
  ViewportMtfOverlay: { template: '<div />' },
  ViewportMeasurementOverlay: { template: '<div />' },
  ViewportOrientationOverlay: { template: '<div />' },
  ViewportQaWaterOverlay: { template: '<div />' },
  ViewportScaleBarOverlay: { template: '<div class="scale-bar-overlay-stub" />' }
}

function mountStage(imageSrc = 'blob:frame-1', props: Record<string, unknown> = {}) {
  return mount(ViewerCanvasStage, {
    props: {
      alt: 'Stack',
      cornerInfo: emptyCornerInfo,
      imageSrc,
      orientation: emptyOrientation,
      placeholder: 'Preview',
      viewportKey: 'single',
      ...props
    },
    global: {
      stubs: overlayStubs
    }
  })
}

function createPointerMoveEvent(options: { buttons: number; clientX: number; clientY: number }): Event {
  const event = new Event('pointermove', { bubbles: true, cancelable: true })
  Object.defineProperties(event, {
    buttons: { value: options.buttons },
    clientX: { value: options.clientX },
    clientY: { value: options.clientY }
  })
  return event
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

  it('only emits hover coordinates while no pointer button is pressed', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      () =>
        ({
          left: 0,
          top: 0,
          right: 200,
          bottom: 200,
          width: 200,
          height: 200,
          x: 0,
          y: 0,
          toJSON: () => ({})
        }) as DOMRect
    )
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(200)
    vi.spyOn(HTMLImageElement.prototype, 'naturalHeight', 'get').mockReturnValue(200)

    const wrapper = mountStage()
    await nextTick()
    const viewport = wrapper.find('.viewer-viewport')

    viewport.element.dispatchEvent(createPointerMoveEvent({ buttons: 1, clientX: 80, clientY: 90 }))
    await nextTick()
    expect(wrapper.emitted('hoverViewportChange')).toBeUndefined()

    viewport.element.dispatchEvent(createPointerMoveEvent({ buttons: 0, clientX: 80, clientY: 90 }))
    await nextTick()

    expect(wrapper.emitted('hoverViewportChange')).toEqual([
      [
        {
          viewportKey: 'single',
          x: 0.4,
          y: 0.45
        }
      ]
    ])

    wrapper.unmount()
  })

  it('clears hover coordinates when a pointer drag starts', async () => {
    const wrapper = mountStage()
    await nextTick()

    await wrapper.find('.viewer-viewport').trigger('pointerdown')

    expect(wrapper.emitted('hoverViewportChange')).toEqual([
      [
        {
          viewportKey: 'single',
          x: null,
          y: null
        }
      ]
    ])

    wrapper.unmount()
  })

  it('renders image and overlays without a local transform layer', () => {
    const wrapper = mountStage()

    expect(wrapper.find('.viewer-image-space-layer').exists()).toBe(false)
    expect(wrapper.find('.viewer-image').exists()).toBe(true)
    expect(wrapper.find('.crosshair-overlay-stub').exists()).toBe(true)
    expect(wrapper.find('.corner-overlay-stub').exists()).toBe(true)
    expect(wrapper.find('.scale-bar-overlay-stub').exists()).toBe(true)
    wrapper.unmount()
  })

  it('can hide corner info and scale bar overlays independently', () => {
    const wrapper = mountStage('blob:frame-1', {
      showCornerInfo: false,
      showScaleBar: false
    })

    expect(wrapper.find('.corner-overlay-stub').exists()).toBe(false)
    expect(wrapper.find('.scale-bar-overlay-stub').exists()).toBe(false)
    expect(wrapper.find('.crosshair-overlay-stub').exists()).toBe(true)
    wrapper.unmount()
  })
})
