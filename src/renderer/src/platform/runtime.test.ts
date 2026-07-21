import { describe, expect, it } from 'vitest'
import { isDicomUploadCandidate, resolvePageHostBackendOrigin, resolveWebBackendOriginForPage, toUploadItems } from './runtime'

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

  it('keeps the WebRTC worktree backend port when resolving a LAN page address', () => {
    expect(
      resolveWebBackendOriginForPage(
        'page-host',
        'http://192.168.139.3:5174',
        'http:',
        '192.168.139.3',
        8100
      )
    ).toBe('http://192.168.139.3:8100')
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

describe('DICOM upload candidates', () => {
  it('keeps normal, extensionless, and supported archive candidates while skipping unsupported byproducts', () => {
    const dicom = new File(['dicom'], 'slice.dcm')
    const extensionlessDicom = new File(['dicom'], 'IM0001')
    const zipArchive = new File(['zip'], 'study.zip')
    const sevenZipArchive = new File(['7z'], 'study.7z')
    const rarArchive = new File(['rar'], 'study.rar')
    const metadata = new File(['notes'], 'README.txt')

    expect(isDicomUploadCandidate(dicom)).toBe(true)
    expect(isDicomUploadCandidate(extensionlessDicom)).toBe(true)
    expect(isDicomUploadCandidate(zipArchive)).toBe(true)
    expect(isDicomUploadCandidate(sevenZipArchive)).toBe(true)
    expect(isDicomUploadCandidate(rarArchive)).toBe(true)
    expect(isDicomUploadCandidate(metadata)).toBe(false)
    expect(isDicomUploadCandidate(dicom, '__MACOSX/._slice.dcm')).toBe(false)
    expect(toUploadItems([dicom, extensionlessDicom, zipArchive, sevenZipArchive, rarArchive, metadata])).toHaveLength(5)
  })
})
