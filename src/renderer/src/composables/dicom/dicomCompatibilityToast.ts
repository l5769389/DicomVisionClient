import type { FolderSeriesItem } from '../../types/viewer'

type SeriesCompatibilityIssue = NonNullable<FolderSeriesItem['compatibilityIssues']>[number]

export type DicomCompatibilityToastTone = 'warning' | 'error'

export interface DicomCompatibilityToast {
  detail: string
  message: string
  tone: DicomCompatibilityToastTone
}

const DICOM_COMPATIBILITY_TITLE_ZH: Record<string, string> = {
  'missing-image-size': '缺少图像尺寸',
  'mixed-image-size': '序列内图像尺寸不一致',
  'compressed-transfer-syntax': '压缩传输语法',
  'missing-transfer-syntax': '缺少传输语法',
  'unsupported-photometric': '非单色像素数据',
  'multiframe-first-frame': '多帧 DICOM',
  'missing-pixel-spacing': '缺少像素间距',
  'missing-spatial-geometry': '缺少空间几何信息',
  'missing-rescale': '缺少重采样元数据'
}

export function buildDicomCompatibilityToast(
  seriesItems: FolderSeriesItem[],
  locale: string
): DicomCompatibilityToast | null {
  const affectedSeries = seriesItems.filter((series) => (series.compatibilityIssues?.length ?? 0) > 0)
  if (!affectedSeries.length) {
    return null
  }

  const issues = affectedSeries.flatMap((series) => series.compatibilityIssues ?? [])
  const firstSeries = affectedSeries[0]
  const firstIssue = issues[0]
  const isZh = locale === 'zh-CN'
  const seriesLabel = firstSeries.seriesDescription || firstSeries.modality || firstSeries.seriesId
  const issueTitle = firstIssue ? resolveCompatibilityIssueTitle(firstIssue, isZh) : ''
  const message = isZh ? 'DICOM 已加载，但存在兼容性提示' : 'DICOM loaded with compatibility notices'
  const detail = isZh
    ? `${affectedSeries.length} 个 series 存在 ${issues.length} 项提示。${seriesLabel}: ${issueTitle}`
    : `${affectedSeries.length} series with ${issues.length} notice(s). ${seriesLabel}: ${issueTitle}`
  const tone = issues.some((issue) => issue.severity === 'error') ? 'error' : 'warning'
  return { detail, message, tone }
}

function resolveCompatibilityIssueTitle(issue: SeriesCompatibilityIssue, isZh: boolean): string {
  if (isZh) {
    return DICOM_COMPATIBILITY_TITLE_ZH[issue.code] ?? issue.title ?? issue.code
  }
  return issue.title || issue.code
}
