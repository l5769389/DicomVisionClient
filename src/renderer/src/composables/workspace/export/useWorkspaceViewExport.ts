import { nextTick, type ComputedRef, type Ref } from 'vue'
import type {
  AnnotationOverlay,
  CornerInfo,
  CornerPosition,
  MeasurementDraftPoint,
  MeasurementOverlay,
  ViewerTabItem
} from '../../../types/viewer'
import { getSmoothCurveSegments } from '../../measurements/measurementGeometry'
import { applyViewportCornerInfoPreference } from '../../ui/viewportCornerInfo'
import type { WorkspaceExportCopy } from '../../ui/uiMessages'
import { useUiPreferences } from '../../ui/useUiPreferences'
import {
  buildExportFileStem,
  exportCurrentView,
  type ViewerExportFormat,
  type ViewerExportOverlays
} from './viewExport'
import { useWorkspaceExportUi } from './useWorkspaceExportUi'
import { isMprLikeViewType } from '../views/viewerViewportTargets'

const EXPORT_LABEL_LINE_HEIGHT_PX = 18

function isCompareStackViewType(viewType: ViewerTabItem['viewType'] | null | undefined): boolean {
  return viewType === 'CompareStack'
}

function isLayoutViewType(viewType: ViewerTabItem['viewType'] | null | undefined): boolean {
  return viewType === 'Layout'
}

function isPetCtFusionViewType(viewType: ViewerTabItem['viewType'] | null | undefined): boolean {
  return viewType === 'PETCTFusion'
}

function canvasPoint(point: MeasurementDraftPoint, width: number, height: number): { x: number; y: number } {
  return {
    x: point.x * width,
    y: point.y * height
  }
}

function drawLabel(context: CanvasRenderingContext2D, lines: string[], x: number, y: number, maxWidth: number): void {
  const visibleLines = lines.map((line) => line.trim()).filter(Boolean)
  if (!visibleLines.length) {
    return
  }

  context.font = '13px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
  const width = Math.min(
    Math.max(...visibleLines.map((line) => context.measureText(line).width)) + 14,
    Math.max(120, maxWidth - 16)
  )
  const height = visibleLines.length * EXPORT_LABEL_LINE_HEIGHT_PX + 8
  const left = Math.max(8, Math.min(maxWidth - width - 8, x))
  const top = Math.max(8, y)

  context.save()
  context.fillStyle = 'rgba(7,16,28,0.92)'
  context.strokeStyle = 'rgba(125,211,252,0.55)'
  context.lineWidth = 1
  context.beginPath()
  context.roundRect(left, top, width, height, 8)
  context.fill()
  context.stroke()
  context.fillStyle = '#f8fafc'
  visibleLines.forEach((line, index) => {
    context.fillText(line, left + 7, top + EXPORT_LABEL_LINE_HEIGHT_PX + index * EXPORT_LABEL_LINE_HEIGHT_PX)
  })
  context.restore()
}

function drawSmoothMeasurementPath(context: CanvasRenderingContext2D, points: MeasurementDraftPoint[], closePath = false): void {
  if (points.length < 2) {
    return
  }

  context.beginPath()
  context.moveTo(points[0].x, points[0].y)
  getSmoothCurveSegments(points, closePath).forEach((segment) => {
    context.bezierCurveTo(
      segment.controlPoint1.x,
      segment.controlPoint1.y,
      segment.controlPoint2.x,
      segment.controlPoint2.y,
      segment.end.x,
      segment.end.y
    )
  })
  if (closePath) {
    context.closePath()
  }
  context.stroke()
}

function drawMeasurements(context: CanvasRenderingContext2D, measurements: MeasurementOverlay[], width: number, height: number): void {
  measurements.forEach((measurement) => {
    const points = measurement.points.map((point) => canvasPoint(point, width, height))
    if (!points.length) {
      return
    }

    context.save()
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.strokeStyle = 'rgba(3,15,24,0.92)'
    context.lineWidth = 5

    const drawShape = (): void => {
      if (measurement.toolType === 'line' && points.length >= 2) {
        context.beginPath()
        context.moveTo(points[0].x, points[0].y)
        context.lineTo(points[1].x, points[1].y)
        context.stroke()
      } else if ((measurement.toolType === 'rect' || measurement.toolType === 'ellipse') && points.length >= 2) {
        const left = Math.min(points[0].x, points[1].x)
        const top = Math.min(points[0].y, points[1].y)
        const rectWidth = Math.abs(points[1].x - points[0].x)
        const rectHeight = Math.abs(points[1].y - points[0].y)
        context.beginPath()
        if (measurement.toolType === 'ellipse') {
          context.ellipse(left + rectWidth / 2, top + rectHeight / 2, rectWidth / 2, rectHeight / 2, 0, 0, Math.PI * 2)
        } else {
          context.rect(left, top, rectWidth, rectHeight)
        }
        context.stroke()
      } else if (measurement.toolType === 'angle' && points.length >= 2) {
        context.beginPath()
        context.moveTo(points[0].x, points[0].y)
        context.lineTo(points[1].x, points[1].y)
        if (points[2]) {
          context.lineTo(points[2].x, points[2].y)
        }
        context.stroke()
      } else if (measurement.toolType === 'curve' && points.length >= 2) {
        drawSmoothMeasurementPath(context, points)
      } else if (measurement.toolType === 'freeform' && points.length >= 3) {
        drawSmoothMeasurementPath(context, points, true)
      }
    }

    drawShape()
    context.strokeStyle = 'rgba(85,231,255,0.98)'
    context.lineWidth = 2.5
    drawShape()

    const anchor = measurement.toolType === 'curve'
      ? points[points.length - 1] ?? points[0]
      : points[1] ?? points[0]
    drawLabel(context, measurement.labelLines ?? [], anchor.x + 12, anchor.y - 32, width)
    context.restore()
  })
}

function drawArrowHead(context: CanvasRenderingContext2D, start: { x: number; y: number }, end: { x: number; y: number }, size: number): void {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.hypot(dx, dy)
  if (length < 1e-6) {
    return
  }

  const ux = dx / length
  const uy = dy / length
  const backX = end.x - ux * size * 2.8
  const backY = end.y - uy * size * 2.8
  const perpX = -uy * size
  const perpY = ux * size
  context.beginPath()
  context.moveTo(end.x, end.y)
  context.lineTo(backX + perpX, backY + perpY)
  context.lineTo(backX - perpX, backY - perpY)
  context.closePath()
  context.fill()
}

function drawAnnotations(context: CanvasRenderingContext2D, annotations: AnnotationOverlay[], width: number, height: number): void {
  annotations.forEach((annotation) => {
    const points = annotation.points.map((point) => canvasPoint(point, width, height))
    if (points.length < 2) {
      return
    }

    const lineWidth = annotation.size === 'lg' ? 3 : annotation.size === 'sm' ? 2 : 2.5
    const fontSize = annotation.size === 'lg' ? 16 : annotation.size === 'sm' ? 12 : 14
    context.save()
    context.strokeStyle = annotation.color
    context.fillStyle = annotation.color
    context.lineCap = 'round'
    context.lineWidth = lineWidth
    context.beginPath()
    context.moveTo(points[0].x, points[0].y)
    context.lineTo(points[1].x, points[1].y)
    context.stroke()
    drawArrowHead(context, points[0], points[1], lineWidth * 2.8)

    const text = annotation.text.trim()
    if (text) {
      context.font = `${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
      const labelWidth = Math.min(Math.max(context.measureText(text).width + 14, 48), Math.max(48, width - 16))
      const left = Math.max(8, Math.min(width - labelWidth - 8, points[0].x + 12))
      const top = Math.max(8, Math.min(height - fontSize - 18, points[0].y - fontSize - 12))
      context.fillStyle = 'rgba(7,14,24,0.92)'
      context.strokeStyle = 'rgba(255,255,255,0.18)'
      context.lineWidth = 1
      context.beginPath()
      context.roundRect(left, top, labelWidth, fontSize + 12, 8)
      context.fill()
      context.stroke()
      context.fillStyle = annotation.color
      context.fillText(text, left + 7, top + fontSize + 2)
    }
    context.restore()
  })
}

function drawCornerInfo(context: CanvasRenderingContext2D, cornerInfo: CornerInfo, width: number, height: number): void {
  const { viewportCornerInfoPreference } = useUiPreferences()
  const displayCornerInfo = applyViewportCornerInfoPreference(cornerInfo, viewportCornerInfoPreference.value)
  const blocks: Array<{
    key: CornerPosition
    x: number
    y: number
    align: CanvasTextAlign
    baseline: CanvasTextBaseline
  }> = [
    { key: 'topLeft', x: 18, y: 18, align: 'left', baseline: 'top' },
    { key: 'topRight', x: width - 18, y: 18, align: 'right', baseline: 'top' },
    { key: 'bottomLeft', x: 18, y: height - 18, align: 'left', baseline: 'bottom' },
    { key: 'bottomRight', x: width - 18, y: height - 18, align: 'right', baseline: 'bottom' }
  ]

  context.save()
  context.font = '13px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
  context.fillStyle = '#eaf3fb'
  context.strokeStyle = 'rgba(3, 15, 24, 0.92)'
  context.lineJoin = 'round'
  context.lineWidth = 3

  blocks.forEach(({ key, x, y, align, baseline }) => {
    const lines = displayCornerInfo[key].map((line) => line.trim()).filter(Boolean)
    if (!lines.length) {
      return
    }

    context.textAlign = align
    context.textBaseline = baseline
    lines.forEach((line, index) => {
      const lineY =
        baseline === 'top'
          ? y + index * 16
          : y - (lines.length - 1 - index) * 16
      context.strokeText(line, x, lineY)
      context.fillText(line, x, lineY)
    })
  })

  context.restore()
}

export function hasExportCornerInfo(cornerInfo: CornerInfo | null | undefined): boolean {
  if (!cornerInfo) {
    return false
  }

  const { viewportCornerInfoPreference } = useUiPreferences()
  const displayCornerInfo = applyViewportCornerInfoPreference(cornerInfo, viewportCornerInfoPreference.value)
  return [displayCornerInfo.topLeft, displayCornerInfo.topRight, displayCornerInfo.bottomLeft, displayCornerInfo.bottomRight].some((lines) =>
    lines.some((line) => line.trim())
  )
}

export interface WorkspaceViewExportOptions {
  activeTab: ComputedRef<ViewerTabItem | null> | Ref<ViewerTabItem | null>
  activeViewportKey: ComputedRef<string> | Ref<string>
  exportNameInputRef: Ref<HTMLInputElement | null>
  getAnnotations: (viewportKey: string) => AnnotationOverlay[]
  getCornerInfoForExport: (tab: ViewerTabItem, viewportKey: string) => CornerInfo
  getExportMeasurements: (viewportKey: string) => MeasurementOverlay[]
  viewportHostRef: Ref<HTMLElement | null>
  workspaceExportCopy: ComputedRef<WorkspaceExportCopy>
}

export function useWorkspaceViewExport(options: WorkspaceViewExportOptions) {
  const { exportPreference } = useUiPreferences()
  const exportUi = useWorkspaceExportUi(options.workspaceExportCopy, options.exportNameInputRef)

  function resolveActiveExportImageElement(viewportKey: string): HTMLImageElement | null {
    const host = options.viewportHostRef.value
    if (!host) {
      return null
    }

    const surface = host.querySelector<HTMLElement>(`[data-active-render-surface="true"][data-viewport-key="${viewportKey}"]`)
    const image = surface?.querySelector<HTMLImageElement>('.viewer-image') ?? null
    return image instanceof HTMLImageElement ? image : null
  }

  async function buildAnnotatedPngData(viewportKey: string, overlays: ViewerExportOverlays): Promise<Uint8Array | null> {
    await nextTick()
    const image = resolveActiveExportImageElement(viewportKey)
    if (!image?.src || !image.naturalWidth || !image.naturalHeight) {
      return null
    }

    if (!image.complete && typeof image.decode === 'function') {
      await image.decode()
    }

    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d')
    if (!context) {
      return null
    }

    try {
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      if (overlays.cornerInfo) {
        drawCornerInfo(context, overlays.cornerInfo, canvas.width, canvas.height)
      }
      drawMeasurements(context, overlays.measurements, canvas.width, canvas.height)
      drawAnnotations(context, overlays.annotations, canvas.width, canvas.height)

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
      if (!blob) {
        return null
      }

      return new Uint8Array(await blob.arrayBuffer())
    } catch (error) {
      console.error('Failed to compose annotated PNG locally.', error)
      return null
    }
  }

  async function handleExportCurrentView(format: ViewerExportFormat, viewportKeyOverride?: string): Promise<void> {
    try {
      const activeTab = options.activeTab.value
      if (!activeTab) {
        exportUi.showExportNotice(null, format)
        return
      }

      const shouldUseActiveViewport =
        isMprLikeViewType(activeTab.viewType) ||
        isCompareStackViewType(activeTab.viewType) ||
        isLayoutViewType(activeTab.viewType) ||
        isPetCtFusionViewType(activeTab.viewType)
      const exportViewportKey = viewportKeyOverride ?? (shouldUseActiveViewport ? options.activeViewportKey.value : 'single')
      const exportFileNameStem = buildExportFileStem(activeTab, exportViewportKey)
      const defaultFileNameStem =
        format === 'dicom-sr'
          ? `${exportFileNameStem}-measurements-sr`
          : format === 'dicom-gsps'
            ? `${exportFileNameStem}-presentation-state`
            : exportFileNameStem
      let customFileNameStem: string | null = null
      if (!exportPreference.value.useDefaultFileName) {
        customFileNameStem = await exportUi.requestExportFileName(format, defaultFileNameStem)
        if (!customFileNameStem) {
          return
        }
      }

      const overlays: ViewerExportOverlays = {
        annotations: options.getAnnotations(exportViewportKey),
        cornerInfo: options.getCornerInfoForExport(activeTab, exportViewportKey),
        measurements: options.getExportMeasurements(exportViewportKey)
      }
      const exportOverlays: ViewerExportOverlays =
        format === 'png'
          ? {
              annotations: exportPreference.value.includePngAnnotations ? overlays.annotations : [],
              cornerInfo: exportPreference.value.includePngCornerInfo ? overlays.cornerInfo : null,
              measurements: exportPreference.value.includePngMeasurements ? overlays.measurements : []
            }
          : format === 'dicom-sr'
            ? {
                annotations: [],
                cornerInfo: null,
                measurements: overlays.measurements
              }
            : format === 'dicom-gsps'
              ? {
                  annotations: overlays.annotations,
                  cornerInfo: null,
                  measurements: overlays.measurements
                }
              : {
                  annotations: exportPreference.value.includeDicomAnnotations ? overlays.annotations : [],
                  cornerInfo: null,
                  measurements: exportPreference.value.includeDicomMeasurements ? overlays.measurements : []
                }
      const shouldComposePng =
        format === 'png' &&
        (exportOverlays.annotations.length > 0 || exportOverlays.measurements.length > 0 || hasExportCornerInfo(exportOverlays.cornerInfo))
      const pngData = shouldComposePng ? await buildAnnotatedPngData(exportViewportKey, exportOverlays) : null
      const result = await exportCurrentView({
        activeTab,
        activeViewportKey: exportViewportKey,
        data: pngData,
        exportFormat: format,
        exportPreference: exportPreference.value,
        fileNameStem: customFileNameStem,
        overlays: exportOverlays
      })
      exportUi.showExportNotice(result, format)
    } catch (error) {
      console.error('Failed to export current view.', error)
      exportUi.showExportFailureNotice()
    }
  }

  return {
    ...exportUi,
    buildAnnotatedPngData,
    handleExportCurrentView
  }
}
