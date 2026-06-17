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

const imageFrameOverlayStub = {
  props: ['imageFrame'],
  template:
    '<div class="image-frame-overlay-stub" :data-left="imageFrame.left" :data-top="imageFrame.top" :data-width="imageFrame.width" :data-height="imageFrame.height" :data-natural-width="imageFrame.naturalWidth ?? 0" :data-natural-height="imageFrame.naturalHeight ?? 0" />'
}

const annotationOverlayStub = {
  props: ['imageFrame'],
  template:
    '<div class="annotation-overlay-stub" :data-left="imageFrame.left" :data-top="imageFrame.top" :data-width="imageFrame.width" :data-height="imageFrame.height" />'
}

const overlayStubs = {
  VolumeOrientationCube: { template: '<div />' },
  ViewportAnnotationOverlay: annotationOverlayStub,
  ViewportCornerOverlay: { template: '<div class="corner-overlay-stub" />' },
  ViewportCrosshairOverlay: { template: '<div class="crosshair-overlay-stub" />' },
  ViewportMtfOverlay: imageFrameOverlayStub,
  ViewportMeasurementOverlay: { template: '<div />' },
  ViewportOrientationOverlay: { template: '<div class="orientation-overlay-stub" />' },
  ViewportQaWaterOverlay: imageFrameOverlayStub,
  ViewportScaleBarOverlay: { template: '<div class="scale-bar-overlay-stub" />' },
  ViewportVoiOverlay: imageFrameOverlayStub
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

function readOverlayFrame(wrapper: ReturnType<typeof mount<typeof ViewerCanvasStage>>) {
  const overlay = wrapper.find('.image-frame-overlay-stub')
  return {
    left: Number(overlay.attributes('data-left')),
    top: Number(overlay.attributes('data-top')),
    width: Number(overlay.attributes('data-width')),
    height: Number(overlay.attributes('data-height')),
    naturalWidth: Number(overlay.attributes('data-natural-width')),
    naturalHeight: Number(overlay.attributes('data-natural-height'))
  }
}

function installQueuedRaf(): { flush: () => void } {
  const callbacks: FrameRequestCallback[] = []
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    callbacks.push(callback)
    return callbacks.length
  })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)
  return {
    flush: () => {
      const pending = callbacks.splice(0)
      pending.forEach((callback) => callback(0))
    }
  }
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

  it('keeps the previous valid image frame while a replacement image is loading', async () => {
    let naturalWidth = 100
    let naturalHeight = 50
    const raf = installQueuedRaf()
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      () =>
        ({
          left: 0,
          top: 0,
          right: 200,
          bottom: 100,
          width: 200,
          height: 100,
          x: 0,
          y: 0,
          toJSON: () => ({})
        }) as DOMRect
    )
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockImplementation(() => naturalWidth)
    vi.spyOn(HTMLImageElement.prototype, 'naturalHeight', 'get').mockImplementation(() => naturalHeight)

    const wrapper = mountStage('blob:frame-1')
    await nextTick()
    raf.flush()
    await nextTick()
    expect(readOverlayFrame(wrapper)).toMatchObject({
      left: 0,
      top: 0,
      width: 200,
      height: 100,
      naturalWidth: 100,
      naturalHeight: 50
    })

    naturalWidth = 0
    naturalHeight = 0
    await wrapper.setProps({ imageSrc: 'blob:frame-2' })
    await nextTick()
    raf.flush()
    await nextTick()

    expect(readOverlayFrame(wrapper)).toMatchObject({
      left: 0,
      top: 0,
      width: 200,
      height: 100,
      naturalWidth: 100,
      naturalHeight: 50
    })

    wrapper.unmount()
  })

  it('updates the stable image frame after the new image load completes', async () => {
    let naturalWidth = 100
    let naturalHeight = 50
    const raf = installQueuedRaf()
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      () =>
        ({
          left: 0,
          top: 0,
          right: 200,
          bottom: 100,
          width: 200,
          height: 100,
          x: 0,
          y: 0,
          toJSON: () => ({})
        }) as DOMRect
    )
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockImplementation(() => naturalWidth)
    vi.spyOn(HTMLImageElement.prototype, 'naturalHeight', 'get').mockImplementation(() => naturalHeight)

    const wrapper = mountStage('blob:frame-1')
    await nextTick()
    raf.flush()
    await nextTick()

    naturalWidth = 0
    naturalHeight = 0
    await wrapper.setProps({ imageSrc: 'blob:frame-2' })
    await nextTick()
    raf.flush()
    await nextTick()
    expect(readOverlayFrame(wrapper)).toMatchObject({
      width: 200,
      height: 100,
      naturalWidth: 100,
      naturalHeight: 50
    })

    naturalWidth = 50
    naturalHeight = 100
    await wrapper.find('img.viewer-image').trigger('load')
    await nextTick()
    raf.flush()
    await nextTick()

    expect(readOverlayFrame(wrapper)).toMatchObject({
      left: 75,
      top: 0,
      width: 50,
      height: 100,
      naturalWidth: 50,
      naturalHeight: 100
    })

    wrapper.unmount()
  })

  it('clears the image frame only when the image source is removed', async () => {
    const raf = installQueuedRaf()
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      () =>
        ({
          left: 0,
          top: 0,
          right: 200,
          bottom: 100,
          width: 200,
          height: 100,
          x: 0,
          y: 0,
          toJSON: () => ({})
        }) as DOMRect
    )
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(100)
    vi.spyOn(HTMLImageElement.prototype, 'naturalHeight', 'get').mockReturnValue(50)

    const wrapper = mountStage('blob:frame-1')
    await nextTick()
    raf.flush()
    await nextTick()
    expect(readOverlayFrame(wrapper).width).toBe(200)

    await wrapper.setProps({ imageSrc: '' })
    await nextTick()
    raf.flush()
    await nextTick()

    expect(wrapper.find('.image-frame-overlay-stub').exists()).toBe(false)

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
    expect(wrapper.find('.orientation-overlay-stub').exists()).toBe(true)
    expect(wrapper.find('.scale-bar-overlay-stub').exists()).toBe(true)
    wrapper.unmount()
  })

  it('hides image overlays while loading without image content', () => {
    const wrapper = mountStage('', {
      isLoading: true,
      orientation: {
        top: 'A',
        right: 'L',
        bottom: 'P',
        left: 'R',
        volumeQuaternion: null
      }
    })

    expect(wrapper.find('.viewer-image').exists()).toBe(false)
    expect(wrapper.find('.crosshair-overlay-stub').exists()).toBe(false)
    expect(wrapper.find('.corner-overlay-stub').exists()).toBe(false)
    expect(wrapper.find('.orientation-overlay-stub').exists()).toBe(false)
    expect(wrapper.find('.scale-bar-overlay-stub').exists()).toBe(false)
    wrapper.unmount()
  })

  it('treats image layers as image content for overlays', () => {
    const wrapper = mountStage('', {
      imageLayers: [
        {
          key: 'pet-layer',
          src: 'blob:pet-layer',
          alt: 'PET layer'
        }
      ]
    })

    expect(wrapper.find('.crosshair-overlay-stub').exists()).toBe(true)
    expect(wrapper.find('.corner-overlay-stub').exists()).toBe(true)
    expect(wrapper.find('.orientation-overlay-stub').exists()).toBe(true)
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
    expect(wrapper.find('.orientation-overlay-stub').exists()).toBe(true)
    wrapper.unmount()
  })

  it('does not pass viewport transforms to annotation overlays', async () => {
    const wrapper = mountStage('blob:frame-1', {
      viewportTransform: {
        rotationDegrees: 90,
        horFlip: false,
        verFlip: false,
        zoom: 2,
        offsetX: 12,
        offsetY: -8
      }
    })
    await nextTick()

    const annotationOverlay = wrapper.find('.annotation-overlay-stub')
    expect(annotationOverlay.attributes('data-zoom')).toBeUndefined()
    expect(annotationOverlay.attributes('data-rotation')).toBeUndefined()
    wrapper.unmount()
  })
})
