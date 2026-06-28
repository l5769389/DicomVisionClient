import type {
  QaWaterAnalysis,
  QaWaterMetrics,
  QaWaterMetricKey
} from '../../types/viewer'

export async function analyzeWaterPhantomView(
  viewId: string,
  viewportKey: string,
  metrics: QaWaterMetricKey[]
): Promise<QaWaterAnalysis> {
  const { postApi } = await import('../../services/typedApi')
  const data = await postApi('AnalyzeQaWaterApiV1ViewQaWaterAnalyzePost', {
    viewId,
    viewportKey,
    metrics
  })

  return {
    viewId: data.viewId,
    viewportKey: data.viewportKey,
    rois: data.rois ?? [],
    metrics: (data.metrics ?? {}) as QaWaterMetrics,
    status: data.status ?? 'ready',
    message: data.message ?? undefined
  }
}
