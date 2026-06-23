import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ViewportCrosshairOverlay from './ViewportCrosshairOverlay.vue'

function createCanvasContext(): CanvasRenderingContext2D {
  return {
    beginPath: vi.fn(),
    clearRect: vi.fn(),
    lineTo: vi.fn(),
    moveTo: vi.fn(),
    restore: vi.fn(),
    save: vi.fn(),
    scale: vi.fn(),
    setLineDash: vi.fn(),
    setTransform: vi.fn(),
    stroke: vi.fn()
  } as unknown as CanvasRenderingContext2D
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
  vi.restoreAllMocks()
})

describe('ViewportCrosshairOverlay', () => {
  it('draws the initial crosshair after the canvas is mounted', () => {
    const raf = installQueuedRaf()
    const context = createCanvasContext()
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(context)

    const wrapper = mount(ViewportCrosshairOverlay, {
      props: {
        imageFrame: {
          left: 0,
          top: 0,
          width: 320,
          height: 240
        },
        mprCrosshair: {
          centerX: 0.5,
          centerY: 0.5,
          hitRadius: 8,
          horizontalPosition: 0.5,
          verticalPosition: 0.5
        },
        stageHeight: 240,
        stageWidth: 320,
        viewportKey: 'mpr-ax'
      }
    })

    expect(getContext).not.toHaveBeenCalled()

    raf.flush()

    expect(getContext).toHaveBeenCalledTimes(1)
    expect(context.stroke).toHaveBeenCalled()
    wrapper.unmount()
  })
})
