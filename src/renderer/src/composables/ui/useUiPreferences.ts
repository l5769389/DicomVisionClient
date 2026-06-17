import { computed, reactive, watch } from 'vue'
import { PSEUDOCOLOR_PRESET_OPTIONS } from '../../constants/pseudocolor'
import { loadUiPreferencesFromStorage, saveUiPreferencesToStorage } from '../../platform/preferencesStorage'
import {
  DEFAULT_MPR_LAYOUT_KEY,
  isMprLayoutKey,
  type MprDefaultLayoutKey
} from '../workspace/layout/mprLayoutOptions'
import {
  DEFAULT_MPR_SEGMENTATION_COLOR,
  DEFAULT_MPR_VOI_COLOR
} from '../../types/viewer'
import { VIEWER_LAYOUT_CUSTOM_GRID_SIZE } from '../workspace/layout/viewerLayoutTemplates'
import {
  createDefaultViewportCornerInfoPreference,
  normalizeViewportCornerInfoPreference,
  type ViewportCornerInfoPreference
} from './viewportCornerInfo'

export type AppLocale = 'zh-CN' | 'en-US'
export type DicomTagDisplayMode = 'flat' | 'tree'
export type DicomDeidentifyFieldKey =
  | 'patientIdentity'
  | 'patientDemographics'
  | 'datesAndTimes'
  | 'accessionInstitution'
  | 'physiciansOperators'
  | 'descriptions'
  | 'deviceInfo'
  | 'privateTags'
  | 'uids'

export const DEFAULT_DICOM_DEIDENTIFY_FIELD_KEYS: DicomDeidentifyFieldKey[] = [
  'patientIdentity',
  'patientDemographics',
  'datesAndTimes',
  'accessionInstitution',
  'physiciansOperators',
  'privateTags',
  'uids'
]

const DICOM_DEIDENTIFY_FIELD_KEYS: DicomDeidentifyFieldKey[] = [
  ...DEFAULT_DICOM_DEIDENTIFY_FIELD_KEYS,
  'descriptions',
  'deviceInfo'
]
const DICOM_DEIDENTIFY_FIELD_KEY_SET = new Set(DICOM_DEIDENTIFY_FIELD_KEYS)

export interface WindowTemplatePreset {
  id: string
  source: 'system' | 'custom'
  ww: number
  wl: number
  accent: string
  labels: {
    'zh-CN': string
    'en-US': string
  }
}

export interface CrosshairViewportPreference {
  key: 'mpr-ax' | 'mpr-cor' | 'mpr-sag'
  label: string
  color: string
  thickness: number
}

export interface ScaleBarPreference {
  enabled: boolean
  color: string
}

export type MeasurementLineStyle = 'solid' | 'dash'

export interface MeasurementStylePreference {
  editingColor: string
  completedColor: string
  lineWidth: number
  editingLineStyle: MeasurementLineStyle
  completedLineStyle: MeasurementLineStyle
}

export interface MprSegmentationStylePreference {
  thresholdColor: string
  voiColor: string
}

export interface ExportPreference {
  locationMode: 'default' | 'custom'
  desktopDirectory: string | null
  includeDicomAnnotations: boolean
  includeDicomMeasurements: boolean
  includePngAnnotations: boolean
  includePngCornerInfo: boolean
  includePngMeasurements: boolean
  useDefaultFileName: boolean
  webDirectoryName: string | null
}

export interface DicomTagEditSavePreference {
  locationMode: 'default' | 'custom'
  desktopDirectory: string | null
}

export interface DicomDeidentifyPreference {
  selectedFieldKeys: DicomDeidentifyFieldKey[]
  replacementPrefix: string
}

export interface HangingProtocolRule {
  id: string
  name: string
  enabled: boolean
  modality: string
  seriesDescriptionKeyword: string
  rows: number
  columns: number
}

export type PacsAuthType = 'none' | 'basic' | 'bearer'
export type PacsProtocol = 'dicomweb' | 'dimse'
export type PacsProfilePreset = 'orthanc' | 'dcm4chee' | 'custom'
export type DimseQueryModel = 'study-root' | 'patient-root'

export interface PacsDicomwebProfile {
  id: string
  name: string
  enabled: boolean
  protocol: PacsProtocol
  preset: PacsProfilePreset
  baseUrl: string
  qidoPath: string
  wadoPath: string
  authType: PacsAuthType
  username: string
  password: string
  bearerToken: string
  host: string
  port: number
  calledAeTitle: string
  clientAeTitle: string
  queryModel: DimseQueryModel
  timeoutSeconds: number
}

export interface PacsPreference {
  localSourceEnabled: boolean
  enabled: boolean
  activeProfileId: string
  profiles: PacsDicomwebProfile[]
}

export interface RoiStatPreference {
  key: string
  label: string
  enabled: boolean
}

export type QaWaterMetricKey = 'accuracy' | 'uniformity' | 'noise'

export interface QaWaterMetricPreference {
  key: QaWaterMetricKey
  label: string
  enabled: boolean
}

interface StoredCustomWindowPreset {
  id: string
  ww: number
  wl: number
  accent: string
  labels: WindowTemplatePreset['labels']
}

interface UiPreferencesState {
  version: number
  locale: AppLocale
  themeId: string
  selectedPseudocolorKey: string
  mprDefaultLayoutKey: MprDefaultLayoutKey
  dicomTagDisplayMode: DicomTagDisplayMode
  selectedWindowPresetId: string
  crosshairConfigs: CrosshairViewportPreference[]
  scaleBarPreference: ScaleBarPreference
  viewportCornerInfoPreference: ViewportCornerInfoPreference
  measurementStylePreference: MeasurementStylePreference
  mprSegmentationStylePreference: MprSegmentationStylePreference
  dicomTagEditSavePreference: DicomTagEditSavePreference
  dicomDeidentifyPreference: DicomDeidentifyPreference
  hangingProtocolRules: HangingProtocolRule[]
  pacsPreference: PacsPreference
  exportPreference: ExportPreference
  qaWaterMetrics: QaWaterMetricPreference[]
  roiStatOptions: RoiStatPreference[]
  customWindowPresets: StoredCustomWindowPreset[]
}

const CURRENT_PREFERENCES_VERSION = 16
const DEFAULT_THEME_ID = 'industrial-utility'
const DEFAULT_PSEUDOCOLOR_KEY = 'bw'
const DEFAULT_DICOM_TAG_DISPLAY_MODE: DicomTagDisplayMode = 'tree'
const DEFAULT_WINDOW_PRESET_ID = 'lung'
export const MAX_CUSTOM_WINDOW_PRESETS = 5
export const MAX_HANGING_PROTOCOL_RULES = 8
const LEGACY_CROSSHAIR_COLORS: Record<CrosshairViewportPreference['key'], string> = {
  'mpr-ax': '#ffd166',
  'mpr-cor': '#7dd3fc',
  'mpr-sag': '#fda4af'
}
const PREVIOUS_DEFAULT_CROSSHAIR_COLORS: Record<CrosshairViewportPreference['key'], string> = {
  'mpr-ax': '#22c55e',
  'mpr-cor': '#3b82f6',
  'mpr-sag': '#ef4444'
}
const PREVIOUS_DEFAULT_VIEWPORT_CORNER_INFO_PREFERENCE: ViewportCornerInfoPreference = {
  topLeft: ['manufacturerModel', 'stationName', 'institutionName', 'examDescription', 'seriesNumber', 'viewportLocation'],
  topRight: ['patientName', 'patientSummary'],
  bottomLeft: ['technique', 'sliceThickness', 'acquisitionDateTime', 'windowLevel'],
  bottomRight: ['zoom', 'coordinates']
}

const systemWindowPresets: WindowTemplatePreset[] = [
  {
    id: 'lung',
    source: 'system',
    ww: 1500,
    wl: -600,
    accent: 'linear-gradient(135deg,#6fd3ff,#f7fbff)',
    labels: {
      'zh-CN': '肺窗',
      'en-US': 'Lung'
    }
  },
  {
    id: 'mediastinum',
    source: 'system',
    ww: 350,
    wl: 40,
    accent: 'linear-gradient(135deg,#ffd0b6,#ff8452)',
    labels: {
      'zh-CN': '纵隔',
      'en-US': 'Mediastinum'
    }
  },
  {
    id: 'bone',
    source: 'system',
    ww: 2000,
    wl: 500,
    accent: 'linear-gradient(135deg,#f7f0d0,#f1b74f)',
    labels: {
      'zh-CN': '骨窗',
      'en-US': 'Bone'
    }
  },
  {
    id: 'brain',
    source: 'system',
    ww: 80,
    wl: 40,
    accent: 'linear-gradient(135deg,#dad7ff,#7686ff)',
    labels: {
      'zh-CN': '脑窗',
      'en-US': 'Brain'
    }
  },
  {
    id: 'abdomen',
    source: 'system',
    ww: 400,
    wl: 50,
    accent: 'linear-gradient(135deg,#fed7aa,#fb7185)',
    labels: {
      'zh-CN': '腹部窗',
      'en-US': 'Abdomen'
    }
  },
  {
    id: 'stroke',
    source: 'system',
    ww: 40,
    wl: 40,
    accent: 'linear-gradient(135deg,#bfdbfe,#38bdf8)',
    labels: {
      'zh-CN': '卒中窗',
      'en-US': 'Stroke'
    }
  },
  {
    id: 'soft-tissue',
    source: 'system',
    ww: 400,
    wl: 40,
    accent: 'linear-gradient(135deg,#fbcfe8,#c084fc)',
    labels: {
      'zh-CN': '软组织窗',
      'en-US': 'Soft Tissue'
    }
  },
  {
    id: 'liver',
    source: 'system',
    ww: 150,
    wl: 30,
    accent: 'linear-gradient(135deg,#fde68a,#f97316)',
    labels: {
      'zh-CN': '肝窗',
      'en-US': 'Liver'
    }
  },
  {
    id: 'cta',
    source: 'system',
    ww: 700,
    wl: 200,
    accent: 'linear-gradient(135deg,#bae6fd,#0ea5e9)',
    labels: {
      'zh-CN': '血管窗',
      'en-US': 'CTA'
    }
  },
  {
    id: 'subdural',
    source: 'system',
    ww: 130,
    wl: 50,
    accent: 'linear-gradient(135deg,#e9d5ff,#8b5cf6)',
    labels: {
      'zh-CN': '硬膜下窗',
      'en-US': 'Subdural'
    }
  }
]

const SYSTEM_WINDOW_PRESET_ZH_LABELS: Record<string, string> = {
  lung: '肺窗',
  bone: '骨窗',
  brain: '脑窗',
  abdomen: '腹部窗',
  mediastinum: '纵隔窗',
  stroke: '卒中窗',
  'soft-tissue': '软组织窗',
  liver: '肝窗',
  cta: '血管窗',
  subdural: '硬膜下窗'
}

function createDefaultCrosshairConfigs(): CrosshairViewportPreference[] {
  return [
    { key: 'mpr-ax', label: 'AX', color: '#ef4444', thickness: 2 },
    { key: 'mpr-cor', label: 'COR', color: '#22c55e', thickness: 2 },
    { key: 'mpr-sag', label: 'SAG', color: '#3b82f6', thickness: 2 }
  ]
}

function createDefaultScaleBarPreference(): ScaleBarPreference {
  return {
    enabled: true,
    color: '#f8fafc'
  }
}

function createDefaultMeasurementStylePreference(): MeasurementStylePreference {
  return {
    editingColor: '#ffb84d',
    completedColor: '#55e7ff',
    lineWidth: 2.5,
    editingLineStyle: 'dash',
    completedLineStyle: 'solid'
  }
}

function createDefaultMprSegmentationStylePreference(): MprSegmentationStylePreference {
  return {
    thresholdColor: DEFAULT_MPR_SEGMENTATION_COLOR,
    voiColor: DEFAULT_MPR_VOI_COLOR
  }
}

function createDefaultExportPreference(): ExportPreference {
  return {
    locationMode: 'default',
    desktopDirectory: null,
    includeDicomAnnotations: true,
    includeDicomMeasurements: true,
    includePngAnnotations: true,
    includePngCornerInfo: true,
    includePngMeasurements: true,
    useDefaultFileName: true,
    webDirectoryName: null
  }
}

function createDefaultDicomTagEditSavePreference(): DicomTagEditSavePreference {
  return {
    locationMode: 'default',
    desktopDirectory: null
  }
}

function createDefaultDicomDeidentifyPreference(): DicomDeidentifyPreference {
  return {
    selectedFieldKeys: [...DEFAULT_DICOM_DEIDENTIFY_FIELD_KEYS],
    replacementPrefix: 'ANON'
  }
}

function createDefaultHangingProtocolRules(): HangingProtocolRule[] {
  return []
}

function createDefaultPacsPreference(): PacsPreference {
  return {
    localSourceEnabled: true,
    enabled: false,
    activeProfileId: 'orthanc-local',
    profiles: [
      {
        id: 'orthanc-local',
        name: 'Orthanc Local',
        enabled: true,
        protocol: 'dicomweb',
        preset: 'orthanc',
        baseUrl: 'http://127.0.0.1:8042',
        qidoPath: '/dicom-web',
        wadoPath: '/dicom-web',
        authType: 'none',
        username: '',
        password: '',
        bearerToken: '',
        host: '127.0.0.1',
        port: 4242,
        calledAeTitle: 'ORTHANC',
        clientAeTitle: 'DICOMVISION',
        queryModel: 'study-root',
        timeoutSeconds: 8
      }
    ]
  }
}

function createDefaultRoiStatOptions(): RoiStatPreference[] {
  return [
    { key: 'mean', label: 'Mean', enabled: true },
    { key: 'max', label: 'Max', enabled: true },
    { key: 'min', label: 'Min', enabled: true },
    { key: 'area', label: 'Area', enabled: true },
    { key: 'stddev', label: 'StdDev', enabled: true },
    { key: 'width', label: 'Width', enabled: true },
    { key: 'height', label: 'Height', enabled: true }
  ]
}

function createDefaultQaWaterMetrics(): QaWaterMetricPreference[] {
  return [
    { key: 'accuracy', label: 'Accuracy', enabled: true },
    { key: 'uniformity', label: 'Uniformity', enabled: true },
    { key: 'noise', label: 'Noise', enabled: true }
  ]
}

function createDefaultState(): UiPreferencesState {
  return {
    version: CURRENT_PREFERENCES_VERSION,
    locale: 'zh-CN',
    themeId: DEFAULT_THEME_ID,
    selectedPseudocolorKey: DEFAULT_PSEUDOCOLOR_KEY,
    mprDefaultLayoutKey: DEFAULT_MPR_LAYOUT_KEY,
    dicomTagDisplayMode: DEFAULT_DICOM_TAG_DISPLAY_MODE,
    selectedWindowPresetId: DEFAULT_WINDOW_PRESET_ID,
    crosshairConfigs: createDefaultCrosshairConfigs(),
    scaleBarPreference: createDefaultScaleBarPreference(),
    viewportCornerInfoPreference: createDefaultViewportCornerInfoPreference(),
    measurementStylePreference: createDefaultMeasurementStylePreference(),
    mprSegmentationStylePreference: createDefaultMprSegmentationStylePreference(),
    dicomTagEditSavePreference: createDefaultDicomTagEditSavePreference(),
    dicomDeidentifyPreference: createDefaultDicomDeidentifyPreference(),
    hangingProtocolRules: createDefaultHangingProtocolRules(),
    pacsPreference: createDefaultPacsPreference(),
    exportPreference: createDefaultExportPreference(),
    qaWaterMetrics: createDefaultQaWaterMetrics(),
    roiStatOptions: createDefaultRoiStatOptions(),
    customWindowPresets: []
  }
}

const state = reactive<UiPreferencesState>(createDefaultState())

let hasHydrated = false
let hydrationPromise: Promise<void> | null = null

function syncDocumentTheme(themeId: string): void {
  if (typeof document === 'undefined') {
    return
  }

  document.documentElement.dataset.theme = themeId
  document.documentElement.style.colorScheme = themeId === 'clinical-light' ? 'light' : 'dark'
}

function createCustomPresetId(): string {
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function createHangingProtocolRuleId(): string {
  return `hp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function normalizeLocale(value: unknown): AppLocale {
  return value === 'en-US' ? 'en-US' : 'zh-CN'
}

function normalizeNumber(value: unknown, fallback: number): number {
  const nextValue =
    typeof value === 'number' ? value : typeof value === 'string' ? Number.parseFloat(value) : Number.NaN
  return Number.isFinite(nextValue) ? nextValue : fallback
}

function normalizeInteger(value: unknown, fallback: number): number {
  return Math.trunc(normalizeNumber(value, fallback))
}

function normalizeLayoutGridSize(value: unknown, fallback: number): number {
  return Math.min(VIEWER_LAYOUT_CUSTOM_GRID_SIZE, Math.max(1, normalizeInteger(value, fallback)))
}

function normalizeAccent(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value : 'linear-gradient(135deg,#7dd3fc,#f8fafc)'
}

function normalizeLabel(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function normalizeThemeId(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value : DEFAULT_THEME_ID
}

function normalizePseudocolorKey(value: unknown): string {
  if (typeof value !== 'string') {
    return DEFAULT_PSEUDOCOLOR_KEY
  }

  return PSEUDOCOLOR_PRESET_OPTIONS.some((option) => option.key === value) ? value : DEFAULT_PSEUDOCOLOR_KEY
}

function normalizeCrosshairConfigs(value: unknown): CrosshairViewportPreference[] {
  const defaults = createDefaultCrosshairConfigs()
  const parsed = Array.isArray(value) ? value : []

  return defaults.map((defaultItem) => {
    const matched = parsed.find((item) => item && typeof item === 'object' && (item as { key?: unknown }).key === defaultItem.key) as
      | Partial<CrosshairViewportPreference>
      | undefined

    return {
      key: defaultItem.key,
      label: defaultItem.label,
      color: typeof matched?.color === 'string' && matched.color.trim() ? matched.color : defaultItem.color,
      thickness: Math.min(4, Math.max(1, normalizeNumber(matched?.thickness, defaultItem.thickness)))
    }
  })
}

function normalizeScaleBarPreference(value: unknown): ScaleBarPreference {
  const defaults = createDefaultScaleBarPreference()
  const record = value && typeof value === 'object' ? (value as Partial<ScaleBarPreference>) : null

  return {
    enabled: typeof record?.enabled === 'boolean' ? record.enabled : defaults.enabled,
    color: typeof record?.color === 'string' && record.color.trim() ? record.color : defaults.color
  }
}

function normalizeDicomTagDisplayMode(value: unknown): DicomTagDisplayMode {
  return value === 'flat' || value === 'tree' ? value : DEFAULT_DICOM_TAG_DISPLAY_MODE
}

function normalizeDicomTagEditSavePreference(value: unknown): DicomTagEditSavePreference {
  const defaults = createDefaultDicomTagEditSavePreference()
  const record = value && typeof value === 'object' ? (value as Partial<DicomTagEditSavePreference>) : null

  return {
    locationMode: record?.locationMode === 'custom' ? 'custom' : defaults.locationMode,
    desktopDirectory:
      typeof record?.desktopDirectory === 'string' && record.desktopDirectory.trim() ? record.desktopDirectory.trim() : null
  }
}

function normalizeDicomDeidentifyPreference(value: unknown): DicomDeidentifyPreference {
  const defaults = createDefaultDicomDeidentifyPreference()
  const record = value && typeof value === 'object' ? (value as Partial<DicomDeidentifyPreference>) : null
  const hasStoredSelection = Array.isArray(record?.selectedFieldKeys)
  const selectedFieldKeys = hasStoredSelection
    ? Array.from(
        new Set(
          record.selectedFieldKeys?.filter((item): item is DicomDeidentifyFieldKey =>
            typeof item === 'string' && DICOM_DEIDENTIFY_FIELD_KEY_SET.has(item as DicomDeidentifyFieldKey)
          ) ?? []
        )
      )
    : defaults.selectedFieldKeys
  const replacementPrefix =
    typeof record?.replacementPrefix === 'string' && record.replacementPrefix.trim()
      ? record.replacementPrefix.trim().slice(0, 24)
      : defaults.replacementPrefix

  return {
    selectedFieldKeys,
    replacementPrefix
  }
}

function normalizeMprDefaultLayoutKey(value: unknown): MprDefaultLayoutKey {
  return isMprLayoutKey(value) ? value : DEFAULT_MPR_LAYOUT_KEY
}

function normalizeHangingProtocolModality(value: unknown): string {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : ''
  if (!normalized || normalized === 'ANY' || normalized === '*') {
    return 'ALL'
  }
  return normalized.replace(/[^A-Z0-9_-]/g, '').slice(0, 12) || 'ALL'
}

function normalizeHangingProtocolRules(value: unknown): HangingProtocolRule[] {
  if (!Array.isArray(value)) {
    return createDefaultHangingProtocolRules()
  }

  return value.slice(0, MAX_HANGING_PROTOCOL_RULES).map((item, index) => {
    const record = item && typeof item === 'object' ? (item as Partial<HangingProtocolRule>) : {}
    const rows = normalizeLayoutGridSize(record.rows, 1)
    const columns = normalizeLayoutGridSize(record.columns, 1)
    const name =
      typeof record.name === 'string' && record.name.trim()
        ? record.name.trim().slice(0, 48)
        : `Protocol ${index + 1}`
    return {
      id: typeof record.id === 'string' && record.id.trim() ? record.id.trim() : `loaded-hp-${index}`,
      name,
      enabled: typeof record.enabled === 'boolean' ? record.enabled : true,
      modality: normalizeHangingProtocolModality(record.modality),
      seriesDescriptionKeyword:
        typeof record.seriesDescriptionKeyword === 'string'
          ? record.seriesDescriptionKeyword.trim().slice(0, 64)
          : '',
      rows,
      columns
    }
  })
}

function normalizePacsAuthType(value: unknown): PacsAuthType {
  return value === 'basic' || value === 'bearer' ? value : 'none'
}

function normalizePacsProtocol(value: unknown): PacsProtocol {
  return value === 'dimse' ? 'dimse' : 'dicomweb'
}

function normalizePacsProfilePreset(value: unknown): PacsProfilePreset {
  return value === 'orthanc' || value === 'dcm4chee' ? value : 'custom'
}

function normalizeDimseQueryModel(value: unknown): DimseQueryModel {
  return value === 'patient-root' ? 'patient-root' : 'study-root'
}

function normalizePacsPath(value: unknown, fallback: string): string {
  const normalized = typeof value === 'string' && value.trim() ? value.trim() : fallback
  return normalized.startsWith('/') ? normalized : `/${normalized}`
}

function normalizeAeTitle(value: unknown, fallback: string): string {
  const normalized = typeof value === 'string' && value.trim() ? value.trim().toUpperCase() : fallback
  return normalized.replace(/[^A-Z0-9 _-]/g, '').slice(0, 16) || fallback
}

function normalizePacsHost(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 255) : fallback
}

function normalizePacsPort(value: unknown, fallback: number): number {
  const port = normalizeInteger(value, fallback)
  return Math.min(65535, Math.max(1, port))
}

function normalizePacsProfile(value: unknown, index: number): PacsDicomwebProfile {
  const defaults = createDefaultPacsPreference().profiles[0]!
  const record = value && typeof value === 'object' ? (value as Partial<PacsDicomwebProfile>) : {}
  const fallbackId = index === 0 ? defaults.id : `pacs-${index + 1}`
  const id = typeof record.id === 'string' && record.id.trim() ? record.id.trim() : fallbackId
  return {
    id,
    name: typeof record.name === 'string' && record.name.trim() ? record.name.trim().slice(0, 48) : `PACS ${index + 1}`,
    enabled: typeof record.enabled === 'boolean' ? record.enabled : true,
    protocol: normalizePacsProtocol(record.protocol),
    preset: normalizePacsProfilePreset(record.preset),
    baseUrl:
      typeof record.baseUrl === 'string' && record.baseUrl.trim() ? record.baseUrl.trim().replace(/\/+$/, '') : defaults.baseUrl,
    qidoPath: normalizePacsPath(record.qidoPath, defaults.qidoPath),
    wadoPath: normalizePacsPath(record.wadoPath, defaults.wadoPath),
    authType: normalizePacsAuthType(record.authType),
    username: typeof record.username === 'string' ? record.username.slice(0, 128) : '',
    password: typeof record.password === 'string' ? record.password.slice(0, 256) : '',
    bearerToken: typeof record.bearerToken === 'string' ? record.bearerToken.slice(0, 512) : '',
    host: normalizePacsHost(record.host, defaults.host),
    port: normalizePacsPort(record.port, defaults.port),
    calledAeTitle: normalizeAeTitle(record.calledAeTitle, defaults.calledAeTitle),
    clientAeTitle: normalizeAeTitle(record.clientAeTitle, defaults.clientAeTitle),
    queryModel: normalizeDimseQueryModel(record.queryModel),
    timeoutSeconds: Math.min(60, Math.max(1, normalizeNumber(record.timeoutSeconds, defaults.timeoutSeconds)))
  }
}

function normalizePacsPreference(value: unknown): PacsPreference {
  const defaults = createDefaultPacsPreference()
  const record = value && typeof value === 'object' ? (value as Partial<PacsPreference>) : null
  const parsedProfiles = Array.isArray(record?.profiles) ? record.profiles : defaults.profiles
  const profileMap = new Map<string, PacsDicomwebProfile>()
  parsedProfiles.slice(0, 12).forEach((item, index) => {
    const profile = normalizePacsProfile(item, index)
    profileMap.set(profile.id, profile)
  })
  const profiles = [...profileMap.values()]
  const activeProfileId =
    typeof record?.activeProfileId === 'string' && profiles.some((profile) => profile.id === record.activeProfileId)
      ? record.activeProfileId
      : profiles[0]?.id ?? defaults.activeProfileId

  return {
    localSourceEnabled: typeof record?.localSourceEnabled === 'boolean' ? record.localSourceEnabled : defaults.localSourceEnabled,
    enabled: typeof record?.enabled === 'boolean' ? record.enabled : defaults.enabled,
    activeProfileId,
    profiles: profiles.length ? profiles : defaults.profiles
  }
}

function normalizeHexColor(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback
  }

  const normalized = value.trim()
  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized : fallback
}

function normalizeMeasurementLineStyle(value: unknown, fallback: MeasurementLineStyle): MeasurementLineStyle {
  return value === 'dash' || value === 'solid' ? value : fallback
}

function normalizeMeasurementStylePreference(value: unknown): MeasurementStylePreference {
  const defaults = createDefaultMeasurementStylePreference()
  const record = value && typeof value === 'object' ? (value as Partial<MeasurementStylePreference>) : null

  return {
    editingColor: normalizeHexColor(record?.editingColor, defaults.editingColor),
    completedColor: normalizeHexColor(record?.completedColor, defaults.completedColor),
    lineWidth: Math.min(6, Math.max(1.5, normalizeNumber(record?.lineWidth, defaults.lineWidth))),
    editingLineStyle: normalizeMeasurementLineStyle(record?.editingLineStyle, defaults.editingLineStyle),
    completedLineStyle: normalizeMeasurementLineStyle(record?.completedLineStyle, defaults.completedLineStyle)
  }
}

function normalizeMprSegmentationStylePreference(value: unknown): MprSegmentationStylePreference {
  const defaults = createDefaultMprSegmentationStylePreference()
  const record = value && typeof value === 'object' ? (value as Partial<MprSegmentationStylePreference>) : null

  return {
    thresholdColor: normalizeHexColor(record?.thresholdColor, defaults.thresholdColor),
    voiColor: normalizeHexColor(record?.voiColor, defaults.voiColor)
  }
}

function normalizeExportPreference(value: unknown): ExportPreference {
  const defaults = createDefaultExportPreference()
  const record = value && typeof value === 'object'
    ? (value as Partial<ExportPreference> & { includeDicomOverlays?: unknown; includePngOverlays?: unknown })
    : null
  const legacyDicomOverlays = typeof record?.includeDicomOverlays === 'boolean' ? record.includeDicomOverlays : defaults.includeDicomMeasurements
  const legacyPngOverlays = typeof record?.includePngOverlays === 'boolean' ? record.includePngOverlays : defaults.includePngMeasurements

  return {
    locationMode: record?.locationMode === 'custom' ? 'custom' : defaults.locationMode,
    desktopDirectory:
      typeof record?.desktopDirectory === 'string' && record.desktopDirectory.trim() ? record.desktopDirectory.trim() : null,
    includeDicomAnnotations:
      typeof record?.includeDicomAnnotations === 'boolean' ? record.includeDicomAnnotations : legacyDicomOverlays,
    includeDicomMeasurements:
      typeof record?.includeDicomMeasurements === 'boolean' ? record.includeDicomMeasurements : legacyDicomOverlays,
    includePngAnnotations:
      typeof record?.includePngAnnotations === 'boolean' ? record.includePngAnnotations : legacyPngOverlays,
    includePngCornerInfo:
      typeof record?.includePngCornerInfo === 'boolean' ? record.includePngCornerInfo : defaults.includePngCornerInfo,
    includePngMeasurements:
      typeof record?.includePngMeasurements === 'boolean' ? record.includePngMeasurements : legacyPngOverlays,
    useDefaultFileName:
      typeof record?.useDefaultFileName === 'boolean' ? record.useDefaultFileName : defaults.useDefaultFileName,
    webDirectoryName:
      typeof record?.webDirectoryName === 'string' && record.webDirectoryName.trim() ? record.webDirectoryName.trim() : null
  }
}

function migrateCrosshairConfigs(version: number, value: CrosshairViewportPreference[]): CrosshairViewportPreference[] {
  let nextValue = value

  if (version < 3) {
    const defaults = createDefaultCrosshairConfigs()
    nextValue = nextValue.map((item) => {
      const defaultItem = defaults.find((candidate) => candidate.key === item.key) ?? item
      const legacyColor = LEGACY_CROSSHAIR_COLORS[item.key]
      return {
        ...item,
        color: item.color.toLowerCase() === legacyColor.toLowerCase() ? defaultItem.color : item.color
      }
    })
  }

  if (version < 5) {
    const defaults = createDefaultCrosshairConfigs()
    nextValue = nextValue.map((item) => {
      const defaultItem = defaults.find((candidate) => candidate.key === item.key) ?? item
      const previousColor = PREVIOUS_DEFAULT_CROSSHAIR_COLORS[item.key]
      return {
        ...item,
        color: item.color.toLowerCase() === previousColor.toLowerCase() ? defaultItem.color : item.color
      }
    })
  }

  return nextValue
}

function areStringArraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function areViewportCornerInfoPreferencesEqual(
  left: ViewportCornerInfoPreference,
  right: ViewportCornerInfoPreference
): boolean {
  return (
    areStringArraysEqual(left.topLeft, right.topLeft) &&
    areStringArraysEqual(left.topRight, right.topRight) &&
    areStringArraysEqual(left.bottomLeft, right.bottomLeft) &&
    areStringArraysEqual(left.bottomRight, right.bottomRight)
  )
}

function migrateViewportCornerInfoPreference(
  version: number,
  value: ViewportCornerInfoPreference
): ViewportCornerInfoPreference {
  if (version >= 15 || !areViewportCornerInfoPreferencesEqual(value, PREVIOUS_DEFAULT_VIEWPORT_CORNER_INFO_PREFERENCE)) {
    return value
  }
  return createDefaultViewportCornerInfoPreference()
}

function normalizeRoiStatOptions(value: unknown): RoiStatPreference[] {
  const defaults = createDefaultRoiStatOptions()
  const parsed = Array.isArray(value) ? value : []

  return defaults.map((defaultItem) => {
    const matched = parsed.find((item) => item && typeof item === 'object' && (item as { key?: unknown }).key === defaultItem.key) as
      | Partial<RoiStatPreference>
      | undefined

    return {
      key: defaultItem.key,
      label: defaultItem.label,
      enabled: typeof matched?.enabled === 'boolean' ? matched.enabled : defaultItem.enabled
    }
  })
}

function normalizeQaWaterMetrics(value: unknown): QaWaterMetricPreference[] {
  const defaults = createDefaultQaWaterMetrics()
  const parsed = Array.isArray(value) ? value : []

  return defaults.map((defaultItem) => {
    const matched = parsed.find((item) => item && typeof item === 'object' && (item as { key?: unknown }).key === defaultItem.key) as
      | Partial<QaWaterMetricPreference>
      | undefined

    return {
      key: defaultItem.key,
      label: defaultItem.label,
      enabled: typeof matched?.enabled === 'boolean' ? matched.enabled : defaultItem.enabled
    }
  })
}

function normalizeCustomWindowPresets(value: unknown): StoredCustomWindowPreset[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.slice(0, MAX_CUSTOM_WINDOW_PRESETS).map((item, index) => ({
    id: typeof item?.id === 'string' && item.id.trim() ? item.id : `custom-loaded-${index}`,
    ww: normalizeNumber(item?.ww, 400),
    wl: normalizeNumber(item?.wl, 40),
    accent: normalizeAccent(item?.accent),
    labels: {
      'zh-CN': normalizeLabel(item?.labels?.['zh-CN'], '自定义窗模板'),
      'en-US': normalizeLabel(item?.labels?.['en-US'], 'Custom Window')
    }
  }))
}

function normalizeWindowPresetId(value: unknown, customWindowPresets: StoredCustomWindowPreset[]): string {
  if (typeof value !== 'string' || !value.trim()) {
    return DEFAULT_WINDOW_PRESET_ID
  }

  const isKnownSystemPreset = systemWindowPresets.some((preset) => preset.id === value)
  const isKnownCustomPreset = customWindowPresets.some((preset) => preset.id === value)
  return isKnownSystemPreset || isKnownCustomPreset ? value : DEFAULT_WINDOW_PRESET_ID
}

function applyState(nextState: UiPreferencesState): void {
  state.version = nextState.version
  state.locale = nextState.locale
  state.themeId = nextState.themeId
  state.selectedPseudocolorKey = nextState.selectedPseudocolorKey
  state.mprDefaultLayoutKey = nextState.mprDefaultLayoutKey
  state.dicomTagDisplayMode = nextState.dicomTagDisplayMode
  state.selectedWindowPresetId = nextState.selectedWindowPresetId
  state.crosshairConfigs = nextState.crosshairConfigs
  state.scaleBarPreference = nextState.scaleBarPreference
  state.viewportCornerInfoPreference = nextState.viewportCornerInfoPreference
  state.measurementStylePreference = nextState.measurementStylePreference
  state.mprSegmentationStylePreference = nextState.mprSegmentationStylePreference
  state.dicomTagEditSavePreference = nextState.dicomTagEditSavePreference
  state.dicomDeidentifyPreference = nextState.dicomDeidentifyPreference
  state.hangingProtocolRules = nextState.hangingProtocolRules
  state.pacsPreference = nextState.pacsPreference
  state.exportPreference = nextState.exportPreference
  state.qaWaterMetrics = nextState.qaWaterMetrics
  state.roiStatOptions = nextState.roiStatOptions
  state.customWindowPresets = nextState.customWindowPresets
  syncDocumentTheme(nextState.themeId)
}

function serializeState(): UiPreferencesState {
  return {
    version: CURRENT_PREFERENCES_VERSION,
    locale: state.locale,
    themeId: state.themeId,
    selectedPseudocolorKey: state.selectedPseudocolorKey,
    mprDefaultLayoutKey: state.mprDefaultLayoutKey,
    dicomTagDisplayMode: state.dicomTagDisplayMode,
    selectedWindowPresetId: state.selectedWindowPresetId,
    crosshairConfigs: state.crosshairConfigs.map((item) => ({ ...item })),
    scaleBarPreference: {
      enabled: state.scaleBarPreference.enabled,
      color: state.scaleBarPreference.color
    },
    viewportCornerInfoPreference: {
      topLeft: [...state.viewportCornerInfoPreference.topLeft],
      topRight: [...state.viewportCornerInfoPreference.topRight],
      bottomLeft: [...state.viewportCornerInfoPreference.bottomLeft],
      bottomRight: [...state.viewportCornerInfoPreference.bottomRight]
    },
    measurementStylePreference: {
      editingColor: state.measurementStylePreference.editingColor,
      completedColor: state.measurementStylePreference.completedColor,
      lineWidth: state.measurementStylePreference.lineWidth,
      editingLineStyle: state.measurementStylePreference.editingLineStyle,
      completedLineStyle: state.measurementStylePreference.completedLineStyle
    },
    mprSegmentationStylePreference: {
      thresholdColor: state.mprSegmentationStylePreference.thresholdColor,
      voiColor: state.mprSegmentationStylePreference.voiColor
    },
    dicomTagEditSavePreference: {
      locationMode: state.dicomTagEditSavePreference.locationMode,
      desktopDirectory: state.dicomTagEditSavePreference.desktopDirectory
    },
    dicomDeidentifyPreference: {
      selectedFieldKeys: [...state.dicomDeidentifyPreference.selectedFieldKeys],
      replacementPrefix: state.dicomDeidentifyPreference.replacementPrefix
    },
    hangingProtocolRules: state.hangingProtocolRules.map((item) => ({ ...item })),
    pacsPreference: {
      localSourceEnabled: state.pacsPreference.localSourceEnabled,
      enabled: state.pacsPreference.enabled,
      activeProfileId: state.pacsPreference.activeProfileId,
      profiles: state.pacsPreference.profiles.map((item) => ({ ...item }))
    },
    exportPreference: {
      locationMode: state.exportPreference.locationMode,
      desktopDirectory: state.exportPreference.desktopDirectory,
      includeDicomAnnotations: state.exportPreference.includeDicomAnnotations,
      includeDicomMeasurements: state.exportPreference.includeDicomMeasurements,
      includePngAnnotations: state.exportPreference.includePngAnnotations,
      includePngCornerInfo: state.exportPreference.includePngCornerInfo,
      includePngMeasurements: state.exportPreference.includePngMeasurements,
      useDefaultFileName: state.exportPreference.useDefaultFileName,
      webDirectoryName: state.exportPreference.webDirectoryName
    },
    qaWaterMetrics: state.qaWaterMetrics.map((item) => ({ ...item })),
    roiStatOptions: state.roiStatOptions.map((item) => ({ ...item })),
    customWindowPresets: state.customWindowPresets.map((item) => ({
      id: item.id,
      ww: item.ww,
      wl: item.wl,
      accent: item.accent,
      labels: {
        'zh-CN': item.labels['zh-CN'],
        'en-US': item.labels['en-US']
      }
    }))
  }
}

async function persistState(): Promise<void> {
  if (!hasHydrated) {
    return
  }

  try {
    await saveUiPreferencesToStorage(serializeState())
  } catch (error) {
    console.error('Failed to save UI preferences.', error)
  }
}

async function hydrateState(): Promise<void> {
  if (hasHydrated) {
    return
  }
  if (hydrationPromise) {
    return hydrationPromise
  }

  hydrationPromise = (async () => {
    try {
      const raw = await loadUiPreferencesFromStorage()
      if (!raw || typeof raw !== 'object') {
        return
      }

      const parsed = raw as Partial<UiPreferencesState> | null
      if (!parsed) {
        return
      }

      const storedVersion = Math.floor(normalizeNumber(parsed.version, 0))
      const customWindowPresets = normalizeCustomWindowPresets(parsed.customWindowPresets)
      applyState({
        version: CURRENT_PREFERENCES_VERSION,
        locale: normalizeLocale(parsed.locale),
        themeId: normalizeThemeId(parsed.themeId),
        selectedPseudocolorKey: normalizePseudocolorKey(parsed.selectedPseudocolorKey),
        mprDefaultLayoutKey: normalizeMprDefaultLayoutKey(parsed.mprDefaultLayoutKey),
        dicomTagDisplayMode: normalizeDicomTagDisplayMode(parsed.dicomTagDisplayMode),
        selectedWindowPresetId: normalizeWindowPresetId(parsed.selectedWindowPresetId, customWindowPresets),
        crosshairConfigs: migrateCrosshairConfigs(storedVersion, normalizeCrosshairConfigs(parsed.crosshairConfigs)),
        scaleBarPreference: normalizeScaleBarPreference(parsed.scaleBarPreference),
        viewportCornerInfoPreference: migrateViewportCornerInfoPreference(
          storedVersion,
          normalizeViewportCornerInfoPreference(parsed.viewportCornerInfoPreference)
        ),
        measurementStylePreference: normalizeMeasurementStylePreference(parsed.measurementStylePreference),
        mprSegmentationStylePreference: normalizeMprSegmentationStylePreference(parsed.mprSegmentationStylePreference),
        dicomTagEditSavePreference: normalizeDicomTagEditSavePreference(parsed.dicomTagEditSavePreference),
        dicomDeidentifyPreference: normalizeDicomDeidentifyPreference(parsed.dicomDeidentifyPreference),
        hangingProtocolRules: normalizeHangingProtocolRules(parsed.hangingProtocolRules),
        pacsPreference: normalizePacsPreference(parsed.pacsPreference),
        exportPreference: normalizeExportPreference(parsed.exportPreference),
        qaWaterMetrics: normalizeQaWaterMetrics(parsed.qaWaterMetrics),
        roiStatOptions: normalizeRoiStatOptions(parsed.roiStatOptions),
        customWindowPresets
      })
    } catch (error) {
      console.error('Failed to load UI preferences.', error)
    } finally {
      hasHydrated = true
    }
  })()

  return hydrationPromise
}

void hydrateState()

syncDocumentTheme(state.themeId)

watch(
  () => serializeState(),
  () => {
    void persistState()
  },
  { deep: true }
)

watch(
  () => state.themeId,
  (value) => {
    syncDocumentTheme(value)
  },
  { immediate: true }
)

export function useUiPreferences() {
  const windowPresets = computed<WindowTemplatePreset[]>(() => [
    ...systemWindowPresets,
    ...state.customWindowPresets.map((item) => ({
      ...item,
      source: 'custom' as const
    }))
  ])

  const locale = computed(() => state.locale)
  const themeId = computed({
    get: () => state.themeId,
    set: (value: string) => {
      state.themeId = normalizeThemeId(value)
      void persistState()
    }
  })
  const selectedPseudocolorKey = computed({
    get: () => state.selectedPseudocolorKey,
    set: (value: string) => {
      state.selectedPseudocolorKey = normalizePseudocolorKey(value)
      void persistState()
    }
  })
  const mprDefaultLayoutKey = computed({
    get: () => state.mprDefaultLayoutKey,
    set: (value: MprDefaultLayoutKey) => {
      state.mprDefaultLayoutKey = normalizeMprDefaultLayoutKey(value)
      void persistState()
    }
  })
  const dicomTagDisplayMode = computed({
    get: () => state.dicomTagDisplayMode,
    set: (value: DicomTagDisplayMode) => {
      state.dicomTagDisplayMode = normalizeDicomTagDisplayMode(value)
      void persistState()
    }
  })
  const selectedWindowPresetId = computed({
    get: () => state.selectedWindowPresetId,
    set: (value: string) => {
      state.selectedWindowPresetId = normalizeWindowPresetId(value, state.customWindowPresets)
      void persistState()
    }
  })

  function setLocale(locale: AppLocale): void {
    state.locale = locale
    void persistState()
  }

  function setMprDefaultLayoutKey(value: MprDefaultLayoutKey): void {
    state.mprDefaultLayoutKey = normalizeMprDefaultLayoutKey(value)
    void persistState()
  }

  function addCustomWindowPreset(input: {
    zhName: string
    enName: string
    ww: number
    wl: number
    accent?: string
  }): string {
    if (state.customWindowPresets.length >= MAX_CUSTOM_WINDOW_PRESETS) {
      return state.customWindowPresets[state.customWindowPresets.length - 1]?.id ?? DEFAULT_WINDOW_PRESET_ID
    }

    const presetId = createCustomPresetId()
    state.customWindowPresets = [
      ...state.customWindowPresets,
      {
        id: presetId,
        ww: normalizeNumber(input.ww, 400),
        wl: normalizeNumber(input.wl, 40),
        accent: normalizeAccent(input.accent),
        labels: {
          'zh-CN': normalizeLabel(input.zhName, '自定义窗模板'),
          'en-US': normalizeLabel(input.enName, 'Custom Window')
        }
      }
    ]
    state.selectedWindowPresetId = presetId
    void persistState()
    return presetId
  }

  function removeCustomWindowPreset(id: string): void {
    state.customWindowPresets = state.customWindowPresets.filter((item) => item.id !== id)
    if (state.selectedWindowPresetId === id) {
      state.selectedWindowPresetId = DEFAULT_WINDOW_PRESET_ID
    }
    void persistState()
  }

  function setCrosshairConfigs(nextValue: CrosshairViewportPreference[]): void {
    state.crosshairConfigs = normalizeCrosshairConfigs(nextValue)
    void persistState()
  }

  function setScaleBarPreference(nextValue: ScaleBarPreference): void {
    state.scaleBarPreference = normalizeScaleBarPreference(nextValue)
    void persistState()
  }

  function setViewportCornerInfoPreference(nextValue: ViewportCornerInfoPreference): void {
    state.viewportCornerInfoPreference = normalizeViewportCornerInfoPreference(nextValue)
    void persistState()
  }

  function setMeasurementStylePreference(nextValue: MeasurementStylePreference): void {
    state.measurementStylePreference = normalizeMeasurementStylePreference(nextValue)
    void persistState()
  }

  function setMprSegmentationStylePreference(nextValue: MprSegmentationStylePreference): void {
    state.mprSegmentationStylePreference = normalizeMprSegmentationStylePreference(nextValue)
    void persistState()
  }

  function setDicomTagEditSavePreference(nextValue: DicomTagEditSavePreference): void {
    state.dicomTagEditSavePreference = normalizeDicomTagEditSavePreference(nextValue)
    void persistState()
  }

  function setDicomDeidentifyPreference(nextValue: DicomDeidentifyPreference): void {
    state.dicomDeidentifyPreference = normalizeDicomDeidentifyPreference(nextValue)
    void persistState()
  }

  function setHangingProtocolRules(nextValue: HangingProtocolRule[]): void {
    state.hangingProtocolRules = normalizeHangingProtocolRules(nextValue)
    void persistState()
  }

  function setPacsPreference(nextValue: PacsPreference): void {
    state.pacsPreference = normalizePacsPreference(nextValue)
    void persistState()
  }

  function addHangingProtocolRule(input: Omit<HangingProtocolRule, 'id'>): string {
    if (state.hangingProtocolRules.length >= MAX_HANGING_PROTOCOL_RULES) {
      return state.hangingProtocolRules[state.hangingProtocolRules.length - 1]?.id ?? ''
    }

    const id = createHangingProtocolRuleId()
    state.hangingProtocolRules = normalizeHangingProtocolRules([
      ...state.hangingProtocolRules,
      {
        ...input,
        id
      }
    ])
    void persistState()
    return id
  }

  function updateHangingProtocolRule(id: string, patch: Partial<Omit<HangingProtocolRule, 'id'>>): void {
    state.hangingProtocolRules = normalizeHangingProtocolRules(
      state.hangingProtocolRules.map((rule) => (rule.id === id ? { ...rule, ...patch, id } : rule))
    )
    void persistState()
  }

  function removeHangingProtocolRule(id: string): void {
    state.hangingProtocolRules = state.hangingProtocolRules.filter((rule) => rule.id !== id)
    void persistState()
  }

  function setExportPreference(nextValue: ExportPreference): void {
    state.exportPreference = normalizeExportPreference(nextValue)
    void persistState()
  }

  function setRoiStatOptions(nextValue: RoiStatPreference[]): void {
    state.roiStatOptions = normalizeRoiStatOptions(nextValue)
    void persistState()
  }

  function removeCustomWindowPresets(ids: string[]): void {
    const idSet = new Set(ids)
    if (!idSet.size) {
      return
    }

    state.customWindowPresets = state.customWindowPresets.filter((item) => !idSet.has(item.id))
    if (idSet.has(state.selectedWindowPresetId)) {
      state.selectedWindowPresetId = DEFAULT_WINDOW_PRESET_ID
    }
    void persistState()
  }

  function setQaWaterMetrics(nextValue: QaWaterMetricPreference[]): void {
    state.qaWaterMetrics = normalizeQaWaterMetrics(nextValue)
    void persistState()
  }

  function getWindowPresetLabel(preset: WindowTemplatePreset): string {
    if (state.locale === 'zh-CN' && preset.source === 'system') {
      return SYSTEM_WINDOW_PRESET_ZH_LABELS[preset.id] ?? preset.labels[state.locale]
    }
    return preset.labels[state.locale]
  }

  return {
    customWindowPresets: computed(() => state.customWindowPresets),
    crosshairConfigs: computed(() => state.crosshairConfigs),
    dicomDeidentifyPreference: computed(() => state.dicomDeidentifyPreference),
    dicomTagEditSavePreference: computed(() => state.dicomTagEditSavePreference),
    getWindowPresetLabel,
    locale,
    dicomTagDisplayMode,
    exportPreference: computed(() => state.exportPreference),
    hangingProtocolRules: computed(() => state.hangingProtocolRules),
    measurementStylePreference: computed(() => state.measurementStylePreference),
    mprSegmentationStylePreference: computed(() => state.mprSegmentationStylePreference),
    mprDefaultLayoutKey,
    pacsPreference: computed(() => state.pacsPreference),
    qaWaterMetrics: computed(() => state.qaWaterMetrics),
    roiStatOptions: computed(() => state.roiStatOptions),
    scaleBarPreference: computed(() => state.scaleBarPreference),
    viewportCornerInfoPreference: computed(() => state.viewportCornerInfoPreference),
    selectedPseudocolorKey,
    selectedWindowPresetId,
    setCrosshairConfigs,
    setDicomDeidentifyPreference,
    setDicomTagEditSavePreference,
    setExportPreference,
    setHangingProtocolRules,
    setPacsPreference,
    setLocale,
    setMeasurementStylePreference,
    setMprSegmentationStylePreference,
    setMprDefaultLayoutKey,
    setQaWaterMetrics,
    setScaleBarPreference,
    setViewportCornerInfoPreference,
    setRoiStatOptions,
    addCustomWindowPreset,
    removeCustomWindowPreset,
    removeCustomWindowPresets,
    addHangingProtocolRule,
    updateHangingProtocolRule,
    removeHangingProtocolRule,
    systemWindowPresets,
    themeId,
    windowPresets
  }
}
