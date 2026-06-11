import { describe, expect, it } from 'vitest'
import { resolveShellKind, rewritePathForMobileShell } from './shellSelection'

describe('shellSelection', () => {
  it('forces the mobile shell for the /m route', () => {
    expect(resolveShellKind({ pathname: '/m', viewportWidth: 1280 })).toBe('mobile')
    expect(resolveShellKind({ pathname: '/m/study', viewportWidth: 1280 })).toBe('mobile')
  })

  it('forces the mobile shell for mobile hostnames', () => {
    expect(resolveShellKind({ hostname: 'm.example.com', pathname: '/', viewportWidth: 1280 })).toBe('mobile')
    expect(resolveShellKind({ hostname: 'mobile.example.com', pathname: '/', viewportWidth: 1280 })).toBe('mobile')
  })

  it('keeps desktop runtime on the desktop shell', () => {
    expect(resolveShellKind({
      hasDesktopRuntime: true,
      hostname: 'm.example.com',
      pathname: '/m',
      viewportWidth: 390,
      maxTouchPoints: 5
    })).toBe('desktop')
  })

  it('keeps a wide non-touch browser on the desktop shell', () => {
    expect(resolveShellKind({ pathname: '/', viewportWidth: 1280, hasCoarsePointer: false, maxTouchPoints: 0 })).toBe('desktop')
  })

  it('auto-selects mobile for narrow touch browsers', () => {
    expect(resolveShellKind({ pathname: '/', viewportWidth: 390, hasCoarsePointer: true, maxTouchPoints: 5 })).toBe('mobile')
  })

  it('rewrites automatic mobile entry to /m while preserving query and hash', () => {
    expect(rewritePathForMobileShell('/', '?case=demo', '#view')).toBe('/m?case=demo#view')
  })
})
