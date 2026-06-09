import { describe, expect, it } from 'vitest'
import {
  SAMPLE_VIEWPORT_CORNER_INFO,
  applyViewportCornerInfoPreference,
  createDefaultViewportCornerInfoPreference,
  filterViewportCornerInfoCatalog,
  normalizeViewportCornerInfoPreference
} from './viewportCornerInfo'

describe('viewportCornerInfo', () => {
  it('keeps the current system corner layout by default', () => {
    expect(applyViewportCornerInfoPreference(SAMPLE_VIEWPORT_CORNER_INFO, createDefaultViewportCornerInfoPreference())).toEqual(
      {
        topLeft: ['SIEMENS / SOMATOM', 'CT01', 'Chest CT', 'Se: 3', 'AXIAL  I 42.5mm', 'Im: 36/128'],
        topRight: SAMPLE_VIEWPORT_CORNER_INFO.topRight,
        bottomLeft: SAMPLE_VIEWPORT_CORNER_INFO.bottomLeft,
        bottomRight: SAMPLE_VIEWPORT_CORNER_INFO.bottomRight
      }
    )
  })

  it('normalizes unknown, duplicate, and over-limit items', () => {
    expect(
      normalizeViewportCornerInfoPreference({
        topLeft: [
          'manufacturerModel',
          'stationName',
          'not-a-key',
          'institutionName',
          'examDescription',
          'seriesNumber',
          'viewportLocation',
          'imageIndex'
        ],
        topRight: ['manufacturerModel', 'patientName', 'patientSummary'],
        bottomLeft: ['windowLevel', 'windowLevel'],
        bottomRight: ['zoom', 'coordinates']
      })
    ).toEqual({
      topLeft: ['manufacturerModel', 'stationName', 'institutionName', 'examDescription', 'seriesNumber', 'viewportLocation'],
      topRight: ['patientName', 'patientSummary'],
      bottomLeft: ['windowLevel'],
      bottomRight: ['zoom', 'coordinates']
    })
  })

  it('applies deletion and reordering across corners', () => {
    const preference = normalizeViewportCornerInfoPreference({
      topLeft: ['patientName', 'windowLevel'],
      topRight: ['seriesNumber'],
      bottomLeft: [],
      bottomRight: ['zoom']
    })

    expect(applyViewportCornerInfoPreference(SAMPLE_VIEWPORT_CORNER_INFO, preference)).toEqual({
      topLeft: ['ZHANG SAN', 'W: 400 L: 40'],
      topRight: ['Se: 3'],
      bottomLeft: [],
      bottomRight: ['Zoom:1.25x']
    })
  })

  it('searches common items by labels and DICOM keywords', () => {
    expect(filterViewportCornerInfoCatalog('患者', 'zh-CN').map((item) => item.key)).toContain('patientName')
    expect(filterViewportCornerInfoCatalog('WindowWidth', 'en-US').map((item) => item.key)).toEqual(['windowLevel'])
    expect(filterViewportCornerInfoCatalog('Image number', 'en-US').map((item) => item.key)).toEqual(['imageIndex'])
    expect(filterViewportCornerInfoCatalog('AccessionNumber', 'en-US').map((item) => item.key)).toEqual(['accessionNumber'])
    expect(filterViewportCornerInfoCatalog('CTDIvol', 'en-US').map((item) => item.key)).toEqual(['ctdiVol'])
    expect(filterViewportCornerInfoCatalog('zoom', 'en-US').map((item) => item.key)).toEqual(['zoom'])
  })

  it('uses structured backend tag lines for extended items', () => {
    const preference = normalizeViewportCornerInfoPreference({
      topLeft: ['accessionNumber', 'protocolName', 'pixelSpacing'],
      topRight: ['studyInstanceUid'],
      bottomLeft: ['ctdiVol', 'exposure'],
      bottomRight: ['imagePositionPatient']
    })

    expect(applyViewportCornerInfoPreference(SAMPLE_VIEWPORT_CORNER_INFO, preference)).toEqual({
      topLeft: ['Acc: A20260605001', 'Protocol: Chest Routine', 'Pixel: 0.742 x 0.742mm'],
      topRight: ['Study UID: 1.2.840.113619.2.55.3'],
      bottomLeft: ['CTDIvol: 12.4mGy', 'Exposure: 210mAs'],
      bottomRight: ['IPP: -180.0, -180.0, 42.5']
    })
  })
})
