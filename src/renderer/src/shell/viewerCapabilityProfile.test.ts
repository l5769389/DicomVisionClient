import { describe, expect, it } from 'vitest'
import {
  mobileViewerCapabilityProfile,
  supportsViewerDataSource,
  supportsViewerViewType
} from './viewerCapabilityProfile'

describe('viewerCapabilityProfile', () => {
  it('allows mobile-ready sources and views', () => {
    expect(supportsViewerDataSource(mobileViewerCapabilityProfile, 'server-sample')).toBe(true)
    expect(supportsViewerDataSource(mobileViewerCapabilityProfile, 'web-upload')).toBe(true)
    expect(supportsViewerDataSource(mobileViewerCapabilityProfile, 'desktop-picker')).toBe(true)
    expect(supportsViewerDataSource(mobileViewerCapabilityProfile, 'pacs')).toBe(true)

    expect(supportsViewerViewType(mobileViewerCapabilityProfile, 'Stack')).toBe(true)
    expect(supportsViewerViewType(mobileViewerCapabilityProfile, 'CompareStack')).toBe(true)
    expect(supportsViewerViewType(mobileViewerCapabilityProfile, 'MPR')).toBe(true)
    expect(supportsViewerViewType(mobileViewerCapabilityProfile, '3D')).toBe(true)
    expect(supportsViewerViewType(mobileViewerCapabilityProfile, '4D')).toBe(true)
    expect(supportsViewerViewType(mobileViewerCapabilityProfile, 'Tag')).toBe(true)
  })
})
