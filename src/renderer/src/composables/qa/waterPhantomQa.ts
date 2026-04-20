import { api } from '../../services/api'
import type {
  QaWaterAnalysis,
  QaWaterAnalyzeRequest,
  QaWaterAnalyzeResponse,
  QaWaterMetricKey
} from '../../types/viewer'

export async function analyzeWaterPhantomView(
  viewId: string,
  viewportKey: string,
  metrics: QaWaterMetricKey[]
): Promise<QaWaterAnalysis> {
  const requestPayload: QaWaterAnalyzeRequest = {
    viewId,
    viewportKey,
    metrics
  }
  const { data } = await api.post<QaWaterAnalyzeResponse>('/view/qa/water/analyze', requestPayload)

  return {
    viewId: data.viewId,
    viewportKey: data.viewportKey,
    rois: data.rois ?? [],
    metrics: data.metrics ?? {},
    status: data.status ?? 'ready',
    message: data.message ?? undefined
  }
}
