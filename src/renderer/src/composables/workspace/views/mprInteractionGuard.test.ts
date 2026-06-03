import { describe, expect, it } from 'vitest'
import {
  resolveMprCrosshairForImageUpdate,
  resolveOptimisticMprCrosshairCenter,
  resolveOptimisticMprCrosshairRotation,
  shouldCompleteMprCrosshairSettling,
  shouldPreserveLocalMprCrosshair,
  shouldSuppressMprCrosshairPreviewImageUpdate,
  type ActiveMprCrosshairDragLock
} from './mprInteractionGuard'

const incomingCrosshair = {
  centerX: 0.2,
  centerY: 0.3,
  hitRadius: 0.025,
  horizontalPosition: 0.3,
  verticalPosition: 0.2
}

const currentCrosshair = {
  centerX: 0.6,
  centerY: 0.7,
  hitRadius: 0.025,
  horizontalPosition: 0.7,
  verticalPosition: 0.6
}

function createLock(overrides: Partial<ActiveMprCrosshairDragLock> = {}): ActiveMprCrosshairDragLock {
  return {
    tabKey: 'series-1::MPR',
    viewportKey: 'mpr-ax',
    phaseKey: null,
    mode: 'move',
    ...overrides
  }
}

describe('mprInteractionGuard', () => {
  it('preserves the optimistic crosshair for the actively dragged MPR viewport', () => {
    const lock = createLock()

    expect(
      shouldPreserveLocalMprCrosshair(lock, {
        tabKey: 'series-1::MPR',
        viewportKey: 'mpr-ax',
        phaseKey: null
      })
    ).toBe(true)

    expect(
      resolveMprCrosshairForImageUpdate({
        incomingCrosshair,
        currentCrosshair,
        lock,
        update: {
          tabKey: 'series-1::MPR',
          viewportKey: 'mpr-ax',
          phaseKey: null
        }
      })
    ).toEqual(currentCrosshair)
  })

  it('only preserves the optimistic crosshair for the active 4D phase', () => {
    const lock = createLock({
      tabKey: 'series-1::4D',
      phaseKey: '3'
    })

    expect(
      shouldPreserveLocalMprCrosshair(lock, {
        tabKey: 'series-1::4D',
        viewportKey: 'mpr-ax',
        phaseKey: '3'
      })
    ).toBe(true)

    expect(
      shouldPreserveLocalMprCrosshair(lock, {
        tabKey: 'series-1::4D',
        viewportKey: 'mpr-ax',
        phaseKey: '2'
      })
    ).toBe(false)
  })

  it('preserves the optimistic crosshair while rotating the active MPR viewport', () => {
    expect(
      resolveMprCrosshairForImageUpdate({
        incomingCrosshair,
        currentCrosshair,
        lock: createLock({ mode: 'rotate' }),
        update: {
          tabKey: 'series-1::MPR',
          viewportKey: 'mpr-ax',
          phaseKey: null
        }
      })
    ).toEqual(currentCrosshair)
  })

  it('accepts authoritative backend crosshair data when the update carries an MPR revision', () => {
    expect(
      resolveMprCrosshairForImageUpdate({
        incomingCrosshair,
        currentCrosshair,
        lock: createLock({ status: 'dragging' }),
        update: {
          tabKey: 'series-1::MPR',
          viewportKey: 'mpr-ax',
          phaseKey: null,
          mprRevision: 5
        }
      })
    ).toEqual(incomingCrosshair)

    expect(
      resolveMprCrosshairForImageUpdate({
        incomingCrosshair,
        currentCrosshair,
        lock: createLock({ status: 'settling' }),
        update: {
          tabKey: 'series-1::MPR',
          viewportKey: 'mpr-ax',
          phaseKey: null,
          mprRevision: 5
        }
      })
    ).toEqual(incomingCrosshair)
  })

  it('keeps preserving the optimistic crosshair while the drag lock is settling', () => {
    expect(
      resolveMprCrosshairForImageUpdate({
        incomingCrosshair,
        currentCrosshair,
        lock: createLock({ status: 'settling', endedAt: 123 }),
        update: {
          tabKey: 'series-1::MPR',
          viewportKey: 'mpr-ax',
          phaseKey: null
        }
      })
    ).toEqual(currentCrosshair)
  })

  it('does not preserve optimistic crosshairs for backend-driven reference viewports', () => {
    const lock = createLock()

    expect(
      shouldPreserveLocalMprCrosshair(lock, {
        tabKey: 'series-1::MPR',
        viewportKey: 'mpr-cor',
        phaseKey: null
      })
    ).toBe(false)

    expect(
      resolveMprCrosshairForImageUpdate({
        incomingCrosshair,
        currentCrosshair,
        lock,
        update: {
          tabKey: 'series-1::MPR',
          viewportKey: 'mpr-sag',
          phaseKey: null
        }
      })
    ).toEqual(incomingCrosshair)
  })

  it('suppresses active JPEG previews and stale MPR image updates', () => {
    const update = {
      tabKey: 'series-1::MPR',
      viewportKey: 'mpr-ax' as const,
      phaseKey: null,
      mprRevision: 4
    }

    expect(
      shouldSuppressMprCrosshairPreviewImageUpdate({
        lock: createLock({ status: 'dragging' }),
        update,
        imageFormat: 'jpeg'
      })
    ).toBe(true)
    expect(
      shouldSuppressMprCrosshairPreviewImageUpdate({
        acceptedMprRevision: 6,
        lock: createLock({ status: 'dragging' }),
        update: {
          ...update,
          viewportKey: 'mpr-cor',
          mprRevision: 5
        },
        imageFormat: 'jpeg'
      })
    ).toBe(true)
    expect(
      shouldSuppressMprCrosshairPreviewImageUpdate({
        acceptedMprRevision: 4,
        lock: createLock({ status: 'dragging' }),
        update: {
          ...update,
          viewportKey: 'mpr-cor',
          mprRevision: 5
        },
        imageFormat: 'jpeg'
      })
    ).toBe(false)
    expect(
      shouldSuppressMprCrosshairPreviewImageUpdate({
        lock: createLock({ status: 'settling' }),
        update,
        imageFormat: 'png'
      })
    ).toBe(false)
    expect(
      shouldSuppressMprCrosshairPreviewImageUpdate({
        acceptedMprRevision: 6,
        lock: createLock({ status: 'settling' }),
        update: {
          ...update,
          viewportKey: 'mpr-cor',
          mprRevision: 5
        },
        imageFormat: 'png'
      })
    ).toBe(true)
  })

  it('only completes settling on a backend final PNG for the active 4D phase', () => {
    const lock = createLock({
      tabKey: 'series-1::4D',
      phaseKey: '3',
      status: 'settling'
    })

    expect(
      shouldCompleteMprCrosshairSettling({
        lock,
        update: {
          tabKey: 'series-1::4D',
          viewportKey: 'mpr-ax',
          phaseKey: '3'
        },
        imageFormat: 'png',
        currentCrosshair: incomingCrosshair,
        incomingCrosshair: incomingCrosshair,
        acceptedMprRevision: 4
      })
    ).toBe(true)
    expect(
      shouldCompleteMprCrosshairSettling({
        lock,
        update: {
          tabKey: 'series-1::4D',
          viewportKey: 'mpr-ax',
          phaseKey: '2'
        },
        imageFormat: 'png'
      })
    ).toBe(false)
    expect(
      shouldCompleteMprCrosshairSettling({
        lock: createLock({ status: 'dragging' }),
        update: {
          tabKey: 'series-1::MPR',
          viewportKey: 'mpr-ax',
          phaseKey: null
        },
        imageFormat: 'png'
      })
    ).toBe(false)
  })

  it('does not complete settling without incoming crosshair data', () => {
    const lock = createLock({ status: 'settling' })

    expect(
      shouldCompleteMprCrosshairSettling({
        lock,
        update: {
          tabKey: 'series-1::MPR',
          viewportKey: 'mpr-ax',
          phaseKey: null,
          mprRevision: 5
        },
        imageFormat: 'png',
        acceptedMprRevision: 4,
        currentCrosshair: incomingCrosshair
      })
    ).toBe(false)
    expect(
      shouldCompleteMprCrosshairSettling({
        lock,
        update: {
          tabKey: 'series-1::MPR',
          viewportKey: 'mpr-ax',
          phaseKey: null,
          mprRevision: 5
        },
        imageFormat: 'png',
        acceptedMprRevision: 4,
        incomingCrosshair
      })
    ).toBe(true)
  })

  it('completes settling on authoritative final PNG even when it corrects optimistic crosshair', () => {
    const lock = createLock({ status: 'settling' })

    expect(
      shouldCompleteMprCrosshairSettling({
        lock,
        update: {
          tabKey: 'series-1::MPR',
          viewportKey: 'mpr-ax',
          phaseKey: null,
          mprRevision: 5
        },
        imageFormat: 'png',
        acceptedMprRevision: 4,
        currentCrosshair: {
          ...incomingCrosshair,
          centerX: 0.55,
          centerY: 0.66
        },
        incomingCrosshair: {
          ...incomingCrosshair,
          centerX: 0.5,
          centerY: 0.3
        }
      })
    ).toBe(true)

    expect(
      shouldCompleteMprCrosshairSettling({
        lock,
        update: {
          tabKey: 'series-1::MPR',
          viewportKey: 'mpr-ax',
          phaseKey: null,
          mprRevision: 5
        },
        imageFormat: 'png',
        acceptedMprRevision: 4,
        currentCrosshair: {
          ...incomingCrosshair,
          centerX: 0.55,
          centerY: 0.66
        },
        incomingCrosshair: {
          ...incomingCrosshair,
          centerX: 0.5509,
          centerY: 0.6599
        }
      })
    ).toBe(true)
  })

  it('accepts the backend crosshair when the viewport or tab does not match the active drag', () => {
    expect(
      resolveMprCrosshairForImageUpdate({
        incomingCrosshair,
        currentCrosshair,
        lock: createLock({ viewportKey: 'mpr-cor' }),
        update: {
          tabKey: 'series-1::MPR',
          viewportKey: 'mpr-ax',
          phaseKey: null
        }
      })
    ).toEqual(incomingCrosshair)

    expect(
      resolveMprCrosshairForImageUpdate({
        incomingCrosshair,
        currentCrosshair,
        lock: createLock({ tabKey: 'series-2::MPR' }),
        update: {
          tabKey: 'series-1::MPR',
          viewportKey: 'mpr-ax',
          phaseKey: null
        }
      })
    ).toEqual(incomingCrosshair)
  })

  it('falls back to the backend crosshair when no optimistic crosshair exists locally', () => {
    expect(
      resolveMprCrosshairForImageUpdate({
        incomingCrosshair,
        currentCrosshair: null,
        lock: createLock(),
        update: {
          tabKey: 'series-1::MPR',
          viewportKey: 'mpr-ax',
          phaseKey: null
        }
      })
    ).toEqual(incomingCrosshair)
  })

  it('preserves the initial grab offset while generating optimistic drag centers', () => {
    expect(
      resolveOptimisticMprCrosshairCenter({
        lock: createLock({
          pointerOffsetX: -0.04,
          pointerOffsetY: 0.03
        }),
        pointerX: 0.8,
        pointerY: 0.1,
        update: {
          tabKey: 'series-1::MPR',
          viewportKey: 'mpr-ax',
          phaseKey: null
        }
      })
    ).toEqual({
      x: 0.76,
      y: 0.13
    })
  })

  it('falls back to the pointer position when no matching optimistic drag lock exists', () => {
    expect(
      resolveOptimisticMprCrosshairCenter({
        lock: createLock({
          tabKey: 'series-1::4D',
          phaseKey: '1',
          pointerOffsetX: 0.2,
          pointerOffsetY: -0.1
        }),
        pointerX: 0.85,
        pointerY: 0.15,
        update: {
          tabKey: 'series-1::4D',
          viewportKey: 'mpr-ax',
          phaseKey: '2'
        }
      })
    ).toEqual({
      x: 0.85,
      y: 0.15
    })
  })

  it('keeps orthogonal crosshair rotation locked at 90 degrees during optimistic updates', () => {
    const rotation = resolveOptimisticMprCrosshairRotation({
      lock: createLock({
        mode: 'rotate',
        line: 'horizontal',
        centerX: 0.5,
        centerY: 0.5,
        startPointerAngleRad: 0,
        startHorizontalAngleRad: 0,
        startVerticalAngleRad: Math.PI / 2,
        isDoubleOblique: false
      }),
      pointerX: 0.5,
      pointerY: 1,
      line: 'horizontal',
      update: {
        tabKey: 'series-1::MPR',
        viewportKey: 'mpr-ax',
        phaseKey: null
      }
    })

    expect(rotation?.horizontalAngleRad).toBeCloseTo(Math.PI / 2)
    expect(rotation?.verticalAngleRad).toBeCloseTo(0)
  })

  it('only rotates the grabbed line during optimistic Double Oblique updates', () => {
    const rotation = resolveOptimisticMprCrosshairRotation({
      lock: createLock({
        mode: 'rotate',
        line: 'horizontal',
        centerX: 0.5,
        centerY: 0.5,
        startPointerAngleRad: 0,
        startHorizontalAngleRad: 0,
        startVerticalAngleRad: 0.7,
        isDoubleOblique: true
      }),
      pointerX: 0.5,
      pointerY: 1,
      line: 'horizontal',
      update: {
        tabKey: 'series-1::MPR',
        viewportKey: 'mpr-ax',
        phaseKey: null
      }
    })

    expect(rotation?.horizontalAngleRad).toBeCloseTo(Math.PI / 2)
    expect(rotation?.verticalAngleRad).toBeCloseTo(0.7)
  })
})
