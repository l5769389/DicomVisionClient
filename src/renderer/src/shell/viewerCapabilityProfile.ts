import type { ShellKind } from './shellSelection'
import type { ViewType } from '../types/viewer'

export type ViewerDataSourceKind = 'desktop-picker' | 'web-upload' | 'server-sample' | 'pacs'

export interface ViewerCapabilityProfile {
  dataSources: ViewerDataSourceKind[]
  shellKind: ShellKind
  viewTypes: ViewType[]
}

export const desktopViewerCapabilityProfile: ViewerCapabilityProfile = {
  shellKind: 'desktop',
  dataSources: ['desktop-picker', 'web-upload', 'server-sample', 'pacs'],
  viewTypes: ['Stack', 'PET', 'CompareStack', 'MPR', '3D', '4D', 'Tag', 'Layout']
}

export const mobileViewerCapabilityProfile: ViewerCapabilityProfile = {
  shellKind: 'mobile',
  dataSources: ['desktop-picker', 'web-upload', 'server-sample', 'pacs'],
  viewTypes: ['Stack', 'CompareStack', 'MPR', '3D', '4D', 'Tag']
}

export function supportsViewerDataSource(profile: ViewerCapabilityProfile, dataSource: ViewerDataSourceKind): boolean {
  return profile.dataSources.includes(dataSource)
}

export function supportsViewerViewType(profile: ViewerCapabilityProfile, viewType: ViewType): boolean {
  return profile.viewTypes.includes(viewType)
}
