import { describe, expect, it } from 'vitest'
import { APP_BACKEND_CONFIG, DESKTOP_DEV_BACKEND_ORIGIN } from '@shared/appConfig'

describe('viewport montage worktree backend configuration', () => {
  it('uses the worktree-owned backend port instead of main or pre-release', () => {
    expect(APP_BACKEND_CONFIG.desktop.devPort).toBe(8200)
    expect(APP_BACKEND_CONFIG.web.devOrigin).toBe('http://127.0.0.1:8200')
    expect(DESKTOP_DEV_BACKEND_ORIGIN).toBe('http://127.0.0.1:8200')
  })
})
