import { describe, expect, it } from 'vitest'
import type { FolderSeriesItem } from '../../types/viewer'
import { buildDicomCompatibilityToast } from './dicomCompatibilityToast'

function createSeries(overrides: Partial<FolderSeriesItem>): FolderSeriesItem {
  return {
    folderPath: 'folder',
    instanceCount: 1,
    seriesId: 'series-1',
    ...overrides
  }
}

describe('dicom compatibility toast', () => {
  it('returns null when no loaded series has compatibility issues', () => {
    expect(buildDicomCompatibilityToast([createSeries({})], 'en')).toBeNull()
  })

  it('summarizes affected series and issue counts in English', () => {
    const toast = buildDicomCompatibilityToast(
      [
        createSeries({
          seriesDescription: 'CT Head',
          compatibilityIssues: [
            {
              code: 'missing-pixel-spacing',
              severity: 'warning',
              title: 'Missing pixel spacing',
              affectedInstances: 2
            }
          ]
        })
      ],
      'en'
    )

    expect(toast?.tone).toBe('warning')
    expect(toast?.message).toBe('DICOM loaded with compatibility notices')
    expect(toast?.detail).toContain('1 series with 1 notice(s). CT Head: Missing pixel spacing')
  })

  it('uses Chinese titles and escalates errors', () => {
    const toast = buildDicomCompatibilityToast(
      [
        createSeries({
          modality: 'CT',
          compatibilityIssues: [
            {
              code: 'missing-image-size',
              severity: 'error',
              title: 'Missing image dimensions',
              affectedInstances: 1
            }
          ]
        })
      ],
      'zh-CN'
    )

    expect(toast?.tone).toBe('error')
    expect(toast?.message).toBe('DICOM 已加载，但存在兼容性提示')
    expect(toast?.detail).toContain('CT: 缺少图像尺寸')
  })
})
