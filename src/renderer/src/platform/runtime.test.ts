import { describe, expect, it } from 'vitest'
import { resolveWebBackendOriginForPage } from './runtime'

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
})
