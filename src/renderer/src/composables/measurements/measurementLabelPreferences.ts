import type { RoiStatPreference } from '../ui/useUiPreferences'
import type { MeasurementDraft, MeasurementOverlay, MeasurementToolType } from '../../types/viewer'

const ROI_TOOL_TYPES = new Set<MeasurementToolType>(['rect', 'ellipse'])

interface ParsedLabelLine {
  key: string | null
  value: string
}

interface ParsedSizeLine {
  widthValue: string
  heightValue: string
}

function parseLabelLine(line: string): ParsedLabelLine {
  const normalized = line.trim()
  const match = normalized.match(/^([A-Za-z][A-Za-z/-]*)\s+(.+)$/)
  if (!match) {
    return {
      key: null,
      value: normalized
    }
  }

  return {
    key: match[1],
    value: match[2]
  }
}

function appendSharedUnit(primary: string, secondary: string): string {
  if (/[A-Za-z%]/.test(primary)) {
    return primary
  }

  const unitMatch = secondary.match(/([A-Za-z%][A-Za-z0-9^/%.-]*)\s*$/)
  if (!unitMatch) {
    return primary
  }

  return `${primary} ${unitMatch[1]}`
}

function parseSizeLine(line: string): ParsedSizeLine | null {
  const match = line.trim().match(/^Size\s+(.+?)\s*\*\s*(.+)$/i)
  if (!match) {
    return null
  }

  const widthValue = appendSharedUnit(match[1].trim(), match[2].trim())
  return {
    widthValue,
    heightValue: match[2].trim()
  }
}

function buildEnabledStatKeySet(roiStatOptions: RoiStatPreference[]): Set<string> {
  return new Set(roiStatOptions.filter((item) => item.enabled).map((item) => item.key.toLowerCase()))
}

function normalizeLabelKey(key: string): string {
  return key.trim().toLowerCase()
}

export function filterMeasurementLabelLines(
  toolType: MeasurementToolType,
  labelLines: string[],
  roiStatOptions: RoiStatPreference[]
): string[] {
  if (!ROI_TOOL_TYPES.has(toolType)) {
    return labelLines
  }

  const enabledStatKeys = buildEnabledStatKeySet(roiStatOptions)

  return labelLines.flatMap((line) => {
    const sizeLine = parseSizeLine(line)
    if (sizeLine) {
      const nextLines: string[] = []
      if (enabledStatKeys.has('width')) {
        nextLines.push(`Width ${sizeLine.widthValue}`)
      }
      if (enabledStatKeys.has('height')) {
        nextLines.push(`Height ${sizeLine.heightValue}`)
      }
      return nextLines
    }

    const parsed = parseLabelLine(line)
    if (!parsed.key) {
      return line
    }

    return enabledStatKeys.has(normalizeLabelKey(parsed.key)) ? line : []
  })
}

export function filterMeasurementOverlayByPreferences(
  measurement: MeasurementOverlay,
  roiStatOptions: RoiStatPreference[]
): MeasurementOverlay {
  return {
    ...measurement,
    labelLines: filterMeasurementLabelLines(measurement.toolType, measurement.labelLines ?? [], roiStatOptions)
  }
}

export function filterMeasurementDraftByPreferences(
  draft: MeasurementDraft | null,
  roiStatOptions: RoiStatPreference[]
): MeasurementDraft | null {
  if (!draft) {
    return null
  }

  return {
    ...draft,
    labelLines: filterMeasurementLabelLines(draft.toolType, draft.labelLines ?? [], roiStatOptions)
  }
}
