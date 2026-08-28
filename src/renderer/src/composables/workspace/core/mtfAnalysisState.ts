import type { MeasurementDraftPoint, ViewerTabItem } from '../../../types/viewer'

export function buildMtfAnalysisRequest(payload: {
  viewId: string
  viewportKey: string
  points: MeasurementDraftPoint[]
  sourceSliceIndex: number
}) {
  return {
    viewId: payload.viewId,
    viewportKey: payload.viewportKey,
    points: payload.points,
    sourceSliceIndex: payload.sourceSliceIndex
  }
}

export function applyMtfAnalysisResultToTabs(
  tabs: ViewerTabItem[],
  tabKey: string,
  mtfId: string,
  updater: (tab: ViewerTabItem) => ViewerTabItem
): ViewerTabItem[] {
  return tabs.map((tab) => {
    if (tab.key !== tabKey || !tab.mtfState?.items.some((item) => item.mtfId === mtfId)) {
      return tab
    }
    return updater(tab)
  })
}
