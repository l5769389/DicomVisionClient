import { describe, expect, it } from 'vitest'
import type { MprPlaneInfo, MprThresholdRegion, MprVoiSphere } from '../../types/viewer'
import {
  buildThresholdRegionBoxFromImageRect,
  canvasNormalizedPointToSourceImage,
  createVoiSphereFromImageCircle,
  estimateThresholdRegionDefaultDepthMm,
  normalizedImagePointToWorld,
  projectThresholdRegionBoxToPlane,
  projectThresholdRegionBoxToCanvasPlane,
  projectVoiSphereToPlane,
  sourceImagePointToCanvasNormalized,
  translateThresholdRegionBoxInPlane,
  worldPointToNormalizedImage
} from './mprVoiGeometry'

const axialPlane: MprPlaneInfo = {
  viewport: 'mpr-ax',
  centerWorld: [0, 0, 0],
  cursorCenterWorld: [0, 0, 0],
  rowWorld: [0, 1, 0],
  colWorld: [0, 0, 1],
  normalWorld: [1, 0, 0],
  pixelSpacingRowMm: 1,
  pixelSpacingColMm: 2,
  pixelSpacingNormalMm: 3,
  outputShape: [100, 50],
  row: [0, 1, 0],
  col: [0, 0, 1],
  normal: [1, 0, 0],
  isOblique: false
}

describe('mprVoiGeometry', () => {
  it('converts normalized image points to world points and back', () => {
    expect(normalizedImagePointToWorld(axialPlane, { x: 0.5, y: 0.5 })).toEqual([0, 0, 0])
    expect(normalizedImagePointToWorld(axialPlane, { x: 1, y: 1 })).toEqual([0, 50, 50])
    expect(worldPointToNormalizedImage(axialPlane, [0, 50, 50])).toEqual({ x: 1, y: 1 })
  })

  it('maps source-plane coordinates through the rendered canvas transform', () => {
    const frame = { width: 200, height: 100, naturalWidth: 200, naturalHeight: 100 }
    const transform = {
      rotationDegrees: 0,
      horFlip: false,
      verFlip: false,
      zoom: 1,
      offsetX: 20,
      offsetY: 0
    }

    const canvasPoint = sourceImagePointToCanvasNormalized(axialPlane, { x: 0.75, y: 0.5 }, frame, transform)
    expect(canvasPoint).toEqual({ x: 0.725, y: 0.5 })
    expect(canvasNormalizedPointToSourceImage(axialPlane, canvasPoint, frame, transform)).toEqual({ x: 0.75, y: 0.5 })
  })

  it('uses the backend image-to-canvas matrix when projecting MPR points', () => {
    const planeWithMatrix: MprPlaneInfo = {
      ...axialPlane,
      imageToCanvasMatrix: [
        [2, 0, 10],
        [0, 3, 20],
        [0, 0, 1]
      ]
    }
    const frame = { width: 200, height: 400, naturalWidth: 200, naturalHeight: 400 }

    const canvasPoint = sourceImagePointToCanvasNormalized(planeWithMatrix, { x: 0.25, y: 0.5 }, frame, {
      rotationDegrees: 0,
      horFlip: false,
      verFlip: false,
      zoom: 100,
      offsetX: 999,
      offsetY: 999
    })

    expect(canvasPoint).toEqual({ x: 0.175, y: 0.425 })
    expect(canvasNormalizedPointToSourceImage(planeWithMatrix, canvasPoint, frame)).toEqual({ x: 0.25, y: 0.5 })
  })

  it('builds and projects an oriented threshold box from an image rect', () => {
    const box = buildThresholdRegionBoxFromImageRect(
      axialPlane,
      'mpr-ax',
      {
        xMin: 0.25,
        xMax: 0.75,
        yMin: 0.25,
        yMax: 0.75
      },
      axialPlane.pixelSpacingNormalMm
    )

    expect(box).toEqual({
      centerWorld: [0, 0, 0],
      rowWorld: [0, 1, 0],
      colWorld: [0, 0, 1],
      normalWorld: [1, 0, 0],
      widthMm: 50,
      heightMm: 50,
      depthMm: 3,
      sourceViewport: 'mpr-ax'
    })

    const projection = projectThresholdRegionBoxToPlane(box, axialPlane)
    expect(projection.visible).toBe(true)
    expect(projection.intersectsPlane).toBe(true)
    expect(projection.clippedRect).toEqual({
      xMin: 0.25,
      xMax: 0.75,
      yMin: 0.25,
      yMax: 0.75
    })
  })

  it('projects threshold boxes into transformed canvas coordinates', () => {
    const box = buildThresholdRegionBoxFromImageRect(
      axialPlane,
      'mpr-ax',
      {
        xMin: 0.25,
        xMax: 0.75,
        yMin: 0.25,
        yMax: 0.75
      },
      3
    )
    const projection = projectThresholdRegionBoxToCanvasPlane(
      box,
      axialPlane,
      { width: 200, height: 100, naturalWidth: 200, naturalHeight: 100 },
      {
        rotationDegrees: 0,
        horFlip: false,
        verFlip: false,
        zoom: 1,
        offsetX: 20,
        offsetY: 0
      }
    )

    expect(projection.clippedRect).toEqual({
      xMin: 0.475,
      xMax: 0.725,
      yMin: 0.25,
      yMax: 0.75
    })
  })

  it('projects an axial threshold box into orthogonal planes using physical depth only on the normal axis', () => {
    const rect = {
      xMin: 0.25,
      xMax: 0.75,
      yMin: 0.25,
      yMax: 0.75
    }
    const box = buildThresholdRegionBoxFromImageRect(
      axialPlane,
      'mpr-ax',
      rect,
      estimateThresholdRegionDefaultDepthMm(axialPlane, rect)
    )
    const coronalPlane: MprPlaneInfo = {
      ...axialPlane,
      viewport: 'mpr-cor',
      rowWorld: [1, 0, 0],
      colWorld: [0, 0, 1],
      normalWorld: [0, 1, 0],
      row: [1, 0, 0],
      col: [0, 0, 1],
      normal: [0, 1, 0]
    }
    const sagittalPlane: MprPlaneInfo = {
      ...axialPlane,
      viewport: 'mpr-sag',
      rowWorld: [1, 0, 0],
      colWorld: [0, 1, 0],
      normalWorld: [0, 0, 1],
      row: [1, 0, 0],
      col: [0, 1, 0],
      normal: [0, 0, 1]
    }

    const coronalProjection = projectThresholdRegionBoxToPlane(box, coronalPlane)
    const sagittalProjection = projectThresholdRegionBoxToPlane(box, sagittalPlane)

    expect(coronalProjection.clippedRect).toEqual({
      xMin: 0.25,
      xMax: 0.75,
      yMin: 0.41,
      yMax: 0.59
    })
    expect(sagittalProjection.clippedRect).toEqual({
      xMin: 0.25,
      xMax: 0.75,
      yMin: 0.41,
      yMax: 0.59
    })
  })

  it('keeps resize handle identity when the rendered canvas is flipped', () => {
    const box = buildThresholdRegionBoxFromImageRect(
      axialPlane,
      'mpr-ax',
      {
        xMin: 0.25,
        xMax: 0.75,
        yMin: 0.25,
        yMax: 0.75
      },
      3
    )
    const projection = projectThresholdRegionBoxToCanvasPlane(
      box,
      axialPlane,
      { width: 200, height: 100, naturalWidth: 200, naturalHeight: 100 },
      {
        rotationDegrees: 0,
        horFlip: true,
        verFlip: false,
        zoom: 1,
        offsetX: 0,
        offsetY: 0
      }
    )

    expect(projection.clippedRect).toEqual({
      xMin: 0.375,
      xMax: 0.625,
      yMin: 0.25,
      yMax: 0.75
    })
    expect(projection.handles).toEqual([
      { handle: 'nw', point: { x: 0.625, y: 0.25 } },
      { handle: 'ne', point: { x: 0.375, y: 0.25 } },
      { handle: 'se', point: { x: 0.375, y: 0.75 } },
      { handle: 'sw', point: { x: 0.625, y: 0.75 } }
    ])
  })

  it('uses an adaptive default threshold box depth', () => {
    expect(estimateThresholdRegionDefaultDepthMm(axialPlane)).toBe(18)
    expect(estimateThresholdRegionDefaultDepthMm(axialPlane, {
      xMin: 0.25,
      xMax: 0.75,
      yMin: 0.25,
      yMax: 0.75
    })).toBe(18)
    expect(estimateThresholdRegionDefaultDepthMm(axialPlane, {
      xMin: 0.49,
      xMax: 0.51,
      yMin: 0.49,
      yMax: 0.51
    })).toBe(3)
  })

  it('translates a threshold box in the active plane', () => {
    const box = buildThresholdRegionBoxFromImageRect(
      axialPlane,
      'mpr-ax',
      {
        xMin: 0.25,
        xMax: 0.75,
        yMin: 0.25,
        yMax: 0.75
      },
      3
    )

    expect(translateThresholdRegionBoxInPlane(box, axialPlane, { x: 0.1, y: -0.2 }).centerWorld).toEqual([0, -20, 10])
  })

  it('projects a sphere VOI as an intersecting or dashed plane ellipse', () => {
    const sphere: MprVoiSphere = {
      id: 'v1',
      label: '1',
      enabled: true,
      centerWorld: [3, 10, 0],
      radiusMm: 5,
      color: '#22d3ee'
    }

    const projection = projectVoiSphereToPlane(sphere, axialPlane)
    expect(projection.intersectsPlane).toBe(true)
    expect(projection.center).toEqual({ x: 0.5, y: 0.6 })
    expect(projection.radiusX).toBeCloseTo(0.04)
    expect(projection.radiusY).toBeCloseTo(0.04)

    const outsideProjection = projectVoiSphereToPlane({ ...sphere, centerWorld: [6, 10, 0] }, axialPlane)
    expect(outsideProjection.intersectsPlane).toBe(false)
    expect(outsideProjection.radiusX).toBeCloseTo(0.05)
  })

  it('creates a sphere VOI from an image circle', () => {
    expect(createVoiSphereFromImageCircle(axialPlane, { x: 0.5, y: 0.5 }, { x: 0.6, y: 0.5 }, '#22d3ee')).toEqual({
      id: '',
      label: '',
      enabled: true,
      centerWorld: [0, 0, 0],
      radiusMm: 10,
      color: '#22d3ee'
    })
  })

  it('hides projected threshold boxes when the current plane does not intersect them', () => {
    const region: MprThresholdRegion = {
      id: 'r1',
      enabled: true,
      label: '1',
      thresholdHu: 300,
      thresholdMode: 'hu',
      thresholdPercentile: 80,
      color: '#ff4df8',
      box: {
        centerWorld: [10, 0, 0],
        rowWorld: [0, 1, 0],
        colWorld: [0, 0, 1],
        normalWorld: [1, 0, 0],
        widthMm: 20,
        heightMm: 20,
        depthMm: 2,
        sourceViewport: 'mpr-ax'
      },
      stats: null
    }

    const projection = projectThresholdRegionBoxToPlane(region.box, axialPlane)
    expect(projection.visible).toBe(false)
    expect(projection.intersectsPlane).toBe(false)
  })
})
