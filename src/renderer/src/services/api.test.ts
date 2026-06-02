import { afterEach, describe, expect, it } from 'vitest'
import { DESKTOP_DEV_BACKEND_ORIGIN } from '@shared/appConfig'
import { api, getApiBaseURL, getBackendOrigin, resolveBackendAssetUrl, setApiBaseURL } from './api'
import { resetWorkspaceIdentityForTest, WORKSPACE_HEADER } from './workspaceIdentity'

afterEach(() => {
  setApiBaseURL(`${DESKTOP_DEV_BACKEND_ORIGIN}/api/v1`)
  resetWorkspaceIdentityForTest()
})

describe('api service URL helpers', () => {
  it('normalizes API base URLs before resolving the backend origin', () => {
    setApiBaseURL('  http://backend.example.test/api/v1///  ')

    expect(getApiBaseURL()).toBe('http://backend.example.test/api/v1')
    expect(getBackendOrigin()).toBe('http://backend.example.test')
  })

  it('resolves backend-relative asset URLs against the backend origin', () => {
    setApiBaseURL('http://backend.example.test/api/v1/')

    expect(resolveBackendAssetUrl('/api/v1/dicom/thumbnail?seriesId=s1')).toBe(
      'http://backend.example.test/api/v1/dicom/thumbnail?seriesId=s1'
    )
    expect(resolveBackendAssetUrl('api/v1/dicom/fourD/preview')).toBe(
      'http://backend.example.test/api/v1/dicom/fourD/preview'
    )
    expect(resolveBackendAssetUrl('local-preview.png')).toBe('local-preview.png')
  })

  it('leaves already absolute asset URLs untouched', () => {
    expect(resolveBackendAssetUrl('https://cdn.example.test/image.png')).toBe('https://cdn.example.test/image.png')
    expect(resolveBackendAssetUrl('//cdn.example.test/image.png')).toBe('//cdn.example.test/image.png')
    expect(resolveBackendAssetUrl('data:image/png;base64,abc')).toBe('data:image/png;base64,abc')
    expect(resolveBackendAssetUrl('blob:https://app.example.test/123')).toBe('blob:https://app.example.test/123')
  })

  it('attaches the anonymous workspace id to API requests', async () => {
    resetWorkspaceIdentityForTest('workspace-test')

    const response = await api.request({
      url: '/ping',
      adapter: async (config) => ({
        config,
        data: config.headers,
        headers: {},
        status: 200,
        statusText: 'OK'
      })
    })

    expect(response.data?.[WORKSPACE_HEADER] ?? response.data?.get?.(WORKSPACE_HEADER)).toBe('workspace-test')
  })
})
