import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { usePointerDockResize } from './usePointerDockResize'

describe('usePointerDockResize', () => {
  let frameCallback: FrameRequestCallback | null

  beforeEach(() => {
    frameCallback = null
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frameCallback = callback
      return 1
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {
      frameCallback = null
    })
  })

  function pointer(type: string, clientX: number): PointerEvent {
    return new PointerEvent(type, { clientX, bubbles: true })
  }

  it('coalesces pointer moves into one animation frame and commits the final position', () => {
    const commits = vi.fn()
    const scope = effectScope()
    const resize = scope.run(() => usePointerDockResize<'left'>({ onCommit: commits }))!
    const config = { collapsedWidth: 64, collapseThreshold: 220, minWidth: 280, maxWidth: 480 }

    resize.start(pointer('pointerdown', 100), { config, direction: 'left', key: 'left', startWidth: 300 })
    window.dispatchEvent(pointer('pointermove', 120))
    window.dispatchEvent(pointer('pointermove', 150))

    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1)
    expect(resize.preview.value?.result.width).toBe(300)
    frameCallback?.(0)
    expect(resize.preview.value?.result.width).toBe(350)

    window.dispatchEvent(pointer('pointerup', 170))
    expect(commits).toHaveBeenCalledWith('left', expect.objectContaining({ collapsed: false, width: 370 }))
    expect(resize.preview.value).toBeNull()
    scope.stop()
  })

  it('mirrors right-side growth and restores preview state on cancel', () => {
    const commits = vi.fn()
    const scope = effectScope()
    const resize = scope.run(() => usePointerDockResize<'right'>({ onCommit: commits }))!
    const config = { collapsedWidth: 58, collapseThreshold: 170, minWidth: 196, maxWidth: 360 }

    resize.start(pointer('pointerdown', 500), { config, direction: 'right', key: 'right', startWidth: 58 })
    window.dispatchEvent(pointer('pointermove', 450))
    frameCallback?.(0)
    expect(resize.preview.value?.result).toMatchObject({ collapsed: true, width: 108 })

    window.dispatchEvent(pointer('pointercancel', 450))
    expect(resize.preview.value).toBeNull()
    expect(commits).not.toHaveBeenCalled()
    scope.stop()
  })
})
