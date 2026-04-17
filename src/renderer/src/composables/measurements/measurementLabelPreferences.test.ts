import { describe, expect, it } from 'vitest'
import { filterMeasurementDraftByPreferences, filterMeasurementLabelLines, filterMeasurementOverlayByPreferences } from './measurementLabelPreferences'

describe('measurementLabelPreferences', () => {
  const roiStatOptions = [
    { key: 'mean', label: 'Mean', enabled: true },
    { key: 'max', label: 'Max', enabled: false },
    { key: 'min', label: 'Min', enabled: false },
    { key: 'area', label: 'Area', enabled: true },
    { key: 'stddev', label: 'StdDev', enabled: false },
    { key: 'width', label: 'Width', enabled: true },
    { key: 'height', label: 'Height', enabled: false }
  ]

  it('filters rectangle roi stats by enabled options and expands Size into width and height fields', () => {
    expect(
      filterMeasurementLabelLines(
        'rect',
        ['Size 120.0 * 80.0 mm', 'Area 2400.0 mm2', 'Mean 42.0', 'StdDev 3.5'],
        roiStatOptions
      )
    ).toEqual(['Width 120.0 mm', 'Area 2400.0 mm2', 'Mean 42.0'])
  })

  it('leaves non-roi measurement labels unchanged', () => {
    expect(filterMeasurementLabelLines('line', ['12.4 mm'], roiStatOptions)).toEqual(['12.4 mm'])
  })

  it('filters overlays and drafts without mutating points or ids', () => {
    expect(
      filterMeasurementOverlayByPreferences(
        {
          measurementId: 'roi-1',
          toolType: 'ellipse',
          points: [
            { x: 0.1, y: 0.2 },
            { x: 0.5, y: 0.7 }
          ],
          labelLines: ['Size 60.0 * 45.0 mm', 'Max 99.0', 'Area 1200.0 mm2']
        },
        roiStatOptions
      )
    ).toEqual({
      measurementId: 'roi-1',
      toolType: 'ellipse',
      points: [
        { x: 0.1, y: 0.2 },
        { x: 0.5, y: 0.7 }
      ],
      labelLines: ['Width 60.0 mm', 'Area 1200.0 mm2']
    })

    expect(
      filterMeasurementDraftByPreferences(
        {
          measurementId: 'roi-draft',
          toolType: 'rect',
          points: [
            { x: 0.2, y: 0.2 },
            { x: 0.4, y: 0.6 }
          ],
          labelLines: ['Size 22.0 * 18.0 mm', 'Mean 55.0', 'Min 10.0']
        },
        roiStatOptions
      )
    ).toEqual({
      measurementId: 'roi-draft',
      toolType: 'rect',
      points: [
        { x: 0.2, y: 0.2 },
        { x: 0.4, y: 0.6 }
      ],
      labelLines: ['Width 22.0 mm', 'Mean 55.0']
    })
  })
})
