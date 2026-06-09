import { describe, expect, it } from 'vitest'
import {
  mobileViewerCapabilityProfile,
  supportsViewerDataSource,
  supportsViewerViewType
} from './viewerCapabilityProfile'

describe('viewerCapabilityProfile', () => {
  it('limits the mobile shell to demo source and mobile-ready views', () => {
    expect(supportsViewerDataSource(mobileViewerCapabilityProfile, 'server-sample')).toBe(true)
    expect(supportsViewerDataSource(mobileViewerCapabilityProfile, 'web-upload')).toBe(false)
    expect(supportsViewerDataSource(mobileViewerCapabilityProfile, 'pacs')).toBe(false)

    expect(supportsViewerViewType(mobileViewerCapabilityProfile, 'Stack')).toBe(true)
    expect(supportsViewerViewType(mobileViewerCapabilityProfile, 'MPR')).toBe(true)
    expect(supportsViewerViewType(mobileViewerCapabilityProfile, 'Tag')).toBe(true)
    expect(supportsViewerViewType(mobileViewerCapabilityProfile, '3D')).toBe(false)
  })
})
