import type { CornerInfo, CornerPosition } from '../../types/viewer'

export type ViewportCornerInfoItemKey =
  | 'manufacturerModel'
  | 'stationName'
  | 'institutionName'
  | 'examDescription'
  | 'seriesNumber'
  | 'viewportLocation'
  | 'imageIndex'
  | 'patientName'
  | 'patientSummary'
  | 'technique'
  | 'sliceThickness'
  | 'acquisitionDateTime'
  | 'windowLevel'
  | 'zoom'
  | 'coordinates'
  | 'transform2dState'
  | 'modality'
  | 'accessionNumber'
  | 'studyDate'
  | 'studyTime'
  | 'studyId'
  | 'studyInstanceUid'
  | 'seriesInstanceUid'
  | 'sopInstanceUid'
  | 'seriesDescription'
  | 'bodyPartExamined'
  | 'protocolName'
  | 'patientBirthDate'
  | 'referringPhysicianName'
  | 'patientPosition'
  | 'pixelSpacing'
  | 'rowsColumns'
  | 'sliceLocation'
  | 'instanceNumber'
  | 'imagePositionPatient'
  | 'imageOrientationPatient'
  | 'rescaleSlopeIntercept'
  | 'convolutionKernel'
  | 'reconstructionDiameter'
  | 'ctdiVol'
  | 'exposure'
  | 'exposureTime'

export const VIEWPORT_CORNER_INFO_TYPOGRAPHY_PRESETS = ['compact', 'standard', 'comfortable'] as const
export const VIEWPORT_CORNER_INFO_COLOR_MODES = ['auto', 'custom'] as const
export const DEFAULT_VIEWPORT_CORNER_INFO_CUSTOM_DARK_COLOR = '#f8fafc'
export const DEFAULT_VIEWPORT_CORNER_INFO_CUSTOM_LIGHT_COLOR = '#182334'

export type ViewportCornerInfoTypographyPreset = (typeof VIEWPORT_CORNER_INFO_TYPOGRAPHY_PRESETS)[number]
export type ViewportCornerInfoColorMode = (typeof VIEWPORT_CORNER_INFO_COLOR_MODES)[number]

export interface ViewportCornerInfoPreference {
  topLeft: ViewportCornerInfoItemKey[]
  topRight: ViewportCornerInfoItemKey[]
  bottomLeft: ViewportCornerInfoItemKey[]
  bottomRight: ViewportCornerInfoItemKey[]
  typographyPreset: ViewportCornerInfoTypographyPreset
  colorMode: ViewportCornerInfoColorMode
  customDarkColor: string
  customLightColor: string
}

export interface ViewportCornerInfoCatalogItem {
  key: ViewportCornerInfoItemKey
  labels: {
    'zh-CN': string
    'en-US': string
  }
  dicomKeywords: string[]
  keywords: string[]
}

type CornerInfoLineMap = Record<ViewportCornerInfoItemKey, string[]>

export const VIEWPORT_CORNER_POSITIONS: CornerPosition[] = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight']
export const MAX_VIEWPORT_CORNER_ITEMS_PER_POSITION = 6

const VOLUME_HIDDEN_CORNER_TAGS: ViewportCornerInfoItemKey[] = [
  'imageIndex',
  'coordinates',
  'transform2dState',
  'windowLevel',
  'sliceThickness',
  'technique'
]

export function stripVolumeCornerInfo(cornerInfo: CornerInfo): CornerInfo {
  const tags = { ...(cornerInfo.tags ?? {}) }
  const hiddenLines = new Set(
    VOLUME_HIDDEN_CORNER_TAGS.flatMap((key) => tags[key] ?? [])
  )
  for (const key of VOLUME_HIDDEN_CORNER_TAGS) {
    delete tags[key]
  }

  const isVolumeHiddenLine = (line: string): boolean =>
    hiddenLines.has(line) ||
    /^Im:\s*/i.test(line) ||
    /^(?:Cursor\s+)?X:\s*(?:-?\d+|--)\s+Y:\s*(?:-?\d+|--)(?:\s+.+)?$/i.test(line) ||
    /^Rot:\s*-?\d+(?:\.\d+)?°?\s*\/\s*Flip:/i.test(line) ||
    /^(?:W:\s*-?\d+(?:\.\d+)?\s+L:|WW\s+-?\d+(?:\.\d+)?\s+WL\s+)/i.test(line) ||
    /^-?\d+(?:\.\d+)?\s*mm$/i.test(line) ||
    /(?:^|\s)-?\d+(?:\.\d+)?\s*(?:kV|mA)(?:\s|$)/i.test(line)

  return {
    ...cornerInfo,
    topLeft: cornerInfo.topLeft.filter((line) => !isVolumeHiddenLine(line)),
    topRight: cornerInfo.topRight.filter((line) => !isVolumeHiddenLine(line)),
    bottomLeft: cornerInfo.bottomLeft.filter((line) => !isVolumeHiddenLine(line)),
    bottomRight: cornerInfo.bottomRight.filter((line) => !isVolumeHiddenLine(line)),
    tags
  }
}

export const VIEWPORT_CORNER_INFO_CATALOG: ViewportCornerInfoCatalogItem[] = [
  {
    key: 'manufacturerModel',
    labels: { 'zh-CN': '制造商 / 型号', 'en-US': 'Manufacturer / Model' },
    dicomKeywords: ['Manufacturer', 'ManufacturerModelName'],
    keywords: ['vendor', 'model', 'manufacturer', '设备', '型号', '厂商']
  },
  {
    key: 'stationName',
    labels: { 'zh-CN': '设备站点', 'en-US': 'Station name' },
    dicomKeywords: ['StationName'],
    keywords: ['station', '设备站点', '站点']
  },
  {
    key: 'institutionName',
    labels: { 'zh-CN': '机构名称', 'en-US': 'Institution' },
    dicomKeywords: ['InstitutionName'],
    keywords: ['institution', 'hospital', '医院', '机构']
  },
  {
    key: 'examDescription',
    labels: { 'zh-CN': '检查 / 序列描述', 'en-US': 'Study / series description' },
    dicomKeywords: ['StudyDescription', 'StudyID', 'SeriesDescription'],
    keywords: ['description', 'study', 'series', '检查描述', '序列描述']
  },
  {
    key: 'seriesNumber',
    labels: { 'zh-CN': '序列号', 'en-US': 'Series number' },
    dicomKeywords: ['SeriesNumber'],
    keywords: ['series', 'se', '序列号']
  },
  {
    key: 'viewportLocation',
    labels: { 'zh-CN': '视口定位', 'en-US': 'Viewport location' },
    dicomKeywords: ['ImagePositionPatient'],
    keywords: ['location', 'position', 'axial', 'coronal', 'sagittal', '定位', '层面']
  },
  {
    key: 'imageIndex',
    labels: { 'zh-CN': 'Im 信息', 'en-US': 'Image number (Im)' },
    dicomKeywords: ['InstanceNumber'],
    keywords: ['image', 'instance', 'im', 'image number', '图像', '张数']
  },
  {
    key: 'patientName',
    labels: { 'zh-CN': '患者姓名', 'en-US': 'Patient name' },
    dicomKeywords: ['PatientName'],
    keywords: ['patient', 'name', '患者', '姓名']
  },
  {
    key: 'patientSummary',
    labels: { 'zh-CN': '患者 ID / 性别 / 年龄', 'en-US': 'Patient ID / sex / age' },
    dicomKeywords: ['PatientID', 'PatientSex', 'PatientAge'],
    keywords: ['patient id', 'sex', 'age', '患者id', '性别', '年龄']
  },
  {
    key: 'technique',
    labels: { 'zh-CN': '扫描参数 kV / mA', 'en-US': 'Technique kV / mA' },
    dicomKeywords: ['KVP', 'XRayTubeCurrent'],
    keywords: ['kv', 'ma', 'technique', '扫描参数', '管电压', '管电流']
  },
  {
    key: 'sliceThickness',
    labels: { 'zh-CN': '层厚', 'en-US': 'Slice thickness' },
    dicomKeywords: ['SliceThickness'],
    keywords: ['slice', 'thickness', 'mm', '层厚']
  },
  {
    key: 'acquisitionDateTime',
    labels: { 'zh-CN': '采集日期 / 时间', 'en-US': 'Acquisition date / time' },
    dicomKeywords: ['AcquisitionDate', 'AcquisitionTime', 'ContentDate', 'ContentTime', 'StudyDate', 'StudyTime'],
    keywords: ['date', 'time', 'acquisition', 'study date', '采集', '日期', '时间']
  },
  {
    key: 'windowLevel',
    labels: { 'zh-CN': '窗宽 / 窗位', 'en-US': 'Window / level' },
    dicomKeywords: ['WindowWidth', 'WindowCenter'],
    keywords: ['window', 'level', 'ww', 'wl', '窗宽', '窗位']
  },
  {
    key: 'zoom',
    labels: { 'zh-CN': '缩放', 'en-US': 'Zoom' },
    dicomKeywords: [],
    keywords: ['zoom', 'scale', '缩放']
  },
  {
    key: 'coordinates',
    labels: { 'zh-CN': '坐标 / 像素值', 'en-US': 'Coordinates / pixel value' },
    dicomKeywords: [],
    keywords: ['coordinate', 'cursor', 'pixel value', 'HU', '坐标', '像素值']
  },
  {
    key: 'transform2dState',
    labels: { 'zh-CN': '旋转 / 镜像', 'en-US': 'Rotation / flip' },
    dicomKeywords: [],
    keywords: ['rotation', 'rotate', 'flip', 'mirror', 'transform', '旋转', '镜像', '翻转']
  },
  {
    key: 'modality',
    labels: { 'zh-CN': '模态', 'en-US': 'Modality' },
    dicomKeywords: ['Modality'],
    keywords: ['modality', 'CT', 'MR', 'PT', 'US', '模态']
  },
  {
    key: 'accessionNumber',
    labels: { 'zh-CN': '检查号', 'en-US': 'Accession number' },
    dicomKeywords: ['AccessionNumber'],
    keywords: ['accession', 'acc', '检查号']
  },
  {
    key: 'studyDate',
    labels: { 'zh-CN': '检查日期', 'en-US': 'Study date' },
    dicomKeywords: ['StudyDate'],
    keywords: ['study date', 'date', '检查日期']
  },
  {
    key: 'studyTime',
    labels: { 'zh-CN': '检查时间', 'en-US': 'Study time' },
    dicomKeywords: ['StudyTime'],
    keywords: ['study time', 'time', '检查时间']
  },
  {
    key: 'studyId',
    labels: { 'zh-CN': '检查 ID', 'en-US': 'Study ID' },
    dicomKeywords: ['StudyID'],
    keywords: ['study id', '检查id']
  },
  {
    key: 'studyInstanceUid',
    labels: { 'zh-CN': '检查 UID', 'en-US': 'Study UID' },
    dicomKeywords: ['StudyInstanceUID'],
    keywords: ['study uid', 'study instance uid', '检查uid']
  },
  {
    key: 'seriesInstanceUid',
    labels: { 'zh-CN': '序列 UID', 'en-US': 'Series UID' },
    dicomKeywords: ['SeriesInstanceUID'],
    keywords: ['series uid', 'series instance uid', '序列uid']
  },
  {
    key: 'sopInstanceUid',
    labels: { 'zh-CN': '图像 SOP UID', 'en-US': 'SOP UID' },
    dicomKeywords: ['SOPInstanceUID'],
    keywords: ['sop uid', 'sop instance uid', '图像uid']
  },
  {
    key: 'seriesDescription',
    labels: { 'zh-CN': '序列描述', 'en-US': 'Series description' },
    dicomKeywords: ['SeriesDescription'],
    keywords: ['series description', 'description', '序列描述']
  },
  {
    key: 'bodyPartExamined',
    labels: { 'zh-CN': '检查部位', 'en-US': 'Body part' },
    dicomKeywords: ['BodyPartExamined'],
    keywords: ['body', 'body part', '部位']
  },
  {
    key: 'protocolName',
    labels: { 'zh-CN': '扫描协议', 'en-US': 'Protocol name' },
    dicomKeywords: ['ProtocolName'],
    keywords: ['protocol', '扫描协议']
  },
  {
    key: 'patientBirthDate',
    labels: { 'zh-CN': '出生日期', 'en-US': 'Patient birth date' },
    dicomKeywords: ['PatientBirthDate'],
    keywords: ['birth', 'birthday', 'dob', '出生']
  },
  {
    key: 'referringPhysicianName',
    labels: { 'zh-CN': '申请医生', 'en-US': 'Referring physician' },
    dicomKeywords: ['ReferringPhysicianName'],
    keywords: ['referring physician', 'doctor', 'physician', '医生']
  },
  {
    key: 'patientPosition',
    labels: { 'zh-CN': '患者体位', 'en-US': 'Patient position' },
    dicomKeywords: ['PatientPosition'],
    keywords: ['patient position', 'HFS', 'FFS', '体位']
  },
  {
    key: 'pixelSpacing',
    labels: { 'zh-CN': '像素间距', 'en-US': 'Pixel spacing' },
    dicomKeywords: ['PixelSpacing'],
    keywords: ['pixel spacing', 'spacing', '像素间距']
  },
  {
    key: 'rowsColumns',
    labels: { 'zh-CN': '矩阵大小', 'en-US': 'Matrix size' },
    dicomKeywords: ['Rows', 'Columns'],
    keywords: ['matrix', 'rows', 'columns', '矩阵']
  },
  {
    key: 'sliceLocation',
    labels: { 'zh-CN': '层面位置', 'en-US': 'Slice location' },
    dicomKeywords: ['SliceLocation'],
    keywords: ['slice location', 'location', '层面位置']
  },
  {
    key: 'instanceNumber',
    labels: { 'zh-CN': '实例号', 'en-US': 'Instance number' },
    dicomKeywords: ['InstanceNumber'],
    keywords: ['instance number', 'instance', '实例号']
  },
  {
    key: 'imagePositionPatient',
    labels: { 'zh-CN': '图像位置 IPP', 'en-US': 'Image position (IPP)' },
    dicomKeywords: ['ImagePositionPatient'],
    keywords: ['ipp', 'image position', 'position patient', '图像位置']
  },
  {
    key: 'imageOrientationPatient',
    labels: { 'zh-CN': '图像方向 IOP', 'en-US': 'Image orientation (IOP)' },
    dicomKeywords: ['ImageOrientationPatient'],
    keywords: ['iop', 'image orientation', 'orientation patient', '图像方向']
  },
  {
    key: 'rescaleSlopeIntercept',
    labels: { 'zh-CN': '重缩放斜率 / 截距', 'en-US': 'Rescale slope / intercept' },
    dicomKeywords: ['RescaleSlope', 'RescaleIntercept'],
    keywords: ['rescale', 'slope', 'intercept', '重缩放']
  },
  {
    key: 'convolutionKernel',
    labels: { 'zh-CN': '重建核', 'en-US': 'Convolution kernel' },
    dicomKeywords: ['ConvolutionKernel'],
    keywords: ['kernel', 'convolution', '重建核']
  },
  {
    key: 'reconstructionDiameter',
    labels: { 'zh-CN': '重建视野', 'en-US': 'Reconstruction diameter' },
    dicomKeywords: ['ReconstructionDiameter'],
    keywords: ['fov', 'reconstruction diameter', '重建视野']
  },
  {
    key: 'ctdiVol',
    labels: { 'zh-CN': 'CTDIvol 剂量', 'en-US': 'CTDIvol' },
    dicomKeywords: ['CTDIvol'],
    keywords: ['ctdi', 'dose', '剂量']
  },
  {
    key: 'exposure',
    labels: { 'zh-CN': '曝光量', 'en-US': 'Exposure' },
    dicomKeywords: ['Exposure'],
    keywords: ['exposure', 'mAs', '曝光']
  },
  {
    key: 'exposureTime',
    labels: { 'zh-CN': '曝光时间', 'en-US': 'Exposure time' },
    dicomKeywords: ['ExposureTime'],
    keywords: ['exposure time', 'ms', '曝光时间']
  }
]

export const VIEWPORT_CORNER_INFO_ITEM_KEYS = VIEWPORT_CORNER_INFO_CATALOG.map((item) => item.key)
const VIEWPORT_CORNER_INFO_ITEM_KEY_SET = new Set<ViewportCornerInfoItemKey>(VIEWPORT_CORNER_INFO_ITEM_KEYS)
const VIEWPORT_CORNER_INFO_SEARCH_INDEX: Record<'zh-CN' | 'en-US', Map<ViewportCornerInfoItemKey, string>> = {
  'zh-CN': createViewportCornerInfoSearchIndex('zh-CN'),
  'en-US': createViewportCornerInfoSearchIndex('en-US')
}

const DEFAULT_VIEWPORT_CORNER_INFO_PREFERENCE: ViewportCornerInfoPreference = {
  topLeft: [
    'manufacturerModel',
    'stationName',
    'examDescription',
    'seriesNumber',
    'viewportLocation',
    'imageIndex'
  ],
  topRight: ['patientName', 'patientSummary'],
  bottomLeft: ['technique', 'sliceThickness', 'acquisitionDateTime', 'windowLevel'],
  bottomRight: ['zoom', 'coordinates', 'transform2dState'],
  typographyPreset: 'comfortable',
  colorMode: 'auto',
  customDarkColor: DEFAULT_VIEWPORT_CORNER_INFO_CUSTOM_DARK_COLOR,
  customLightColor: DEFAULT_VIEWPORT_CORNER_INFO_CUSTOM_LIGHT_COLOR
}

export const SAMPLE_VIEWPORT_CORNER_INFO: CornerInfo = {
  topLeft: ['SIEMENS / SOMATOM', 'CT01', 'Radiology', 'Chest CT', 'Se: 3', 'AXIAL  I 42.5mm', 'Im: 36/128'],
  topRight: ['ZHANG SAN', 'P000123 / M / 058Y'],
  bottomLeft: ['120kV 250mA', '1.25mm', '2026-06-05 10:24:31', 'W: 400 L: 40'],
  bottomRight: ['Zoom:1.25x', 'X:12 Y:-4', 'Rot:90° / Flip:H'],
  tags: {
    modality: ['Modality: CT'],
    accessionNumber: ['Acc: A20260605001'],
    studyDate: ['Study date: 2026.06.05'],
    studyTime: ['Study time: 10:24:31'],
    studyId: ['Study ID: CHEST-CT'],
    studyInstanceUid: ['Study UID: 1.2.840.113619.2.55.3'],
    seriesInstanceUid: ['Series UID: 1.2.840.113619.2.55.3.604'],
    sopInstanceUid: ['SOP UID: 1.2.840.113619.2.55.3.604.36'],
    seriesDescription: ['Series: Chest CT'],
    bodyPartExamined: ['Body: CHEST'],
    protocolName: ['Protocol: Chest Routine'],
    patientBirthDate: ['Birth: 1968.03.12'],
    referringPhysicianName: ['Referrer: LI SI'],
    patientPosition: ['Patient pos: HFS'],
    pixelSpacing: ['Pixel: 0.742 x 0.742mm'],
    rowsColumns: ['Matrix: 512 x 512'],
    sliceLocation: ['Slice loc: 42.5mm'],
    instanceNumber: ['Instance: 36'],
    imagePositionPatient: ['IPP: -180.0, -180.0, 42.5'],
    imageOrientationPatient: ['IOP: 1, 0, 0, 0, 1, 0'],
    rescaleSlopeIntercept: ['Rescale: m 1  b -1024'],
    convolutionKernel: ['Kernel: B30f'],
    reconstructionDiameter: ['FOV: 380mm'],
    ctdiVol: ['CTDIvol: 12.4mGy'],
    exposure: ['Exposure: 210mAs'],
    exposureTime: ['Exp time: 500ms']
  }
}

function clonePreference(preference: ViewportCornerInfoPreference): ViewportCornerInfoPreference {
  return {
    topLeft: [...preference.topLeft],
    topRight: [...preference.topRight],
    bottomLeft: [...preference.bottomLeft],
    bottomRight: [...preference.bottomRight],
    typographyPreset: preference.typographyPreset,
    colorMode: preference.colorMode,
    customDarkColor: preference.customDarkColor,
    customLightColor: preference.customLightColor
  }
}

export function createDefaultViewportCornerInfoPreference(): ViewportCornerInfoPreference {
  return clonePreference(DEFAULT_VIEWPORT_CORNER_INFO_PREFERENCE)
}

function normalizeItemKey(value: unknown): ViewportCornerInfoItemKey | null {
  return typeof value === 'string' && VIEWPORT_CORNER_INFO_ITEM_KEY_SET.has(value as ViewportCornerInfoItemKey)
    ? (value as ViewportCornerInfoItemKey)
    : null
}

function normalizeTypographyPreset(value: unknown): ViewportCornerInfoTypographyPreset {
  return VIEWPORT_CORNER_INFO_TYPOGRAPHY_PRESETS.includes(value as ViewportCornerInfoTypographyPreset)
    ? (value as ViewportCornerInfoTypographyPreset)
    : DEFAULT_VIEWPORT_CORNER_INFO_PREFERENCE.typographyPreset
}

function normalizeColorMode(value: unknown): ViewportCornerInfoColorMode {
  return VIEWPORT_CORNER_INFO_COLOR_MODES.includes(value as ViewportCornerInfoColorMode)
    ? (value as ViewportCornerInfoColorMode)
    : DEFAULT_VIEWPORT_CORNER_INFO_PREFERENCE.colorMode
}

function normalizeHexColor(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback
  }

  const normalized = value.trim()
  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized : fallback
}

function createViewportCornerInfoSearchIndex(locale: 'zh-CN' | 'en-US'): Map<ViewportCornerInfoItemKey, string> {
  return new Map(
    VIEWPORT_CORNER_INFO_CATALOG.map((item) => [
      item.key,
      [
        item.key,
        item.labels[locale],
        item.labels['zh-CN'],
        item.labels['en-US'],
        ...item.dicomKeywords,
        ...item.keywords
      ]
        .join(' ')
        .toLowerCase()
    ])
  )
}

export function normalizeViewportCornerInfoPreference(value: unknown): ViewportCornerInfoPreference {
  if (!value || typeof value !== 'object') {
    return createDefaultViewportCornerInfoPreference()
  }

  const record = value as Partial<Record<CornerPosition, unknown>>
  const usedKeys = new Set<ViewportCornerInfoItemKey>()
  const styleRecord = value as Partial<
    Pick<ViewportCornerInfoPreference, 'colorMode' | 'customDarkColor' | 'customLightColor' | 'typographyPreset'>
  > & { customColor?: unknown }
  const legacyCustomColor = normalizeHexColor(styleRecord.customColor, DEFAULT_VIEWPORT_CORNER_INFO_PREFERENCE.customDarkColor)
  const normalized: ViewportCornerInfoPreference = {
    topLeft: [],
    topRight: [],
    bottomLeft: [],
    bottomRight: [],
    typographyPreset: normalizeTypographyPreset(styleRecord.typographyPreset),
    colorMode: normalizeColorMode(styleRecord.colorMode),
    customDarkColor: normalizeHexColor(styleRecord.customDarkColor, legacyCustomColor),
    customLightColor: normalizeHexColor(styleRecord.customLightColor, DEFAULT_VIEWPORT_CORNER_INFO_PREFERENCE.customLightColor)
  }

  for (const position of VIEWPORT_CORNER_POSITIONS) {
    const source = Array.isArray(record[position]) ? record[position] : []
    for (const item of source) {
      if (normalized[position].length >= MAX_VIEWPORT_CORNER_ITEMS_PER_POSITION) {
        break
      }

      const key = normalizeItemKey(item)
      if (!key || usedKeys.has(key)) {
        continue
      }

      usedKeys.add(key)
      normalized[position].push(key)
    }
  }

  return normalized
}

function normalizeLines(lines: string[] | undefined): string[] {
  return (lines ?? []).map((line) => line.trim()).filter(Boolean)
}

function normalizeCornerTagLines(tags: CornerInfo['tags'] | undefined): Partial<CornerInfoLineMap> {
  if (!tags) {
    return {}
  }
  return VIEWPORT_CORNER_INFO_ITEM_KEYS.reduce<Partial<CornerInfoLineMap>>((accumulator, key) => {
    const lines = normalizeLines(tags[key])
    if (lines.length) {
      accumulator[key] = lines
    }
    return accumulator
  }, {})
}

function firstMatchingLine(lines: string[], predicate: (line: string) => boolean): string | null {
  return lines.find((line) => predicate(line)) ?? null
}

function isSeriesNumberLine(line: string): boolean {
  return /^Se:\s*/i.test(line)
}

function isImageIndexLine(line: string): boolean {
  return /^Im:\s*/i.test(line)
}

function isViewportLocationLine(line: string): boolean {
  return /^(?:Stack|AXIAL|CORONAL|SAGITTAL|OBLIQUE\b|3D\b)/i.test(line)
}

function isWindowLine(line: string): boolean {
  return /^W:\s*/i.test(line)
}

function isZoomLine(line: string): boolean {
  return /^Zoom:\s*/i.test(line)
}

function isCoordinateLine(line: string): boolean {
  return /^(?:Cursor\s+)?X:\s*(?:-?\d+|--)\s+Y:\s*(?:-?\d+|--)(?:\s+.+)?$/i.test(line)
}

function isTransform2dStateLine(line: string): boolean {
  return /^Rot:\s*-?\d+(?:\.\d+)?°?\s*\/\s*Flip:/i.test(line)
}

function isTechniqueLine(line: string): boolean {
  return /\b(?:kV|mA)\b/i.test(line)
}

function isSliceThicknessLine(line: string): boolean {
  return /^\d+(?:\.\d+)?\s*mm$/i.test(line)
}

function isDateTimeLine(line: string): boolean {
  return /\d{4}[-/]\d{2}[-/]\d{2}/.test(line) || /\b\d{2}:\d{2}(?::\d{2})?\b/.test(line)
}

export function resolveViewportCornerInfoLineMap(cornerInfo: CornerInfo): CornerInfoLineMap {
  const tagLines = normalizeCornerTagLines(cornerInfo.tags)
  const topLeft = normalizeLines(cornerInfo.topLeft)
  const topRight = normalizeLines(cornerInfo.topRight)
  const bottomLeft = normalizeLines(cornerInfo.bottomLeft)
  const bottomRight = normalizeLines(cornerInfo.bottomRight)

  const seriesNumberLine = firstMatchingLine(topLeft, isSeriesNumberLine)
  const imageIndexLine = firstMatchingLine(topLeft, isImageIndexLine)
  const viewportLocationLine = firstMatchingLine(topLeft, isViewportLocationLine)
  const metadataTopLeft = topLeft.filter(
    (line) => line !== seriesNumberLine && line !== imageIndexLine && line !== viewportLocationLine
  )

  const windowLine = firstMatchingLine(bottomLeft, isWindowLine)
  const techniqueLine = firstMatchingLine(bottomLeft, isTechniqueLine)
  const sliceThicknessLine = firstMatchingLine(bottomLeft, isSliceThicknessLine)
  const acquisitionDateTimeLine = firstMatchingLine(bottomLeft, isDateTimeLine)
  const remainingBottomLeft = bottomLeft.filter(
    (line) =>
      line !== windowLine &&
      line !== techniqueLine &&
      line !== sliceThicknessLine &&
      line !== acquisitionDateTimeLine
  )

  const zoomLine = firstMatchingLine(bottomRight, isZoomLine)
  const coordinateLine = firstMatchingLine(bottomRight, isCoordinateLine)
  const transform2dStateLine = firstMatchingLine(bottomRight, isTransform2dStateLine)

  const inferredLineMap: CornerInfoLineMap = {
    manufacturerModel: metadataTopLeft[0] ? [metadataTopLeft[0]] : [],
    stationName: metadataTopLeft[1] ? [metadataTopLeft[1]] : [],
    institutionName: metadataTopLeft[2] ? [metadataTopLeft[2]] : [],
    examDescription: metadataTopLeft[3] ? [metadataTopLeft[3]] : [],
    seriesNumber: seriesNumberLine ? [seriesNumberLine] : [],
    viewportLocation: viewportLocationLine ? [viewportLocationLine] : [],
    imageIndex: imageIndexLine ? [imageIndexLine] : [],
    patientName: topRight[0] ? [topRight[0]] : [],
    patientSummary: topRight[1] ? [topRight[1]] : [],
    technique: techniqueLine ? [techniqueLine] : remainingBottomLeft[0] ? [remainingBottomLeft[0]] : [],
    sliceThickness: sliceThicknessLine ? [sliceThicknessLine] : [],
    acquisitionDateTime: acquisitionDateTimeLine ? [acquisitionDateTimeLine] : [],
    windowLevel: windowLine ? [windowLine] : [],
    zoom: zoomLine ? [zoomLine] : [],
    coordinates: coordinateLine ? [coordinateLine] : [],
    transform2dState: transform2dStateLine ? [transform2dStateLine] : [],
    modality: [],
    accessionNumber: [],
    studyDate: [],
    studyTime: [],
    studyId: [],
    studyInstanceUid: [],
    seriesInstanceUid: [],
    sopInstanceUid: [],
    seriesDescription: [],
    bodyPartExamined: [],
    protocolName: [],
    patientBirthDate: [],
    referringPhysicianName: [],
    patientPosition: [],
    pixelSpacing: [],
    rowsColumns: [],
    sliceLocation: [],
    instanceNumber: [],
    imagePositionPatient: [],
    imageOrientationPatient: [],
    rescaleSlopeIntercept: [],
    convolutionKernel: [],
    reconstructionDiameter: [],
    ctdiVol: [],
    exposure: [],
    exposureTime: []
  }

  return VIEWPORT_CORNER_INFO_ITEM_KEYS.reduce<CornerInfoLineMap>((accumulator, key) => {
    accumulator[key] = tagLines[key]?.length ? tagLines[key]! : inferredLineMap[key]
    return accumulator
  }, { ...inferredLineMap })
}

function uniqueLines(lines: string[]): string[] {
  return lines.filter((line, index) => lines.indexOf(line) === index)
}

export function applyViewportCornerInfoPreference(
  cornerInfo: CornerInfo,
  preference: ViewportCornerInfoPreference
): CornerInfo {
  const lineMap = resolveViewportCornerInfoLineMap(cornerInfo)
  const normalizedPreference = normalizeViewportCornerInfoPreference(preference)

  return VIEWPORT_CORNER_POSITIONS.reduce(
    (accumulator, position) => {
      accumulator[position] = uniqueLines(normalizedPreference[position].flatMap((key) => lineMap[key] ?? []))
      return accumulator
    },
    {
      topLeft: [],
      topRight: [],
      bottomLeft: [],
      bottomRight: []
    } as CornerInfo
  )
}

export function getViewportCornerInfoItemLabel(item: ViewportCornerInfoCatalogItem, locale: 'zh-CN' | 'en-US'): string {
  return item.labels[locale] ?? item.labels['zh-CN']
}

export function filterViewportCornerInfoCatalog(
  query: string,
  locale: 'zh-CN' | 'en-US' = 'zh-CN'
): ViewportCornerInfoCatalogItem[] {
  const tokens = query
    .trim()
    .toLowerCase()
    .split(/[\s_\-./\\|:，。；;、（）()[\]{}]+/g)
    .filter(Boolean)
  if (!tokens.length) {
    return VIEWPORT_CORNER_INFO_CATALOG
  }

  return VIEWPORT_CORNER_INFO_CATALOG.filter((item) => {
    const haystack = VIEWPORT_CORNER_INFO_SEARCH_INDEX[locale].get(item.key) ?? item.key.toLowerCase()
    return tokens.every((token) => haystack.includes(token))
  })
}
