<script setup lang="ts">
import { computed, ref } from 'vue'
import AppIcon from '../../components/AppIcon.vue'
import { toApiPacsDicomwebProfile, toApiPacsDimseProfile } from '../../composables/pacs/pacsProfileApi'
import {
  createPacsProfile,
  pacsAuthLabel,
  pacsPresetLabel,
  pacsProfileEndpoint,
  pacsProfilePresetConnectionPatch
} from '../../composables/pacs/pacsProfileUtils'
import { PSEUDOCOLOR_PRESET_OPTIONS, getPseudocolorGradient } from '../../constants/pseudocolor'
import {
  useUiPreferences,
  type AppLocale,
  type CrosshairViewportPreference,
  type DrawingScopePreference,
  type ExportPreference,
  type MeasurementLineStyle,
  type MeasurementStylePreference,
  type PacsAuthType,
  type PacsDicomwebProfile,
  type PacsPreference,
  type PacsProfilePreset,
  type RoiStatPreference,
  type ScaleBarPreference
} from '../../composables/ui/useUiPreferences'
import {
  createDefaultViewportCornerInfoPreference,
  normalizeViewportCornerInfoPreference,
  type ViewportCornerInfoColorMode,
  type ViewportCornerInfoPreference,
  type ViewportCornerInfoTypographyPreset
} from '../../composables/ui/viewportCornerInfo'
import type { DrawingScope, MprViewportKey } from '../../types/viewer'
import {
  MOBILE_GESTURE_SENSITIVITY_OPTIONS,
  MOBILE_ORIENTATION_LOCK_OPTIONS,
  type MobileGestureSensitivity,
  type MobileMprDefaultTool,
  type MobileOrientationLock,
  type MobileStackDefaultTool,
  type MobileVolumeDefaultTool,
  useMobileViewerPreferences
} from './useMobileViewerPreferences'

defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  close: []
  orientationLockRequest: [lock: MobileOrientationLock]
}>()

const {
  crosshairConfigs,
  exportPreference,
  getWindowPresetLabel,
  drawingScopePreference,
  locale,
  measurementStylePreference,
  pacsPreference,
  roiStatOptions,
  scaleBarPreference,
  selectedPseudocolorKey,
  selectedWindowPresetId,
  viewportCornerInfoPreference,
  setCrosshairConfigs,
  setExportPreference,
  setDrawingScopePreference,
  setLocale,
  setMeasurementStylePreference,
  setPacsPreference,
  setRoiStatOptions,
  setScaleBarPreference,
  setViewportCornerInfoPreference,
  themeId,
  windowPresets
} = useUiPreferences()
const {
  defaultShowCornerInfo,
  defaultShowPseudocolorBar,
  defaultShowScaleBar,
  gestureSensitivity,
  mprDefaultTool,
  mprDefaultViewport,
  mprShowReferenceThumbnails,
  orientationLock,
  stackDefaultTool,
  volumeDefaultTool,
  setDefaultShowCornerInfo,
  setDefaultShowPseudocolorBar,
  setDefaultShowScaleBar,
  setGestureSensitivity,
  setMprDefaultTool,
  setMprDefaultViewport,
  setMprShowReferenceThumbnails,
  setOrientationLock,
  setStackDefaultTool,
  setVolumeDefaultTool
} = useMobileViewerPreferences()
let typedApiModulePromise: Promise<typeof import('../../services/typedApi')> | null = null

function loadTypedApi(): Promise<typeof import('../../services/typedApi')> {
  typedApiModulePromise ??= import('../../services/typedApi')
  return typedApiModulePromise
}

type MobileSettingsPanelKey =
  | 'interface'
  | 'reading'
  | 'windowColor'
  | 'mpr'
  | 'display'
  | 'overlays'
  | 'measurements'
  | 'dicomExport'
  | 'pacs'
  | 'playback'

interface ThemeOption {
  accent: string
  id: string
  panel: string
  rail: string
  surface: string
  text: string
  zh: string
  en: string
}

interface ColorPreset {
  value: string
  label: string
}

interface MobileCornerInfoTypographyOption {
  value: ViewportCornerInfoTypographyPreset
  zh: string
  en: string
}

interface MobileCornerInfoColorModeOption {
  value: ViewportCornerInfoColorMode
  zh: string
  en: string
}

interface MobileDefaultToolOption<T extends string> {
  key: T
  icon: string
  zh: string
  en: string
}

type PacsTestResult = { ok: boolean; message: string }

const isZh = computed(() => locale.value === 'zh-CN')
const defaultDrawingScopePreference: DrawingScopePreference = {
  measurement: 'image',
  annotation: 'image',
  qaWater: 'image',
  mtf: 'image'
}
const safeDrawingScopePreference = computed<DrawingScopePreference>(() => ({
  ...defaultDrawingScopePreference,
  ...(drawingScopePreference?.value ?? {})
}))
const activePanel = ref<MobileSettingsPanelKey | null>(null)
const draftPacsProfile = ref<PacsDicomwebProfile | null>(null)
const editingPacsProfileId = ref<string | null>(null)
const testingPacsProfileIds = ref<string[]>([])
const pacsTestResults = ref<Record<string, PacsTestResult>>({})

const themeOptions: ThemeOption[] = [
  {
    accent: '#6fa9c4',
    id: 'industrial-utility',
    panel: '#111923',
    rail: 'linear-gradient(90deg,#101820,#263746,#6fa9c4)',
    surface: '#17222d',
    text: '#f5f9fc',
    zh: '工业实用风',
    en: 'Industrial'
  },
  {
    accent: '#66d0ff',
    id: 'aurora',
    panel: '#07111d',
    rail: 'linear-gradient(90deg,#07111d,#12345a,#66d0ff)',
    surface: '#10243b',
    text: '#e6f6ff',
    zh: '冷蓝深色',
    en: 'Aurora'
  },
  {
    accent: '#2f84c6',
    id: 'clinical-light',
    panel: '#f7fbff',
    rail: 'linear-gradient(90deg,#edf7ff,#cfe3f2,#2f84c6)',
    surface: '#dcecf8',
    text: '#24384d',
    zh: '临床浅色',
    en: 'Clinical'
  }
]

const mprViewportOptions: Array<{ key: MprViewportKey; label: string; desc: string }> = [
  { key: 'mpr-ax', label: 'AX', desc: 'Axial' },
  { key: 'mpr-cor', label: 'COR', desc: 'Coronal' },
  { key: 'mpr-sag', label: 'SAG', desc: 'Sagittal' }
]

const stackToolOptions: Array<MobileDefaultToolOption<MobileStackDefaultTool>> = [
  { key: 'scroll', icon: 'page', zh: '翻页', en: 'Page' },
  { key: 'window', icon: 'window', zh: '调窗', en: 'Window' },
  { key: 'pan', icon: 'pan', zh: '平移', en: 'Pan' }
]

const mprToolOptions: Array<MobileDefaultToolOption<MobileMprDefaultTool>> = [
  { key: 'crosshair', icon: 'crosshair', zh: '十字线', en: 'Crosshair' },
  ...stackToolOptions
]

const volumeToolOptions: Array<MobileDefaultToolOption<MobileVolumeDefaultTool>> = [
  { key: 'rotate3d', icon: 'rotate3d', zh: '旋转', en: 'Rotate' },
  { key: 'window', icon: 'window', zh: '调窗', en: 'Window' },
  { key: 'pan', icon: 'pan', zh: '平移', en: 'Pan' }
]

const gestureSensitivityLabels: Record<MobileGestureSensitivity, { zh: string; en: string }> = {
  high: { zh: '高', en: 'High' },
  low: { zh: '低', en: 'Low' },
  normal: { zh: '标准', en: 'Normal' }
}
const orientationLockLabels: Record<MobileOrientationLock, { zh: string; en: string }> = {
  landscape: { zh: '锁定横屏', en: 'Landscape' },
  portrait: { zh: '锁定竖屏', en: 'Portrait' },
  unlocked: { zh: '不锁定', en: 'Unlocked' }
}
const pacsProtocolOptions: Array<{ value: PacsDicomwebProfile['protocol']; label: string }> = [
  { value: 'dicomweb', label: 'DICOMweb' },
  { value: 'dimse', label: 'DIMSE' }
]
const pacsPresetOptions: PacsProfilePreset[] = ['orthanc', 'dcm4chee', 'custom']
const pacsAuthOptions: PacsAuthType[] = ['none', 'basic', 'bearer']

const scaleBarColorPresets: ColorPreset[] = [
  { value: '#f8fafc', label: 'White' },
  { value: '#22c55e', label: 'Green' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#ef4444', label: 'Red' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#a855f7', label: 'Violet' }
]

const cornerInfoTypographyOptions: MobileCornerInfoTypographyOption[] = [
  { value: 'compact', zh: '紧凑', en: 'Compact' },
  { value: 'standard', zh: '标准', en: 'Standard' },
  { value: 'comfortable', zh: '舒适', en: 'Comfortable' }
]

const cornerInfoColorModeOptions: MobileCornerInfoColorModeOption[] = [
  { value: 'auto', zh: '自动', en: 'Auto' },
  { value: 'custom', zh: '自定义', en: 'Custom' }
]

const cornerInfoColorPresets: ColorPreset[] = [
  { value: '#f8fafc', label: 'White' },
  { value: '#182334', label: 'Dark' },
  { value: '#22d3ee', label: 'Cyan' },
  { value: '#facc15', label: 'Yellow' },
  { value: '#22c55e', label: 'Green' },
  { value: '#ff9a9a', label: 'Fusion' }
]

const DEFAULT_MOBILE_SCALE_BAR_PREFERENCE: ScaleBarPreference = {
  enabled: true,
  color: '#f8fafc'
}

function createDefaultMobileCrosshairConfigs(): CrosshairViewportPreference[] {
  return [
    { key: 'mpr-ax', label: 'AX', color: '#ef4444', thickness: 2 },
    { key: 'mpr-cor', label: 'COR', color: '#22c55e', thickness: 2 },
    { key: 'mpr-sag', label: 'SAG', color: '#3b82f6', thickness: 2 }
  ]
}

const measurementColorPresets: ColorPreset[] = [
  { value: '#ffb84d', label: 'Amber' },
  { value: '#55e7ff', label: 'Cyan' },
  { value: '#f8fafc', label: 'White' },
  { value: '#22c55e', label: 'Green' },
  { value: '#ef4444', label: 'Red' },
  { value: '#a855f7', label: 'Violet' }
]

const lineStyleOptions: Array<{ value: MeasurementLineStyle; zh: string; en: string }> = [
  { value: 'solid', zh: '实线', en: 'Solid' },
  { value: 'dash', zh: '虚线', en: 'Dashed' }
]

const selectedThemeLabel = computed(() => {
  const theme = themeOptions.find((item) => item.id === themeId.value)
  return theme ? (isZh.value ? theme.zh : theme.en) : themeId.value
})
const selectedWindowPresetLabel = computed(() => {
  const preset = windowPresets.value.find((item) => item.id === selectedWindowPresetId.value)
  return preset ? getWindowPresetLabel(preset) : selectedWindowPresetId.value
})
const selectedPseudocolorLabel = computed(() =>
  PSEUDOCOLOR_PRESET_OPTIONS.find((preset) => preset.key === selectedPseudocolorKey.value)?.label ?? selectedPseudocolorKey.value
)
const selectedMprPlaneLabel = computed(() =>
  mprViewportOptions.find((item) => item.key === mprDefaultViewport.value)?.label ?? mprDefaultViewport.value
)
const selectedStackToolLabel = computed(() =>
  stackToolOptions.find((tool) => tool.key === stackDefaultTool.value)?.[isZh.value ? 'zh' : 'en'] ?? stackDefaultTool.value
)
const selectedMprToolLabel = computed(() =>
  mprToolOptions.find((tool) => tool.key === mprDefaultTool.value)?.[isZh.value ? 'zh' : 'en'] ?? mprDefaultTool.value
)
const selectedVolumeToolLabel = computed(() =>
  volumeToolOptions.find((tool) => tool.key === volumeDefaultTool.value)?.[isZh.value ? 'zh' : 'en'] ?? volumeDefaultTool.value
)
const selectedCornerInfoTypographyIndex = computed(() => Math.max(
  0,
  cornerInfoTypographyOptions.findIndex((option) => option.value === viewportCornerInfoPreference.value.typographyPreset)
))
const selectedCornerInfoTypographyOption = computed(() => (
  cornerInfoTypographyOptions[selectedCornerInfoTypographyIndex.value] ?? cornerInfoTypographyOptions[2]!
))
const selectedCornerInfoTypographyLabel = computed(() =>
  selectedCornerInfoTypographyOption.value[isZh.value ? 'zh' : 'en']
)
const displayDefaultsLabel = computed(() => {
  const enabledCount = [defaultShowCornerInfo.value, defaultShowPseudocolorBar.value, defaultShowScaleBar.value].filter(Boolean).length
  return isZh.value ? `${enabledCount} 项开启` : `${enabledCount} on`
})
const crosshairThickness = computed(() => {
  if (!crosshairConfigs.value.length) {
    return 2
  }
  const average = crosshairConfigs.value.reduce((sum, item) => sum + item.thickness, 0) / crosshairConfigs.value.length
  return Math.round(average * 2) / 2
})
const overlayStyleLabel = computed(() => {
  const scaleBarLabel = scaleBarPreference.value.enabled ? (isZh.value ? '比例尺开' : 'Scale on') : (isZh.value ? '比例尺关' : 'Scale off')
  return isZh.value
    ? `${scaleBarLabel} · 四角${selectedCornerInfoTypographyLabel.value} · 十字线 ${crosshairThickness.value}px`
    : `${scaleBarLabel} · Corner ${selectedCornerInfoTypographyLabel.value} · Crosshair ${crosshairThickness.value}px`
})
const measurementStyleLabel = computed(() => {
  const enabledCount = roiStatOptions.value.filter((item) => item.enabled).length
  return isZh.value ? `${measurementStylePreference.value.lineWidth}px · ROI ${enabledCount} 项` : `${measurementStylePreference.value.lineWidth}px · ${enabledCount} ROI`
})
const drawingScopeRows = computed(() => [
  {
    key: 'measurement' as const,
    title: isZh.value ? '测量' : 'Measurement'
  },
  {
    key: 'annotation' as const,
    title: isZh.value ? '标注' : 'Annotation'
  },
  {
    key: 'qaWater' as const,
    title: isZh.value ? '水模 QA' : 'Water QA'
  },
  {
    key: 'mtf' as const,
    title: 'MTF'
  }
])
const dicomExportLabel = computed(() => {
  const enabledExportCount = [
    exportPreference.value.includePngMeasurements,
    exportPreference.value.includePngAnnotations,
    exportPreference.value.includePngCornerInfo,
    exportPreference.value.includeDicomMeasurements,
    exportPreference.value.includeDicomAnnotations
  ].filter(Boolean).length
  return isZh.value ? `导出 ${enabledExportCount} 项` : `${enabledExportCount} export options`
})
const enabledPacsProfileCount = computed(() => pacsPreference.value.profiles.filter((profile) => profile.enabled).length)
const pacsSettingsLabel = computed(() => (
  isZh.value
    ? `${enabledPacsProfileCount.value}/${pacsPreference.value.profiles.length} 启用`
    : `${enabledPacsProfileCount.value}/${pacsPreference.value.profiles.length} enabled`
))
const activePacsProfile = computed(() => (
  pacsPreference.value.profiles.find((profile) => profile.id === pacsPreference.value.activeProfileId) ??
  pacsPreference.value.profiles[0] ??
  null
))
const editingPacsProfile = computed(() => (
  editingPacsProfileId.value
    ? pacsPreference.value.profiles.find((profile) => profile.id === editingPacsProfileId.value) ?? null
    : null
))
const gestureSensitivityIndex = computed(() => {
  const index = MOBILE_GESTURE_SENSITIVITY_OPTIONS.indexOf(gestureSensitivity.value)
  return index >= 0 ? index : 1
})
const activePanelTitle = computed(() => {
  if (!activePanel.value) {
    return isZh.value ? '设置' : 'Settings'
  }
  const titles: Record<MobileSettingsPanelKey, string> = {
    dicomExport: isZh.value ? 'DICOM 与导出' : 'DICOM & Export',
    display: isZh.value ? '显示默认' : 'Display Defaults',
    interface: isZh.value ? '界面' : 'Interface',
    measurements: isZh.value ? '测量与 ROI' : 'Measurements & ROI',
    mpr: 'MPR',
    overlays: isZh.value ? '覆盖层样式' : 'Overlay Style',
    pacs: isZh.value ? 'PACS 数据源' : 'PACS Source',
    playback: isZh.value ? '播放与手势' : 'Playback & Gestures',
    reading: isZh.value ? '阅片默认' : 'Reading Defaults',
    windowColor: isZh.value ? '窗模板与伪彩' : 'Window & Color'
  }
  return titles[activePanel.value]
})

function openPanel(panel: MobileSettingsPanelKey): void {
  activePanel.value = panel
}

function closeOverlay(): void {
  activePanel.value = null
  emit('close')
}

function handleLocaleChange(nextLocale: AppLocale): void {
  setLocale(nextLocale)
}

function isSameColor(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase()
}

function updateCrosshairConfig(key: CrosshairViewportPreference['key'], patch: Partial<CrosshairViewportPreference>): void {
  setCrosshairConfigs(crosshairConfigs.value.map((item) => (item.key === key ? { ...item, ...patch, key } : item)))
}

function setCrosshairThickness(value: number): void {
  if (!Number.isFinite(value)) {
    return
  }
  setCrosshairConfigs(crosshairConfigs.value.map((item) => ({
    ...item,
    thickness: value
  })))
}

function handleCrosshairThicknessInput(event: Event): void {
  const target = event.target as HTMLInputElement | null
  setCrosshairThickness(Number.parseFloat(target?.value ?? ''))
}

function resetOverlayStylePreferences(): void {
  const defaultCornerInfoPreference = createDefaultViewportCornerInfoPreference()
  setScaleBarPreference({ ...DEFAULT_MOBILE_SCALE_BAR_PREFERENCE })
  setCrosshairConfigs(createDefaultMobileCrosshairConfigs())
  updateCornerInfoStylePreference({
    colorMode: defaultCornerInfoPreference.colorMode,
    customDarkColor: defaultCornerInfoPreference.customDarkColor,
    customLightColor: defaultCornerInfoPreference.customLightColor,
    typographyPreset: defaultCornerInfoPreference.typographyPreset
  })
}

function updateScaleBarPreference(patch: Partial<ScaleBarPreference>): void {
  setScaleBarPreference({ ...scaleBarPreference.value, ...patch })
}

function updateCornerInfoStylePreference(
  patch: Partial<Pick<ViewportCornerInfoPreference, 'colorMode' | 'customDarkColor' | 'customLightColor' | 'typographyPreset'>>
): void {
  setViewportCornerInfoPreference(normalizeViewportCornerInfoPreference({
    ...viewportCornerInfoPreference.value,
    topLeft: [...viewportCornerInfoPreference.value.topLeft],
    topRight: [...viewportCornerInfoPreference.value.topRight],
    bottomLeft: [...viewportCornerInfoPreference.value.bottomLeft],
    bottomRight: [...viewportCornerInfoPreference.value.bottomRight],
    ...patch
  }))
}

function handleCornerInfoCustomColorInput(event: Event, targetSurface: 'dark' | 'light'): void {
  const target = event.target as HTMLInputElement | null
  if (target?.value) {
    updateCornerInfoStylePreference({
      colorMode: 'custom',
      [targetSurface === 'dark' ? 'customDarkColor' : 'customLightColor']: target.value
    })
  }
}

function handleCornerInfoTypographySliderInput(event: Event): void {
  const target = event.target as HTMLInputElement | null
  const index = Math.round(Number.parseFloat(target?.value ?? ''))
  const option = cornerInfoTypographyOptions[Math.max(0, Math.min(cornerInfoTypographyOptions.length - 1, index))]
  if (option) {
    updateCornerInfoStylePreference({ typographyPreset: option.value })
  }
}

function getMobileCornerInfoPreviewStyle(kind: 'dark' | 'light'): Record<string, string> {
  const color = viewportCornerInfoPreference.value.colorMode === 'custom'
    ? kind === 'light'
      ? viewportCornerInfoPreference.value.customLightColor
      : viewportCornerInfoPreference.value.customDarkColor
    : kind === 'light'
      ? '#182334'
      : '#dbe5ec'
  return {
    '--mobile-corner-info-preview-color': color
  }
}

function updateMeasurementStylePreference(patch: Partial<MeasurementStylePreference>): void {
  setMeasurementStylePreference({ ...measurementStylePreference.value, ...patch })
}

function updateDrawingScopePreference(key: keyof DrawingScopePreference, scope: DrawingScope): void {
  setDrawingScopePreference({
    ...safeDrawingScopePreference.value,
    [key]: scope
  })
}

function handleMeasurementLineWidthInput(event: Event): void {
  const target = event.target as HTMLInputElement | null
  const value = Number.parseFloat(target?.value ?? '')
  if (Number.isFinite(value)) {
    updateMeasurementStylePreference({ lineWidth: value })
  }
}

function updateRoiStatOption(key: RoiStatPreference['key'], enabled: boolean): void {
  setRoiStatOptions(roiStatOptions.value.map((item) => (item.key === key ? { ...item, enabled } : item)))
}

function updateExportPreference(patch: Partial<ExportPreference>): void {
  setExportPreference({ ...exportPreference.value, ...patch })
}

function handleGestureSensitivityInput(event: Event): void {
  const target = event.target as HTMLInputElement | null
  const index = Math.max(0, Math.min(MOBILE_GESTURE_SENSITIVITY_OPTIONS.length - 1, Number.parseInt(target?.value ?? '', 10)))
  setGestureSensitivity(MOBILE_GESTURE_SENSITIVITY_OPTIONS[index])
}

function eventValue(event: Event): string {
  return (event.target as HTMLInputElement | HTMLSelectElement | null)?.value ?? ''
}

function eventNumber(event: Event, fallback: number): number {
  const value = Number.parseFloat(eventValue(event))
  return Number.isFinite(value) ? value : fallback
}

function updatePacsPreference(patch: Partial<PacsPreference>): void {
  setPacsPreference({ ...pacsPreference.value, ...patch })
}

function updatePacsProfile(profileId: string, patch: Partial<PacsDicomwebProfile>): void {
  setPacsPreference({
    ...pacsPreference.value,
    profiles: pacsPreference.value.profiles.map((profile) => (
      profile.id === profileId ? { ...profile, ...patch } : profile
    ))
  })
}

function updateDraftPacsProfile(patch: Partial<PacsDicomwebProfile>): void {
  if (!draftPacsProfile.value) {
    return
  }
  draftPacsProfile.value = { ...draftPacsProfile.value, ...patch }
}

function startCreatePacsProfile(): void {
  draftPacsProfile.value = createPacsProfile('custom', isZh.value)
  editingPacsProfileId.value = null
}

function saveDraftPacsProfile(): void {
  if (!draftPacsProfile.value) {
    return
  }
  const profile = {
    ...draftPacsProfile.value,
    name: draftPacsProfile.value.name.trim() || (isZh.value ? '新 PACS 配置' : 'New PACS Profile')
  }
  setPacsPreference({
    ...pacsPreference.value,
    activeProfileId: pacsPreference.value.activeProfileId || profile.id,
    profiles: [...pacsPreference.value.profiles, profile]
  })
  draftPacsProfile.value = null
  editingPacsProfileId.value = profile.id
}

function cancelDraftPacsProfile(): void {
  if (draftPacsProfile.value) {
    removePacsTestResults([draftPacsProfile.value.id])
  }
  draftPacsProfile.value = null
}

function setDefaultPacsProfile(profileId: string): void {
  updatePacsPreference({ activeProfileId: profileId })
}

function openPacsProfileDetail(profileId: string): void {
  draftPacsProfile.value = null
  editingPacsProfileId.value = profileId
}

function closePacsProfileDetail(): void {
  editingPacsProfileId.value = null
}

function deletePacsProfile(profileId: string): void {
  if (pacsPreference.value.profiles.length <= 1) {
    return
  }
  const nextProfiles = pacsPreference.value.profiles.filter((profile) => profile.id !== profileId)
  setPacsPreference({
    ...pacsPreference.value,
    profiles: nextProfiles,
    activeProfileId: pacsPreference.value.activeProfileId === profileId
      ? nextProfiles[0]?.id ?? ''
      : pacsPreference.value.activeProfileId
  })
  if (editingPacsProfileId.value === profileId) {
    editingPacsProfileId.value = null
  }
  removePacsTestResults([profileId])
}

function applyPacsPreset(profileId: string, preset: PacsProfilePreset): void {
  updatePacsProfile(profileId, { preset, ...pacsProfilePresetConnectionPatch(preset) })
}

function applyDraftPacsPreset(preset: PacsProfilePreset): void {
  updateDraftPacsProfile({ preset, ...pacsProfilePresetConnectionPatch(preset) })
}

function removePacsTestResults(profileIds: string[]): void {
  const removingIds = new Set(profileIds)
  pacsTestResults.value = Object.fromEntries(
    Object.entries(pacsTestResults.value).filter(([profileId]) => !removingIds.has(profileId))
  )
}

function pacsTestResultForProfile(profileId: string): PacsTestResult | null {
  return pacsTestResults.value[profileId] ?? null
}

function isTestingPacsProfile(profileId: string): boolean {
  return testingPacsProfileIds.value.includes(profileId)
}

async function testPacsProfile(profile: PacsDicomwebProfile): Promise<void> {
  testingPacsProfileIds.value = [...new Set([...testingPacsProfileIds.value, profile.id])]
  removePacsTestResults([profile.id])
  try {
    const { postApi } = await loadTypedApi()
    const response = profile.protocol === 'dimse'
      ? await postApi('TestDimseConnectionApiV1PacsDimseTestPost', {
          profile: toApiPacsDimseProfile(profile)
        })
      : await postApi('TestDicomwebConnectionApiV1PacsDicomwebTestPost', {
          profile: toApiPacsDicomwebProfile(profile)
        })
    pacsTestResults.value = {
      ...pacsTestResults.value,
      [profile.id]: {
        ok: response.ok,
        message: response.message
      }
    }
  } catch (error) {
    pacsTestResults.value = {
      ...pacsTestResults.value,
      [profile.id]: {
        ok: false,
        message: error instanceof Error ? error.message : (isZh.value ? '连接测试失败' : 'Connection test failed')
      }
    }
  } finally {
    testingPacsProfileIds.value = testingPacsProfileIds.value.filter((id) => id !== profile.id)
  }
}

function handleOrientationLockClick(lock: MobileOrientationLock): void {
  setOrientationLock(lock)
  emit('orientationLockRequest', lock)
}

function orientationLockIcon(lock: MobileOrientationLock): string {
  if (lock === 'landscape') {
    return 'orientation-landscape'
  }
  if (lock === 'portrait') {
    return 'orientation-portrait'
  }
  return 'orientation-unlocked'
}
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" class="mobile-settings" role="dialog" aria-modal="true" :aria-label="activePanelTitle">
      <header class="mobile-settings__header">
        <button
          v-if="activePanel"
          type="button"
          class="mobile-settings__icon-button mobile-settings__back-button"
          data-testid="mobile-settings-back"
          @click="activePanel = null"
        >
          <AppIcon name="chevron-left" :size="20" />
        </button>
        <span v-else class="mobile-settings__header-spacer" aria-hidden="true"></span>
        <div class="mobile-settings__header-title">
          <div class="mobile-settings__title">{{ activePanelTitle }}</div>
        </div>
        <button type="button" class="mobile-settings__icon-button" data-testid="mobile-settings-close" @click="closeOverlay">
          <AppIcon name="close" :size="18" />
        </button>
      </header>

      <main class="mobile-settings__content" :class="{ 'mobile-settings__content--detail': activePanel }">
        <template v-if="!activePanel">
          <section class="mobile-settings__nav-group">
            <button type="button" class="mobile-settings__nav-row" data-testid="mobile-settings-nav-interface" @click="openPanel('interface')">
              <AppIcon name="language" :size="20" />
              <span>
                <strong>{{ isZh ? '界面' : 'Interface' }}</strong>
                <small>{{ locale === 'zh-CN' ? '中文' : 'English' }} · {{ selectedThemeLabel }}</small>
              </span>
              <AppIcon name="chevron-right" :size="18" />
            </button>
            <button type="button" class="mobile-settings__nav-row" data-testid="mobile-settings-nav-reading" @click="openPanel('reading')">
              <AppIcon name="page" :size="20" />
              <span>
                <strong>{{ isZh ? '阅片默认' : 'Reading Defaults' }}</strong>
                <small>2D {{ selectedStackToolLabel }} · MPR {{ selectedMprToolLabel }} · 3D {{ selectedVolumeToolLabel }}</small>
              </span>
              <AppIcon name="chevron-right" :size="18" />
            </button>
          </section>

          <section class="mobile-settings__nav-group">
            <button type="button" class="mobile-settings__nav-row" data-testid="mobile-settings-nav-window-color" @click="openPanel('windowColor')">
              <AppIcon name="palette" :size="20" />
              <span>
                <strong>{{ isZh ? '窗模板与伪彩' : 'Window & Color' }}</strong>
                <small>{{ selectedWindowPresetLabel }} · {{ selectedPseudocolorLabel }}</small>
              </span>
              <AppIcon name="chevron-right" :size="18" />
            </button>
            <button type="button" class="mobile-settings__nav-row" data-testid="mobile-settings-nav-mpr" @click="openPanel('mpr')">
              <AppIcon name="crosshair" :size="20" />
              <span>
                <strong>MPR</strong>
                <small>{{ selectedMprPlaneLabel }}</small>
              </span>
              <AppIcon name="chevron-right" :size="18" />
            </button>
            <button type="button" class="mobile-settings__nav-row" data-testid="mobile-settings-nav-display" @click="openPanel('display')">
              <AppIcon name="display" :size="20" />
              <span>
                <strong>{{ isZh ? '显示默认' : 'Display Defaults' }}</strong>
                <small>{{ displayDefaultsLabel }}</small>
              </span>
              <AppIcon name="chevron-right" :size="18" />
            </button>
            <button type="button" class="mobile-settings__nav-row" data-testid="mobile-settings-nav-overlays" @click="openPanel('overlays')">
              <AppIcon name="measure" :size="20" />
              <span>
                <strong>{{ isZh ? '覆盖层样式' : 'Overlay Style' }}</strong>
                <small>{{ overlayStyleLabel }}</small>
              </span>
              <AppIcon name="chevron-right" :size="18" />
            </button>
            <button type="button" class="mobile-settings__nav-row" data-testid="mobile-settings-nav-measurements" @click="openPanel('measurements')">
              <AppIcon name="measure-line" :size="20" />
              <span>
                <strong>{{ isZh ? '测量与 ROI' : 'Measurements & ROI' }}</strong>
                <small>{{ measurementStyleLabel }}</small>
              </span>
              <AppIcon name="chevron-right" :size="18" />
            </button>
          </section>

          <section class="mobile-settings__nav-group">
            <button type="button" class="mobile-settings__nav-row" data-testid="mobile-settings-nav-dicom-export" @click="openPanel('dicomExport')">
              <AppIcon name="tag" :size="20" />
              <span>
                <strong>{{ isZh ? 'DICOM 与导出' : 'DICOM & Export' }}</strong>
                <small>{{ dicomExportLabel }}</small>
              </span>
              <AppIcon name="chevron-right" :size="18" />
            </button>
            <button type="button" class="mobile-settings__nav-row" data-testid="mobile-settings-nav-pacs" @click="openPanel('pacs')">
              <AppIcon name="pacs" :size="20" />
              <span>
                <strong>{{ isZh ? 'PACS 数据源' : 'PACS Source' }}</strong>
                <small>{{ pacsSettingsLabel }}</small>
              </span>
              <AppIcon name="chevron-right" :size="18" />
            </button>
            <button type="button" class="mobile-settings__nav-row" data-testid="mobile-settings-nav-playback" @click="openPanel('playback')">
              <AppIcon name="play" :size="20" />
              <span>
                <strong>{{ isZh ? '播放与手势' : 'Playback & Gestures' }}</strong>
                <small>{{ isZh ? gestureSensitivityLabels[gestureSensitivity].zh : gestureSensitivityLabels[gestureSensitivity].en }} · {{ isZh ? orientationLockLabels[orientationLock].zh : orientationLockLabels[orientationLock].en }}</small>
              </span>
              <AppIcon name="chevron-right" :size="18" />
            </button>
          </section>
        </template>

        <section v-else-if="activePanel === 'interface'" class="mobile-settings__section">
          <div class="mobile-settings__segmented" data-testid="mobile-settings-locale">
            <button type="button" :class="{ active: locale === 'zh-CN' }" @click="handleLocaleChange('zh-CN')">中文</button>
            <button type="button" :class="{ active: locale === 'en-US' }" @click="handleLocaleChange('en-US')">English</button>
          </div>
          <div class="mobile-settings__theme-grid">
            <button
              v-for="theme in themeOptions"
              :key="theme.id"
              type="button"
              class="mobile-settings__theme-card"
              :class="{ active: themeId === theme.id }"
              data-testid="mobile-settings-theme"
              @click="themeId = theme.id"
            >
              <span
                class="mobile-settings__theme-preview"
                :style="{
                  '--mobile-theme-accent': theme.accent,
                  '--mobile-theme-panel': theme.panel,
                  '--mobile-theme-rail': theme.rail,
                  '--mobile-theme-surface': theme.surface,
                  '--mobile-theme-text': theme.text
                }"
              >
                <span class="mobile-settings__theme-preview-rail"></span>
                <span class="mobile-settings__theme-preview-card">
                  <span></span>
                  <span></span>
                </span>
                <span class="mobile-settings__theme-preview-accent"></span>
              </span>
              <span class="mobile-settings__theme-body">
                <strong>{{ isZh ? theme.zh : theme.en }}</strong>
                <small>{{ theme.id === 'clinical-light' ? (isZh ? '浅色' : 'Light') : (isZh ? '深色' : 'Dark') }}</small>
              </span>
              <span v-if="themeId === theme.id" class="mobile-settings__theme-check" aria-hidden="true">
                <AppIcon name="check" :size="14" />
              </span>
            </button>
          </div>
        </section>

        <section v-else-if="activePanel === 'reading'" class="mobile-settings__section">
          <div class="mobile-settings__subhead">{{ isZh ? '2D 默认工具' : '2D Default Tool' }}</div>
          <div class="mobile-settings__option-grid">
            <button
              v-for="tool in stackToolOptions"
              :key="tool.key"
              type="button"
              class="mobile-settings__option"
              :class="{ active: stackDefaultTool === tool.key }"
              data-testid="mobile-settings-stack-tool"
              @click="setStackDefaultTool(tool.key)"
            >
              <AppIcon :name="tool.icon" :size="16" />
              <span>{{ isZh ? tool.zh : tool.en }}</span>
            </button>
          </div>
          <div class="mobile-settings__subhead">{{ isZh ? 'MPR 默认工具' : 'MPR Default Tool' }}</div>
          <div class="mobile-settings__option-grid">
            <button
              v-for="tool in mprToolOptions"
              :key="tool.key"
              type="button"
              class="mobile-settings__option"
              :class="{ active: mprDefaultTool === tool.key }"
              data-testid="mobile-settings-mpr-tool"
              @click="setMprDefaultTool(tool.key)"
            >
              <AppIcon :name="tool.icon" :size="16" />
              <span>{{ isZh ? tool.zh : tool.en }}</span>
            </button>
          </div>
          <div class="mobile-settings__subhead">{{ isZh ? '3D 默认工具' : '3D Default Tool' }}</div>
          <div class="mobile-settings__option-grid">
            <button
              v-for="tool in volumeToolOptions"
              :key="tool.key"
              type="button"
              class="mobile-settings__option"
              :class="{ active: volumeDefaultTool === tool.key }"
              data-testid="mobile-settings-volume-tool"
              @click="setVolumeDefaultTool(tool.key)"
            >
              <AppIcon :name="tool.icon" :size="16" />
              <span>{{ isZh ? tool.zh : tool.en }}</span>
            </button>
          </div>
        </section>

        <section v-else-if="activePanel === 'windowColor'" class="mobile-settings__section">
          <div class="mobile-settings__subhead">{{ isZh ? '默认窗模板' : 'Default Window' }}</div>
          <div class="mobile-settings__list mobile-settings__list--window">
            <button
              v-for="preset in windowPresets"
              :key="preset.id"
              type="button"
              class="mobile-settings__row"
              :class="{ active: selectedWindowPresetId === preset.id }"
              data-testid="mobile-settings-window"
              @click="selectedWindowPresetId = preset.id"
            >
              <span class="mobile-settings__swatch" :style="{ background: preset.accent }"></span>
              <span class="mobile-settings__row-text">
                <strong>{{ getWindowPresetLabel(preset) }}</strong>
                <small>WW {{ Math.round(preset.ww) }} / WL {{ Math.round(preset.wl) }}</small>
              </span>
            </button>
          </div>
          <div class="mobile-settings__subhead">{{ isZh ? '默认伪彩' : 'Default Color' }}</div>
          <div class="mobile-settings__option-grid">
            <button
              v-for="preset in PSEUDOCOLOR_PRESET_OPTIONS"
              :key="preset.key"
              type="button"
              class="mobile-settings__option"
              :class="{ active: selectedPseudocolorKey === preset.key }"
              data-testid="mobile-settings-pseudocolor"
              @click="selectedPseudocolorKey = preset.key"
            >
              <span
                class="mobile-settings__swatch mobile-settings__swatch--pseudocolor"
                :style="{ '--mobile-settings-pseudocolor-gradient': getPseudocolorGradient(preset.key) }"
              ></span>
              <span>{{ preset.label }}</span>
            </button>
          </div>
        </section>

        <section v-else-if="activePanel === 'mpr'" class="mobile-settings__section">
          <div class="mobile-settings__subhead">{{ isZh ? '默认平面' : 'Default Plane' }}</div>
          <div class="mobile-settings__option-grid mobile-settings__plane-grid">
            <button
              v-for="item in mprViewportOptions"
              :key="item.key"
              type="button"
              class="mobile-settings__option"
              :class="{ active: mprDefaultViewport === item.key }"
              data-testid="mobile-settings-mpr-plane"
              @click="setMprDefaultViewport(item.key)"
            >
              <strong>{{ item.label }}</strong>
              <small>{{ item.desc }}</small>
            </button>
          </div>
          <button
            type="button"
            class="mobile-settings__switch-row"
            data-testid="mobile-settings-mpr-references"
            @click="setMprShowReferenceThumbnails(!mprShowReferenceThumbnails)"
          >
            <span>
              <strong>{{ isZh ? '显示参考小图' : 'Reference Thumbnails' }}</strong>
              <small>{{ isZh ? '主图旁显示另外两个 MPR 平面' : 'Show the other two MPR planes beside the primary view' }}</small>
            </span>
            <span class="mobile-settings__switch" :class="{ 'mobile-settings__switch--on': mprShowReferenceThumbnails }" aria-hidden="true">
              <span></span>
            </span>
          </button>
        </section>

        <section v-else-if="activePanel === 'display'" class="mobile-settings__section">
          <button
            type="button"
            class="mobile-settings__switch-row"
            data-testid="mobile-settings-corner-info"
            @click="setDefaultShowCornerInfo(!defaultShowCornerInfo)"
          >
            <span>
              <strong>{{ isZh ? '四角信息' : 'Corner Info' }}</strong>
              <small>{{ isZh ? '新打开视图默认显示患者和序列信息' : 'Show patient and series overlays by default' }}</small>
            </span>
            <span class="mobile-settings__switch" :class="{ 'mobile-settings__switch--on': defaultShowCornerInfo }" aria-hidden="true">
              <span></span>
            </span>
          </button>
          <button
            type="button"
            class="mobile-settings__switch-row"
            data-testid="mobile-settings-scale-bar"
            @click="setDefaultShowScaleBar(!defaultShowScaleBar)"
          >
            <span>
              <strong>{{ isZh ? '比例尺' : 'Scale Bar' }}</strong>
              <small>{{ isZh ? '新打开视图默认显示比例尺' : 'Show scale bar by default' }}</small>
            </span>
            <span class="mobile-settings__switch" :class="{ 'mobile-settings__switch--on': defaultShowScaleBar }" aria-hidden="true">
              <span></span>
            </span>
          </button>
          <button
            type="button"
            class="mobile-settings__switch-row"
            data-testid="mobile-settings-pseudocolor-bar"
            @click="setDefaultShowPseudocolorBar(!defaultShowPseudocolorBar)"
          >
            <span>
              <strong>{{ isZh ? '伪彩条' : 'Pseudocolor Bar' }}</strong>
              <small>{{ isZh ? '新打开视图默认显示当前伪彩的颜色范围条' : 'Show the active pseudocolor range bar by default' }}</small>
            </span>
            <span class="mobile-settings__switch" :class="{ 'mobile-settings__switch--on': defaultShowPseudocolorBar }" aria-hidden="true">
              <span></span>
            </span>
          </button>
        </section>

        <section v-else-if="activePanel === 'overlays'" class="mobile-settings__section">
          <button
            type="button"
            class="mobile-settings__reset-row"
            data-testid="mobile-settings-overlay-reset"
            @click="resetOverlayStylePreferences"
          >
            <AppIcon name="reset" :size="18" />
            <span>
              <strong>{{ isZh ? '重置覆盖层样式' : 'Reset Overlay Style' }}</strong>
              <small>{{ isZh ? '恢复比例尺和 MPR 十字线默认样式' : 'Restore scale bar and MPR crosshair defaults' }}</small>
            </span>
          </button>
          <button
            type="button"
            class="mobile-settings__switch-row"
            data-testid="mobile-settings-overlay-scale-enabled"
            @click="updateScaleBarPreference({ enabled: !scaleBarPreference.enabled })"
          >
            <span>
              <strong>{{ isZh ? '比例尺覆盖层' : 'Scale Bar Overlay' }}</strong>
              <small>{{ scaleBarPreference.enabled ? (isZh ? '已开启' : 'Enabled') : (isZh ? '已关闭' : 'Disabled') }}</small>
            </span>
            <span class="mobile-settings__switch" :class="{ 'mobile-settings__switch--on': scaleBarPreference.enabled }" aria-hidden="true">
              <span></span>
            </span>
          </button>

          <div class="mobile-settings__control-block">
            <div class="mobile-settings__subhead">{{ isZh ? '比例尺颜色' : 'Scale Bar Color' }}</div>
            <div class="mobile-settings__color-grid">
              <button
                v-for="preset in scaleBarColorPresets"
                :key="`scale-${preset.value}`"
                type="button"
                class="mobile-settings__color-swatch-button"
                :class="{ active: isSameColor(scaleBarPreference.color, preset.value) }"
                :style="{ '--mobile-settings-color': preset.value }"
                :title="preset.label"
                data-testid="mobile-settings-scale-color"
                @click="updateScaleBarPreference({ color: preset.value })"
              >
                <span></span>
              </button>
            </div>
          </div>

          <div class="mobile-settings__control-block">
            <div class="mobile-settings__subhead">{{ isZh ? '四角信息' : 'Corner Info' }}</div>
            <div class="mobile-settings__corner-typography-control">
              <div class="mobile-settings__range-head">
                <span>{{ isZh ? '字体密度' : 'Typography Density' }}</span>
                <strong>{{ selectedCornerInfoTypographyLabel }}</strong>
              </div>
              <input
                class="mobile-settings__range"
                data-testid="mobile-settings-corner-typography-slider"
                type="range"
                min="0"
                :max="cornerInfoTypographyOptions.length - 1"
                step="1"
                :value="selectedCornerInfoTypographyIndex"
                @input="handleCornerInfoTypographySliderInput"
              />
              <div class="mobile-settings__range-ticks mobile-settings__corner-typography-ticks" aria-hidden="true">
                <span
                  v-for="(option, index) in cornerInfoTypographyOptions"
                  :key="option.value"
                  :class="{ 'mobile-settings__corner-typography-tick--active': index === selectedCornerInfoTypographyIndex }"
                >
                  {{ isZh ? option.zh : option.en }}
                </span>
              </div>
            </div>

            <div class="mobile-settings__segmented mobile-settings__corner-color-mode" data-testid="mobile-settings-corner-color-mode">
              <button
                v-for="option in cornerInfoColorModeOptions"
                :key="option.value"
                type="button"
                :class="{ active: viewportCornerInfoPreference.colorMode === option.value }"
                @click="updateCornerInfoStylePreference({ colorMode: option.value })"
              >
                {{ isZh ? option.zh : option.en }}
              </button>
            </div>

            <div class="mobile-settings__corner-color-stack" :class="{ 'mobile-settings__corner-color-stack--disabled': viewportCornerInfoPreference.colorMode !== 'custom' }">
              <div class="mobile-settings__corner-color-row">
                <span class="mobile-settings__corner-color-label">{{ isZh ? '暗底' : 'Dark' }}</span>
                <input
                  :value="viewportCornerInfoPreference.customDarkColor"
                  type="color"
                  class="mobile-settings__corner-color-input"
                  :disabled="viewportCornerInfoPreference.colorMode !== 'custom'"
                  data-testid="mobile-settings-corner-dark-color-input"
                  @input="handleCornerInfoCustomColorInput($event, 'dark')"
                />
                <strong>{{ viewportCornerInfoPreference.customDarkColor }}</strong>
              </div>
              <div class="mobile-settings__color-grid mobile-settings__color-grid--corner">
                <button
                  v-for="preset in cornerInfoColorPresets"
                  :key="`corner-dark-${preset.value}`"
                  type="button"
                  class="mobile-settings__color-swatch-button"
                  :class="{ active: viewportCornerInfoPreference.colorMode === 'custom' && isSameColor(viewportCornerInfoPreference.customDarkColor, preset.value) }"
                  :style="{ '--mobile-settings-color': preset.value }"
                  :title="preset.label"
                  :disabled="viewportCornerInfoPreference.colorMode !== 'custom'"
                  data-testid="mobile-settings-corner-dark-color"
                  @click="updateCornerInfoStylePreference({ customDarkColor: preset.value, colorMode: 'custom' })"
                >
                  <span></span>
                </button>
              </div>

              <div class="mobile-settings__corner-color-row">
                <span class="mobile-settings__corner-color-label">{{ isZh ? '浅底' : 'Light' }}</span>
                <input
                  :value="viewportCornerInfoPreference.customLightColor"
                  type="color"
                  class="mobile-settings__corner-color-input"
                  :disabled="viewportCornerInfoPreference.colorMode !== 'custom'"
                  data-testid="mobile-settings-corner-light-color-input"
                  @input="handleCornerInfoCustomColorInput($event, 'light')"
                />
                <strong>{{ viewportCornerInfoPreference.customLightColor }}</strong>
              </div>
              <div class="mobile-settings__color-grid mobile-settings__color-grid--corner">
                <button
                  v-for="preset in cornerInfoColorPresets"
                  :key="`corner-light-${preset.value}`"
                  type="button"
                  class="mobile-settings__color-swatch-button"
                  :class="{ active: viewportCornerInfoPreference.colorMode === 'custom' && isSameColor(viewportCornerInfoPreference.customLightColor, preset.value) }"
                  :style="{ '--mobile-settings-color': preset.value }"
                  :title="preset.label"
                  :disabled="viewportCornerInfoPreference.colorMode !== 'custom'"
                  data-testid="mobile-settings-corner-light-color"
                  @click="updateCornerInfoStylePreference({ customLightColor: preset.value, colorMode: 'custom' })"
                >
                  <span></span>
                </button>
              </div>
            </div>

            <div class="mobile-settings__corner-preview-grid">
              <div
                class="mobile-settings__corner-preview mobile-settings__corner-preview--dark"
                :class="`mobile-settings__corner-preview--${viewportCornerInfoPreference.typographyPreset}`"
                :style="getMobileCornerInfoPreviewStyle('dark')"
              >
                <span class="mobile-settings__corner-preview-label">CT</span>
                <span class="mobile-settings__corner-preview-line mobile-settings__corner-preview-line--top-left">SIEMENS<br />Im: 36/128</span>
                <span class="mobile-settings__corner-preview-line mobile-settings__corner-preview-line--top-right">ZHANG SAN<br />P000123</span>
                <span class="mobile-settings__corner-preview-line mobile-settings__corner-preview-line--bottom-left">W: 400 L: 40</span>
              </div>
              <div
                class="mobile-settings__corner-preview mobile-settings__corner-preview--light"
                :class="`mobile-settings__corner-preview--${viewportCornerInfoPreference.typographyPreset}`"
                :style="getMobileCornerInfoPreviewStyle('light')"
              >
                <span class="mobile-settings__corner-preview-label">PET</span>
                <span class="mobile-settings__corner-preview-line mobile-settings__corner-preview-line--top-left">PT<br />SUV</span>
                <span class="mobile-settings__corner-preview-line mobile-settings__corner-preview-line--top-right">PET/CT</span>
                <span class="mobile-settings__corner-preview-line mobile-settings__corner-preview-line--bottom-left">Zoom 1.25x</span>
              </div>
            </div>
          </div>

          <div class="mobile-settings__control-block">
            <div class="mobile-settings__subhead">{{ isZh ? 'MPR 十字线' : 'MPR Crosshair' }}</div>
            <div class="mobile-settings__range-head">
              <span>{{ isZh ? '整体粗细' : 'Overall Thickness' }}</span>
              <strong>{{ crosshairThickness }} px</strong>
            </div>
            <input
              class="mobile-settings__range"
              data-testid="mobile-settings-crosshair-thickness"
              type="range"
              min="1"
              max="4"
              step="0.5"
              :value="crosshairThickness"
              @input="handleCrosshairThicknessInput"
            />
            <div class="mobile-settings__crosshair-list">
              <div v-for="config in crosshairConfigs" :key="config.key" class="mobile-settings__crosshair-row">
                <span class="mobile-settings__crosshair-label">{{ config.label }}</span>
                <div class="mobile-settings__color-grid mobile-settings__color-grid--compact">
                  <button
                    v-for="preset in scaleBarColorPresets"
                    :key="`${config.key}-${preset.value}`"
                    type="button"
                    class="mobile-settings__color-swatch-button"
                    :class="{ active: isSameColor(config.color, preset.value) }"
                    :style="{ '--mobile-settings-color': preset.value }"
                    :title="preset.label"
                    data-testid="mobile-settings-crosshair-color"
                    @click="updateCrosshairConfig(config.key, { color: preset.value })"
                  >
                    <span></span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section v-else-if="activePanel === 'measurements'" class="mobile-settings__section">
          <div class="mobile-settings__control-block">
            <div class="mobile-settings__subhead">{{ isZh ? '编辑中颜色' : 'Editing Color' }}</div>
            <div class="mobile-settings__color-grid">
              <button
                v-for="preset in measurementColorPresets"
                :key="`editing-${preset.value}`"
                type="button"
                class="mobile-settings__color-swatch-button"
                :class="{ active: isSameColor(measurementStylePreference.editingColor, preset.value) }"
                :style="{ '--mobile-settings-color': preset.value }"
                :title="preset.label"
                data-testid="mobile-settings-measure-editing-color"
                @click="updateMeasurementStylePreference({ editingColor: preset.value })"
              >
                <span></span>
              </button>
            </div>
          </div>

          <div class="mobile-settings__control-block">
            <div class="mobile-settings__subhead">{{ isZh ? '完成后颜色' : 'Completed Color' }}</div>
            <div class="mobile-settings__color-grid">
              <button
                v-for="preset in measurementColorPresets"
                :key="`completed-${preset.value}`"
                type="button"
                class="mobile-settings__color-swatch-button"
                :class="{ active: isSameColor(measurementStylePreference.completedColor, preset.value) }"
                :style="{ '--mobile-settings-color': preset.value }"
                :title="preset.label"
                data-testid="mobile-settings-measure-completed-color"
                @click="updateMeasurementStylePreference({ completedColor: preset.value })"
              >
                <span></span>
              </button>
            </div>
          </div>

          <div class="mobile-settings__control-block">
            <div class="mobile-settings__range-head">
              <span class="mobile-settings__subhead">{{ isZh ? '线宽' : 'Line Width' }}</span>
              <strong>{{ measurementStylePreference.lineWidth }} px</strong>
            </div>
            <input
              class="mobile-settings__range"
              data-testid="mobile-settings-measure-line-width"
              type="range"
              min="1.5"
              max="6"
              step="0.5"
              :value="measurementStylePreference.lineWidth"
              @input="handleMeasurementLineWidthInput"
            />
          </div>

          <div class="mobile-settings__control-block">
            <div class="mobile-settings__subhead">{{ isZh ? '线型' : 'Line Style' }}</div>
            <div class="mobile-settings__line-style-grid">
              <span>{{ isZh ? '编辑中' : 'Editing' }}</span>
              <div class="mobile-settings__mini-segmented">
                <button
                  v-for="option in lineStyleOptions"
                  :key="`editing-line-${option.value}`"
                  type="button"
                  :class="{ active: measurementStylePreference.editingLineStyle === option.value }"
                  data-testid="mobile-settings-measure-editing-line"
                  @click="updateMeasurementStylePreference({ editingLineStyle: option.value })"
                >
                  {{ isZh ? option.zh : option.en }}
                </button>
              </div>
              <span>{{ isZh ? '完成后' : 'Completed' }}</span>
              <div class="mobile-settings__mini-segmented">
                <button
                  v-for="option in lineStyleOptions"
                  :key="`completed-line-${option.value}`"
                  type="button"
                  :class="{ active: measurementStylePreference.completedLineStyle === option.value }"
                  data-testid="mobile-settings-measure-completed-line"
                  @click="updateMeasurementStylePreference({ completedLineStyle: option.value })"
                >
                  {{ isZh ? option.zh : option.en }}
                </button>
              </div>
            </div>
          </div>

          <div class="mobile-settings__control-block">
            <div class="mobile-settings__subhead">{{ isZh ? '绘制作用范围' : 'Drawing Scope' }}</div>
            <div class="mobile-settings__scope-list">
              <div
                v-for="row in drawingScopeRows"
                :key="row.key"
                class="mobile-settings__scope-row"
              >
                <span>{{ row.title }}</span>
                <div class="mobile-settings__mini-segmented">
                  <button
                    type="button"
                    :class="{ active: safeDrawingScopePreference[row.key] === 'image' }"
                    data-testid="mobile-settings-drawing-scope-image"
                    @click="updateDrawingScopePreference(row.key, 'image')"
                  >
                    {{ isZh ? '当前影像' : 'Image' }}
                  </button>
                  <button
                    type="button"
                    :class="{ active: safeDrawingScopePreference[row.key] === 'series' }"
                    data-testid="mobile-settings-drawing-scope-series"
                    @click="updateDrawingScopePreference(row.key, 'series')"
                  >
                    {{ isZh ? '整个 series' : 'Series' }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="mobile-settings__control-block">
            <div class="mobile-settings__subhead">ROI</div>
            <div class="mobile-settings__option-grid mobile-settings__roi-grid">
              <button
                v-for="option in roiStatOptions"
                :key="option.key"
                type="button"
                class="mobile-settings__option"
                :class="{ active: option.enabled }"
                data-testid="mobile-settings-roi-stat"
                @click="updateRoiStatOption(option.key, !option.enabled)"
              >
                <span>{{ option.label }}</span>
              </button>
            </div>
          </div>
        </section>

        <section v-else-if="activePanel === 'dicomExport'" class="mobile-settings__section">
          <div class="mobile-settings__note-card">
            <AppIcon name="tag" :size="18" />
            <span>
              <strong>{{ isZh ? 'DICOM Tag 浏览' : 'DICOM Tag Browser' }}</strong>
              <small>{{ isZh ? '简洁浏览布局' : 'Compact browsing layout' }}</small>
            </span>
          </div>

          <div class="mobile-settings__control-block">
            <div class="mobile-settings__subhead">{{ isZh ? '导出文件名' : 'Export File Name' }}</div>
            <button
              type="button"
              class="mobile-settings__switch-row mobile-settings__switch-row--embedded"
              data-testid="mobile-settings-export-default-name"
              @click="updateExportPreference({ useDefaultFileName: !exportPreference.useDefaultFileName })"
            >
              <span>
                <strong>{{ isZh ? '自动使用默认文件名' : 'Use automatic file name' }}</strong>
                <small>{{ exportPreference.useDefaultFileName ? (isZh ? '导出时直接按序列和视口命名' : 'Exports are named from series and viewport') : (isZh ? '导出前询问文件名' : 'Ask for a file name before export') }}</small>
              </span>
              <span class="mobile-settings__switch" :class="{ 'mobile-settings__switch--on': exportPreference.useDefaultFileName }" aria-hidden="true">
                <span></span>
              </span>
            </button>
          </div>

          <div class="mobile-settings__control-block">
            <div class="mobile-settings__subhead">{{ isZh ? 'PNG 截图内容' : 'PNG Snapshot Content' }}</div>
            <button
              type="button"
              class="mobile-settings__switch-row mobile-settings__switch-row--embedded"
              data-testid="mobile-settings-export-png-measurements"
              @click="updateExportPreference({ includePngMeasurements: !exportPreference.includePngMeasurements })"
            >
              <span><strong>{{ isZh ? '包含测量' : 'Measurements' }}</strong></span>
              <span class="mobile-settings__switch" :class="{ 'mobile-settings__switch--on': exportPreference.includePngMeasurements }" aria-hidden="true"><span></span></span>
            </button>
            <button
              type="button"
              class="mobile-settings__switch-row mobile-settings__switch-row--embedded"
              data-testid="mobile-settings-export-png-annotations"
              @click="updateExportPreference({ includePngAnnotations: !exportPreference.includePngAnnotations })"
            >
              <span><strong>{{ isZh ? '包含标注' : 'Annotations' }}</strong></span>
              <span class="mobile-settings__switch" :class="{ 'mobile-settings__switch--on': exportPreference.includePngAnnotations }" aria-hidden="true"><span></span></span>
            </button>
            <button
              type="button"
              class="mobile-settings__switch-row mobile-settings__switch-row--embedded"
              data-testid="mobile-settings-export-png-corner"
              @click="updateExportPreference({ includePngCornerInfo: !exportPreference.includePngCornerInfo })"
            >
              <span><strong>{{ isZh ? '包含四角信息' : 'Corner Info' }}</strong></span>
              <span class="mobile-settings__switch" :class="{ 'mobile-settings__switch--on': exportPreference.includePngCornerInfo }" aria-hidden="true"><span></span></span>
            </button>
          </div>

          <div class="mobile-settings__control-block">
            <div class="mobile-settings__subhead">{{ isZh ? 'DICOM 导出内容' : 'DICOM Export Content' }}</div>
            <button
              type="button"
              class="mobile-settings__switch-row mobile-settings__switch-row--embedded"
              data-testid="mobile-settings-export-dicom-measurements"
              @click="updateExportPreference({ includeDicomMeasurements: !exportPreference.includeDicomMeasurements })"
            >
              <span><strong>{{ isZh ? '包含测量' : 'Measurements' }}</strong></span>
              <span class="mobile-settings__switch" :class="{ 'mobile-settings__switch--on': exportPreference.includeDicomMeasurements }" aria-hidden="true"><span></span></span>
            </button>
            <button
              type="button"
              class="mobile-settings__switch-row mobile-settings__switch-row--embedded"
              data-testid="mobile-settings-export-dicom-annotations"
              @click="updateExportPreference({ includeDicomAnnotations: !exportPreference.includeDicomAnnotations })"
            >
              <span><strong>{{ isZh ? '包含标注' : 'Annotations' }}</strong></span>
              <span class="mobile-settings__switch" :class="{ 'mobile-settings__switch--on': exportPreference.includeDicomAnnotations }" aria-hidden="true"><span></span></span>
            </button>
          </div>
        </section>

        <section v-else-if="activePanel === 'pacs'" class="mobile-settings__section">
          <div class="mobile-settings__pacs-summary">
            <span class="mobile-settings__pacs-summary-icon">
              <AppIcon name="pacs" :size="20" />
            </span>
            <span>
              <strong>{{ activePacsProfile?.name ?? (isZh ? '未配置 PACS' : 'No PACS profile') }}</strong>
              <small>{{ activePacsProfile ? pacsProfileEndpoint(activePacsProfile) : (isZh ? '新增或启用一个 PACS 配置' : 'Add or enable a PACS profile') }}</small>
            </span>
          </div>

          <div class="mobile-settings__pacs-toolbar">
            <span>{{ isZh ? '配置' : 'Profiles' }} · {{ pacsPreference.profiles.length }}</span>
            <button type="button" data-testid="mobile-settings-pacs-add" @click="startCreatePacsProfile">
              <AppIcon name="plus" :size="16" />
              {{ isZh ? '新增' : 'Add' }}
            </button>
          </div>

          <div v-if="draftPacsProfile" class="mobile-settings__pacs-profile mobile-settings__pacs-profile--editing" data-testid="mobile-settings-pacs-draft">
            <div class="mobile-settings__pacs-profile-head">
              <strong>{{ isZh ? '新增 PACS 配置' : 'New PACS Profile' }}</strong>
              <button type="button" class="mobile-settings__pacs-action" @click="cancelDraftPacsProfile">
                {{ isZh ? '取消' : 'Cancel' }}
              </button>
            </div>
            <div class="mobile-settings__pacs-form">
              <label class="mobile-settings__field">
                <span>{{ isZh ? '名称' : 'Name' }}</span>
                <input class="mobile-settings__input" data-testid="mobile-settings-pacs-draft-name" :value="draftPacsProfile.name" @input="updateDraftPacsProfile({ name: eventValue($event) })" />
              </label>
              <label class="mobile-settings__field">
                <span>{{ isZh ? '协议' : 'Protocol' }}</span>
                <select class="mobile-settings__select" :value="draftPacsProfile.protocol" @change="updateDraftPacsProfile({ protocol: eventValue($event) as PacsDicomwebProfile['protocol'] })">
                  <option v-for="option in pacsProtocolOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
                </select>
              </label>
              <label class="mobile-settings__field">
                <span>{{ isZh ? '预设' : 'Preset' }}</span>
                <select class="mobile-settings__select" :value="draftPacsProfile.preset" @change="applyDraftPacsPreset(eventValue($event) as PacsProfilePreset)">
                  <option v-for="preset in pacsPresetOptions" :key="preset" :value="preset">{{ pacsPresetLabel(preset, isZh) }}</option>
                </select>
              </label>
              <template v-if="draftPacsProfile.protocol === 'dimse'">
                <label class="mobile-settings__field">
                  <span>Host</span>
                  <input class="mobile-settings__input" :value="draftPacsProfile.host" @input="updateDraftPacsProfile({ host: eventValue($event) })" />
                </label>
                <label class="mobile-settings__field">
                  <span>Port</span>
                  <input class="mobile-settings__input" type="number" :value="draftPacsProfile.port" @input="updateDraftPacsProfile({ port: eventNumber($event, draftPacsProfile.port) })" />
                </label>
                <label class="mobile-settings__field">
                  <span>Called AE</span>
                  <input class="mobile-settings__input" :value="draftPacsProfile.calledAeTitle" @input="updateDraftPacsProfile({ calledAeTitle: eventValue($event) })" />
                </label>
                <label class="mobile-settings__field">
                  <span>Client AE</span>
                  <input class="mobile-settings__input" :value="draftPacsProfile.clientAeTitle" @input="updateDraftPacsProfile({ clientAeTitle: eventValue($event) })" />
                </label>
              </template>
              <template v-else>
                <label class="mobile-settings__field">
                  <span>Base URL</span>
                  <input class="mobile-settings__input" data-testid="mobile-settings-pacs-draft-base-url" :value="draftPacsProfile.baseUrl" @input="updateDraftPacsProfile({ baseUrl: eventValue($event) })" />
                </label>
                <label class="mobile-settings__field">
                  <span>QIDO</span>
                  <input class="mobile-settings__input" :value="draftPacsProfile.qidoPath" @input="updateDraftPacsProfile({ qidoPath: eventValue($event) })" />
                </label>
                <label class="mobile-settings__field">
                  <span>WADO</span>
                  <input class="mobile-settings__input" :value="draftPacsProfile.wadoPath" @input="updateDraftPacsProfile({ wadoPath: eventValue($event) })" />
                </label>
              </template>
              <label class="mobile-settings__field">
                <span>{{ isZh ? '认证' : 'Auth' }}</span>
                <select class="mobile-settings__select" :value="draftPacsProfile.authType" @change="updateDraftPacsProfile({ authType: eventValue($event) as PacsAuthType })">
                  <option v-for="auth in pacsAuthOptions" :key="auth" :value="auth">{{ pacsAuthLabel(auth, isZh) }}</option>
                </select>
              </label>
              <label v-if="draftPacsProfile.authType === 'basic'" class="mobile-settings__field">
                <span>{{ isZh ? '用户名' : 'Username' }}</span>
                <input class="mobile-settings__input" :value="draftPacsProfile.username" @input="updateDraftPacsProfile({ username: eventValue($event) })" />
              </label>
              <label v-if="draftPacsProfile.authType === 'basic'" class="mobile-settings__field">
                <span>{{ isZh ? '密码' : 'Password' }}</span>
                <input class="mobile-settings__input" type="password" :value="draftPacsProfile.password" @input="updateDraftPacsProfile({ password: eventValue($event) })" />
              </label>
              <label v-if="draftPacsProfile.authType === 'bearer'" class="mobile-settings__field">
                <span>Token</span>
                <input class="mobile-settings__input" :value="draftPacsProfile.bearerToken" @input="updateDraftPacsProfile({ bearerToken: eventValue($event) })" />
              </label>
            </div>
            <div class="mobile-settings__pacs-actions">
              <button type="button" class="mobile-settings__pacs-action" data-testid="mobile-settings-pacs-draft-test" :disabled="isTestingPacsProfile(draftPacsProfile.id)" @click="testPacsProfile(draftPacsProfile)">
                {{ isTestingPacsProfile(draftPacsProfile.id) ? (isZh ? '测试中' : 'Testing') : (isZh ? '测试连接' : 'Test') }}
              </button>
              <button type="button" class="mobile-settings__pacs-action mobile-settings__pacs-action--primary" data-testid="mobile-settings-pacs-draft-save" @click="saveDraftPacsProfile">
                {{ isZh ? '保存' : 'Save' }}
              </button>
            </div>
            <div
              v-if="pacsTestResultForProfile(draftPacsProfile.id)"
              class="mobile-settings__test-result"
              :class="{ 'mobile-settings__test-result--ok': pacsTestResultForProfile(draftPacsProfile.id)?.ok, 'mobile-settings__test-result--error': !pacsTestResultForProfile(draftPacsProfile.id)?.ok }"
            >
              {{ pacsTestResultForProfile(draftPacsProfile.id)?.message }}
            </div>
          </div>

          <div class="mobile-settings__pacs-profile-list">
            <article
              v-for="profile in pacsPreference.profiles"
              :key="profile.id"
              class="mobile-settings__pacs-profile"
              :class="{ 'mobile-settings__pacs-profile--active': pacsPreference.activeProfileId === profile.id }"
              data-testid="mobile-settings-pacs-profile"
            >
              <div class="mobile-settings__pacs-profile-head">
                <span>
                  <strong>{{ profile.name }}</strong>
                  <small>{{ pacsProfileEndpoint(profile) }}</small>
                </span>
                <span class="mobile-settings__pacs-chip">{{ profile.protocol.toUpperCase() }}</span>
              </div>
              <div class="mobile-settings__pacs-chip-row">
                <span class="mobile-settings__pacs-chip">{{ pacsPresetLabel(profile.preset, isZh) }}</span>
                <span class="mobile-settings__pacs-chip">{{ pacsAuthLabel(profile.authType, isZh) }}</span>
                <span v-if="pacsPreference.activeProfileId === profile.id" class="mobile-settings__pacs-chip mobile-settings__pacs-chip--accent">{{ isZh ? '默认' : 'Default' }}</span>
              </div>
              <div class="mobile-settings__pacs-actions">
                <button type="button" class="mobile-settings__pacs-action" data-testid="mobile-settings-pacs-profile-enabled" @click="updatePacsProfile(profile.id, { enabled: !profile.enabled })">
                  {{ profile.enabled ? (isZh ? '停用' : 'Disable') : (isZh ? '启用' : 'Enable') }}
                </button>
                <button type="button" class="mobile-settings__pacs-action" data-testid="mobile-settings-pacs-profile-default" :disabled="pacsPreference.activeProfileId === profile.id" @click="setDefaultPacsProfile(profile.id)">
                  {{ isZh ? '设为默认' : 'Set Default' }}
                </button>
                <button type="button" class="mobile-settings__pacs-action" data-testid="mobile-settings-pacs-profile-edit" @click="editingPacsProfileId === profile.id ? closePacsProfileDetail() : openPacsProfileDetail(profile.id)">
                  {{ editingPacsProfileId === profile.id ? (isZh ? '收起' : 'Collapse') : (isZh ? '编辑' : 'Edit') }}
                </button>
                <button type="button" class="mobile-settings__pacs-action" data-testid="mobile-settings-pacs-profile-test" :disabled="isTestingPacsProfile(profile.id)" @click="testPacsProfile(profile)">
                  {{ isTestingPacsProfile(profile.id) ? (isZh ? '测试中' : 'Testing') : (isZh ? '测试' : 'Test') }}
                </button>
                <button type="button" class="mobile-settings__pacs-action mobile-settings__pacs-action--danger" data-testid="mobile-settings-pacs-profile-delete" :disabled="pacsPreference.profiles.length <= 1" @click="deletePacsProfile(profile.id)">
                  {{ isZh ? '删除' : 'Delete' }}
                </button>
              </div>
              <div
                v-if="pacsTestResultForProfile(profile.id)"
                class="mobile-settings__test-result"
                :class="{ 'mobile-settings__test-result--ok': pacsTestResultForProfile(profile.id)?.ok, 'mobile-settings__test-result--error': !pacsTestResultForProfile(profile.id)?.ok }"
              >
                {{ pacsTestResultForProfile(profile.id)?.message }}
              </div>
              <div v-if="editingPacsProfileId === profile.id && editingPacsProfile" class="mobile-settings__pacs-form" data-testid="mobile-settings-pacs-edit-form">
                <label class="mobile-settings__field">
                  <span>{{ isZh ? '名称' : 'Name' }}</span>
                  <input class="mobile-settings__input" data-testid="mobile-settings-pacs-profile-name" :value="profile.name" @input="updatePacsProfile(profile.id, { name: eventValue($event) })" />
                </label>
                <label class="mobile-settings__field">
                  <span>{{ isZh ? '协议' : 'Protocol' }}</span>
                  <select class="mobile-settings__select" :value="profile.protocol" @change="updatePacsProfile(profile.id, { protocol: eventValue($event) as PacsDicomwebProfile['protocol'] })">
                    <option v-for="option in pacsProtocolOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
                  </select>
                </label>
                <label class="mobile-settings__field">
                  <span>{{ isZh ? '预设' : 'Preset' }}</span>
                  <select class="mobile-settings__select" :value="profile.preset" @change="applyPacsPreset(profile.id, eventValue($event) as PacsProfilePreset)">
                    <option v-for="preset in pacsPresetOptions" :key="preset" :value="preset">{{ pacsPresetLabel(preset, isZh) }}</option>
                  </select>
                </label>
                <template v-if="profile.protocol === 'dimse'">
                  <label class="mobile-settings__field">
                    <span>Host</span>
                    <input class="mobile-settings__input" :value="profile.host" @input="updatePacsProfile(profile.id, { host: eventValue($event) })" />
                  </label>
                  <label class="mobile-settings__field">
                    <span>Port</span>
                    <input class="mobile-settings__input" type="number" :value="profile.port" @input="updatePacsProfile(profile.id, { port: eventNumber($event, profile.port) })" />
                  </label>
                  <label class="mobile-settings__field">
                    <span>Called AE</span>
                    <input class="mobile-settings__input" :value="profile.calledAeTitle" @input="updatePacsProfile(profile.id, { calledAeTitle: eventValue($event) })" />
                  </label>
                  <label class="mobile-settings__field">
                    <span>Client AE</span>
                    <input class="mobile-settings__input" :value="profile.clientAeTitle" @input="updatePacsProfile(profile.id, { clientAeTitle: eventValue($event) })" />
                  </label>
                </template>
                <template v-else>
                  <label class="mobile-settings__field">
                    <span>Base URL</span>
                    <input class="mobile-settings__input" data-testid="mobile-settings-pacs-profile-base-url" :value="profile.baseUrl" @input="updatePacsProfile(profile.id, { baseUrl: eventValue($event) })" />
                  </label>
                  <label class="mobile-settings__field">
                    <span>QIDO</span>
                    <input class="mobile-settings__input" :value="profile.qidoPath" @input="updatePacsProfile(profile.id, { qidoPath: eventValue($event) })" />
                  </label>
                  <label class="mobile-settings__field">
                    <span>WADO</span>
                    <input class="mobile-settings__input" :value="profile.wadoPath" @input="updatePacsProfile(profile.id, { wadoPath: eventValue($event) })" />
                  </label>
                </template>
                <label class="mobile-settings__field">
                  <span>{{ isZh ? '认证' : 'Auth' }}</span>
                  <select class="mobile-settings__select" :value="profile.authType" @change="updatePacsProfile(profile.id, { authType: eventValue($event) as PacsAuthType })">
                    <option v-for="auth in pacsAuthOptions" :key="auth" :value="auth">{{ pacsAuthLabel(auth, isZh) }}</option>
                  </select>
                </label>
              </div>
            </article>
          </div>
        </section>

        <section v-else-if="activePanel === 'playback'" class="mobile-settings__section">
          <div class="mobile-settings__control-block">
            <div class="mobile-settings__range-head">
              <span class="mobile-settings__subhead">{{ isZh ? '翻页灵敏度' : 'Page Sensitivity' }}</span>
              <strong>{{ isZh ? gestureSensitivityLabels[gestureSensitivity].zh : gestureSensitivityLabels[gestureSensitivity].en }}</strong>
            </div>
            <input
              class="mobile-settings__range"
              data-testid="mobile-settings-gesture-sensitivity"
              type="range"
              min="0"
              :max="MOBILE_GESTURE_SENSITIVITY_OPTIONS.length - 1"
              step="1"
              :value="gestureSensitivityIndex"
              @input="handleGestureSensitivityInput"
            />
            <div class="mobile-settings__range-ticks" aria-hidden="true">
              <span v-for="item in MOBILE_GESTURE_SENSITIVITY_OPTIONS" :key="item">{{ isZh ? gestureSensitivityLabels[item].zh : gestureSensitivityLabels[item].en }}</span>
            </div>
          </div>
          <div class="mobile-settings__subhead">{{ isZh ? '屏幕方向' : 'Orientation Lock' }}</div>
          <div class="mobile-settings__option-grid mobile-settings__orientation-grid">
            <button
              v-for="item in MOBILE_ORIENTATION_LOCK_OPTIONS"
              :key="item"
              type="button"
              class="mobile-settings__option"
              :class="{ active: orientationLock === item }"
              data-testid="mobile-settings-orientation-lock"
              @click="handleOrientationLockClick(item)"
            >
              <AppIcon :name="orientationLockIcon(item)" :size="16" />
              <span>{{ isZh ? orientationLockLabels[item].zh : orientationLockLabels[item].en }}</span>
            </button>
          </div>
        </section>
      </main>
    </div>
  </Teleport>
</template>

<style scoped>
.mobile-settings {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  background: var(--theme-app-background);
  color: var(--theme-text-primary);
}

.mobile-settings__header {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) 40px;
  align-items: center;
  gap: 6px;
  min-height: 56px;
  padding: calc(env(safe-area-inset-top, 0px) + 8px) 12px 8px;
  border-bottom: 1px solid color-mix(in srgb, var(--theme-border-soft) 70%, transparent);
  background: color-mix(in srgb, var(--theme-surface-panel-solid) 90%, transparent);
  backdrop-filter: blur(18px);
}

.mobile-settings__header-title {
  min-width: 0;
  text-align: center;
}

.mobile-settings__header-spacer {
  display: block;
  width: 40px;
  height: 40px;
}

.mobile-settings__title {
  overflow: hidden;
  font-size: 18px;
  font-weight: 900;
  line-height: 1.15;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-settings__icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 80%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-surface-card) 86%, transparent);
  color: var(--theme-text-primary);
}

.mobile-settings__back-button {
  color: var(--theme-accent);
}

.mobile-settings__content {
  min-height: 0;
  overflow: auto;
  padding: 10px 12px calc(env(safe-area-inset-bottom, 0px) + 16px);
}

.mobile-settings__content--detail {
  padding-top: 12px;
}

.mobile-settings__nav-group {
  display: grid;
  gap: 1px;
  overflow: hidden;
  margin-bottom: 10px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 70%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-surface-card) 82%, transparent);
}

.mobile-settings__nav-row {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr) 20px;
  align-items: center;
  gap: 9px;
  min-height: 52px;
  border: 0;
  border-bottom: 1px solid color-mix(in srgb, var(--theme-border-soft) 54%, transparent);
  background: transparent;
  color: var(--theme-text-primary);
  padding: 8px 10px;
  text-align: left;
}

.mobile-settings__nav-row:last-child {
  border-bottom: 0;
}

.mobile-settings__nav-row > .app-icon,
.mobile-settings__nav-row > :first-child {
  justify-self: center;
  color: var(--theme-accent);
}

.mobile-settings__nav-row > :last-child {
  color: var(--theme-text-muted);
}

.mobile-settings__nav-row strong,
.mobile-settings__nav-row small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-settings__nav-row strong {
  font-size: 14px;
  font-weight: 900;
  line-height: 1.15;
}

.mobile-settings__nav-row small {
  margin-top: 2px;
  color: var(--theme-text-muted);
  font-size: 11px;
  font-weight: 800;
  line-height: 1.2;
}

.mobile-settings__section {
  display: grid;
  gap: 10px;
  padding: 0 0 16px;
}

.mobile-settings__subhead {
  margin: 10px 0 7px;
  color: var(--theme-text-muted);
  font-size: 11px;
  font-weight: 900;
}

.mobile-settings__segmented,
.mobile-settings__option-grid {
  display: grid;
  gap: 8px;
}

.mobile-settings__segmented {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.mobile-settings__option-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.mobile-settings__theme-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-top: 8px;
}

.mobile-settings__orientation-grid,
.mobile-settings__plane-grid,
.mobile-settings__sensitivity-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.mobile-settings__fps-grid,
.mobile-settings__roi-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.mobile-settings__segmented button,
.mobile-settings__option,
.mobile-settings__row,
.mobile-settings__switch-row,
.mobile-settings__reset-row,
.mobile-settings__note-card,
.mobile-settings__control-block {
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 72%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-surface-card) 82%, transparent);
  color: var(--theme-text-secondary);
}

.mobile-settings__segmented button,
.mobile-settings__option,
.mobile-settings__row,
.mobile-settings__switch-row,
.mobile-settings__reset-row,
.mobile-settings__note-card {
  min-height: 44px;
}

.mobile-settings__segmented button.active,
.mobile-settings__option.active,
.mobile-settings__row.active {
  border-color: color-mix(in srgb, var(--theme-accent) 64%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-accent) 18%, var(--theme-surface-card));
  color: var(--theme-text-primary);
}

.mobile-settings__option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  text-align: left;
}

.mobile-settings__option strong,
.mobile-settings__option span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-settings__theme-card {
  position: relative;
  display: grid;
  grid-template-rows: 52px auto;
  gap: 8px;
  min-height: 112px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 72%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-surface-card) 82%, transparent);
  color: var(--theme-text-secondary);
  padding: 8px;
  text-align: left;
}

.mobile-settings__theme-card.active {
  border-color: color-mix(in srgb, var(--theme-accent) 64%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-accent) 16%, var(--theme-surface-card));
  color: var(--theme-text-primary);
}

.mobile-settings__theme-preview {
  position: relative;
  display: grid;
  grid-template-rows: 9px minmax(0, 1fr);
  gap: 7px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--theme-border-strong) 70%, transparent);
  border-radius: 8px;
  background: var(--mobile-theme-panel);
  padding: 8px;
}

.mobile-settings__theme-preview-rail {
  display: block;
  border-radius: 999px;
  background: var(--mobile-theme-rail);
}

.mobile-settings__theme-preview-card {
  display: grid;
  grid-template-rows: 8px 1fr;
  gap: 6px;
  min-height: 0;
  width: 68%;
  border-radius: 6px;
  background: var(--mobile-theme-surface);
  padding: 7px;
}

.mobile-settings__theme-preview-card span:first-child,
.mobile-settings__theme-preview-card span:last-child {
  display: block;
  border-radius: 999px;
  background: color-mix(in srgb, var(--mobile-theme-text) 82%, transparent);
}

.mobile-settings__theme-preview-card span:last-child {
  width: 58%;
  opacity: 0.62;
}

.mobile-settings__theme-preview-accent {
  position: absolute;
  right: 8px;
  bottom: 8px;
  width: 22px;
  height: 22px;
  border: 2px solid color-mix(in srgb, var(--mobile-theme-panel) 80%, white);
  border-radius: 999px;
  background: var(--mobile-theme-accent);
}

.mobile-settings__theme-body {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.mobile-settings__theme-body strong,
.mobile-settings__theme-body small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-settings__theme-body strong {
  font-size: 12px;
  font-weight: 900;
}

.mobile-settings__theme-body small {
  color: var(--theme-text-muted);
  font-size: 10px;
  font-weight: 800;
}

.mobile-settings__theme-check {
  position: absolute;
  right: 8px;
  top: 8px;
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-accent) 84%, black);
  color: var(--theme-accent-contrast);
}

.mobile-settings__option small {
  display: block;
  color: var(--theme-text-muted);
  font-size: 11px;
}

.mobile-settings__list {
  display: grid;
  gap: 7px;
}

.mobile-settings__list--window {
  max-height: min(34dvh, 300px);
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-right: 3px;
}

.mobile-settings__row {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr);
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 8px 10px;
  text-align: left;
}

.mobile-settings__row-text {
  min-width: 0;
}

.mobile-settings__row-text strong,
.mobile-settings__row-text small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-settings__row-text small {
  color: var(--theme-text-muted);
  font-size: 11px;
}

.mobile-settings__swatch {
  display: inline-block;
  width: 28px;
  height: 28px;
  flex: 0 0 auto;
  border: 1px solid color-mix(in srgb, var(--theme-border-strong) 78%, transparent);
  border-radius: 8px;
}

.mobile-settings__swatch--pseudocolor {
  position: relative;
  overflow: hidden;
  background: color-mix(in srgb, var(--theme-surface-card) 70%, transparent);
  isolation: isolate;
}

.mobile-settings__swatch--pseudocolor::before {
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  background: var(--mobile-settings-pseudocolor-gradient);
  content: "";
  transform: translateZ(0);
}

.mobile-settings__switch-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  width: 100%;
  margin-top: 9px;
  padding: 9px 10px;
  text-align: left;
}

.mobile-settings__switch-row--embedded {
  margin-top: 0;
  border-color: color-mix(in srgb, var(--theme-border-soft) 54%, transparent);
  background: color-mix(in srgb, var(--theme-surface-panel-solid) 58%, transparent);
}

.mobile-settings__switch-row strong,
.mobile-settings__switch-row small {
  display: block;
}

.mobile-settings__switch-row small {
  margin-top: 3px;
  color: var(--theme-text-muted);
  font-size: 11px;
}

.mobile-settings__reset-row,
.mobile-settings__note-card {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px;
  text-align: left;
}

.mobile-settings__reset-row {
  color: var(--theme-text-primary);
}

.mobile-settings__reset-row > .app-icon,
.mobile-settings__reset-row > :first-child {
  color: var(--theme-accent);
  justify-self: center;
}

.mobile-settings__note-card {
  color: var(--theme-text-secondary);
}

.mobile-settings__note-card > .app-icon,
.mobile-settings__note-card > :first-child {
  color: var(--theme-accent);
  justify-self: center;
}

.mobile-settings__reset-row strong,
.mobile-settings__reset-row small,
.mobile-settings__note-card strong,
.mobile-settings__note-card small {
  display: block;
}

.mobile-settings__reset-row small,
.mobile-settings__note-card small {
  margin-top: 3px;
  color: var(--theme-text-muted);
  font-size: 11px;
}

.mobile-settings__switch {
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 42px;
  height: 24px;
  border: 1px solid color-mix(in srgb, var(--theme-border-strong) 78%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-surface-panel-solid) 88%, transparent);
}

.mobile-settings__switch span {
  width: 18px;
  height: 18px;
  margin-left: 3px;
  border-radius: 999px;
  background: var(--theme-text-muted);
  transition: transform 160ms ease, background 160ms ease;
}

.mobile-settings__switch--on {
  border-color: color-mix(in srgb, var(--theme-accent) 64%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-accent) 30%, var(--theme-surface-panel-solid));
}

.mobile-settings__switch--on span {
  transform: translateX(17px);
  background: var(--theme-accent);
}

.mobile-settings__control-block {
  display: grid;
  gap: 8px;
  padding: 10px;
}

.mobile-settings__control-block .mobile-settings__subhead {
  margin: 0;
}

.mobile-settings__color-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 7px;
}

.mobile-settings__color-grid--compact {
  grid-template-columns: repeat(6, 28px);
}

.mobile-settings__color-swatch-button {
  display: grid;
  place-items: center;
  aspect-ratio: 1;
  min-width: 0;
  min-height: 30px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 72%, transparent);
  border-radius: 999px;
  background: var(--mobile-settings-color);
}

.mobile-settings__color-swatch-button.active {
  border-color: color-mix(in srgb, var(--theme-border-strong) 80%, transparent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--theme-accent) 42%, transparent);
}

.mobile-settings__color-swatch-button span {
  display: block;
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: transparent;
}

.mobile-settings__color-swatch-button.active span {
  background: color-mix(in srgb, white 88%, transparent);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.22);
}

.mobile-settings__color-swatch-button:disabled,
.mobile-settings__corner-color-input:disabled {
  cursor: not-allowed;
}

.mobile-settings__corner-style-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.mobile-settings__corner-style-grid .mobile-settings__option {
  justify-content: center;
  min-height: 40px;
  text-align: center;
}

.mobile-settings__corner-typography-control {
  display: grid;
  gap: 8px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 56%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-surface-panel-solid) 44%, transparent);
  padding: 10px;
}

.mobile-settings__corner-typography-ticks span {
  font-weight: 900;
}

.mobile-settings__corner-typography-tick--active {
  color: var(--theme-text-primary);
}

.mobile-settings__corner-color-mode {
  margin-top: 2px;
}

.mobile-settings__corner-color-stack {
  display: grid;
  gap: 7px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 56%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-surface-panel-solid) 42%, transparent);
  padding: 8px;
}

.mobile-settings__corner-color-stack--disabled {
  opacity: 0.46;
  filter: grayscale(1);
}

.mobile-settings__corner-color-row {
  display: grid;
  grid-template-columns: 40px 46px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  color: var(--theme-text-primary);
}

.mobile-settings__corner-color-label {
  overflow: hidden;
  color: var(--theme-text-secondary);
  font-size: 11px;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-settings__color-grid--corner {
  padding-left: 50px;
}

.mobile-settings__corner-color-input {
  width: 44px;
  height: 36px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 72%, transparent);
  border-radius: 8px;
  background: transparent;
}

.mobile-settings__corner-preview-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 2px;
}

.mobile-settings__corner-preview {
  position: relative;
  min-height: 116px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 68%, transparent);
  border-radius: 8px;
  --mobile-corner-info-preview-font-size: 12px;
  --mobile-corner-info-preview-line-height: 1.36;
}

.mobile-settings__corner-preview--standard {
  --mobile-corner-info-preview-font-size: 11px;
  --mobile-corner-info-preview-line-height: 1.26;
}

.mobile-settings__corner-preview--compact {
  --mobile-corner-info-preview-font-size: 10px;
  --mobile-corner-info-preview-line-height: 1.16;
}

.mobile-settings__corner-preview--dark {
  background:
    radial-gradient(circle at 28% 22%, rgba(96, 165, 250, 0.13), transparent 34%),
    linear-gradient(180deg, #111827, #020409);
}

.mobile-settings__corner-preview--light {
  background:
    radial-gradient(circle at 30% 20%, rgba(96, 165, 250, 0.18), transparent 34%),
    linear-gradient(180deg, #e9f3fb, #b9cbd9);
}

.mobile-settings__corner-preview-label {
  position: absolute;
  top: 7px;
  left: 50%;
  transform: translateX(-50%);
  color: color-mix(in srgb, var(--mobile-corner-info-preview-color) 72%, transparent);
  font-size: 10px;
  font-weight: 900;
}

.mobile-settings__corner-preview-line {
  position: absolute;
  max-width: 48%;
  color: var(--mobile-corner-info-preview-color);
  font-family: var(--font-data);
  font-size: var(--mobile-corner-info-preview-font-size);
  font-weight: 700;
  line-height: var(--mobile-corner-info-preview-line-height);
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.34);
  word-break: break-word;
}

.mobile-settings__corner-preview--light .mobile-settings__corner-preview-line {
  text-shadow:
    0 1px 1px rgba(255, 255, 255, 0.78),
    0 0 3px rgba(15, 23, 42, 0.2);
}

.mobile-settings__corner-preview-line--top-left {
  top: 10px;
  left: 10px;
}

.mobile-settings__corner-preview-line--top-right {
  top: 10px;
  right: 10px;
  text-align: right;
}

.mobile-settings__corner-preview-line--bottom-left {
  bottom: 10px;
  left: 10px;
}

.mobile-settings__crosshair-list {
  display: grid;
  gap: 10px;
}

.mobile-settings__crosshair-row {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.mobile-settings__crosshair-label {
  color: var(--theme-text-primary);
  font-size: 12px;
  font-weight: 900;
}

.mobile-settings__mini-segmented {
  display: grid;
  grid-auto-columns: minmax(32px, 1fr);
  grid-auto-flow: column;
  gap: 5px;
}

.mobile-settings__mini-segmented button {
  min-height: 30px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 72%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-surface-panel-solid) 80%, transparent);
  color: var(--theme-text-secondary);
  font-size: 12px;
  font-weight: 900;
}

.mobile-settings__mini-segmented button.active {
  border-color: color-mix(in srgb, var(--theme-accent) 64%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-accent) 18%, var(--theme-surface-card));
  color: var(--theme-text-primary);
}

.mobile-settings__range-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.mobile-settings__range-head strong {
  color: var(--theme-text-primary);
  font-size: 12px;
}

.mobile-settings__range-head > span {
  color: var(--theme-text-muted);
  font-size: 11px;
  font-weight: 900;
}

.mobile-settings__range {
  width: 100%;
  min-width: 0;
  accent-color: var(--theme-accent);
  touch-action: pan-x;
}

.mobile-settings__range-ticks {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  color: var(--theme-text-muted);
  font-size: 10px;
  font-weight: 900;
}

.mobile-settings__range-ticks span {
  min-width: 0;
  text-align: center;
}

.mobile-settings__line-style-grid {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
}

.mobile-settings__line-style-grid > span {
  color: var(--theme-text-muted);
  font-size: 12px;
  font-weight: 900;
}

.mobile-settings__scope-list {
  display: grid;
  gap: 8px;
}

.mobile-settings__scope-row {
  display: grid;
  grid-template-columns: minmax(72px, 0.8fr) minmax(0, 1fr);
  align-items: center;
  gap: 8px;
}

.mobile-settings__scope-row > span {
  min-width: 0;
  overflow: hidden;
  color: var(--theme-text-primary);
  font-size: 12px;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-settings__pacs-summary,
.mobile-settings__pacs-profile {
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 72%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-surface-card) 82%, transparent);
}

.mobile-settings__pacs-summary {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  padding: 10px;
}

.mobile-settings__pacs-summary-icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border: 1px solid color-mix(in srgb, var(--theme-accent) 36%, var(--theme-border-soft));
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-accent) 12%, transparent);
  color: var(--theme-accent);
}

.mobile-settings__pacs-summary strong,
.mobile-settings__pacs-summary small,
.mobile-settings__pacs-profile strong,
.mobile-settings__pacs-profile small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-settings__pacs-summary strong,
.mobile-settings__pacs-profile strong {
  color: var(--theme-text-primary);
  font-size: 14px;
  font-weight: 900;
}

.mobile-settings__pacs-summary small,
.mobile-settings__pacs-profile small {
  margin-top: 3px;
  color: var(--theme-text-muted);
  font-size: 11px;
  font-weight: 800;
}

.mobile-settings__pacs-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 6px;
  color: var(--theme-text-muted);
  font-size: 12px;
  font-weight: 900;
}

.mobile-settings__pacs-toolbar button,
.mobile-settings__pacs-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 34px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 72%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-surface-panel-solid) 78%, transparent);
  color: var(--theme-text-secondary);
  padding: 7px 10px;
  font-size: 12px;
  font-weight: 900;
}

.mobile-settings__pacs-profile-list {
  display: grid;
  gap: 10px;
}

.mobile-settings__pacs-profile {
  display: grid;
  gap: 9px;
  padding: 10px;
}

.mobile-settings__pacs-profile--active {
  border-color: color-mix(in srgb, var(--theme-accent) 64%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-accent) 13%, var(--theme-surface-card));
}

.mobile-settings__pacs-profile--editing {
  border-color: color-mix(in srgb, var(--theme-accent) 54%, var(--theme-border-strong));
}

.mobile-settings__pacs-profile-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: 8px;
}

.mobile-settings__pacs-chip-row,
.mobile-settings__pacs-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.mobile-settings__pacs-chip {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 70%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-surface-panel-solid) 72%, transparent);
  color: var(--theme-text-muted);
  padding: 3px 8px;
  font-size: 10px;
  font-weight: 900;
}

.mobile-settings__pacs-chip--accent {
  border-color: color-mix(in srgb, var(--theme-accent) 56%, var(--theme-border-soft));
  background: color-mix(in srgb, var(--theme-accent) 18%, transparent);
  color: var(--theme-text-primary);
}

.mobile-settings__pacs-action--primary {
  border-color: color-mix(in srgb, var(--theme-accent) 62%, var(--theme-border-soft));
  background: color-mix(in srgb, var(--theme-accent) 18%, var(--theme-surface-card));
  color: var(--theme-text-primary);
}

.mobile-settings__pacs-action--danger {
  border-color: color-mix(in srgb, var(--theme-status-danger-border, #ef4444) 58%, var(--theme-border-soft));
  background: color-mix(in srgb, var(--theme-status-danger-bg, #ef4444) 16%, var(--theme-surface-card));
  color: var(--theme-status-danger-text, #fca5a5);
}

.mobile-settings__pacs-action:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.mobile-settings__pacs-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  padding-top: 4px;
}

.mobile-settings__field {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.mobile-settings__field span {
  overflow: hidden;
  color: var(--theme-text-muted);
  font-size: 10px;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-settings__input,
.mobile-settings__select {
  width: 100%;
  min-width: 0;
  min-height: 34px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 72%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-surface-panel-solid) 74%, transparent);
  color: var(--theme-text-primary);
  padding: 7px 9px;
  font: inherit;
  font-size: 12px;
  font-weight: 800;
}

.mobile-settings__test-result {
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 72%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-surface-panel-solid) 70%, transparent);
  color: var(--theme-text-secondary);
  padding: 8px 9px;
  font-size: 11px;
  font-weight: 800;
}

.mobile-settings__test-result--ok {
  border-color: color-mix(in srgb, var(--theme-status-success-border, #22c55e) 58%, var(--theme-border-soft));
  color: var(--theme-status-success-text, #86efac);
}

.mobile-settings__test-result--error {
  border-color: color-mix(in srgb, var(--theme-status-danger-border, #ef4444) 58%, var(--theme-border-soft));
  color: var(--theme-status-danger-text, #fca5a5);
}

@media (orientation: landscape) and (max-height: 520px) {
  .mobile-settings__header {
    min-height: 44px;
    padding: calc(env(safe-area-inset-top, 0px) + 5px) 10px 5px;
  }

  .mobile-settings__title {
    font-size: 15px;
  }

  .mobile-settings__icon-button {
    width: 38px;
    height: 36px;
  }

  .mobile-settings__content {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-content: start;
    gap: 0 14px;
    padding: 8px 10px calc(env(safe-area-inset-bottom, 0px) + 10px);
  }

  .mobile-settings__content--detail {
    grid-template-columns: minmax(0, 1fr);
  }

  .mobile-settings__nav-group {
    margin-bottom: 10px;
  }

  .mobile-settings__nav-row {
    min-height: 48px;
  }

  .mobile-settings__section {
    padding: 8px 0 10px;
  }

  .mobile-settings__subhead {
    margin: 7px 0 5px;
  }

  .mobile-settings__segmented button,
  .mobile-settings__option,
  .mobile-settings__row,
  .mobile-settings__switch-row {
    min-height: 38px;
  }

  .mobile-settings__theme-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .mobile-settings__theme-card {
    grid-template-rows: 34px auto;
    min-height: 78px;
  }

  .mobile-settings__list--window {
    max-height: 158px;
  }
}
</style>
