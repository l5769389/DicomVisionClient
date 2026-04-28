import { describe, expect, it } from 'vitest'
import {
  resolveMprCrosshairForImageUpdate,
  resolveOptimisticMprCrosshairCenter,
  shouldPreserveLocalMprCrosshair,
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

  it('accepts the backend crosshair when the viewport, tab, or mode does not match the active drag', () => {
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
})
