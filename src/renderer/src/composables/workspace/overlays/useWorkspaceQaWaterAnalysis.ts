import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import type { QaWaterAnalysis, QaWaterMetricKey, ViewerTabItem } from '../../../types/viewer'
import type { QaWaterMetricPreference } from '../../ui/useUiPreferences'

let waterPhantomQaModulePromise: Promise<typeof import('../../qa/waterPhantomQa')> | null = null

function loadWaterPhantomQa(): Promise<typeof import('../../qa/waterPhantomQa')> {
  waterPhantomQaModulePromise ??= import('../../qa/waterPhantomQa')
  return waterPhantomQaModulePromise
}

export function isWaterPhantomQaOperation(value: string): boolean {
  const normalized = value.startsWith('stack:') ? value.slice('stack:'.length) : value
  return normalized === 'qa:water-phantom' || normalized === 'qa:water-accuracy' || normalized === 'qa:water-uniformity'
}

export interface WorkspaceQaWaterAnalysisOptions {
  activeOperation: ComputedRef<string> | Ref<string>
  activeTab: ComputedRef<ViewerTabItem | null> | Ref<ViewerTabItem | null>
  qaWaterMetrics: ComputedRef<QaWaterMetricPreference[]>
}

export function useWorkspaceQaWaterAnalysis(options: WorkspaceQaWaterAnalysisOptions) {
  const qaWaterAnalysis = ref<QaWaterAnalysis | null>(null)
  const qaWaterAnalysisCache = ref<Record<string, QaWaterAnalysis>>({})
  let qaWaterAnalysisRequestId = 0

  function getEnabledQaWaterMetricKeys(): QaWaterMetricKey[] {
    return options.qaWaterMetrics.value
      .filter((metric) => metric.enabled)
      .map((metric) => metric.key)
  }

  const qaWaterAnalysisKey = computed(() => {
    const tab = options.activeTab.value
    if (!isWaterPhantomQaOperation(options.activeOperation.value) || tab?.viewType !== 'Stack' || !tab.viewId || !tab.imageSrc) {
      return ''
    }

    return [
      options.activeOperation.value,
      tab.key,
      tab.viewId,
      tab.imageSrc,
      options.qaWaterMetrics.value.map((metric) => `${metric.key}:${metric.enabled ? '1' : '0'}`).join(',')
    ].join('|')
  })

  function rememberQaWaterAnalysis(key: string, analysis: QaWaterAnalysis): void {
    qaWaterAnalysisCache.value = {
      ...qaWaterAnalysisCache.value,
      [key]: analysis
    }
  }

  async function refreshQaWaterAnalysis(key = qaWaterAnalysisKey.value): Promise<void> {
    const requestId = qaWaterAnalysisRequestId + 1
    qaWaterAnalysisRequestId = requestId
    const tab = options.activeTab.value
    if (!key || !isWaterPhantomQaOperation(options.activeOperation.value) || tab?.viewType !== 'Stack' || !tab.viewId || !tab.imageSrc) {
      qaWaterAnalysis.value = null
      return
    }

    qaWaterAnalysis.value = {
      viewId: tab.viewId,
      viewportKey: 'single',
      rois: [],
      status: 'loading'
    }

    try {
      const { analyzeWaterPhantomView } = await loadWaterPhantomQa()
      const analysis = await analyzeWaterPhantomView(tab.viewId, 'single', getEnabledQaWaterMetricKeys())
      rememberQaWaterAnalysis(key, analysis)
      if (requestId === qaWaterAnalysisRequestId && key === qaWaterAnalysisKey.value) {
        qaWaterAnalysis.value = analysis
      }
    } catch (error) {
      console.error('Failed to analyze water phantom QA.', error)
      const analysis: QaWaterAnalysis = {
        viewId: tab.viewId,
        viewportKey: 'single',
        rois: [],
        status: 'error',
        message: 'Water phantom QA analysis failed.'
      }
      rememberQaWaterAnalysis(key, analysis)
      if (requestId === qaWaterAnalysisRequestId && key === qaWaterAnalysisKey.value) {
        qaWaterAnalysis.value = analysis
      }
    }
  }

  watch(
    () => qaWaterAnalysisKey.value,
    (value) => {
      if (!value) {
        qaWaterAnalysisRequestId += 1
        qaWaterAnalysis.value = null
        return
      }
      const cachedAnalysis = qaWaterAnalysisCache.value[value]
      if (cachedAnalysis) {
        qaWaterAnalysisRequestId += 1
        qaWaterAnalysis.value = cachedAnalysis
        return
      }
      void refreshQaWaterAnalysis(value)
    },
    { immediate: true }
  )

  return {
    qaWaterAnalysis,
    qaWaterAnalysisKey,
    refreshQaWaterAnalysis
  }
}
