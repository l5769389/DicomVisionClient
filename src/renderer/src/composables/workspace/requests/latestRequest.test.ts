import { describe, expect, it } from 'vitest'
import { createKeyedLatestRequestGuard, createLatestRequestGuard } from './latestRequest'

describe('latest request guards', () => {
  it('aborts and invalidates the previous unkeyed request', () => {
    const guard = createLatestRequestGuard()
    const first = guard.start()
    const second = guard.start()

    expect(first.signal.aborted).toBe(true)
    expect(second.signal.aborted).toBe(false)
    expect(guard.isCurrent(first.token)).toBe(false)
    expect(guard.isCurrent(second.token)).toBe(true)

    guard.finish(first.token)
    expect(guard.isCurrent(second.token)).toBe(true)

    guard.finish(second.token)
    expect(guard.isCurrent(second.token)).toBe(false)
  })

  it('isolates keyed requests from each other', () => {
    const guard = createKeyedLatestRequestGuard<string>()
    const firstA = guard.start('a')
    const firstB = guard.start('b')
    const secondA = guard.start('a')

    expect(firstA.signal.aborted).toBe(true)
    expect(firstB.signal.aborted).toBe(false)
    expect(secondA.signal.aborted).toBe(false)
    expect(guard.isCurrent('a', firstA.token)).toBe(false)
    expect(guard.isCurrent('a', secondA.token)).toBe(true)
    expect(guard.isCurrent('b', firstB.token)).toBe(true)

    guard.cancel('b')
    expect(firstB.signal.aborted).toBe(true)
    expect(guard.isCurrent('b', firstB.token)).toBe(false)
  })
})
