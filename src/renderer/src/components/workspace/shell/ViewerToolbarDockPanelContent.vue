<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import AppIcon from '../../AppIcon.vue'
import DockInfoPopover from './DockInfoPopover.vue'
import LayoutMenuPanel from './LayoutMenuPanel.vue'
import MprLayoutMenuPanel from './MprLayoutMenuPanel.vue'
import PseudocolorBand from './PseudocolorBand.vue'
import {
  DEFAULT_FUSION_PET_PSEUDOCOLOR_PRESET,
  DEFAULT_FUSION_PET_WINDOW_MAX,
  DEFAULT_FUSION_PET_WINDOW_MIN,
  DEFAULT_PET_RANGE_UPPER_LIMIT,
  DEFAULT_PET_STANDALONE_PSEUDOCOLOR_PRESET,
  FUSION_PET_PSEUDOCOLOR_PRESET_OPTIONS,
  getFusionPetPseudocolorGradient,
  getPseudocolorGradient,
  normalizePetRangeUpperLimit,
  normalizeFusionPetPseudocolorPresetKey,
  normalizePseudocolorPresetKey
} from '../../../constants/pseudocolor'
import type { DrawingScope, ViewerTabItem } from '../../../types/viewer'
import {
  isStackToolOptionSelected,
  resolveStackToolOptionSelectionMode,
  type StackTool,
  type StackToolOption,
  type StackToolOptionSelectBehavior
} from './toolbarTypes'
import { useUiLocale } from '../../../composables/ui/useUiLocale'
import { useUiPreferences, type DrawingScopePreference } from '../../../composables/ui/useUiPreferences'

const props = defineProps<{
  activeTab: ViewerTabItem
  isPlaybackPaused: boolean
  isPlaying: boolean
  menuIconSize: number
  stackToolSelections: Partial<Record<string, string>>
  tool: StackTool
}>()

const emit = defineEmits<{
  applyTool: [tool: StackTool, behavior?: StackToolOptionSelectBehavior]
  endPlayback: [behavior?: StackToolOptionSelectBehavior]
  pausePlayback: [behavior?: StackToolOptionSelectBehavior]
  openSettings: [sectionKey?: string]
  select: [optionValue: string]
}>()

const { locale, toolbarCopy: copy } = useUiLocale()
const { drawingScopePreference, setDrawingScopePreference } = useUiPreferences()
const customWindowWidth = ref('')
const customWindowLevel = ref('')
const petDraftWindowMax = ref(DEFAULT_FUSION_PET_WINDOW_MAX)
const petRangeUpperLimit = ref(DEFAULT_PET_RANGE_UPPER_LIMIT)
const petRangeUpperLimitInput = ref(String(DEFAULT_PET_RANGE_UPPER_LIMIT))
const zoomSliderDraftValue = ref<number | null>(null)
let zoomSliderTimer: ReturnType<typeof window.setTimeout> | null = null
let pendingZoomSliderValue: number | null = null
const ZOOM_SLIDER_DEBOUNCE_MS = 50
const isZh = computed(() => locale.value === 'zh-CN')
const customWindowCopy = computed(() => ({
  title: isZh.value ? '临时窗值' : 'Custom Window',
  description: isZh.value ? '输入 WW / WL 后立即应用到当前目标视图。' : 'Enter WW / WL and apply it to the current target view.',
  width: isZh.value ? '窗宽 WW' : 'WW',
  level: isZh.value ? '窗位 WL' : 'WL',
  apply: isZh.value ? '应用窗值' : 'Apply Window',
  invalid: isZh.value ? '请输入有效数字，窗宽需大于 0。' : 'Enter valid numbers. WW must be greater than 0.'
}))
const measureActionCopy = computed(() => ({
  clearMeasurements: isZh.value ? '清除测量' : 'Clear Measurements',
  clearMeasurementsDesc: isZh.value ? '移除当前目标视图中的测量结果。' : 'Remove measurements from the current target view.'
}))
const windowActionCopy = computed(() => ({
  resetWindow: isZh.value ? '重置窗值' : 'Reset Window',
  resetWindowDesc: isZh.value ? '恢复已选择窗值；未选择时回到影像内置窗值。' : 'Restore the selected window, or fall back to the image window.'
}))
const settingsJumpCopy = computed(() => ({
  windowPresets: isZh.value ? '窗模板设置' : 'Window Settings',
  measurement: isZh.value ? '测量及标注设置' : 'Measurement & Annotation Settings'
}))
const drawingScopeCopy = computed(() => ({
  title: isZh.value ? '应用范围' : 'Scope',
  measurement: isZh.value ? '新建测量的显示范围。' : 'Default visibility for new measurements.',
  annotation: isZh.value ? '新建标注的显示范围。' : 'Default visibility for new annotations.',
  image: isZh.value ? '当前影像' : 'Image',
  series: isZh.value ? '整个序列' : 'Series'
}))
const transformActionCopy = computed(() => ({
  resetPan: isZh.value ? '重置平移' : 'Reset Pan',
  resetZoom: isZh.value ? '重置缩放' : 'Reset Zoom'
}))
const rotateActionCopy = computed(() => ({
  resetRotation: isZh.value ? '重置旋转' : 'Reset Rotation',
  resetRotationDesc: isZh.value ? '恢复当前视图旋转和镜像状态。' : 'Restore rotation and mirror state for the current view.'
}))
const mprActionCopy = computed(() => ({
  resetCrosshair: isZh.value ? '重置十字线' : 'Reset Crosshair',
  resetRotate3d: isZh.value ? '重置 3D 旋转' : 'Reset 3D Rotation'
}))
const annotationActionCopy = computed(() => ({
  clearAnnotations: isZh.value ? '清除标注' : 'Clear Annotations',
  clearAnnotationsDesc: isZh.value ? '移除当前目标视图中的标注结果。' : 'Remove annotations from the current target view.'
}))
const dockDrawingScopeCopy = computed(() => ({
  ...drawingScopeCopy.value,
  title: isZh.value ? '作用范围' : 'Scope',
  measurement: isZh.value ? '新建测量结果显示在当前影像或整个序列；切换会清空已有测量。' : 'New measurements are shown on the current image or the whole series. Switching clears existing measurements.',
  annotation: isZh.value ? '新建标注显示在当前影像或整个序列；切换会清空已有标注。' : 'New annotations are shown on the current image or the whole series. Switching clears existing annotations.',
  qaWater: isZh.value ? '新建水模 QA 结果基于当前影像或整个序列；切换会清空已有 QA 结果。' : 'New water phantom QA results use the current image or the whole series. Switching clears existing QA results.',
  mtf: isZh.value ? '新建 MTF 绘制显示在当前影像或整个序列；切换会清空已有 MTF 结果。' : 'New MTF drawings are shown on the current image or the whole series. Switching clears existing MTF results.',
  image: isZh.value ? '当前影像' : 'Image',
  series: isZh.value ? '整个序列' : 'Series'
}))

const petDisplayCopy = computed(() => ({
  pseudocolor: isZh.value ? '伪彩' : 'Pseudocolor',
  range: isZh.value ? '强度范围' : 'Intensity Range',
  upper: isZh.value ? '上限' : 'Upper',
  unit: isZh.value ? '单位' : 'Unit',
  reset: isZh.value ? '重置 PET 显示' : 'Reset PET Display',
  resetDesc: isZh.value ? '恢复 PET 强度范围和单位。' : 'Restore PET range and unit.',
  rangeMax: isZh.value ? '范围上限' : 'Range Max'
}))

const isFusionRegistrationActive = computed(() =>
  props.activeTab.viewType === 'PETCTFusion' && props.activeTab.fusionManualRegistration === true
)
const fusionRegistrationCopy = computed(() => ({
  statusLabel: isZh.value ? '状态' : 'Status',
  active: isZh.value ? '手动配准中' : 'Manual registration active',
  inactive: isZh.value ? '未开启' : 'Not active',
  enable: isZh.value ? '开启手动配准' : 'Start Manual Registration',
  disable: isZh.value ? '关闭手动配准' : 'Stop Manual Registration',
  actions: isZh.value ? '配准动作' : 'Registration Actions',
  guide: isZh.value ? '使用说明' : 'Guide',
  leftDrag: isZh.value ? '左键拖动：平移 PET 图像。' : 'Left drag: move the PET image.',
  rightDrag: isZh.value ? '右键拖动：旋转 PET 图像。' : 'Right drag: rotate the PET image.',
  esc: isZh.value ? 'Esc：退出手动配准模式。' : 'Esc: exit manual registration mode.',
  hint: isZh.value ? '开启后在融合图像上拖动完成配准。' : 'Enable registration, then drag on the fusion image.'
}))
const fusionRegistrationActionCopy = computed<Record<string, { label: string; description: string }>>(() => ({
  'fusionRegistration:reset': {
    label: isZh.value ? '重置配准' : 'Reset Registration',
    description: isZh.value ? '恢复 PET 与 CT 的默认对齐。' : 'Restore the default PET to CT alignment.'
  },
  'fusionRegistration:load': {
    label: isZh.value ? '加载配准' : 'Load Registration',
    description: isZh.value ? '导入已有的 DicomVision 配准文件。' : 'Import a saved DicomVision registration file.'
  },
  'fusionRegistration:save': {
    label: isZh.value ? '保存配准' : 'Save Registration',
    description: isZh.value ? '打开现有保存流程，确认导出模式和位置。' : 'Open the existing save flow to confirm mode and location.'
  },
  'fusionRegistration:exit': {
    label: isZh.value ? '退出配准模式' : 'Exit Registration',
    description: isZh.value ? '停止手动配准并保留当前结果。' : 'Stop manual registration and keep the current result.'
  }
}))
const fusionRegistrationActions = computed(() =>
  (props.tool.options ?? []).filter((option) => option.value !== 'fusionRegistration:toggle')
)
const petUnitOptions = [
  { value: 'SUVbw', label: 'g/ml (SUVbw)' },
  { value: 'SUVbsa', label: 'cm2/ml' },
  { value: 'SUL', label: 'g/ml* (SUL)' },
  { value: 'kBqml', label: 'kBq/ml' },
  { value: 'percentIDg', label: '%ID/g' },
  { value: 'source', label: 'Source' }
]
const petRangeMaxOptions = [5, 10, 20, 30, 40]

function getActiveLayoutRows(activeTab: ViewerTabItem): number {
  if (activeTab.viewType === 'Layout') {
    return activeTab.layoutTemplate?.rows ?? 1
  }
  return 1
}

function getActiveLayoutColumns(activeTab: ViewerTabItem): number {
  if (activeTab.viewType === 'Layout') {
    return activeTab.layoutTemplate?.columns ?? 1
  }
  return 1
}

function isOptionActive(option: StackToolOption): boolean {
  return isStackToolOptionSelected(props.tool, option, props.stackToolSelections[props.tool.key])
}

const optionSelectionMode = computed(() => resolveStackToolOptionSelectionMode(props.tool))

function optionRole(): 'radio' | 'checkbox' | 'menuitem' {
  if (optionSelectionMode.value === 'single') return 'radio'
  if (optionSelectionMode.value === 'multiple') return 'checkbox'
  return 'menuitem'
}

function isDestructiveAction(action: StackToolOption): boolean {
  const value = action.value.toLowerCase()
  return value.startsWith('clear:')
    || value.startsWith('delete:')
    || value === 'reset:all'
    || value === 'reset:measurements'
    || value === 'reset:annotations'
    || value === 'reset:mtf'
    || value === 'reset:qa-water'
}

function isVolumeOrientationOption(option: StackToolOption): boolean {
  return /^volumeOrientation:[APLRSI]$/.test(option.value)
}

function getVolumeOrientationInitial(option: StackToolOption): string {
  return (option.label.trim()[0] ?? '').toUpperCase()
}

function getVolumeOrientationSuffix(option: StackToolOption): string {
  return option.label.trim().slice(1).toLowerCase()
}

function getSelectedPlaybackFps(value: string | undefined): string {
  const match = String(value ?? '').match(/^playbackFps:(\d+)$/)
  return match?.[1] ?? '5'
}

function parsePlaybackFpsOption(value: string | null | undefined): number | null {
  const match = String(value ?? '').match(/^playbackFps:(\d+)$/)
  const fps = match ? Number(match[1]) : Number.NaN
  return Number.isFinite(fps) ? fps : null
}

const playbackFpsOptions = computed(() =>
  (props.tool.options ?? [])
    .map((option) => ({
      ...option,
      fps: parsePlaybackFpsOption(option.value)
    }))
    .filter((option): option is StackToolOption & { fps: number } => option.fps !== null)
)
const playbackFpsIndex = computed(() => {
  const selectedValue = props.stackToolSelections.play
  const selectedIndex = playbackFpsOptions.value.findIndex((option) => option.value === selectedValue)
  return selectedIndex >= 0 ? selectedIndex : Math.max(0, playbackFpsOptions.value.findIndex((option) => option.fps === 5))
})
const playbackFpsSliderMax = computed(() => Math.max(0, playbackFpsOptions.value.length - 1))

function selectPlaybackFpsIndex(index: number): void {
  const option = playbackFpsOptions.value[Math.max(0, Math.min(playbackFpsSliderMax.value, Math.round(index)))]
  if (option) {
    emit('select', option.value)
  }
}

function handlePlaybackFpsSliderInput(event: Event): void {
  const value = Number((event.target as HTMLInputElement | null)?.value ?? playbackFpsIndex.value)
  selectPlaybackFpsIndex(value)
}

const activeZoomRangeControl = computed(() => (props.tool.rangeControl?.kind === 'zoom' ? props.tool.rangeControl : null))
const zoomSliderValue = computed(() => zoomSliderDraftValue.value ?? activeZoomRangeControl.value?.value ?? 1)

function clampZoomSliderValue(value: number): number {
  const control = activeZoomRangeControl.value
  const fallbackValue = control?.resetValue ?? 1
  if (!control || !Number.isFinite(value)) {
    return fallbackValue
  }
  const stepped = Math.round(value / control.step) * control.step
  return Math.max(control.min, Math.min(control.max, Number(stepped.toFixed(3))))
}

function formatZoomSliderValue(value: number): string {
  const rounded = Number(value.toFixed(value < 1 ? 2 : 1))
  return Number.isInteger(rounded) ? `${rounded}x` : `${rounded}x`
}

function emitZoomSliderValue(value: number): void {
  const normalized = clampZoomSliderValue(value)
  emit('select', `transform:zoom:${normalized}`)
}

function flushPendingZoomSliderValue(): void {
  if (zoomSliderTimer !== null) {
    window.clearTimeout(zoomSliderTimer)
    zoomSliderTimer = null
  }
  if (pendingZoomSliderValue === null) {
    return
  }
  emitZoomSliderValue(pendingZoomSliderValue)
  pendingZoomSliderValue = null
}

function queueZoomSliderValue(value: number): void {
  pendingZoomSliderValue = clampZoomSliderValue(value)
  if (zoomSliderTimer !== null) {
    window.clearTimeout(zoomSliderTimer)
  }
  zoomSliderTimer = window.setTimeout(() => {
    zoomSliderTimer = null
    if (pendingZoomSliderValue !== null) {
      emitZoomSliderValue(pendingZoomSliderValue)
      pendingZoomSliderValue = null
    }
  }, ZOOM_SLIDER_DEBOUNCE_MS)
}

function setZoomSliderValue(value: number, final = false): void {
  const normalized = clampZoomSliderValue(value)
  zoomSliderDraftValue.value = normalized
  if (final) {
    pendingZoomSliderValue = normalized
    flushPendingZoomSliderValue()
    return
  }
  queueZoomSliderValue(normalized)
}

function handleZoomSliderInput(event: Event): void {
  setZoomSliderValue(Number((event.target as HTMLInputElement | null)?.value ?? zoomSliderValue.value), false)
}

function handleZoomSliderCommit(event: Event): void {
  setZoomSliderValue(Number((event.target as HTMLInputElement | null)?.value ?? zoomSliderValue.value), true)
}

function selectZoomSliderTick(value: number): void {
  setZoomSliderValue(value, true)
}

function isZoomSliderTickActive(value: number): boolean {
  return Math.abs(zoomSliderValue.value - value) < 0.025
}

function parseCustomWindowValue(value: string | number | null | undefined): number | null {
  const parsed = Number.parseFloat(String(value ?? '').trim())
  return Number.isFinite(parsed) ? parsed : null
}

const customWindowWidthValue = computed(() => parseCustomWindowValue(customWindowWidth.value))
const customWindowLevelValue = computed(() => parseCustomWindowValue(customWindowLevel.value))
const canApplyCustomWindow = computed(() => {
  const width = customWindowWidthValue.value
  return width !== null && width > 0 && customWindowLevelValue.value !== null
})

function applyCustomWindow(): void {
  const width = customWindowWidthValue.value
  const level = customWindowLevelValue.value
  if (width === null || level === null || width <= 0) {
    return
  }
  emit('select', `${width}|${level}`)
}

const petDisplayInfo = computed(() =>
  props.activeTab.viewType === 'PET'
    ? props.activeTab.petInfo
    : props.activeTab.fusionInfo
)
const isStandalonePetDisplay = computed(() => props.activeTab.viewType === 'PET')
const petWindowEventPrefix = computed(() => (isStandalonePetDisplay.value ? 'petWindow' : 'fusionPetWindow'))
const petUnitEventPrefix = computed(() => (isStandalonePetDisplay.value ? 'petUnit' : 'fusionPetUnit'))
const petResetEventValue = computed(() => (isStandalonePetDisplay.value ? 'petDisplay:reset' : 'fusionPetDisplay:reset'))
const selectedPetUnit = computed(() => petDisplayInfo.value?.petUnit ?? 'SUVbw')
const selectedPetUnitLabel = computed(() => petUnitOptions.find((option) => option.value === selectedPetUnit.value)?.label ?? selectedPetUnit.value)
const selectedPetPseudocolor = computed(() =>
  isStandalonePetDisplay.value
    ? normalizePseudocolorPresetKey(props.activeTab.petInfo?.pseudocolorPreset ?? DEFAULT_PET_STANDALONE_PSEUDOCOLOR_PRESET)
    : normalizeFusionPetPseudocolorPresetKey(props.activeTab.fusionInfo?.petPseudocolorPreset ?? DEFAULT_FUSION_PET_PSEUDOCOLOR_PRESET)
)
const petPseudocolorOptions = computed(() =>
  isStandalonePetDisplay.value
    ? []
    : FUSION_PET_PSEUDOCOLOR_PRESET_OPTIONS.map((option) => ({
        value: `fusionPetPseudocolor:${option.key}`,
        key: option.key,
        label: option.label,
        gradient: option.gradient
      }))
)
const petRangeGradient = computed(() =>
  isStandalonePetDisplay.value
    ? getPseudocolorGradient(DEFAULT_PET_STANDALONE_PSEUDOCOLOR_PRESET)
    : getFusionPetPseudocolorGradient(selectedPetPseudocolor.value)
)
const petWindowMaxLabel = computed(() => petDraftWindowMax.value.toFixed(petDraftWindowMax.value < 10 ? 2 : 0))

function isLikelyCtWindowLeakedIntoPetRange(minValue: number, maxValue: number): boolean {
  const unit = String(petDisplayInfo.value?.petUnit ?? petDisplayInfo.value?.petUnitLabel ?? '').toLowerCase()
  const isPetQuantUnit = unit.includes('suv') || unit.includes('sul') || unit.includes('g/ml')
  return isPetQuantUnit && minValue < -1 && maxValue >= 100
}

function resolvePetWindowMax(): number {
  const minValue = Number(petDisplayInfo.value?.petWindowMin ?? DEFAULT_FUSION_PET_WINDOW_MIN)
  const maxValue = Number(petDisplayInfo.value?.petWindowMax ?? DEFAULT_FUSION_PET_WINDOW_MAX)
  if (Number.isFinite(minValue) && Number.isFinite(maxValue) && isLikelyCtWindowLeakedIntoPetRange(minValue, maxValue)) {
    return DEFAULT_FUSION_PET_WINDOW_MAX
  }
  return Number.isFinite(maxValue) ? Math.max(DEFAULT_FUSION_PET_WINDOW_MIN, maxValue) : DEFAULT_FUSION_PET_WINDOW_MAX
}

function setPetDraftWindowMax(value: number): void {
  const upperLimit = Math.max(1, petRangeUpperLimit.value)
  petDraftWindowMax.value = Math.max(DEFAULT_FUSION_PET_WINDOW_MIN, Math.min(value, upperLimit))
}

function emitPetWindowMax(value: number): void {
  setPetDraftWindowMax(value)
  emit('select', `${petWindowEventPrefix.value}:${DEFAULT_FUSION_PET_WINDOW_MIN}:${petDraftWindowMax.value}`)
}

function formatPetRangeUpperLimit(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)))
}

function handlePetRangeInput(event: Event): void {
  const value = Number((event.target as HTMLInputElement | null)?.value)
  if (!Number.isFinite(value)) {
    return
  }
  emitPetWindowMax(value)
}

function setPetRangeUpperLimit(value: string | number): void {
  const nextValue = normalizePetRangeUpperLimit(value)
  petRangeUpperLimit.value = nextValue
  petRangeUpperLimitInput.value = formatPetRangeUpperLimit(nextValue)
  setPetDraftWindowMax(petDraftWindowMax.value)
  emitPetWindowMax(petDraftWindowMax.value)
}

function handlePetRangeUpperLimitInput(event: Event): void {
  petRangeUpperLimitInput.value = (event.target as HTMLInputElement | null)?.value ?? ''
}

function commitPetRangeUpperLimitInput(): void {
  setPetRangeUpperLimit(petRangeUpperLimitInput.value)
}

function selectPetPseudocolor(value: string): void {
  emit('select', value)
}

function selectPetUnit(value: string): void {
  emit('select', `${petUnitEventPrefix.value}:${value}`)
}

function getFusionRegistrationActionCopy(option: StackToolOption): { label: string; description: string } {
  return fusionRegistrationActionCopy.value[option.value] ?? {
    label: option.label,
    description: option.description ?? ''
  }
}

function isRotateResetOption(option: StackToolOption): boolean {
  return props.tool.key === 'rotate' && option.value === 'rotate:reset'
}

function isFooterActionOption(option: StackToolOption): boolean {
  return (
    option.value === 'transform:reset' ||
    (props.tool.key === 'crosshair' && option.value === 'mprCrosshair:reset') ||
    (props.tool.key === 'rotate3d' && option.value === 'rotate3d:reset') ||
    (props.tool.key === 'volumeClip' && option.value === 'volumeClip:reset') ||
    isRotateResetOption(option) ||
    (props.tool.key === 'annotate' && option.value === 'reset:annotations')
  )
}

const regularOptions = computed(() => (props.tool.options ?? []).filter((option) => !isFooterActionOption(option)))
const drawingScopeToolKey = computed<keyof DrawingScopePreference | null>(() => {
  if (props.tool.key === 'measure') {
    return 'measurement'
  }
  if (props.tool.key === 'annotate') {
    return 'annotation'
  }
  if (props.tool.key === 'qa') {
    const selectedQaOption = props.stackToolSelections.qa ?? props.tool.options?.find((option) => !option.disabled)?.value ?? 'qa:mtf'
    return selectedQaOption === 'qa:water-phantom' ? 'qaWater' : 'mtf'
  }
  return null
})
const drawingScopeDescription = computed(() => {
  if (drawingScopeToolKey.value === 'measurement') {
    return dockDrawingScopeCopy.value.measurement
  }
  if (drawingScopeToolKey.value === 'annotation') {
    return dockDrawingScopeCopy.value.annotation
  }
  if (drawingScopeToolKey.value === 'qaWater') {
    return dockDrawingScopeCopy.value.qaWater
  }
  if (drawingScopeToolKey.value === 'mtf') {
    return dockDrawingScopeCopy.value.mtf
  }
  return ''
})

function updateDockDrawingScope(scope: DrawingScope): void {
  const key = drawingScopeToolKey.value
  if (!key) {
    return
  }
  if (drawingScopePreference.value[key] === scope) {
    return
  }
  setDrawingScopePreference({
    ...drawingScopePreference.value,
    [key]: scope
  })
  if (key === 'measurement') {
    emit('select', 'reset:measurements')
  } else if (key === 'annotation') {
    emit('select', 'reset:annotations')
  } else if (key === 'mtf') {
    emit('select', 'reset:mtf')
  } else if (key === 'qaWater') {
    emit('select', 'reset:qa-water')
  }
}

const footerActions = computed(() => {
  const actions: StackToolOption[] = [...(props.tool.footerOptions ?? [])]
  if (props.tool.key === 'window') {
    actions.push({
      value: 'window:reset',
      label: windowActionCopy.value.resetWindow,
      icon: 'reset'
    })
  }
  if (props.tool.key === 'pan' || props.tool.key === 'zoom') {
    actions.push({
      value: 'transform:reset',
      label: props.tool.key === 'pan' ? transformActionCopy.value.resetPan : transformActionCopy.value.resetZoom,
      icon: 'reset'
    })
  }
  if (props.tool.key === 'crosshair') {
    actions.push({
      value: 'mprCrosshair:reset',
      label: mprActionCopy.value.resetCrosshair,
      icon: 'reset'
    })
  }
  if (props.tool.key === 'rotate3d') {
    actions.push({
      value: 'rotate3d:reset',
      label: mprActionCopy.value.resetRotate3d,
      icon: 'reset'
    })
  }
  if (props.tool.key === 'volumeClip') {
    const resetOption = props.tool.options?.find((option) => option.value === 'volumeClip:reset')
    if (resetOption) {
      actions.push({
        ...resetOption,
        label: isZh.value ? '重置裁剪' : 'Reset Clip'
      })
    }
  }
  if (props.tool.key === 'measure') {
    actions.push({
      value: 'reset:measurements',
      label: measureActionCopy.value.clearMeasurements,
      icon: 'reset'
    })
  }
  if (props.tool.key === 'annotate') {
    actions.push({
      value: 'reset:annotations',
      label: annotationActionCopy.value.clearAnnotations,
      icon: 'reset'
    })
  }
  if (props.tool.key === 'rotate') {
    const resetOption = props.tool.options?.find(isRotateResetOption)
    if (resetOption) {
      actions.push({
        ...resetOption,
        label: rotateActionCopy.value.resetRotation
      })
    }
  }
  return actions
})

function shouldShowOptionDescriptionInline(option: StackToolOption): boolean {
  return Boolean(option.description) && (props.tool.key === 'window' || props.tool.key === 'volumeOrientation')
}

function shouldShowGroupLabel(option: StackToolOption, optionIndex: number): boolean {
  return props.tool.key !== 'qa' && Boolean(option.group) && option.group !== regularOptions.value[optionIndex - 1]?.group
}

function getFooterActionTestId(option: StackToolOption): string {
  if (props.tool.key === 'rotate' && option.value === 'rotate:reset') {
    return 'viewer-toolbar-dock-rotate-reset'
  }
  return `viewer-toolbar-dock-${props.tool.key}-${option.value.replace(/[^a-zA-Z0-9]+/g, '-')}`
}

watch(
  () => [props.activeTab.key, props.activeTab.viewType, petDisplayInfo.value?.petWindowMin, petDisplayInfo.value?.petWindowMax] as const,
  () => {
    const nextMax = resolvePetWindowMax()
    petRangeUpperLimit.value = Math.max(DEFAULT_PET_RANGE_UPPER_LIMIT, Math.ceil(nextMax))
    petRangeUpperLimitInput.value = formatPetRangeUpperLimit(petRangeUpperLimit.value)
    petDraftWindowMax.value = nextMax
  },
  { immediate: true }
)

watch(
  () => [props.tool.key, props.tool.rangeControl?.value] as const,
  () => {
    zoomSliderDraftValue.value = null
    pendingZoomSliderValue = null
    if (zoomSliderTimer !== null) {
      window.clearTimeout(zoomSliderTimer)
      zoomSliderTimer = null
    }
  }
)

onBeforeUnmount(() => {
  if (zoomSliderTimer !== null) {
    window.clearTimeout(zoomSliderTimer)
    zoomSliderTimer = null
  }
})
</script>

<template>
  <div
    class="viewer-toolbar-dock-panel-content"
    :class="[
      `viewer-toolbar-dock-panel-content--${tool.key}`,
      { 'viewer-toolbar-dock-panel-content--with-actions': footerActions.length }
    ]"
  >
    <template v-if="tool.key === 'fusionRegistration'">
      <div class="viewer-toolbar-dock-panel-content__registration">
        <section class="viewer-toolbar-dock-panel-content__registration-status">
          <div>
            <div class="viewer-toolbar-dock-panel-content__section-label">{{ fusionRegistrationCopy.statusLabel }}</div>
            <div class="viewer-toolbar-dock-panel-content__registration-state">
              {{ isFusionRegistrationActive ? fusionRegistrationCopy.active : fusionRegistrationCopy.inactive }}
            </div>
          </div>
          <span
            class="viewer-toolbar-dock-panel-content__registration-dot"
            :class="{ 'viewer-toolbar-dock-panel-content__registration-dot--active': isFusionRegistrationActive }"
            aria-hidden="true"
          ></span>
        </section>

        <button
          type="button"
          class="viewer-toolbar-dock-panel-content__primary-action"
          data-testid="fusion-registration-dock-toggle"
          @click="emit('select', 'fusionRegistration:toggle')"
        >
          <AppIcon name="crosshair" :size="20" />
          <span>{{ isFusionRegistrationActive ? fusionRegistrationCopy.disable : fusionRegistrationCopy.enable }}</span>
        </button>

        <div v-if="isFusionRegistrationActive" class="viewer-toolbar-dock-panel-content__registration-actions">
          <div class="viewer-toolbar-dock-panel-content__section-label">{{ fusionRegistrationCopy.actions }}</div>
          <button
            v-for="option in fusionRegistrationActions"
            :key="option.value"
            type="button"
            class="viewer-toolbar-dock-panel-content__option"
            :data-testid="`fusion-registration-dock-action-${option.value.replace('fusionRegistration:', '')}`"
            @click="emit('select', option.value)"
          >
            <span class="viewer-toolbar-dock-panel-content__option-icon">
              <AppIcon :name="option.icon ?? 'settings'" :size="menuIconSize + 2" />
            </span>
            <span class="viewer-toolbar-dock-panel-content__option-copy">
              <span class="viewer-toolbar-dock-panel-content__option-label">{{ getFusionRegistrationActionCopy(option).label }}</span>
              <DockInfoPopover :text="getFusionRegistrationActionCopy(option).description" />
            </span>
          </button>
        </div>

      </div>
    </template>

    <template v-else-if="tool.key === 'fusionPetDisplay'">
      <div class="viewer-toolbar-dock-panel-content__pet-display">
        <div class="viewer-toolbar-dock-panel-content__pet-display-scroll">
          <section v-if="!isStandalonePetDisplay" class="viewer-toolbar-dock-panel-content__pet-section">
            <div class="viewer-toolbar-dock-panel-content__section-label">{{ petDisplayCopy.pseudocolor }}</div>
            <div class="viewer-toolbar-dock-panel-content__pet-pseudocolor-grid">
              <button
                v-for="option in petPseudocolorOptions"
                :key="option.value"
                type="button"
                role="radio"
                :aria-checked="option.key === selectedPetPseudocolor"
                class="viewer-toolbar-dock-panel-content__pet-pseudocolor-option"
                :class="{ 'viewer-toolbar-dock-panel-content__pet-pseudocolor-option--active': option.key === selectedPetPseudocolor }"
                @click="selectPetPseudocolor(option.value)"
              >
                <span
                  class="viewer-toolbar-dock-panel-content__pet-pseudocolor-band"
                  :style="{ '--pet-pseudocolor-gradient': option.gradient }"
                ></span>
                <span>{{ option.label }}</span>
                <AppIcon v-if="option.key === selectedPetPseudocolor" name="check" :size="14" />
              </button>
            </div>
          </section>

          <section class="viewer-toolbar-dock-panel-content__pet-section">
            <div class="viewer-toolbar-dock-panel-content__pet-section-header">
              <div class="viewer-toolbar-dock-panel-content__section-label">{{ petDisplayCopy.range }}</div>
              <strong>{{ petWindowMaxLabel }}</strong>
            </div>
            <div class="viewer-toolbar-dock-panel-content__pet-range-track" :style="{ '--pet-range-gradient': petRangeGradient }">
              <input
                type="range"
                min="0"
                :max="petRangeUpperLimit"
                step="0.01"
                :value="petDraftWindowMax"
                :aria-label="petDisplayCopy.upper"
                @input="handlePetRangeInput"
              />
            </div>
            <div class="viewer-toolbar-dock-panel-content__pet-range-max">
              <span>{{ petDisplayCopy.rangeMax }}</span>
              <input
                class="viewer-toolbar-dock-panel-content__pet-range-max-input"
                type="number"
                inputmode="decimal"
                min="1"
                max="999"
                step="any"
                :value="petRangeUpperLimitInput"
                :aria-label="petDisplayCopy.rangeMax"
                @input="handlePetRangeUpperLimitInput"
                @change="commitPetRangeUpperLimitInput"
                @keydown.enter.prevent="commitPetRangeUpperLimitInput"
              />
              <div>
                <button
                  v-for="option in petRangeMaxOptions"
                  :key="option"
                  type="button"
                  role="radio"
                  :aria-checked="Math.abs(petRangeUpperLimit - option) < 0.001"
                  :class="{ 'viewer-toolbar-dock-panel-content__pet-range-max-option--active': Math.abs(petRangeUpperLimit - option) < 0.001 }"
                  @click="setPetRangeUpperLimit(option)"
                >
                  {{ option }}
                </button>
              </div>
            </div>
          </section>

          <section class="viewer-toolbar-dock-panel-content__pet-section">
            <div class="viewer-toolbar-dock-panel-content__pet-section-header">
              <div class="viewer-toolbar-dock-panel-content__section-label">{{ petDisplayCopy.unit }}</div>
              <strong>{{ selectedPetUnitLabel }}</strong>
            </div>
            <div class="viewer-toolbar-dock-panel-content__pet-unit-grid">
              <button
                v-for="option in petUnitOptions"
                :key="option.value"
                type="button"
                role="radio"
                :aria-checked="selectedPetUnit === option.value"
                class="viewer-toolbar-dock-panel-content__chip"
                :class="{ 'viewer-toolbar-dock-panel-content__chip--active': selectedPetUnit === option.value }"
                @click="selectPetUnit(option.value)"
              >
                {{ option.label }}
              </button>
            </div>
          </section>
        </div>

        <div class="viewer-toolbar-dock-panel-content__action-zone viewer-toolbar-dock-panel-content__pet-action-zone">
          <button
            type="button"
            class="viewer-toolbar-dock-panel-content__danger-action"
            data-testid="viewer-toolbar-dock-pet-display-reset"
            @click="emit('select', petResetEventValue)"
          >
            <span class="viewer-toolbar-dock-panel-content__danger-action-icon">
              <AppIcon name="reset" :size="20" />
            </span>
            <span class="viewer-toolbar-dock-panel-content__danger-action-copy">
              <span class="viewer-toolbar-dock-panel-content__danger-action-label">
                {{ petDisplayCopy.reset }}
                <DockInfoPopover :text="petDisplayCopy.resetDesc" />
              </span>
            </span>
          </button>
        </div>
      </div>
    </template>

    <template v-else-if="tool.key === 'play'">
      <div class="viewer-toolbar-dock-panel-content__playback">
        <button
          type="button"
          class="viewer-toolbar-dock-panel-content__primary-action"
          :title="isPlaying ? copy.pausePlayback : isPlaybackPaused ? copy.resumePlayback : tool.label"
          @click="isPlaying || isPlaybackPaused ? emit('pausePlayback', { keepMenuOpen: true }) : emit('applyTool', tool, { keepMenuOpen: true })"
        >
          <AppIcon :name="isPlaying ? 'pause' : 'play'" :size="20" />
          <span>{{ isPlaying ? copy.pausePlayback : isPlaybackPaused ? copy.resumePlayback : tool.label }}</span>
        </button>
        <button
          type="button"
          class="viewer-toolbar-dock-panel-content__secondary-action"
          :disabled="!isPlaying && !isPlaybackPaused"
          :title="copy.stopPlayback"
          @click="emit('endPlayback', { keepMenuOpen: true })"
        >
          <AppIcon name="stop" :size="20" />
          <span>{{ copy.stopPlayback }}</span>
        </button>
      </div>
      <div class="viewer-toolbar-dock-panel-content__section-label">FPS</div>
      <div class="viewer-toolbar-dock-panel-content__fps-slider">
        <input
          type="range"
          min="0"
          :max="playbackFpsSliderMax"
          step="1"
          :value="playbackFpsIndex"
          :aria-valuetext="`FPS ${getSelectedPlaybackFps(stackToolSelections.play)}`"
          @input="handlePlaybackFpsSliderInput"
        />
        <div class="viewer-toolbar-dock-panel-content__fps-ticks">
          <button
            v-for="(option, optionIndex) in playbackFpsOptions"
            :key="option.value"
            type="button"
            role="radio"
            :aria-checked="optionIndex === playbackFpsIndex"
            class="viewer-toolbar-dock-panel-content__fps-tick"
            :class="{ 'viewer-toolbar-dock-panel-content__fps-tick--active': optionIndex === playbackFpsIndex }"
            @click="selectPlaybackFpsIndex(optionIndex)"
          >
            {{ option.fps }}
          </button>
        </div>
      </div>
      <div class="viewer-toolbar-dock-panel-content__current">FPS {{ getSelectedPlaybackFps(stackToolSelections.play) }}</div>
    </template>

    <template v-else-if="tool.menuKind === 'layout'">
      <div class="viewer-toolbar-dock-panel-content__layout">
        <LayoutMenuPanel
          :options="tool.options ?? []"
          :active-rows="getActiveLayoutRows(activeTab)"
          :active-columns="getActiveLayoutColumns(activeTab)"
          @select="emit('select', $event)"
        />
      </div>
    </template>

    <template v-else-if="tool.menuKind === 'mprLayout'">
      <div class="viewer-toolbar-dock-panel-content__layout">
        <MprLayoutMenuPanel
          :options="tool.options ?? []"
          :active-value="stackToolSelections[tool.key]"
          @select="emit('select', $event)"
        />
      </div>
    </template>

    <template v-else>
      <div class="viewer-toolbar-dock-panel-content__options">
        <section
          v-if="activeZoomRangeControl"
          class="viewer-toolbar-dock-panel-content__zoom-control"
          data-testid="viewer-toolbar-dock-zoom-control"
        >
          <div class="viewer-toolbar-dock-panel-content__zoom-header">
            <span>{{ tool.label }}</span>
            <strong>{{ formatZoomSliderValue(zoomSliderValue) }}</strong>
          </div>
          <div class="viewer-toolbar-dock-panel-content__zoom-slider">
            <input
              data-testid="viewer-toolbar-dock-zoom-slider"
              type="range"
              :min="activeZoomRangeControl.min"
              :max="activeZoomRangeControl.max"
              :step="activeZoomRangeControl.step"
              :value="zoomSliderValue"
              :aria-label="tool.label"
              @input="handleZoomSliderInput"
              @change="handleZoomSliderCommit"
              @pointerup="flushPendingZoomSliderValue"
            />
          </div>
          <div class="viewer-toolbar-dock-panel-content__zoom-ticks">
            <button
              v-for="tick in activeZoomRangeControl.ticks"
              :key="tick.value"
              type="button"
              role="radio"
              :aria-checked="isZoomSliderTickActive(tick.value)"
              class="viewer-toolbar-dock-panel-content__zoom-tick"
              :class="{ 'viewer-toolbar-dock-panel-content__zoom-tick--active': isZoomSliderTickActive(tick.value) }"
              @click="selectZoomSliderTick(tick.value)"
            >
              {{ tick.label }}
            </button>
          </div>
        </section>
        <form
          v-if="tool.key === 'window'"
          class="viewer-toolbar-dock-panel-content__custom-window"
          @submit.prevent="applyCustomWindow"
        >
          <div class="viewer-toolbar-dock-panel-content__custom-window-header">
            <div class="viewer-toolbar-dock-panel-content__inline-heading">
              <div class="viewer-toolbar-dock-panel-content__custom-window-title">{{ customWindowCopy.title }}</div>
              <DockInfoPopover :text="customWindowCopy.description" />
            </div>
            <button
              type="button"
              class="viewer-toolbar-dock-panel-content__settings-link"
              :title="settingsJumpCopy.windowPresets"
              @click="emit('openSettings', 'windowPresets')"
            >
              <AppIcon name="settings" :size="14" />
              <span>{{ settingsJumpCopy.windowPresets }}</span>
            </button>
          </div>
          <div class="viewer-toolbar-dock-panel-content__custom-window-grid">
            <label class="viewer-toolbar-dock-panel-content__custom-window-field">
              <span>{{ customWindowCopy.width }}</span>
              <input
                v-model="customWindowWidth"
                type="number"
                inputmode="decimal"
                step="any"
                min="0.000001"
                placeholder="400"
              />
            </label>
            <label class="viewer-toolbar-dock-panel-content__custom-window-field">
              <span>{{ customWindowCopy.level }}</span>
              <input
                v-model="customWindowLevel"
                type="number"
                inputmode="decimal"
                step="any"
                placeholder="40"
              />
            </label>
          </div>
          <button
            type="submit"
            class="viewer-toolbar-dock-panel-content__custom-window-apply"
            :disabled="!canApplyCustomWindow"
          >
            <AppIcon name="check" :size="14" />
            <span>{{ customWindowCopy.apply }}</span>
          </button>
          <p
            v-if="customWindowWidth || customWindowLevel"
            class="viewer-toolbar-dock-panel-content__custom-window-validation"
            :class="{ 'viewer-toolbar-dock-panel-content__custom-window-validation--ready': canApplyCustomWindow }"
          >
            {{ canApplyCustomWindow ? `WW ${customWindowWidthValue} / WL ${customWindowLevelValue}` : customWindowCopy.invalid }}
          </p>
        </form>
        <section
          v-if="drawingScopeToolKey"
          class="viewer-toolbar-dock-panel-content__scope-card"
        >
          <div class="viewer-toolbar-dock-panel-content__scope-header">
            <div class="viewer-toolbar-dock-panel-content__inline-heading">
              <div class="viewer-toolbar-dock-panel-content__scope-title">{{ dockDrawingScopeCopy.title }}</div>
              <DockInfoPopover :text="drawingScopeDescription" />
            </div>
          </div>
          <div
            class="viewer-toolbar-dock-panel-content__scope-actions"
            role="radiogroup"
            :aria-label="dockDrawingScopeCopy.title"
          >
            <button
              type="button"
              class="viewer-toolbar-dock-panel-content__scope-choice"
              :class="{ 'viewer-toolbar-dock-panel-content__scope-choice--active': drawingScopePreference[drawingScopeToolKey] === 'image' }"
              role="radio"
              :aria-checked="drawingScopePreference[drawingScopeToolKey] === 'image'"
              @click="updateDockDrawingScope('image')"
            >
              <span>{{ dockDrawingScopeCopy.image }}</span>
              <AppIcon v-if="drawingScopePreference[drawingScopeToolKey] === 'image'" name="check" :size="14" />
            </button>
            <button
              type="button"
              class="viewer-toolbar-dock-panel-content__scope-choice"
              :class="{ 'viewer-toolbar-dock-panel-content__scope-choice--active': drawingScopePreference[drawingScopeToolKey] === 'series' }"
              role="radio"
              :aria-checked="drawingScopePreference[drawingScopeToolKey] === 'series'"
              @click="updateDockDrawingScope('series')"
            >
              <span>{{ dockDrawingScopeCopy.series }}</span>
              <AppIcon v-if="drawingScopePreference[drawingScopeToolKey] === 'series'" name="check" :size="14" />
            </button>
          </div>
        </section>
        <div
          class="viewer-toolbar-dock-panel-content__options-scroll"
          :class="{
            'viewer-toolbar-dock-panel-content__options-scroll--window': tool.key === 'window',
            'viewer-toolbar-dock-panel-content__options-scroll--measure': tool.key === 'measure'
          }"
        >
          <template
            v-for="(option, optionIndex) in regularOptions"
            :key="option.value"
          >
            <div
              v-if="shouldShowGroupLabel(option, optionIndex)"
              class="viewer-toolbar-dock-panel-content__group-label"
            >
              {{ option.group }}
            </div>
            <button
              type="button"
              class="viewer-toolbar-dock-panel-content__option"
              :role="optionRole()"
              :aria-checked="optionSelectionMode !== 'none' ? isOptionActive(option) : undefined"
              :class="{
                'viewer-toolbar-dock-panel-content__option--active': isOptionActive(option),
                'viewer-toolbar-dock-panel-content__option--disabled': option.disabled,
                'viewer-toolbar-dock-panel-content__option--destructive': isDestructiveAction(option)
              }"
              :disabled="option.disabled"
              @click="emit('select', option.value)"
            >
              <span
                v-if="tool.key === 'pseudocolor' || option.icon"
                class="viewer-toolbar-dock-panel-content__option-icon"
                :class="{ 'viewer-toolbar-dock-panel-content__option-icon--wide': tool.key === 'pseudocolor' }"
              >
                <PseudocolorBand
                  v-if="tool.key === 'pseudocolor'"
                  compact
                  class="viewer-toolbar-dock-panel-content__pseudocolor-band"
                  :preset="option.swatchKey ?? 'bw'"
                />
                <AppIcon
                  v-else-if="option.icon"
                  :name="option.icon"
                  :size="menuIconSize + 2"
                />
              </span>
              <span class="viewer-toolbar-dock-panel-content__option-copy">
                <span class="viewer-toolbar-dock-panel-content__option-label">
                  <span v-if="isVolumeOrientationOption(option)" class="volume-orientation-option-label">
                    <span class="volume-orientation-option-label__initial">{{ getVolumeOrientationInitial(option) }}</span>
                    <span class="volume-orientation-option-label__suffix">{{ getVolumeOrientationSuffix(option) }}</span>
                  </span>
                  <template v-else>{{ option.label }}</template>
                  <DockInfoPopover v-if="option.description && !shouldShowOptionDescriptionInline(option)" :text="option.description" />
                </span>
                <span
                  v-if="shouldShowOptionDescriptionInline(option)"
                  class="viewer-toolbar-dock-panel-content__option-description"
                >
                  {{ option.description }}
                </span>
              </span>
              <span
                v-if="optionSelectionMode === 'multiple'"
                class="viewer-toolbar-dock-panel-content__check"
                :class="{ 'viewer-toolbar-dock-panel-content__check--active': option.checked }"
              >
                <AppIcon v-if="option.checked" name="check" :size="14" />
              </span>
              <AppIcon
                v-else-if="optionSelectionMode === 'single' && isOptionActive(option)"
                name="check"
                class="viewer-toolbar-dock-panel-content__selected-icon"
                :size="15"
              />
              <span v-else-if="option.badge && tool.key !== 'qa'" class="viewer-toolbar-dock-panel-content__badge">{{ option.badge }}</span>
            </button>
          </template>
        </div>

        <div
          v-if="footerActions.length"
          class="viewer-toolbar-dock-panel-content__action-zone"
        >
          <button
            v-for="action in footerActions"
            :key="action.value"
            type="button"
            class="viewer-toolbar-dock-panel-content__danger-action"
            :class="{
              'viewer-toolbar-dock-panel-content__measure-reset': action.value === 'reset:measurements',
              'viewer-toolbar-dock-panel-content__danger-action--destructive': isDestructiveAction(action)
            }"
            :data-testid="getFooterActionTestId(action)"
            :disabled="action.disabled"
            @click="emit('select', action.value)"
          >
            <span class="viewer-toolbar-dock-panel-content__danger-action-icon">
              <AppIcon :name="action.icon ?? 'settings'" :size="20" />
            </span>
            <span class="viewer-toolbar-dock-panel-content__danger-action-copy">
              <span class="viewer-toolbar-dock-panel-content__danger-action-label">
                {{ action.label }}
                <DockInfoPopover v-if="action.description" :text="action.description" />
              </span>
            </span>
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.viewer-toolbar-dock-panel-content {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  overflow: auto;
}

.viewer-toolbar-dock-panel-content__inline-heading,
.viewer-toolbar-dock-panel-content__option-label,
.viewer-toolbar-dock-panel-content__danger-action-label {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 2px;
}

.viewer-toolbar-dock-panel-content--with-actions {
  min-height: 100%;
  overflow: hidden;
}

.viewer-toolbar-dock-panel-content--window,
.viewer-toolbar-dock-panel-content--fusionPetDisplay {
  min-height: 100%;
  overflow: hidden;
}

.viewer-toolbar-dock-panel-content__options {
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 8px;
}

.viewer-toolbar-dock-panel-content--measure .viewer-toolbar-dock-panel-content__options {
  overflow: hidden;
}

.viewer-toolbar-dock-panel-content__tool-guide {
  flex: 0 0 auto;
  border: 1px dashed color-mix(in srgb, var(--theme-border-soft) 74%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, var(--theme-surface-card) 46%, transparent);
  padding: 9px 10px;
  color: var(--theme-text-muted);
  font-size: 11px;
  font-weight: 650;
  line-height: 1.4;
}

.viewer-toolbar-dock-panel-content__zoom-control {
  display: grid;
  flex: 0 0 auto;
  gap: 10px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 78%, transparent);
  border-radius: 14px;
  background: color-mix(in srgb, var(--theme-surface-card) 58%, transparent);
  padding: 12px;
}

.viewer-toolbar-dock-panel-content__zoom-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: var(--theme-text-muted);
  font-size: 11px;
  font-weight: 800;
}

.viewer-toolbar-dock-panel-content__zoom-header strong {
  color: var(--theme-text-primary);
  font-size: 15px;
  font-weight: 900;
}

.viewer-toolbar-dock-panel-content__zoom-slider {
  position: relative;
  height: 28px;
  display: grid;
  align-items: center;
}

.viewer-toolbar-dock-panel-content__zoom-slider input {
  width: 100%;
  height: 28px;
  margin: 0;
  appearance: none;
  background: transparent;
  cursor: ew-resize;
}

.viewer-toolbar-dock-panel-content__zoom-slider input::-webkit-slider-runnable-track {
  height: 6px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 78%, transparent);
  border-radius: 999px;
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--theme-accent) 55%, transparent), color-mix(in srgb, var(--theme-accent) 14%, transparent)),
    color-mix(in srgb, var(--theme-surface-muted) 82%, transparent);
}

.viewer-toolbar-dock-panel-content__zoom-slider input::-webkit-slider-thumb {
  width: 18px;
  height: 18px;
  margin-top: -7px;
  appearance: none;
  border: 2px solid color-mix(in srgb, var(--theme-surface-panel-strong-solid) 72%, #ffffff);
  border-radius: 999px;
  background: var(--theme-accent);
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--theme-accent) 42%, transparent),
    0 5px 12px rgba(0, 0, 0, 0.26);
}

.viewer-toolbar-dock-panel-content__zoom-slider input::-moz-range-track {
  height: 6px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 78%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-surface-muted) 82%, transparent);
}

.viewer-toolbar-dock-panel-content__zoom-slider input::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border: 2px solid color-mix(in srgb, var(--theme-surface-panel-strong-solid) 72%, #ffffff);
  border-radius: 999px;
  background: var(--theme-accent);
}

.viewer-toolbar-dock-panel-content__zoom-ticks {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}

.viewer-toolbar-dock-panel-content__zoom-tick {
  min-width: 0;
  min-height: 28px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 82%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-surface-card-soft) 64%, transparent);
  color: var(--theme-text-secondary);
  font-size: 11px;
  font-weight: 850;
  transition:
    border-color 150ms ease,
    background 150ms ease,
    color 150ms ease;
}

.viewer-toolbar-dock-panel-content__zoom-tick:hover,
.viewer-toolbar-dock-panel-content__zoom-tick:focus-visible {
  border-color: var(--theme-hover-border);
  background: var(--theme-hover-surface);
  color: var(--theme-text-primary);
  outline: none;
}

.viewer-toolbar-dock-panel-content__zoom-tick--active {
  border-color: color-mix(in srgb, var(--theme-accent) 48%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-accent) 16%, var(--theme-surface-card));
  color: var(--theme-text-primary);
}

.viewer-toolbar-dock-panel-content__options-scroll {
  display: grid;
  align-content: start;
  gap: 8px;
  min-height: 0;
}

.viewer-toolbar-dock-panel-content__options-scroll--window {
  flex: 1 1 auto;
  max-height: none;
  overflow-y: auto;
  padding-right: 2px;
  scrollbar-width: thin;
}

.viewer-toolbar-dock-panel-content__options-scroll--measure {
  flex: 1 1 auto;
  max-height: none;
  overflow-y: auto;
  padding-right: 2px;
  scrollbar-width: thin;
}

.viewer-toolbar-dock-panel-content__measure-guide {
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 76%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, var(--theme-surface-card) 62%, transparent);
  padding: 10px 11px;
  color: var(--theme-text-secondary);
  font-size: 11px;
  line-height: 1.5;
}

.viewer-toolbar-dock-panel-content__measure-guide-title {
  margin-bottom: 3px;
  color: var(--theme-text-primary);
  font-size: 12px;
  font-weight: 750;
}

.viewer-toolbar-dock-panel-content__measure-guide p {
  margin: 0;
}

.viewer-toolbar-dock-panel-content__action-zone {
  display: grid;
  gap: 8px;
  margin-top: auto;
  border-top: 1px solid color-mix(in srgb, var(--theme-border-soft) 72%, transparent);
  padding-top: 10px;
}

.viewer-toolbar-dock-panel-content__registration {
  display: grid;
  align-content: start;
  gap: 10px;
  min-height: 0;
}

.viewer-toolbar-dock-panel-content__registration-status,
.viewer-toolbar-dock-panel-content__registration-guide {
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 82%, transparent);
  border-radius: 14px;
  background: color-mix(in srgb, var(--theme-surface-card) 48%, transparent);
  padding: 12px;
}

.viewer-toolbar-dock-panel-content__registration-status {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.viewer-toolbar-dock-panel-content__registration-state {
  margin-top: 5px;
  color: var(--theme-text-primary);
  font-size: 14px;
  font-weight: 850;
}

.viewer-toolbar-dock-panel-content__registration-description {
  margin: 4px 0 0;
  color: var(--theme-text-muted);
  font-size: 11px;
  line-height: 1.45;
}

.viewer-toolbar-dock-panel-content__registration-dot {
  display: block;
  width: 10px;
  height: 10px;
  margin-top: 4px;
  border-radius: 999px;
  background: var(--theme-text-muted);
  box-shadow: 0 0 0 5px color-mix(in srgb, var(--theme-text-muted) 10%, transparent);
}

.viewer-toolbar-dock-panel-content__registration-dot--active {
  background: var(--theme-accent);
  box-shadow: 0 0 0 5px color-mix(in srgb, var(--theme-accent) 16%, transparent);
}

.viewer-toolbar-dock-panel-content__registration-actions {
  display: grid;
  gap: 8px;
}

.viewer-toolbar-dock-panel-content__registration-guide ul {
  margin: 8px 0 0;
  padding-left: 18px;
  color: var(--theme-text-secondary);
  font-size: 11.5px;
  line-height: 1.6;
}

.viewer-toolbar-dock-panel-content__pet-display {
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 10px;
  overflow: hidden;
}

.viewer-toolbar-dock-panel-content__pet-display-scroll {
  display: grid;
  align-content: start;
  gap: 10px;
  min-height: 0;
  flex: 1 1 auto;
  overflow-y: auto;
  padding-right: 2px;
  scrollbar-width: thin;
}

.viewer-toolbar-dock-panel-content__pet-section {
  display: grid;
  gap: 9px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 78%, transparent);
  border-radius: 14px;
  background: color-mix(in srgb, var(--theme-surface-card) 52%, transparent);
  padding: 10px;
}

.viewer-toolbar-dock-panel-content__pet-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.viewer-toolbar-dock-panel-content__pet-section-header strong {
  color: var(--theme-text-primary);
  font-size: 12px;
  font-weight: 850;
}

.viewer-toolbar-dock-panel-content__pet-pseudocolor-grid,
.viewer-toolbar-dock-panel-content__pet-unit-grid {
  display: grid;
  gap: 7px;
}

.viewer-toolbar-dock-panel-content__pet-pseudocolor-option {
  display: grid;
  min-width: 0;
  min-height: 42px;
  grid-template-columns: 58px minmax(0, 1fr) auto;
  align-items: center;
  gap: 9px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 78%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, var(--theme-surface-card-soft) 58%, transparent);
  padding: 7px 9px;
  color: var(--theme-text-primary);
  font-size: 12px;
  font-weight: 800;
  text-align: left;
}

.viewer-toolbar-dock-panel-content__pet-pseudocolor-option--active {
  border-color: color-mix(in srgb, var(--theme-accent) 42%, var(--theme-border-soft));
  background: color-mix(in srgb, var(--theme-accent) 12%, var(--theme-surface-card));
}

.viewer-toolbar-dock-panel-content__pet-pseudocolor-band {
  position: relative;
  display: block;
  width: 58px;
  height: 18px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 82%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-surface-card) 70%, transparent);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.16);
  isolation: isolate;
}

.viewer-toolbar-dock-panel-content__pet-pseudocolor-band::before {
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  background: var(--pet-pseudocolor-gradient);
  content: "";
  transform: translateZ(0);
}

.viewer-toolbar-dock-panel-content__pet-range-track {
  position: relative;
  height: 28px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 72%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, var(--theme-surface-card) 70%, transparent);
  isolation: isolate;
}

.viewer-toolbar-dock-panel-content__pet-range-track::before {
  position: absolute;
  inset: -1px;
  z-index: 0;
  border-radius: inherit;
  background: var(--pet-range-gradient);
  content: "";
  pointer-events: none;
  transform: translateZ(0);
}

.viewer-toolbar-dock-panel-content__pet-range-track input {
  position: absolute;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  margin: 0;
  appearance: none;
  background: transparent;
  cursor: ew-resize;
}

.viewer-toolbar-dock-panel-content__pet-range-track input::-webkit-slider-thumb {
  width: 12px;
  height: 28px;
  appearance: none;
  border: 0;
  border-radius: 6px;
  background: color-mix(in srgb, var(--theme-text-primary) 62%, var(--theme-accent) 38%);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.28), 0 2px 6px rgba(0, 0, 0, 0.26);
}

.viewer-toolbar-dock-panel-content__pet-range-max {
  display: grid;
  grid-template-columns: auto minmax(0, 64px) minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  color: var(--theme-text-muted);
  font-size: 10.5px;
  font-weight: 800;
}

.viewer-toolbar-dock-panel-content__pet-range-max-input {
  width: 100%;
  min-width: 0;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 82%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-surface-panel-strong-solid) 76%, transparent);
  padding: 5px 8px;
  color: var(--theme-text-primary);
  font-size: 10.5px;
  font-weight: 850;
  outline: none;
  appearance: textfield;
}

.viewer-toolbar-dock-panel-content__pet-range-max-input:focus {
  border-color: color-mix(in srgb, var(--theme-accent) 44%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-accent) 10%, var(--theme-surface-card));
}

.viewer-toolbar-dock-panel-content__pet-range-max div {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 5px;
}

.viewer-toolbar-dock-panel-content__pet-range-max button {
  min-width: 30px;
  min-height: 24px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 82%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-surface-card-soft) 58%, transparent);
  color: var(--theme-text-secondary);
  font-size: 10.5px;
  font-weight: 800;
}

.viewer-toolbar-dock-panel-content__pet-range-max-option--active {
  border-color: color-mix(in srgb, var(--theme-accent) 36%, var(--theme-border-soft)) !important;
  background: color-mix(in srgb, var(--theme-accent) 14%, var(--theme-surface-card)) !important;
  color: var(--theme-text-primary) !important;
}

.viewer-toolbar-dock-panel-content__pet-unit-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.viewer-toolbar-dock-panel-content__pet-action-zone {
  margin-top: auto;
}

.viewer-toolbar-dock-panel-content__custom-window {
  flex: 0 0 auto;
  display: grid;
  gap: 10px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 82%, transparent);
  border-radius: 14px;
  background: color-mix(in srgb, var(--theme-surface-card) 56%, transparent);
  padding: 12px;
}

.viewer-toolbar-dock-panel-content__custom-window-title {
  color: var(--theme-text-primary);
  font-size: 13px;
  font-weight: 850;
}

.viewer-toolbar-dock-panel-content__custom-window-header {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.viewer-toolbar-dock-panel-content__settings-link {
  display: inline-flex;
  min-height: 28px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  gap: 5px;
  border: 1px solid color-mix(in srgb, var(--theme-accent) 28%, var(--theme-border-soft));
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-accent) 8%, var(--theme-surface-card));
  padding: 4px 8px;
  color: var(--theme-text-primary);
  font-size: 10.5px;
  font-weight: 800;
  white-space: nowrap;
}

.viewer-toolbar-dock-panel-content__settings-link:hover,
.viewer-toolbar-dock-panel-content__settings-link:focus-visible {
  border-color: var(--theme-hover-border);
  background: var(--theme-hover-surface);
  outline: none;
}

.viewer-toolbar-dock-panel-content__scope-card {
  display: grid;
  flex: 0 0 auto;
  gap: 10px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 82%, transparent);
  border-radius: 14px;
  background: color-mix(in srgb, var(--theme-surface-card) 56%, transparent);
  padding: 12px;
}

.viewer-toolbar-dock-panel-content__scope-header {
  display: grid;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
  gap: 8px;
}

.viewer-toolbar-dock-panel-content__scope-title {
  color: var(--theme-text-primary);
  font-size: 13px;
  font-weight: 850;
}

.viewer-toolbar-dock-panel-content__scope-description {
  margin: 3px 0 0;
  color: var(--theme-text-muted);
  font-size: 11px;
  line-height: 1.35;
}

.viewer-toolbar-dock-panel-content__scope-settings {
  max-width: 116px;
}

.viewer-toolbar-dock-panel-content__scope-settings span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.viewer-toolbar-dock-panel-content__scope-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 86%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, var(--theme-surface-card-soft) 64%, transparent);
}

.viewer-toolbar-dock-panel-content__scope-choice {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 34px;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--theme-text-secondary);
  padding: 0 10px;
  font-size: 12px;
  font-weight: 800;
  transition:
    border-color 150ms ease,
    background 150ms ease,
    color 150ms ease,
    box-shadow 150ms ease;
}

.viewer-toolbar-dock-panel-content__scope-choice + .viewer-toolbar-dock-panel-content__scope-choice {
  border-left: 1px solid color-mix(in srgb, var(--theme-border-soft) 86%, transparent);
}

.viewer-toolbar-dock-panel-content__scope-choice:hover,
.viewer-toolbar-dock-panel-content__scope-choice:focus-visible {
  border-color: var(--theme-hover-border);
  background: var(--theme-hover-surface);
  color: var(--theme-text-primary);
  outline: none;
}

.viewer-toolbar-dock-panel-content__scope-choice--active {
  border-color: var(--theme-selection-border);
  background: var(--theme-selection-surface);
  color: var(--theme-text-primary);
  box-shadow: var(--theme-selection-shadow);
}

.viewer-toolbar-dock-panel-content__custom-window-description {
  margin: 3px 0 0;
  color: var(--theme-text-muted);
  font-size: 11px;
  line-height: 1.35;
}

.viewer-toolbar-dock-panel-content__custom-window-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.viewer-toolbar-dock-panel-content__custom-window-field {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.viewer-toolbar-dock-panel-content__custom-window-field span {
  color: var(--theme-text-muted);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.viewer-toolbar-dock-panel-content__custom-window-field input {
  width: 100%;
  min-width: 0;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 90%, transparent);
  border-radius: 11px;
  background: color-mix(in srgb, var(--theme-surface-panel-strong-solid) 78%, transparent);
  padding: 9px 10px;
  color: var(--theme-text-primary);
  font-size: 12px;
  font-weight: 800;
  outline: none;
  appearance: textfield;
  transition:
    border-color 150ms ease,
    background 150ms ease;
}

.viewer-toolbar-dock-panel-content__custom-window-field input::-webkit-outer-spin-button,
.viewer-toolbar-dock-panel-content__custom-window-field input::-webkit-inner-spin-button,
.viewer-toolbar-dock-panel-content__pet-range-max-input::-webkit-outer-spin-button,
.viewer-toolbar-dock-panel-content__pet-range-max-input::-webkit-inner-spin-button {
  margin: 0;
  -webkit-appearance: none;
  appearance: none;
}

.viewer-toolbar-dock-panel-content__custom-window-field input:focus {
  border-color: color-mix(in srgb, var(--theme-accent) 50%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-accent) 8%, var(--theme-surface-card));
}

:global(:root[data-theme="clinical-light"]) .viewer-toolbar-dock-panel-content__custom-window-field input,
:global(:root[data-theme="clinical-light"]) .viewer-toolbar-dock-panel-content__pet-range-max-input {
  border-color: color-mix(in srgb, var(--theme-border-strong) 72%, #94a3b8);
  background: #ffffff;
  color: #0f172a;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    0 0 0 1px color-mix(in srgb, var(--theme-border-soft) 46%, transparent);
}

:global(:root[data-theme="clinical-light"]) .viewer-toolbar-dock-panel-content__custom-window-field input::placeholder,
:global(:root[data-theme="clinical-light"]) .viewer-toolbar-dock-panel-content__pet-range-max-input::placeholder {
  color: color-mix(in srgb, var(--theme-text-muted) 78%, transparent);
}

:global(:root[data-theme="clinical-light"]) .viewer-toolbar-dock-panel-content__custom-window-field input:focus,
:global(:root[data-theme="clinical-light"]) .viewer-toolbar-dock-panel-content__pet-range-max-input:focus {
  border-color: color-mix(in srgb, var(--theme-accent) 56%, var(--theme-border-strong));
  background: #ffffff;
  box-shadow:
    0 0 0 3px color-mix(in srgb, var(--theme-accent) 14%, transparent),
    inset 0 1px 0 rgba(255, 255, 255, 0.92);
}

.viewer-toolbar-dock-panel-content__custom-window-apply {
  display: inline-flex;
  min-height: 36px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 1px solid color-mix(in srgb, var(--theme-accent) 46%, var(--theme-border-strong));
  border-radius: 12px;
  background: color-mix(in srgb, var(--theme-accent) 14%, var(--theme-surface-card));
  color: var(--theme-text-primary);
  font-size: 12px;
  font-weight: 850;
  transition:
    border-color 150ms ease,
    background 150ms ease,
    opacity 150ms ease;
}

.viewer-toolbar-dock-panel-content__custom-window-apply:disabled {
  cursor: not-allowed;
  opacity: 0.46;
}

.viewer-toolbar-dock-panel-content__custom-window-apply:not(:disabled):hover,
.viewer-toolbar-dock-panel-content__custom-window-apply:not(:disabled):focus-visible {
  border-color: var(--theme-hover-border);
  background: var(--theme-hover-surface);
  outline: none;
}

.viewer-toolbar-dock-panel-content__custom-window-validation {
  margin: -2px 0 0;
  color: var(--theme-status-danger-text);
  font-size: 10.5px;
  line-height: 1.35;
}

.viewer-toolbar-dock-panel-content__custom-window-validation--ready {
  color: var(--theme-text-muted);
}

.viewer-toolbar-dock-panel-content__measure-reset {
  display: grid;
  min-width: 0;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 11px;
  border: 1px solid color-mix(in srgb, var(--theme-status-danger) 30%, var(--theme-border-soft));
  border-radius: 14px;
  background: color-mix(in srgb, var(--theme-status-danger) 8%, var(--theme-surface-card));
  padding: 10px 12px;
  color: var(--theme-text-primary);
  text-align: left;
  transition:
    border-color 150ms ease,
    background 150ms ease,
    color 150ms ease;
}

.viewer-toolbar-dock-panel-content__measure-reset:hover,
.viewer-toolbar-dock-panel-content__measure-reset:focus-visible {
  border-color: color-mix(in srgb, var(--theme-status-danger) 48%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-status-danger) 13%, var(--theme-surface-card));
  outline: none;
}

.viewer-toolbar-dock-panel-content__measure-reset-icon {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--theme-status-danger) 32%, var(--theme-border-soft));
  border-radius: 12px;
  background: color-mix(in srgb, var(--theme-status-danger) 10%, transparent);
  color: var(--theme-status-danger-text);
}

.viewer-toolbar-dock-panel-content__measure-reset-copy {
  min-width: 0;
}

.viewer-toolbar-dock-panel-content__measure-reset-label,
.viewer-toolbar-dock-panel-content__measure-reset-description {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.viewer-toolbar-dock-panel-content__measure-reset-label {
  font-size: 13px;
  font-weight: 850;
}

.viewer-toolbar-dock-panel-content__measure-reset-description {
  margin-top: 2px;
  color: var(--theme-text-muted);
  font-size: 11px;
}

.viewer-toolbar-dock-panel-content__danger-action {
  display: grid;
  min-width: 0;
  min-height: var(--viewer-tool-option-min-height);
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 11px;
  border: 1px solid var(--theme-border-soft);
  border-radius: var(--viewer-tool-radius);
  background: color-mix(in srgb, var(--theme-surface-card-soft) 88%, transparent);
  padding: 10px 12px;
  color: var(--theme-text-primary);
  text-align: left;
  transition:
    border-color 150ms ease,
    background 150ms ease,
    color 150ms ease,
    opacity 150ms ease;
}

.viewer-toolbar-dock-panel-content__danger-action:hover,
.viewer-toolbar-dock-panel-content__danger-action:focus-visible {
  border-color: var(--theme-hover-border);
  background: var(--theme-hover-surface);
  outline: none;
  box-shadow: var(--theme-focus-ring);
}

.viewer-toolbar-dock-panel-content__danger-action:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.viewer-toolbar-dock-panel-content__danger-action-icon {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border: 1px solid var(--theme-border-soft);
  border-radius: var(--viewer-tool-radius);
  background: color-mix(in srgb, var(--theme-surface-card) 78%, transparent);
  color: var(--theme-text-secondary);
}

.viewer-toolbar-dock-panel-content__danger-action--destructive {
  border-color: color-mix(in srgb, var(--theme-status-danger) 30%, var(--theme-border-soft));
  background: color-mix(in srgb, var(--theme-status-danger) 8%, var(--theme-surface-card));
}

.viewer-toolbar-dock-panel-content__danger-action--destructive:hover,
.viewer-toolbar-dock-panel-content__danger-action--destructive:focus-visible {
  border-color: color-mix(in srgb, var(--theme-status-danger) 48%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-status-danger) 13%, var(--theme-surface-card));
}

.viewer-toolbar-dock-panel-content__danger-action--destructive .viewer-toolbar-dock-panel-content__danger-action-icon {
  border-color: color-mix(in srgb, var(--theme-status-danger) 32%, var(--theme-border-soft));
  background: color-mix(in srgb, var(--theme-status-danger) 10%, transparent);
  color: var(--theme-status-danger-text);
}

.viewer-toolbar-dock-panel-content__danger-action-copy {
  min-width: 0;
}

.viewer-toolbar-dock-panel-content__danger-action-label,
.viewer-toolbar-dock-panel-content__danger-action-description {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.viewer-toolbar-dock-panel-content__danger-action-label {
  font-size: 13px;
  font-weight: 850;
}

.viewer-toolbar-dock-panel-content__danger-action-description {
  margin-top: 2px;
  color: var(--theme-text-muted);
  font-size: 11px;
}

.viewer-toolbar-dock-panel-content__group-label,
.viewer-toolbar-dock-panel-content__section-label {
  color: var(--theme-text-muted);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.viewer-toolbar-dock-panel-content__group-label {
  padding: 4px 8px 0;
}

.viewer-toolbar-dock-panel-content__option {
  position: relative;
  display: grid;
  min-width: 0;
  min-height: var(--viewer-tool-option-min-height);
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  overflow: hidden;
  border: 1px solid transparent;
  border-radius: var(--viewer-tool-radius);
  background: transparent;
  padding: 10px 12px;
  color: var(--theme-text-secondary);
  text-align: left;
  transition:
    border-color 150ms ease,
    background 150ms ease,
    color 150ms ease,
    opacity 150ms ease;
}

.viewer-toolbar-dock-panel-content__option:hover,
.viewer-toolbar-dock-panel-content__option:focus-visible {
  border-color: color-mix(in srgb, var(--theme-accent) 22%, transparent);
  background: color-mix(in srgb, var(--theme-accent) 8%, transparent);
  color: var(--theme-text-primary);
  outline: none;
}

.viewer-toolbar-dock-panel-content__option--active {
  border-color: var(--theme-selection-border);
  background: var(--theme-selection-surface);
  color: var(--theme-text-primary);
  box-shadow: var(--theme-selection-shadow);
}

.viewer-toolbar-dock-panel-content__option--destructive {
  border-color: color-mix(in srgb, var(--theme-danger) 34%, transparent);
  color: var(--theme-danger);
}

.viewer-toolbar-dock-panel-content__option--destructive:hover,
.viewer-toolbar-dock-panel-content__option--destructive:focus-visible {
  border-color: color-mix(in srgb, var(--theme-danger) 56%, transparent);
  background: color-mix(in srgb, var(--theme-danger) 11%, transparent);
  color: var(--theme-danger);
}

.viewer-toolbar-dock-panel-content__option--destructive .viewer-toolbar-dock-panel-content__option-icon {
  border-color: color-mix(in srgb, var(--theme-danger) 34%, transparent);
  color: var(--theme-danger);
}

.viewer-toolbar-dock-panel-content__option--disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.viewer-toolbar-dock-panel-content__option-icon,
.viewer-toolbar-dock-panel-content__check {
  display: grid;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 86%, transparent);
  background: color-mix(in srgb, var(--theme-surface-card) 76%, transparent);
}

.viewer-toolbar-dock-panel-content__option-icon {
  width: 36px;
  height: 36px;
  overflow: hidden;
  border-radius: var(--viewer-tool-radius);
  color: var(--theme-text-primary);
}

.viewer-toolbar-dock-panel-content__option-icon--wide {
  width: 52px;
}

.viewer-toolbar-dock-panel-content__pseudocolor-band {
  width: 42px;
}

.viewer-toolbar-dock-panel-content__option-copy {
  min-width: 0;
}

.viewer-toolbar-dock-panel-content__option-label {
  display: block;
  overflow: hidden;
  color: var(--theme-text-primary);
  font-size: 13px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.volume-orientation-option-label {
  display: inline-flex;
  min-width: 0;
  align-items: baseline;
  letter-spacing: 0;
}

.volume-orientation-option-label__initial {
  color: var(--theme-text-primary);
  font-weight: 900;
}

.volume-orientation-option-label__suffix {
  color: var(--theme-text-muted);
  font-weight: 750;
  text-transform: lowercase;
}

.viewer-toolbar-dock-panel-content__option-description {
  display: block;
  margin-top: 2px;
  overflow: hidden;
  color: var(--theme-text-muted);
  font-size: 11px;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.viewer-toolbar-dock-panel-content--window .viewer-toolbar-dock-panel-content__option {
  height: 64px;
  min-height: 64px;
}

.viewer-toolbar-dock-panel-content--window .viewer-toolbar-dock-panel-content__options {
  overflow: hidden;
}

.viewer-toolbar-dock-panel-content__check {
  width: 28px;
  height: 28px;
  border-radius: 10px;
  color: var(--theme-text-muted);
}

.viewer-toolbar-dock-panel-content__check--active {
  border-color: color-mix(in srgb, var(--theme-accent) 40%, transparent);
  background: color-mix(in srgb, var(--theme-accent) 16%, transparent);
  color: var(--theme-accent);
}

.viewer-toolbar-dock-panel-content__badge {
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 88%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-surface-card) 72%, transparent);
  padding: 3px 7px;
  color: var(--theme-text-muted);
  font-size: 10px;
  font-weight: 800;
}

.viewer-toolbar-dock-panel-content__selected-icon {
  color: var(--theme-accent);
}

.viewer-toolbar-dock-panel-content__layout {
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 78%, transparent);
  border-radius: 14px;
  background: color-mix(in srgb, var(--theme-surface-card) 50%, transparent);
}

.viewer-toolbar-dock-panel-content__layout :deep(.layout-menu-panel),
.viewer-toolbar-dock-panel-content__layout :deep(.mpr-layout-menu-panel) {
  background: transparent;
}

.viewer-toolbar-dock-panel-content__layout :deep(.layout-preset-grid),
.viewer-toolbar-dock-panel-content__layout :deep(.layout-custom-grid) {
  background: transparent;
}

.viewer-toolbar-dock-panel-content__layout :deep(.mpr-layout-menu-panel) {
  grid-template-columns: repeat(5, 32px);
  justify-content: center;
}

.viewer-toolbar-dock-panel-content__playback {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 8px;
}

.viewer-toolbar-dock-panel-content__primary-action,
.viewer-toolbar-dock-panel-content__secondary-action,
.viewer-toolbar-dock-panel-content__chip {
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 86%, transparent);
  background: color-mix(in srgb, var(--theme-surface-card) 78%, transparent);
  color: var(--theme-text-primary);
  transition:
    border-color 150ms ease,
    background 150ms ease,
    color 150ms ease,
    opacity 150ms ease;
}

.viewer-toolbar-dock-panel-content__primary-action,
.viewer-toolbar-dock-panel-content__secondary-action {
  display: inline-flex;
  min-width: 0;
  min-height: var(--viewer-tool-option-min-height);
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: var(--viewer-tool-radius);
  font-size: 12px;
  font-weight: 800;
}

.viewer-toolbar-dock-panel-content__primary-action {
  border-color: color-mix(in srgb, var(--theme-accent) 48%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-accent) 16%, var(--theme-surface-card));
}

.viewer-toolbar-dock-panel-content__secondary-action:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.viewer-toolbar-dock-panel-content__section-label {
  margin-top: 14px;
  padding: 0 4px;
}

.viewer-toolbar-dock-panel-content__fps-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-top: 8px;
}

.viewer-toolbar-dock-panel-content__fps-slider {
  display: grid;
  gap: 10px;
  margin-top: 9px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 82%, transparent);
  border-radius: 14px;
  background: color-mix(in srgb, var(--theme-surface-card) 54%, transparent);
  padding: 12px;
}

.viewer-toolbar-dock-panel-content__fps-slider input[type='range'] {
  width: 100%;
  height: 18px;
  margin: 0;
  appearance: none;
  background: transparent;
  accent-color: var(--theme-accent);
}

.viewer-toolbar-dock-panel-content__fps-slider input[type='range']::-webkit-slider-runnable-track {
  height: 5px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-text-primary) 24%, var(--theme-surface-panel-strong-solid));
}

.viewer-toolbar-dock-panel-content__fps-slider input[type='range']::-webkit-slider-thumb {
  width: 18px;
  height: 18px;
  margin-top: -6.5px;
  appearance: none;
  border: 2px solid color-mix(in srgb, var(--theme-accent) 32%, var(--theme-surface-card));
  border-radius: 999px;
  background: var(--theme-accent);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--theme-accent) 32%, transparent);
}

.viewer-toolbar-dock-panel-content__fps-slider input[type='range']::-moz-range-track {
  height: 5px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--theme-text-primary) 24%, var(--theme-surface-panel-strong-solid));
}

.viewer-toolbar-dock-panel-content__fps-slider input[type='range']::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border: 2px solid color-mix(in srgb, var(--theme-accent) 32%, var(--theme-surface-card));
  border-radius: 999px;
  background: var(--theme-accent);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--theme-accent) 32%, transparent);
}

.viewer-toolbar-dock-panel-content__fps-ticks {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 5px;
}

.viewer-toolbar-dock-panel-content__fps-tick {
  min-width: 0;
  min-height: 28px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 86%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, var(--theme-surface-card) 78%, transparent);
  color: var(--theme-text-muted);
  font-size: 11px;
  font-weight: 850;
  transition:
    border-color 150ms ease,
    background 150ms ease,
    color 150ms ease;
}

.viewer-toolbar-dock-panel-content__fps-tick:hover,
.viewer-toolbar-dock-panel-content__fps-tick:focus-visible {
  border-color: var(--theme-hover-border);
  background: var(--theme-hover-surface);
  color: var(--theme-text-primary);
  outline: none;
}

.viewer-toolbar-dock-panel-content__fps-tick--active {
  border-color: color-mix(in srgb, var(--theme-accent) 44%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-accent) 14%, var(--theme-surface-card));
  color: var(--theme-text-primary);
}

.viewer-toolbar-dock-panel-content__chip {
  min-height: 34px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 900;
}

.viewer-toolbar-dock-panel-content__chip:hover,
.viewer-toolbar-dock-panel-content__chip:focus-visible,
.viewer-toolbar-dock-panel-content__primary-action:hover,
.viewer-toolbar-dock-panel-content__secondary-action:not(:disabled):hover {
  border-color: var(--theme-hover-border);
  background: var(--theme-hover-surface);
  outline: none;
}

.viewer-toolbar-dock-panel-content__chip--active {
  border-color: color-mix(in srgb, var(--theme-accent) 44%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-accent) 14%, var(--theme-surface-card));
  color: var(--theme-text-primary);
}

.viewer-toolbar-dock-panel-content__current {
  margin-top: 10px;
  color: var(--theme-text-muted);
  font-size: 11px;
  font-weight: 800;
  text-align: center;
}
</style>
