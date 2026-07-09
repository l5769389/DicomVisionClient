import { describe, expect, it } from 'vitest'
import { resolvePageHostBackendOrigin, resolveWebBackendOriginForPage } from './runtime'

describe('resolveWebBackendOriginForPage', () => {
  it('falls back to same-origin when an HTTPS page is configured with an insecure HTTP backend', () => {
    expect(
      resolveWebBackendOriginForPage(
        'http://111.228.1.213///',
        'https://dicom.zhaolin.online',
        'https:'
      )
    ).toBe('https://dicom.zhaolin.online')
  })

  it('keeps explicit HTTP backend origins for HTTP pages', () => {
    expect(
      resolveWebBackendOriginForPage(
        'http://111.228.1.213///',
        'http://111.228.1.213',
        'http:'
      )
    ).toBe('http://111.228.1.213')
  })

  it('keeps secure explicit backend origins', () => {
    expect(
      resolveWebBackendOriginForPage(
        'https://api.example.test/',
        'https://dicom.zhaolin.online',
        'https:'
      )
    ).toBe('https://api.example.test')
  })

  it('resolves page-host mode against the current page hostname and backend port', () => {
    expect(
      resolveWebBackendOriginForPage(
        'page-host',
        'http://10.241.133.38:5173',
        'http:',
        '10.241.133.38',
        8000
      )
    ).toBe('http://10.241.133.38:8000')
  })
})

describe('resolvePageHostBackendOrigin', () => {
  it('uses the page hostname so LAN clients connect back to the same Mac address', () => {
    expect(resolvePageHostBackendOrigin('http:', '192.168.139.3', 8000)).toBe('http://192.168.139.3:8000')
  })

  it('returns null when the page hostname is unavailable', () => {
    expect(resolvePageHostBackendOrigin('http:', '', 8000)).toBeNull()
  })
})
