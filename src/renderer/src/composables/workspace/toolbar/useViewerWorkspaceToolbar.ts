import { computed, onBeforeUnmount, ref, watch, type ComputedRef, type Ref } from 'vue'
import { STACK_OPERATION_PREFIX, VIEW_OPERATION_TYPES } from '@shared/viewerConstants'
import { PSEUDOCOLOR_PRESET_OPTIONS, toPseudocolorSelectionValue } from '../../../constants/pseudocolor'
import { useUiLocale } from '../../ui/useUiLocale'
import { useUiPreferences } from '../../ui/useUiPreferences'
import { VOLUME_PRESET_OPTIONS, createDefaultVolumeRenderConfig, normalizeVolumePresetKey } from '../volume/volumeRenderConfig'
import { createDefaultSurfaceRenderConfig } from '../volume/surfaceRenderConfig'
import {
  DEFAULT_VOLUME_ORIENTATION_FACE,
  getVolumeOrientationIcon,
  isVolumeOrientationFace,
  resolveVolumeOrientationFace,
  VOLUME_ORIENTATION_FACE_NAMES,
  VOLUME_ORIENTATION_FACES,
  type VolumeOrientationFace
} from '../volume/volumeOrientation'
import type { ViewerExportFormat } from '../export/viewExport'
import {
  createViewerLayoutOptionValue,
  parseViewerLayoutOptionValue,
  VIEWER_LAYOUT_PRESETS
} from '../layout/viewerLayoutTemplates'
import {
  MPR_LAYOUT_OPTIONS,
  parseMprLayoutSelectionValue,
  toMprLayoutSelectionValue
} from '../layout/mprLayoutOptions'
import {
  createMenuController,
  createPlaybackController,
  createToolbarActivationController
} from './toolbarStateMachines'
import {
  COMPARE_STACK_SOURCE_PANE_KEY,
  COMPARE_STACK_TARGET_PANE_KEY,
  FUSION_CT_AXIAL_PANE_KEY,
  FUSION_OVERLAY_AXIAL_PANE_KEY,
  FUSION_PANE_KEYS,
  FUSION_PET_AXIAL_PANE_KEY,
  FUSION_PET_CORONAL_MIP_PANE_KEY,
  isFusionPaneKey
} from '../views/viewerWorkspaceTabs'
import { getViewSyncEnabled, VIEW_SYNC_OPTION_CONFIGS } from '../sync/viewSyncConfig'
import type { ViewerDisplayOverlayKey, ViewerToolbarActionPayload } from '../operations/viewActionTypes'
import {
  createDefaultMprMipConfig,
  createDefaultMprSegmentationConfig,
  normalizeMprSegmentationConfig,
  normalizeMprMipConfig,
  type CompareSyncSettingKey,
  type CompareStackPaneKey,
  type FusionPaneKey,
  type MprCrosshairMode,
  type MprMipConfig,
  type MprSegmentationConfigActionType,
  type MprSegmentationConfig,
  type ViewTransformInfo,
  type ViewerLayoutTemplate,
  type ViewerTabItem,
  type SurfaceRenderConfig,
  type VolumeRenderConfig
} from '../../../types/viewer'
import type { StackTool, StackToolOption, StackToolOptionSelectBehavior } from '../../../components/workspace/shell/toolbarTypes'

const MODE_TOOL_KEYS = new Set(['pan', 'zoom', 'window', 'crosshair', 'rotate3d', 'volumeClip', 'qa', 'mtf', 'annotate'])
const SELECTABLE_TOOL_KEYS = new Set(['pan', 'zoom', 'window', 'crosshair', 'rotate3d', 'volumeClip', 'page', 'measure', 'qa', 'mtf', 'annotate', 'segmentation'])
const DEFAULT_QA_OPERATION = 'qa:mtf'
const WATER_PHANTOM_QA_OPERATION = 'qa:water-phantom'
const STACK_PLAYBACK_DEFAULT_FPS = 5
const STACK_PLAYBACK_FPS_OPTIONS = [1, 2, 5, 10, 15, 30] as const

const ZH_TOOL_LABELS: Record<string, string> = {
  annotate: '标注',
  compareSync: '同步',
  crosshair: '十字线',
  export: '导出',
  fusionManualRegistration: '配准',
  fusionRegistration: '配准',
  fusionPseudocolor: 'PET 伪彩',
  fusionPetDisplay: 'PET 显示',
  fusionRegistrationReset: '重置配准',
  fusionRegistrationSave: '保存配准',
  fusionRegistrationLoad: '加载配准',
  layout: '布局',
  measure: '测量',
  mprLayout: 'MPR 布局',
  mprMip: 'MIP',
  page: '翻页',
  pan: '平移',
  play: '播放',
  pseudocolor: '伪彩',
  qa: 'QA',
  render3dMode: '渲染',
  reset: '重置',
  rotate: '旋转',
  rotate3d: '3D 旋转',
  surfaceParams: 'Surface 参数',
  surfacePreset: 'Surface 预设',
  tag: '标签',
  volumeClip: '裁剪',
  volumeOrientation: '朝向',
  volumeRemoveBed: '去床板',
  volumeParams: '参数',
  volumePreset: '预设',
  window: '窗宽窗位',
  zoom: '缩放'
}

const ZH_OPTION_COPY: Record<string, Partial<StackToolOption>> = {
  'compare-sync:pseudocolor': { label: '伪彩', description: '同步伪彩方案' },
  'compare-sync:reset': { label: '重置', description: '将重置操作同步到当前布局中的所有视图' },
  'compare-sync:scroll': { label: '翻页', description: '同步切片滚动' },
  'compare-sync:transform': { label: '旋转 / 镜像', description: '同步 90° 旋转和镜像翻转' },
  'compare-sync:view': { label: '缩放 / 平移', description: '同步缩放和平移' },
  'compare-sync:window': { label: '窗宽窗位', description: '同步 WW / WL 调整' },
  'dicom-gsps': { description: '保存标注和测量，供支持 GSPS 的 Viewer 叠加显示' },
  'dicom-sr': { description: '结构化测量报告' },
  'measure:angle': { label: '角度' },
  'measure:curve': { label: '曲线' },
  'measure:ellipse': { label: '椭圆' },
  'measure:freeform': { label: '自由手绘' },
  'measure:line': { label: '线段' },
  'measure:rect': { label: '矩形' },
  'volumeClip:inside': { label: '裁剪内部', description: '只显示自由区域投影内的 3D 内容' },
  'volumeClip:outside': { label: '裁剪外部', description: '隐藏自由区域投影内的 3D 内容' },
  'volumeClip:reset': { label: '重置裁剪', description: '恢复完整 3D 体数据投影' },
  'volumeOrientation:reset': { label: '重置朝向', description: '恢复 3D 初始朝向。' },
  'pseudocolor:blackbody': { label: '黑体' },
  'pseudocolor:bw': { label: '黑白' },
  'pseudocolor:bwinverse': { label: '反相黑白' },
  'pseudocolor:cardiac': { label: '心脏' },
  'pseudocolor:hotiron': { label: '热铁' },
  'pseudocolor:rainbow': { label: '彩虹' },
  'qa:mtf': {
    description: '通过金属点 ROI 计算空间分辨率',
    badge: '分辨率',
    group: '空间分辨率'
  },
  'qa:water-phantom': {
    label: '水模 QA',
    description: '自动识别水模并报告准确性、均匀性和噪声',
    badge: '水模',
    group: '水模'
  },
  'render3dMode:surface': { label: '表面', description: '骨表面网格' },
  'render3dMode:volume': { label: 'VR', description: '体渲染' },
  'reset:all': { label: '全部重置', description: '重置视图并清除测量、MTF 和标注。' },
  'reset:annotations': { label: '清除标注', description: '移除当前视图中的所有标注。' },
  'reset:measurements': { label: '清除测量', description: '移除当前视图中的所有测量。' },
  'reset:mtf': { label: '清除 MTF', description: '移除当前视图中的所有 MTF ROI。' },
  'reset:view': { label: '重置视图', description: '重置当前视图参数和显示状态。' },
  'transform:reset': { label: '重置' },
  'window:reset': { label: '重置窗值', description: '恢复当前选择的窗值，或回到影像内置窗值。' },
  'petDisplay:reset': { label: '重置 PET 显示', description: '恢复 PET 强度范围和单位。' },
  'fusionPetDisplay:reset': { label: '重置 PET 显示', description: '恢复 PET 伪彩、单位和强度范围。' },
  'rotate:ccw90': { label: '逆时针 90°' },
  'rotate:cw90': { label: '顺时针 90°' },
  'rotate:mirror-h': { label: '水平镜像' },
  'rotate:mirror-v': { label: '垂直镜像' },
  'rotate:reset': { label: '重置旋转' },
  'surfacePreset:bone': { label: '骨表面' },
  'surfacePreset:softTissue': { label: '软组织/皮肤' },
  'surfacePreset:highDensity': { label: '高密度/金属' },
  'volumePreset:bone': { label: '骨骼' },
  'volumePreset:aaa': { label: 'AAA' },
  'volumePreset:cardiac': { label: '心脏' },
  'volumePreset:xray': { label: 'XRay' },
  'volumePreset:carotid': { label: '颈动脉' },
  'volumePreset:bonePlusPlate': { label: '骨骼 + 钢板' },
  'volumePreset:fracture': { label: '骨折' },
  'volumePreset:lumbar': { label: '腰椎' },
  'volumePreset:hardware': { label: '金属植入物' },
  'volumePreset:lung': { label: '肺' },
  'volumePreset:lung2': { label: '肺 2' },
  'volumePreset:lung3': { label: '肺 3' },
  'volumePreset:renalsStomach': { label: '肾脏-胃' },
  'volumePreset:vesselOutline': { label: '血管轮廓' },
  'volumePreset:bones': { label: '骨骼增强' },
  'volumePreset:coronaryCta': { label: '冠脉 CTA' },
  'volumePreset:bodyCta': { label: '全身 CTA' },
  'volumePreset:neckCta': { label: '颈部 CTA' },
  'volumePreset:mrDefault': { label: 'MR 默认' },
  'volumePreset:mrMip': { label: 'MR-MIP' },
  'volumePreset:mrAngio': { label: 'MR 血管' },
  'volumePreset:cbctRealist': { label: 'CBCT 真实' },
  'volumePreset:cbctBone': { label: 'CBCT 骨骼' },
  'volumePreset:cbctBone2': { label: 'CBCT 骨骼 2' },
  'volumePreset:muscle': { label: '肌肉' },
  'volumePreset:mip': { label: 'MIP' },
  'volumePreset:red': { label: '红色' }
}

const measureTool: StackTool = {
  key: 'measure',
  label: 'Measure',
  icon: 'measure',
  kind: 'action',
  options: [
    { value: 'measure:line', label: 'Line', icon: 'measure-line' },
    { value: 'measure:rect', label: 'Rect', icon: 'measure-rect' },
    { value: 'measure:ellipse', label: 'Ellipse', icon: 'measure-ellipse' },
    { value: 'measure:angle', label: 'Angle', icon: 'measure-angle' },
    { value: 'measure:curve', label: 'Curve', icon: 'measure-curve' },
    { value: 'measure:freeform', label: 'Freeform', icon: 'measure-freeform' }
  ]
}

const qaTool: StackTool = {
  key: 'qa',
  label: 'QA',
  icon: 'qa',
  kind: 'mode',
  showSelectedOptionIcon: false,
  options: [
    {
      value: DEFAULT_QA_OPERATION,
      label: 'MTF',
      icon: 'mtf',
      description: 'Spatial resolution from a metal point ROI',
      badge: 'Resolution',
      group: 'Spatial Resolution'
    },
    {
      value: WATER_PHANTOM_QA_OPERATION,
      label: 'Water Phantom QA',
      icon: 'water-phantom',
      description: 'Auto-detect water phantom and report accuracy, uniformity, and noise',
      badge: 'Water',
      group: 'Water Phantom'
    }
  ]
}

const pseudocolorTool: StackTool = {
  key: 'pseudocolor',
  label: 'Pseudocolor',
  icon: 'pseudocolor',
  swatchKey: 'bw',
  kind: 'action',
  options: PSEUDOCOLOR_PRESET_OPTIONS.map((option) => ({
    value: `pseudocolor:${option.key}`,
    label: option.label,
    icon: 'pseudocolor',
    swatchKey: option.key
  }))
}

function toFusionPseudocolorSelectionValue(value: string | null | undefined): string {
  return `fusionPseudocolor:${String(value ?? 'petct-rainbow').replace(/^pseudocolor:/, '')}`
}

const fusionPetDisplayTool: StackTool = {
  key: 'fusionPetDisplay',
  label: 'PET',
  icon: 'pseudocolor',
  kind: 'action',
  inlineKind: 'fusionPetDisplay',
  showSelectedOptionIcon: false,
  dockOptions: [
    {
      value: 'petDisplay:reset',
      label: 'Reset PET Display',
      icon: 'reset',
      description: 'Restore PET display range and unit.'
    }
  ]
}

const fusionRegistrationTool: StackTool = {
  key: 'fusionRegistration',
  label: 'Registration',
  icon: 'crosshair',
  kind: 'action',
  inlineKind: 'fusionRegistration',
  dockOptions: [
    { value: 'fusionRegistration:toggle', label: 'Manual Registration', icon: 'crosshair' },
    { value: 'fusionRegistration:reset', label: 'Reset Registration', icon: 'reset' },
    { value: 'fusionRegistration:load', label: 'Load Registration', icon: 'folder-import' },
    { value: 'fusionRegistration:save', label: 'Save Registration', icon: 'save' },
    { value: 'fusionRegistration:exit', label: 'Exit Registration', icon: 'close' }
  ]
}

const layoutTool: StackTool = {
  key: 'layout',
  label: 'Layout',
  icon: 'layout',
  kind: 'action',
  menuKind: 'layout',
  showSelectedOptionIcon: false,
  options: VIEWER_LAYOUT_PRESETS.map((template) => ({
    value: createViewerLayoutOptionValue(template),
    label: template.label,
    icon: 'layout',
    layoutRows: template.rows,
    layoutColumns: template.columns
  }))
}

const mprLayoutTool: StackTool = {
  key: 'mprLayout',
  label: 'MPR Layout',
  icon: 'layout',
  kind: 'action',
  menuKind: 'mprLayout',
  showSelectedOptionIcon: false,
  options: MPR_LAYOUT_OPTIONS.map((option) => ({
    value: toMprLayoutSelectionValue(option.key),
    label: option.label,
    icon: 'layout',
    disabled: option.disabled,
    mprLayoutKey: option.key
  }))
}

const MPR_CROSSHAIR_MODE_SELECTION_PREFIX = 'mprCrosshairMode:'
const DISPLAY_OVERLAY_SELECTION_PREFIX = 'display:'
export const EXPORT_TARGET_SELECTION_PREFIX = 'exportTarget:'
type DisplayOverlayKey = ViewerDisplayOverlayKey

function toMprCrosshairModeSelectionValue(mode: MprCrosshairMode): string {
  return `${MPR_CROSSHAIR_MODE_SELECTION_PREFIX}${mode}`
}

function parseMprCrosshairModeSelectionValue(value: string | null | undefined): MprCrosshairMode | null {
  const mode = String(value ?? '').replace(MPR_CROSSHAIR_MODE_SELECTION_PREFIX, '')
  return mode === 'orthogonal' || mode === 'double-oblique' ? mode : null
}

function toDisplayOverlaySelectionValue(key: DisplayOverlayKey): string {
  return `${DISPLAY_OVERLAY_SELECTION_PREFIX}${key}`
}

function parseDisplayOverlaySelectionValue(value: string | null | undefined): DisplayOverlayKey | null {
  const key = String(value ?? '').replace(DISPLAY_OVERLAY_SELECTION_PREFIX, '')
  return key === 'cornerInfo' || key === 'scaleBar' || key === 'pseudocolorBar' || key === 'sliceSlider' || key === 'crosshair' || key === 'volumeOrientationCube' ? key : null
}

function toExportTargetSelectionValue(viewportKey: string): string {
  return `${EXPORT_TARGET_SELECTION_PREFIX}${viewportKey}`
}

function parseExportTargetSelectionValue(value: string | null | undefined): string | null {
  const rawValue = String(value ?? '')
  return rawValue.startsWith(EXPORT_TARGET_SELECTION_PREFIX)
    ? rawValue.slice(EXPORT_TARGET_SELECTION_PREFIX.length)
    : null
}

const tagTool: StackTool = {
  key: 'tag',
  label: 'Tag',
  icon: 'tag',
  kind: 'action'
}

const exportTool: StackTool = {
  key: 'export',
  label: 'Export',
  icon: 'export',
  kind: 'action',
  options: [
    { value: 'png', label: 'PNG', icon: 'export' },
    { value: 'dicom', label: 'DICOM', icon: 'export' },
    { value: 'dicom-sr', label: 'DICOM SR', icon: 'export', description: 'Structured measurement report' },
    { value: 'dicom-gsps', label: 'DICOM GSPS', icon: 'export', description: 'Save annotations and measurements as a GSPS overlay' }
  ]
}

const playTool: StackTool = {
  key: 'play',
  label: 'Play',
  icon: 'play',
  kind: 'action',
  showSelectedOptionIcon: false,
  options: STACK_PLAYBACK_FPS_OPTIONS.map((fps) => ({
    value: `playbackFps:${fps}`,
    label: `FPS ${fps}`,
    icon: 'play'
  }))
}

const rotateOptions: StackToolOption[] = [
  { value: 'rotate:cw90', label: 'CW 90', icon: 'rotate-cw90' },
  { value: 'rotate:ccw90', label: 'CCW 90', icon: 'rotate-ccw90' },
  { value: 'rotate:mirror-h', label: 'Mirror H', icon: 'mirror-h' },
  { value: 'rotate:mirror-v', label: 'Mirror V', icon: 'mirror-v' },
  { value: 'rotate:reset', label: 'Reset Rotation', icon: 'reset' }
]

const transformResetDockOptions: StackToolOption[] = [
  {
    value: 'transform:reset',
    label: 'Reset',
    icon: 'reset'
  }
]

const ZOOM_RANGE_MIN = 0.25
const ZOOM_RANGE_MAX = 10
const ZOOM_RANGE_STEP = 0.05
const ZOOM_RANGE_TICKS = [1, 2, 5, 10].map((value) => ({ value, label: `${value}x` }))

const zoomDockOptions: StackToolOption[] = transformResetDockOptions

const rotate3dDockOptions: StackToolOption[] = [
  { value: 'rotate3d:reset', label: 'Reset 3D Rotation', icon: 'reset' }
]

const annotationClearDockOptions: StackToolOption[] = [
  {
    value: 'reset:annotations',
    label: 'Clear Annotations',
    icon: 'reset',
    description: 'Remove annotations from the current target view.'
  }
]

const annotateTool: StackTool = {
  key: 'annotate',
  label: 'Annotate',
  icon: 'annotate',
  kind: 'mode',
  dockOptions: annotationClearDockOptions
}

const stackTools: StackTool[] = [
  layoutTool,
  { key: 'pan', label: 'Pan', icon: 'pan', kind: 'mode', dockOptions: transformResetDockOptions },
  { key: 'zoom', label: 'Zoom', icon: 'zoom', kind: 'mode', dockOptions: zoomDockOptions },
  { key: 'window', label: 'Window', icon: 'window', kind: 'mode' },
  {
    key: 'rotate',
    label: 'Rotate',
    icon: 'rotate',
    kind: 'action',
    options: rotateOptions
  },
  { key: 'page', label: 'Page', icon: 'page', kind: 'action' },
  playTool,
  pseudocolorTool,
  annotateTool,
  measureTool,
  qaTool,
  exportTool,
  tagTool,
  {
    key: 'reset',
    label: 'Reset',
    icon: 'reset',
    kind: 'action',
    showSelectedOptionIcon: false,
    options: [
      { value: 'reset:view', label: 'Reset View', icon: 'reset', description: 'Reset WW/WL, transforms, pseudocolor, and view state.' },
      { value: 'reset:measurements', label: 'Clear Measurements', icon: 'measure', description: 'Remove all measurement overlays in the current view.' },
      { value: 'reset:mtf', label: 'Clear MTF', icon: 'mtf', description: 'Remove all MTF ROIs in the current view.' },
      { value: 'reset:annotations', label: 'Clear Annotations', icon: 'annotate', description: 'Remove all annotation overlays in the current view.' },
      { value: 'reset:all', label: 'Reset All', icon: 'trash', description: 'Reset the view and clear measurements, MTF, and annotations.' }
    ]
  }
]

function withoutMtfResetOption(tool: StackTool): StackTool {
  if (tool.key !== 'reset') {
    return tool
  }

  return {
    ...tool,
    options: tool.options
      ?.filter((option) => option.value !== 'reset:mtf')
      .map((option) =>
        option.value === 'reset:all'
          ? {
              ...option,
              description: 'Reset the view and clear measurements and annotations.'
            }
          : option
      )
  }
}

function localizeToolbarOption(option: StackToolOption, isZh: boolean): StackToolOption {
  if (!isZh) {
    return option
  }
  const copy = ZH_OPTION_COPY[option.value]
  return copy ? { ...option, ...copy } : option
}

function localizeToolbarTool(tool: StackTool, isZh: boolean): StackTool {
  if (!isZh) {
    return tool
  }
  return {
    ...tool,
    label: tool.key === 'crosshair' && tool.options ? tool.label : (ZH_TOOL_LABELS[tool.key] ?? tool.label),
    options: tool.options?.map((option) => localizeToolbarOption(option, isZh)),
    dockOptions: tool.dockOptions?.map((option) => localizeToolbarOption(option, isZh)),
    footerOptions: tool.footerOptions?.map((option) => localizeToolbarOption(option, isZh))
  }
}

function supportsStandardAnnotationExport(viewType: ViewerTabItem['viewType'] | undefined): boolean {
  return viewType !== '3D' && viewType !== 'MPR'
}

function withSupportedExportOptions(tool: StackTool, viewType: ViewerTabItem['viewType'] | undefined): StackTool {
  if (tool.key !== 'export' || supportsStandardAnnotationExport(viewType)) {
    return tool
  }

  return {
    ...tool,
    options: tool.options?.filter((option) => option.value !== 'dicom-sr' && option.value !== 'dicom-gsps')
  }
}

function getFusionPaneLabel(paneKey: FusionPaneKey): string {
  switch (paneKey) {
    case FUSION_CT_AXIAL_PANE_KEY:
      return 'CT Axial'
    case FUSION_PET_AXIAL_PANE_KEY:
      return 'PET Axial'
    case FUSION_PET_CORONAL_MIP_PANE_KEY:
      return 'PET Coronal MIP'
    case FUSION_OVERLAY_AXIAL_PANE_KEY:
    default:
      return 'Fusion Axial'
  }
}

function getComparePaneLabel(tab: ViewerTabItem, paneKey: CompareStackPaneKey): string {
  return tab.compareSeriesTitles?.[paneKey]?.trim() || (paneKey === COMPARE_STACK_TARGET_PANE_KEY ? 'Compare B' : 'Compare A')
}

function getExportTargetOptions(
  tab: ViewerTabItem | null | undefined,
  selectedViewportKey: string | null,
  isZh: boolean
): StackToolOption[] {
  if (!tab) {
    return []
  }

  const group = isZh ? '视图' : 'View'
  if (tab.viewType === 'CompareStack') {
    return [COMPARE_STACK_SOURCE_PANE_KEY, COMPARE_STACK_TARGET_PANE_KEY]
      .filter((paneKey) => Boolean(tab.compareViewIds?.[paneKey]))
      .map((paneKey) => ({
        value: toExportTargetSelectionValue(paneKey),
        label: getComparePaneLabel(tab, paneKey),
        icon: 'layout',
        group,
        checked: selectedViewportKey === paneKey
      }))
  }

  if (tab.viewType === 'PETCTFusion') {
    return FUSION_PANE_KEYS
      .filter((paneKey) => Boolean(tab.fusionViewIds?.[paneKey]))
      .map((paneKey) => ({
        value: toExportTargetSelectionValue(paneKey),
        label: getFusionPaneLabel(paneKey),
        icon: paneKey === FUSION_OVERLAY_AXIAL_PANE_KEY ? 'pseudocolor' : 'page',
        group,
        checked: selectedViewportKey === paneKey
      }))
  }

  if (tab.viewType === 'Layout') {
    return (tab.layoutSlots ?? [])
      .filter((slot) => Boolean(slot.viewId))
      .map((slot) => ({
        value: toExportTargetSelectionValue(slot.id),
        label: slot.seriesTitle?.trim() || slot.id,
        icon: 'layout',
        group,
        checked: selectedViewportKey === slot.id
      }))
  }

  return []
}

function getValidExportTargetViewportKeys(tab: ViewerTabItem | null | undefined): string[] {
  if (!tab) {
    return []
  }
  if (tab.viewType === 'CompareStack') {
    return [COMPARE_STACK_SOURCE_PANE_KEY, COMPARE_STACK_TARGET_PANE_KEY].filter((paneKey) => Boolean(tab.compareViewIds?.[paneKey]))
  }
  if (tab.viewType === 'PETCTFusion') {
    return FUSION_PANE_KEYS.filter((paneKey) => Boolean(tab.fusionViewIds?.[paneKey]))
  }
  if (tab.viewType === 'Layout') {
    return (tab.layoutSlots ?? []).filter((slot) => Boolean(slot.viewId)).map((slot) => slot.id)
  }
  return []
}

function getDefaultExportTargetViewportKey(tab: ViewerTabItem | null | undefined, activeViewportKey: string): string | null {
  const validKeys = getValidExportTargetViewportKeys(tab)
  if (!validKeys.length) {
    return null
  }
  if (validKeys.includes(activeViewportKey)) {
    return activeViewportKey
  }
  if (tab?.viewType === 'PETCTFusion' && isFusionPaneKey(activeViewportKey) && validKeys.includes(activeViewportKey)) {
    return activeViewportKey
  }
  return validKeys[0] ?? null
}

function getSelectedExportTargetViewportKey(
  tab: ViewerTabItem | null | undefined,
  activeViewportKey: string,
  selectedExportTargetValue: string | null | undefined
): string | null {
  const selected = parseExportTargetSelectionValue(selectedExportTargetValue)
  const validKeys = getValidExportTargetViewportKeys(tab)
  if (selected && validKeys.includes(selected)) {
    return selected
  }
  return getDefaultExportTargetViewportKey(tab, activeViewportKey)
}

function withDynamicExportTool(
  tools: StackTool[],
  tab: ViewerTabItem | null | undefined,
  activeViewportKey: string,
  selectedExportTargetValue: string | null | undefined,
  isZh: boolean
): StackTool[] {
  const selectedViewportKey = getSelectedExportTargetViewportKey(tab, activeViewportKey, selectedExportTargetValue)
  const targetOptions = getExportTargetOptions(tab, selectedViewportKey, isZh)
  if (!targetOptions.length) {
    return tools
  }

  return tools.map((tool) =>
    tool.key === 'export'
      ? {
          ...tool,
          showSelectedOptionIcon: false,
          options: [
            ...targetOptions,
            ...(tool.options ?? []).map((option) => ({
              ...option,
              group: isZh ? '格式' : 'Format'
            }))
          ]
        }
      : tool
  )
}

const compareStackTools: StackTool[] = stackTools
  .filter((tool) => tool.key !== 'play' && tool.key !== 'qa')
  .map(withoutMtfResetOption)

const layoutStackTools: StackTool[] = stackTools
  .filter((tool) => tool.key !== 'qa')
  .map(withoutMtfResetOption)

const fusionTools: StackTool[] = [
  { key: 'pan', label: 'Pan', icon: 'pan', kind: 'mode', dockOptions: transformResetDockOptions },
  { key: 'zoom', label: 'Zoom', icon: 'zoom', kind: 'mode', dockOptions: zoomDockOptions },
  { key: 'window', label: 'Window', icon: 'window', kind: 'mode' },
  {
    key: 'rotate',
    label: 'Rotate',
    icon: 'rotate',
    kind: 'action',
    options: rotateOptions
  },
  { key: 'page', label: 'Page', icon: 'page', kind: 'action' },
  annotateTool,
  measureTool,
  exportTool,
  tagTool,
  withoutMtfResetOption({
    key: 'reset',
    label: 'Reset',
    icon: 'reset',
    kind: 'action',
    showSelectedOptionIcon: false,
    options: [
      { value: 'reset:view', label: 'Reset View', icon: 'reset', description: 'Reset WW/WL, transforms, pseudocolor, and view state.' },
      { value: 'reset:measurements', label: 'Clear Measurements', icon: 'measure', description: 'Remove all measurement overlays in the current view.' },
      { value: 'reset:annotations', label: 'Clear Annotations', icon: 'annotate', description: 'Remove all annotation overlays in the current view.' },
      { value: 'reset:all', label: 'Reset All', icon: 'trash', description: 'Reset the view and clear measurements and annotations.' }
    ]
  }),
  fusionPetDisplayTool,
  fusionRegistrationTool
]

const petTools: StackTool[] = [
  { key: 'pan', label: 'Pan', icon: 'pan', kind: 'mode', dockOptions: transformResetDockOptions },
  { key: 'zoom', label: 'Zoom', icon: 'zoom', kind: 'mode', dockOptions: zoomDockOptions },
  fusionPetDisplayTool,
  {
    key: 'rotate',
    label: 'Rotate',
    icon: 'rotate',
    kind: 'action',
    options: rotateOptions
  },
  { key: 'page', label: 'Page', icon: 'page', kind: 'action' },
  annotateTool,
  measureTool,
  exportTool,
  tagTool,
  withoutMtfResetOption({
    key: 'reset',
    label: 'Reset',
    icon: 'reset',
    kind: 'action',
    showSelectedOptionIcon: false,
    options: [
      { value: 'reset:view', label: 'Reset View', icon: 'reset', description: 'Reset WW/WL, transforms, pseudocolor, and view state.' },
      { value: 'reset:measurements', label: 'Clear Measurements', icon: 'measure', description: 'Remove all measurement overlays in the current view.' },
      { value: 'reset:annotations', label: 'Clear Annotations', icon: 'annotate', description: 'Remove all annotation overlays in the current view.' },
      { value: 'reset:all', label: 'Reset All', icon: 'trash', description: 'Reset the view and clear measurements and annotations.' }
    ]
  })
]

const genericTools: StackTool[] = [
  layoutTool,
  { key: 'pan', label: 'Pan', icon: 'pan', kind: 'mode', dockOptions: transformResetDockOptions },
  { key: 'zoom', label: 'Zoom', icon: 'zoom', kind: 'mode', dockOptions: zoomDockOptions },
  { key: 'window', label: 'Window', icon: 'window', kind: 'mode' },
  measureTool,
  pseudocolorTool,
  exportTool,
  tagTool
]

const volumeParamsTool: StackTool = { key: 'volumeParams', label: 'Params', icon: 'settings', kind: 'action' }
const surfaceParamsTool: StackTool = { key: 'surfaceParams', label: 'Surface Params', icon: 'settings', kind: 'action' }

const render3dModeTool: StackTool = {
  key: 'render3dMode',
  label: 'Render',
  icon: 'render-mode',
  kind: 'action',
  showSelectedOptionIcon: false,
  options: [
    { value: 'render3dMode:volume', label: 'VR', icon: 'render-volume', description: 'Volume rendering' },
    { value: 'render3dMode:surface', label: 'Surface', icon: 'render-surface', description: 'Bone surface mesh' }
  ]
}

const volumeOrientationTool: StackTool = {
  key: 'volumeOrientation',
  label: 'Orientation',
  icon: getVolumeOrientationIcon(DEFAULT_VOLUME_ORIENTATION_FACE),
  kind: 'action',
  showSelectedOptionIcon: false,
  options: VOLUME_ORIENTATION_FACES.map((face) => ({
    value: `volumeOrientation:${face}`,
    label: VOLUME_ORIENTATION_FACE_NAMES[face].en
  })),
  footerOptions: [
    {
      value: 'volumeOrientation:reset',
      label: 'Reset Orientation',
      icon: 'reset',
      description: 'Restore the initial 3D orientation.'
    }
  ]
}

const volumePresetTool: StackTool = {
  key: 'volumePreset',
  label: 'Preset',
  icon: 'volumePreset',
  kind: 'action',
  options: VOLUME_PRESET_OPTIONS.map((option) => ({ ...option }))
}

const surfacePresetTool: StackTool = {
  key: 'surfacePreset',
  label: 'Surface Preset',
  icon: 'surface-preset',
  kind: 'action',
  showSelectedOptionIcon: false,
  options: [
    { value: 'surfacePreset:bone', label: 'Bone', icon: 'render-surface' },
    { value: 'surfacePreset:softTissue', label: 'Soft Tissue / Skin', icon: 'volume-preset-muscle' },
    { value: 'surfacePreset:highDensity', label: 'High Density / Metal', icon: 'volume-preset-mip' }
  ]
}

const volumeRemoveBedTool: StackTool = { key: 'volumeRemoveBed', label: 'Remove Bed', icon: 'remove-bed', kind: 'action' }

const volumeClipTool: StackTool = {
  key: 'volumeClip',
  label: 'Clip',
  icon: 'volume-clip',
  kind: 'mode',
  options: [
    { value: 'volumeClip:inside', label: 'Clip Inside', icon: 'volume-clip' },
    { value: 'volumeClip:outside', label: 'Clip Outside', icon: 'volume-clip' },
    { value: 'volumeClip:reset', label: 'Reset Clip', icon: 'reset' }
  ]
}

const segmentationTool: StackTool = {
  key: 'segmentation',
  label: '阈值分割',
  icon: 'segmentation',
  kind: 'action',
  options: [
    {
      value: 'segmentation:threshold',
      label: '阈值分割',
      icon: 'segmentation-threshold',
      description: 'Preview a HU threshold mask'
    },
    {
      value: 'segmentation:voi',
      label: 'VOI',
      icon: 'segmentation-voi',
      description: 'Edit a 3D volume of interest'
    }
  ]
}

const volumeTools: StackTool[] = [
  layoutTool,
  { key: 'rotate3d', label: '3D Rotate', icon: 'rotate3d', kind: 'mode', dockOptions: rotate3dDockOptions },
  volumeOrientationTool,
  { key: 'pan', label: 'Pan', icon: 'pan', kind: 'mode', dockOptions: transformResetDockOptions },
  { key: 'zoom', label: 'Zoom', icon: 'zoom', kind: 'mode', dockOptions: zoomDockOptions },
  render3dModeTool,
  volumeRemoveBedTool,
  volumeClipTool,
  volumeParamsTool,
  volumePresetTool,
  exportTool,
  tagTool,
  {
    key: 'reset',
    label: 'Reset',
    icon: 'reset',
    kind: 'action',
    showSelectedOptionIcon: false,
    options: [
      { value: 'reset:view', label: 'Reset View', icon: 'reset', description: 'Reset 3D view parameters and rendering defaults.' },
      { value: 'reset:all', label: 'Reset All', icon: 'trash', description: 'Reset the view and clear any local overlays.' }
    ]
  }
]

const genericToolsWithCrosshair: StackTool[] = [
  mprLayoutTool,
  { key: 'pan', label: 'Pan', icon: 'pan', kind: 'mode', dockOptions: transformResetDockOptions },
  { key: 'zoom', label: 'Zoom', icon: 'zoom', kind: 'mode', dockOptions: zoomDockOptions },
  { key: 'window', label: 'Window', icon: 'window', kind: 'mode' },
  { key: 'crosshair', label: 'Crosshair', icon: 'crosshair', kind: 'mode', showSelectedOptionIcon: false },
  { key: 'rotate3d', label: '3D Rotate', icon: 'rotate3d', kind: 'mode', dockOptions: rotate3dDockOptions },
  { key: 'mprMip', label: 'MIP', icon: 'mip', kind: 'action' },
  playTool,
  measureTool,
  pseudocolorTool,
  exportTool,
  tagTool,
  {
    key: 'reset',
    label: 'Reset',
    icon: 'reset',
    kind: 'action',
    showSelectedOptionIcon: false,
    options: [
      { value: 'reset:view', label: 'Reset View', icon: 'reset', description: 'Reset crosshair, MIP config, transforms, and pseudocolor.' },
      { value: 'reset:measurements', label: 'Clear Measurements', icon: 'measure', description: 'Remove all measurements in the current MPR study.' },
      { value: 'reset:mtf', label: 'Clear MTF', icon: 'mtf', description: 'Remove all MTF ROIs in the current MPR study.' },
      { value: 'reset:annotations', label: 'Clear Annotations', icon: 'annotate', description: 'Remove all annotation overlays in the current MPR study.' },
      { value: 'reset:all', label: 'Reset All', icon: 'trash', description: 'Reset the view and clear measurements, MTF, and annotations.' }
    ]
  }
]

const mprToolsWithSegmentation: StackTool[] = genericToolsWithCrosshair.flatMap((tool) =>
  tool.key === 'mprMip' ? [tool, segmentationTool] : [tool]
)

const mprWithVolumeTools: StackTool[] = genericToolsWithCrosshair.flatMap((tool) => {
  if (tool.key === 'rotate3d') {
    return [tool, volumeOrientationTool]
  }
  return tool.key === 'mprMip'
    ? [tool, segmentationTool, render3dModeTool, volumeRemoveBedTool, volumeClipTool, volumeParamsTool, volumePresetTool]
    : [tool]
})

interface ViewerWorkspaceToolbarOptions {
  activeOperation: ComputedRef<string>
  activeTab: ComputedRef<ViewerTabItem | null>
  emitSetActiveOperation: (value: string) => void
  emitTriggerViewAction: (payload: ViewerToolbarActionPayload) => void
  emitCompareSyncChange: (payload: { tabKey: string; key: CompareSyncSettingKey; value: boolean }) => void
  emitOpenLayoutView: (template: ViewerLayoutTemplate) => void | Promise<void>
  emitViewportWheel: (payload: { viewportKey: string; deltaY: number; exact?: boolean; deltaX?: number; deltaMode?: number; ctrlKey?: boolean; canvasX?: number; canvasY?: number; canvasWidth?: number; canvasHeight?: number }) => void
  emitOpenSeriesView: (seriesId: string, viewType: 'Tag') => void
  exportCurrentView: (format: ViewerExportFormat, viewportKey?: string) => void
  activeViewportKey: Ref<string>
  cleanupPointerInteractions: () => void
  stopViewportDrag: () => void
  setActiveViewport: (viewportKey: string) => void
}

interface StoredToolbarState {
  activeOperation: string
  activeToolKey: string
  selections: Partial<Record<string, string>>
}

export function useViewerWorkspaceToolbar(options: ViewerWorkspaceToolbarOptions) {
  const { locale } = useUiLocale()
  const { getWindowPresetLabel, mprDefaultLayoutKey, selectedPseudocolorKey, selectedWindowPresetId, windowPresets } = useUiPreferences()
  const playbackController = createPlaybackController()
  const menuController = createMenuController()
  const toolbarActivationController = createToolbarActivationController('window')

  const playbackSnapshot = ref(playbackController.getSnapshot())
  const menuSnapshot = ref(menuController.getSnapshot())
  const toolbarActivationSnapshot = ref(toolbarActivationController.getSnapshot())

  const isVolumeConfigPanelOpen = ref(false)
  const isMprMipPanelOpen = ref(false)
  const isMprSegmentationPanelOpen = ref(false)
  const displayOverlayDraftByTabKey = ref<Record<string, Partial<Record<DisplayOverlayKey, boolean>>>>({})
  const stackToolSelections = ref<Partial<Record<string, string>>>({
    rotate: 'rotate:cw90',
    measure: 'measure:line',
    annotate: 'annotate:arrow',
    qa: DEFAULT_QA_OPERATION,
    play: `playbackFps:${STACK_PLAYBACK_DEFAULT_FPS}`,
    pseudocolor: toPseudocolorSelectionValue(selectedPseudocolorKey.value),
    fusionPseudocolor: toFusionPseudocolorSelectionValue('petct-rainbow'),
    export: 'png',
    exportTarget: '',
    render3dMode: 'render3dMode:volume',
    volumeClip: 'volumeClip:inside',
    volumePreset: 'volumePreset:aaa',
    surfacePreset: 'surfacePreset:bone',
    volumeOrientation: 'volumeOrientation:A',
    layout: createViewerLayoutOptionValue(VIEWER_LAYOUT_PRESETS[0]!),
    mprLayout: toMprLayoutSelectionValue(mprDefaultLayoutKey.value),
    crosshair: toMprCrosshairModeSelectionValue('orthogonal'),
    segmentation: 'segmentation:threshold',
    reset: 'reset:view'
  })
  const toolbarStateByTabKey = new Map<string, StoredToolbarState>()
  const explicitWindowSelectionByTargetKey = new Map<string, string>()
  const pendingTransientCallback = ref<(() => void) | null>(null)

  const toolbarIconSize = 18
  const menuIconSize = 15
  const toggleIconSize = 11
  const isZh = computed(() => locale.value === 'zh-CN')

  let playbackTimer: ReturnType<typeof window.setInterval> | null = null
  let playbackTarget: { current: number; total: number; viewportKey: string } | null = null

  function formatWindowPresetValue(ww: number, wl: number): string {
    return `${ww}|${wl}`
  }

  function parseWindowPresetValue(value: string | null | undefined): { ww: number; wl: number } | null {
    const [wwRaw, wlRaw] = String(value ?? '').split('|')
    const ww = Number.parseFloat(wwRaw)
    const wl = Number.parseFloat(wlRaw)
    return Number.isFinite(ww) && ww > 0 && Number.isFinite(wl) ? { ww, wl } : null
  }

  function clampStackPlaybackFps(value: number | null | undefined): number {
    const numericValue = Number(value)
    if (!Number.isFinite(numericValue)) {
      return STACK_PLAYBACK_DEFAULT_FPS
    }
    return Math.max(1, Math.min(30, Math.trunc(numericValue)))
  }

  function parseStackPlaybackFps(value: string | null | undefined): number {
    const match = String(value ?? '').match(/^playbackFps:(\d+)$/)
    return clampStackPlaybackFps(match ? Number(match[1]) : STACK_PLAYBACK_DEFAULT_FPS)
  }

  function getStackPlaybackFps(): number {
    return parseStackPlaybackFps(stackToolSelections.value.play)
  }

  function getStackPlaybackIntervalMs(): number {
    return Math.max(33, Math.round(1000 / getStackPlaybackFps()))
  }

  const isPlaying = computed(() => playbackSnapshot.value.matches('playing'))
  const isPlaybackPaused = computed(() => playbackSnapshot.value.matches('paused'))
  const openMenuKey = computed(() => menuSnapshot.value.context.openKey)
  const activeToolbarToolKey = computed(() => toolbarActivationSnapshot.value.context.activeKey)
  const transientActiveToolKey = computed(() => toolbarActivationSnapshot.value.context.transientKey)

  const windowTool = computed<StackTool>(() => ({
    key: 'window',
    label: 'Window',
    icon: 'window',
    kind: 'mode',
    showSelectedOptionIcon: false,
    options: windowPresets.value.map((preset) => ({
      value: formatWindowPresetValue(preset.ww, preset.wl),
      label: getWindowPresetLabel(preset),
      icon: 'contrast',
      description: `WW ${Math.round(preset.ww)} / WL ${Math.round(preset.wl)}`
    }))
  }))

  function getCompareSyncEnabled(tab: ViewerTabItem | null | undefined, key: CompareSyncSettingKey): boolean {
    return tab ? getViewSyncEnabled(tab, key) : false
  }

  const compareSyncTool = computed<StackTool>(() => {
    const tab = options.activeTab.value
    return {
      key: 'compareSync',
      label: 'Sync',
      icon: 'sync',
      kind: 'action',
      showSelectedOptionIcon: false,
      options: VIEW_SYNC_OPTION_CONFIGS.map(({ key, value, label, icon, description }) => ({
        value,
        label,
        icon,
        description,
        checked: getCompareSyncEnabled(tab, key),
        syncKey: key
      }))
    }
  })

  const activeMprLayoutKey = computed(() => parseMprLayoutSelectionValue(stackToolSelections.value.mprLayout))
  const isActiveMpr3dLayout = computed(() => options.activeTab.value?.viewType === 'MPR' && activeMprLayoutKey.value === 'mpr-3d')
  const activeMprCrosshairMode = computed<MprCrosshairMode>(() =>
    options.activeTab.value?.mprCrosshairMode === 'double-oblique' ? 'double-oblique' : 'orthogonal'
  )

  function getTabDisplayOverlayVisible(tab: ViewerTabItem | null | undefined, key: DisplayOverlayKey): boolean {
    if (!tab) {
      return true
    }
    if (key === 'cornerInfo') {
      return tab.showCornerInfo !== false
    }
    if (key === 'scaleBar') {
      return tab.showScaleBar !== false
    }
    if (key === 'pseudocolorBar') {
      return tab.showPseudocolorBar !== false
    }
    if (key === 'crosshair') {
      return tab.showCrosshair !== false
    }
    if (key === 'volumeOrientationCube') {
      return tab.showVolumeOrientationCube !== false
    }
    return tab.showSliceSlider !== false
  }

  function getActiveDisplayOverlayVisible(key: DisplayOverlayKey): boolean {
    const tab = options.activeTab.value
    if (!tab) {
      return true
    }

    const draftValue = displayOverlayDraftByTabKey.value[tab.key]?.[key]
    if (typeof draftValue === 'boolean') {
      return draftValue
    }
    return getTabDisplayOverlayVisible(tab, key)
  }

  function setDisplayOverlayDraft(tabKey: string, key: DisplayOverlayKey, visible: boolean): void {
    displayOverlayDraftByTabKey.value = {
      ...displayOverlayDraftByTabKey.value,
      [tabKey]: {
        ...(displayOverlayDraftByTabKey.value[tabKey] ?? {}),
        [key]: visible
      }
    }
  }

  function pruneSettledDisplayOverlayDraft(tab: ViewerTabItem | null | undefined): void {
    if (!tab) {
      return
    }

    const draft = displayOverlayDraftByTabKey.value[tab.key]
    if (!draft) {
      return
    }

    const nextDraft = { ...draft }
    for (const key of ['cornerInfo', 'scaleBar', 'pseudocolorBar', 'sliceSlider', 'crosshair', 'volumeOrientationCube'] as const) {
      if (nextDraft[key] === getTabDisplayOverlayVisible(tab, key)) {
        delete nextDraft[key]
      }
    }

    if (Object.keys(nextDraft).length === Object.keys(draft).length) {
      return
    }

    const nextDraftByTabKey = { ...displayOverlayDraftByTabKey.value }
    if (Object.keys(nextDraft).length) {
      nextDraftByTabKey[tab.key] = nextDraft
    } else {
      delete nextDraftByTabKey[tab.key]
    }
    displayOverlayDraftByTabKey.value = nextDraftByTabKey
  }

  const displayTool = computed<StackTool>(() => ({
    key: 'display',
    label: isZh.value ? '显示' : 'Display',
    icon: 'display',
    kind: 'action',
    showSelectedOptionIcon: false,
    options: [
      {
        value: toDisplayOverlaySelectionValue('cornerInfo'),
        label: isZh.value ? '四角信息' : 'Corner Info',
        icon: 'info',
        checked: getActiveDisplayOverlayVisible('cornerInfo')
      },
      ...(!isActiveRender3dViewport()
        ? [
            {
              value: toDisplayOverlaySelectionValue('scaleBar'),
              label: isZh.value ? '比例尺' : 'Scale Bar',
              icon: 'measure',
              checked: getActiveDisplayOverlayVisible('scaleBar')
            }
          ]
        : []),
      ...(options.activeTab.value?.viewType !== 'PETCTFusion' && options.activeTab.value?.viewType !== '3D'
        ? [
            {
              value: toDisplayOverlaySelectionValue('pseudocolorBar'),
              label: isZh.value ? '伪彩条' : 'Pseudocolor Bar',
              icon: 'pseudocolor',
              checked: getActiveDisplayOverlayVisible('pseudocolorBar')
            }
          ]
        : []),
      ...(options.activeTab.value?.viewType === 'Layout'
        ? [
            {
              value: toDisplayOverlaySelectionValue('sliceSlider'),
              label: isZh.value ? '切片滑条' : 'Slice Slider',
              icon: 'page',
              checked: getActiveDisplayOverlayVisible('sliceSlider')
            }
          ]
        : []),
      ...(options.activeTab.value?.viewType === 'MPR' || options.activeTab.value?.viewType === '4D'
        ? [
            {
              value: toDisplayOverlaySelectionValue('crosshair'),
              label: isZh.value ? '十字线' : 'Crosshair',
              icon: 'crosshair',
              checked: getActiveDisplayOverlayVisible('crosshair')
            }
          ]
        : []),
      ...((isActiveRender3dViewport() || isActiveMpr3dLayout.value)
        ? [
            {
              value: toDisplayOverlaySelectionValue('volumeOrientationCube'),
              label: isZh.value ? '方向立方体' : 'Orientation Cube',
              icon: 'render-mode',
              checked: getActiveDisplayOverlayVisible('volumeOrientationCube')
            }
          ]
        : [])
    ]
  }))

  function withDynamicWindowTool(tools: StackTool[]): StackTool[] {
    return tools.map((tool) => (tool.key === 'window' ? windowTool.value : tool))
  }

  function supportsDisplayTool(viewType: ViewerTabItem['viewType'] | undefined): boolean {
    return viewType === 'Stack' || viewType === 'PET' || viewType === 'MPR' || viewType === '4D' || viewType === 'PETCTFusion' || viewType === 'Layout' || viewType === '3D'
  }

  function withDisplayTool(tools: StackTool[]): StackTool[] {
    if (!supportsDisplayTool(options.activeTab.value?.viewType) || tools.some((tool) => tool.key === 'display')) {
      return tools
    }

    const insertAfterKey = tools.some((tool) => tool.key === 'export') ? 'export' : tools.some((tool) => tool.key === 'window') ? 'window' : 'layout'
    const result: StackTool[] = []
    for (const tool of tools) {
      result.push(tool)
      if (tool.key === insertAfterKey) {
        result.push(displayTool.value)
      }
    }
    return result.some((tool) => tool.key === 'display') ? result : [...result, displayTool.value]
  }

  function withMprCrosshairModeTool(tools: StackTool[]): StackTool[] {
    const tab = options.activeTab.value
    if (tab?.viewType !== 'MPR' && tab?.viewType !== '4D') {
      return tools
    }

    const mode = activeMprCrosshairMode.value
    const isDoubleOblique = mode === 'double-oblique'
    const title = isZh.value
      ? `十字线 · ${isDoubleOblique ? 'Double Oblique' : '正交锁定'}`
      : `Crosshair · ${isDoubleOblique ? 'Double Oblique' : 'Orthogonal Lock'}`
    return tools.map((tool) =>
      tool.key === 'crosshair'
        ? {
            ...tool,
            label: title,
            options: [
              {
                value: toMprCrosshairModeSelectionValue('orthogonal'),
                label: isZh.value ? '正交锁定' : 'Orthogonal Lock',
                icon: 'crosshair',
                description: isZh.value ? '保持三平面互相垂直' : 'Keep the three MPR planes orthogonal',
                checked: mode === 'orthogonal'
              },
              {
                value: toMprCrosshairModeSelectionValue('double-oblique'),
                label: 'Double Oblique',
                icon: 'crosshair',
                description: isZh.value ? '允许单独旋转十字线对应切面' : 'Rotate each referenced plane independently',
                checked: mode === 'double-oblique'
              }
            ]
          }
        : tool
    )
  }

  function withSyncToolAfterLayout(tools: StackTool[]): StackTool[] {
    return tools.flatMap((tool) => (tool.key === 'layout' ? [tool, compareSyncTool.value] : [tool]))
  }

  function getBaseToolsForActiveTab(): StackTool[] {
    const viewType = options.activeTab.value?.viewType
    switch (viewType) {
      case 'Stack':
        return stackTools
      case 'PET':
        return petTools
      case 'PETCTFusion':
        return fusionTools
      case 'CompareStack':
        return withSyncToolAfterLayout(compareStackTools)
      case 'MPR':
        return isActiveMpr3dLayout.value ? mprWithVolumeTools : mprToolsWithSegmentation
      case '4D':
        return genericToolsWithCrosshair
      case 'Layout':
        return isActiveLayoutVolumeSlot() ? volumeTools : withSyncToolAfterLayout(layoutStackTools)
      case '3D':
        return volumeTools
      default:
        return genericTools
    }
  }

  function isActiveRender3dViewport(): boolean {
    const tab = options.activeTab.value
    return Boolean(
      tab && (
        tab.viewType === '3D' ||
        (isActiveMpr3dLayout.value && options.activeViewportKey.value === 'volume') ||
        (tab.viewType === 'Layout' && isActiveLayoutVolumeSlot())
      )
    )
  }

  function getActiveVolumeQuaternion(): [number, number, number, number] | null {
    const tab = options.activeTab.value
    if (!tab) {
      return null
    }
    if (tab.viewType === 'Layout') {
      return getActiveLayoutSlot(tab)?.orientation?.volumeQuaternion ?? tab.orientation.volumeQuaternion ?? null
    }
    return tab.orientation.volumeQuaternion ?? null
  }

  function getActiveVolumeOrientationFace(): VolumeOrientationFace | null {
    const quaternion = getActiveVolumeQuaternion()
    return quaternion ? resolveVolumeOrientationFace(quaternion) : DEFAULT_VOLUME_ORIENTATION_FACE
  }

  function withRenderModeTools(tools: StackTool[]): StackTool[] {
    const tab = options.activeTab.value
    if (!tab || tab.render3dMode !== 'surface' || !isActiveRender3dViewport()) {
      return tools
    }
    return tools
      .filter((tool) => tool.key !== 'window')
      .map((tool) => {
        if (tool.key === 'volumeParams') {
          return surfaceParamsTool
        }
        if (tool.key === 'volumePreset') {
          return surfacePresetTool
        }
        return tool
      })
  }

  function withDynamicVolumeToolState(tool: StackTool): StackTool {
    if (tool.key !== 'volumeRemoveBed' || !isActiveRender3dViewport()) {
      return tool
    }
    const removeBedEnabled = options.activeTab.value?.volumeRenderOptions?.removeBed === true
    const label = removeBedEnabled
      ? (isZh.value ? '已去床板' : 'Bed Hidden')
      : (isZh.value ? '去床板' : 'Remove Bed')
    return {
      ...tool,
      icon: removeBedEnabled ? 'bed-hidden' : 'bed-visible',
      label,
      pressed: removeBedEnabled,
      title: removeBedEnabled
        ? (isZh.value ? '恢复床板显示' : 'Show Bed')
        : (isZh.value ? '隐藏床板' : 'Hide Bed')
    }
  }

  function withDynamicVolumeOrientationToolState(tool: StackTool): StackTool {
    if (tool.key !== 'volumeOrientation' || !isActiveRender3dViewport()) {
      return tool
    }
    const face = getActiveVolumeOrientationFace()
    const faceLabel = face ?? (isZh.value ? '自由' : 'Oblique')
    return {
      ...tool,
      icon: getVolumeOrientationIcon(face),
      label: isZh.value
        ? `朝向 · ${faceLabel}`
        : `Orientation · ${faceLabel}`,
      options: tool.options?.map((option) => ({
        ...option,
        label: option.value.startsWith('volumeOrientation:')
          ? VOLUME_ORIENTATION_FACE_NAMES[option.value.replace(/^volumeOrientation:/, '') as VolumeOrientationFace]?.en ?? option.label
          : option.label,
        description: option.value.startsWith('volumeOrientation:')
          ? (isZh.value
              ? VOLUME_ORIENTATION_FACE_NAMES[option.value.replace(/^volumeOrientation:/, '') as VolumeOrientationFace]?.zh
              : undefined)
          : option.description,
        checked: face !== null && option.value === `volumeOrientation:${face}`
      }))
    }
  }

  const activeTools = computed(() => {
    const viewType = options.activeTab.value?.viewType
    return withDisplayTool(
      withDynamicExportTool(
        withDynamicWindowTool(withRenderModeTools(withMprCrosshairModeTool(getBaseToolsForActiveTab()))),
        options.activeTab.value,
        options.activeViewportKey.value,
        stackToolSelections.value.exportTarget,
        isZh.value
      )
    )
      .map((tool) => withActiveZoomRangeControl(tool))
      .map((tool) => withSupportedExportOptions(tool, viewType))
      .map((tool) => localizeToolbarTool(tool, isZh.value))
      .map((tool) => withDynamicVolumeToolState(tool))
      .map((tool) => withDynamicVolumeOrientationToolState(tool))
  })

  const areToolbarActionsDisabled = computed(
    () =>
      (supportsSlicePlayback(options.activeTab.value?.viewType) && (isPlaying.value || isPlaybackPaused.value)) ||
      Boolean(options.activeTab.value?.viewType === '4D' && options.activeTab.value.fourDIsPlaying)
  )

  const activeVolumeRenderConfig = computed(() => {
    const tab = options.activeTab.value
    if (!tab || !isActiveRender3dViewport()) {
      return null
    }
    if (tab.render3dMode === 'surface') {
      return null
    }

    return tab.volumeRenderConfig ?? createDefaultVolumeRenderConfig(normalizeVolumePresetKey(tab.volumePreset ?? 'aaa'))
  })

  const activeSurfaceRenderConfig = computed<SurfaceRenderConfig | null>(() => {
    const tab = options.activeTab.value
    if (!tab || !isActiveRender3dViewport()) {
      return null
    }
    if (tab.render3dMode !== 'surface') {
      return null
    }

    return tab.surfaceRenderConfig ?? createDefaultSurfaceRenderConfig()
  })

  const activeMprMipConfig = computed(() => {
    const activeTab = options.activeTab.value
    if (!activeTab || (activeTab.viewType !== 'MPR' && activeTab.viewType !== '4D')) {
      return null
    }

    return normalizeMprMipConfig(activeTab.mprMipConfig, createDefaultMprMipConfig())
  })

  const activeMprSegmentationConfig = computed(() => {
    const activeTab = options.activeTab.value
    if (!activeTab || activeTab.viewType !== 'MPR') {
      return null
    }

    return normalizeMprSegmentationConfig(activeTab.mprSegmentationConfig, createDefaultMprSegmentationConfig())
  })

  function getModeOperationValue(toolKey: string): string {
    if (toolKey === 'page') {
      return `${STACK_OPERATION_PREFIX}${VIEW_OPERATION_TYPES.scroll}`
    }
    if (toolKey === 'annotate') {
      return `${STACK_OPERATION_PREFIX}annotate:arrow`
    }
    if (toolKey === 'qa') {
      return `${STACK_OPERATION_PREFIX}${normalizeQaOperation(stackToolSelections.value.qa ?? DEFAULT_QA_OPERATION)}`
    }
    return `${STACK_OPERATION_PREFIX}${toolKey}`
  }

  function getOperationToolKey(operation: string | undefined): string {
    const operationWithoutPrefix = operation?.startsWith(STACK_OPERATION_PREFIX)
      ? operation.slice(STACK_OPERATION_PREFIX.length)
      : (operation ?? '')
    const normalizedOperation = operationWithoutPrefix.split(':')[0]
    if (normalizedOperation === VIEW_OPERATION_TYPES.scroll) {
      return 'page'
    }
    if (normalizedOperation === 'mtf') {
      return 'qa'
    }
    return normalizedOperation
  }

  function supportsSlicePlayback(viewType: ViewerTabItem['viewType'] | undefined): boolean {
    return viewType === 'Stack' || viewType === 'Layout' || viewType === 'MPR' || viewType === '4D'
  }

  function getActiveLayoutSlot(tab: ViewerTabItem): NonNullable<ViewerTabItem['layoutSlots']>[number] | null {
    const slots = tab.layoutSlots ?? []
    return slots.find((slot) => slot.id === options.activeViewportKey.value && slot.viewId) ?? slots.find((slot) => Boolean(slot.viewId)) ?? null
  }

  function isActiveLayoutVolumeSlot(): boolean {
    const tab = options.activeTab.value
    if (!tab || tab.viewType !== 'Layout') {
      return false
    }
    const slot = getActiveLayoutSlot(tab)
    return slot?.viewType === '3D' || slot?.sourceViewType === '3D'
  }

  function resolveActiveComparePaneKey(tab: ViewerTabItem): CompareStackPaneKey {
    const viewportKey = options.activeViewportKey.value
    if (viewportKey === COMPARE_STACK_TARGET_PANE_KEY && tab.compareViewIds?.[COMPARE_STACK_TARGET_PANE_KEY]) {
      return COMPARE_STACK_TARGET_PANE_KEY
    }
    return COMPARE_STACK_SOURCE_PANE_KEY
  }

  function resolveActiveFusionPaneKey(tab: ViewerTabItem): FusionPaneKey {
    const viewportKey = options.activeViewportKey.value
    return isFusionPaneKey(viewportKey) && tab.fusionViewIds?.[viewportKey]
      ? viewportKey
      : FUSION_OVERLAY_AXIAL_PANE_KEY
  }

  function resolveActiveMprViewportKey(tab: ViewerTabItem): 'mpr-ax' | 'mpr-cor' | 'mpr-sag' {
    const viewportKey = options.activeViewportKey.value
    if ((viewportKey === 'mpr-ax' || viewportKey === 'mpr-cor' || viewportKey === 'mpr-sag') && tab.viewportViewIds?.[viewportKey]) {
      return viewportKey
    }
    return 'mpr-ax'
  }

  function getActiveViewportTransformState(tab: ViewerTabItem | null | undefined): ViewTransformInfo | null {
    if (!tab) {
      return null
    }
    if (tab.viewType === 'Layout') {
      return getActiveLayoutSlot(tab)?.transformState ?? tab.transformState ?? null
    }
    if (tab.viewType === 'CompareStack') {
      const paneKey = resolveActiveComparePaneKey(tab)
      return tab.compareTransformStates?.[paneKey] ?? tab.transformState ?? null
    }
    if (tab.viewType === 'PETCTFusion') {
      const paneKey = resolveActiveFusionPaneKey(tab)
      return tab.fusionTransformStates?.[paneKey] ?? tab.transformState ?? null
    }
    if (tab.viewType === 'MPR' || tab.viewType === '4D') {
      const viewportKey = resolveActiveMprViewportKey(tab)
      return tab.viewportTransformStates?.[viewportKey] ?? tab.transformState ?? null
    }
    return tab.transformState ?? null
  }

  function getActiveViewportZoom(): number {
    const zoom = Number(getActiveViewportTransformState(options.activeTab.value)?.zoom)
    return Number.isFinite(zoom) && zoom > 0 ? zoom : 1
  }

  function clampZoomRangeValue(value: number): number {
    if (!Number.isFinite(value)) {
      return 1
    }
    return Math.max(ZOOM_RANGE_MIN, Math.min(ZOOM_RANGE_MAX, value))
  }

  function withActiveZoomRangeControl(tool: StackTool): StackTool {
    if (tool.key !== 'zoom') {
      return tool
    }
    return {
      ...tool,
      dockOptions: tool.dockOptions?.length ? tool.dockOptions : transformResetDockOptions,
      rangeControl: {
        kind: 'zoom',
        value: clampZoomRangeValue(getActiveViewportZoom()),
        min: ZOOM_RANGE_MIN,
        max: ZOOM_RANGE_MAX,
        step: ZOOM_RANGE_STEP,
        ticks: ZOOM_RANGE_TICKS,
        resetValue: 1
      }
    }
  }

  function getWindowSelectionTargetKey(tab: ViewerTabItem): string {
    if (tab.viewType === 'Layout') {
      return `${tab.key}:${getActiveLayoutSlot(tab)?.id ?? 'layout'}`
    }
    if (tab.viewType === 'CompareStack') {
      return `${tab.key}:${resolveActiveComparePaneKey(tab)}`
    }
    if (tab.viewType === 'PETCTFusion') {
      return `${tab.key}:${resolveActiveFusionPaneKey(tab)}`
    }
    if (tab.viewType === 'MPR' || tab.viewType === '4D') {
      return `${tab.key}:${resolveActiveMprViewportKey(tab)}`
    }
    return `${tab.key}:single`
  }

  function getInitialWindowSelectionValue(tab: ViewerTabItem): string | null {
    if (tab.viewType === 'Layout') {
      const info = getActiveLayoutSlot(tab)?.initialWindowInfo
      return info ? formatWindowPresetValue(info.ww, info.wl) : null
    }
    if (tab.viewType === 'CompareStack') {
      const info = tab.compareInitialWindowInfos?.[resolveActiveComparePaneKey(tab)]
      return info ? formatWindowPresetValue(info.ww, info.wl) : null
    }
    if (tab.viewType === 'PETCTFusion') {
      const info = tab.fusionInitialWindowInfos?.[resolveActiveFusionPaneKey(tab)]
      return info ? formatWindowPresetValue(info.ww, info.wl) : null
    }
    if (tab.viewType === 'MPR' || tab.viewType === '4D') {
      const info = tab.viewportInitialWindowInfos?.[resolveActiveMprViewportKey(tab)] ?? tab.initialWindowInfo
      return info ? formatWindowPresetValue(info.ww, info.wl) : null
    }
    const info = tab.initialWindowInfo
    return info ? formatWindowPresetValue(info.ww, info.wl) : null
  }

  function getActiveSeriesIdForTab(tab: ViewerTabItem | null | undefined): string {
    if (!tab) {
      return ''
    }
    if (tab.viewType === 'Layout') {
      return getActiveLayoutSlot(tab)?.seriesId?.trim() ?? tab.seriesId?.trim() ?? ''
    }
    return tab.seriesId?.trim() ?? ''
  }

  function getDefaultToolbarToolKey(viewType: ViewerTabItem['viewType'] | undefined): string {
    if (viewType === 'MPR' || viewType === '4D') {
      return 'crosshair'
    }
    if (viewType === '3D' || (viewType === 'Layout' && isActiveLayoutVolumeSlot())) {
      return 'rotate3d'
    }
    return 'window'
  }

  function setToolbarToolActive(toolKey: string): void {
    toolbarActivationController.setActive(toolKey)
  }

  function isToolAvailable(toolKey: string): boolean {
    return activeTools.value.some((tool) => tool.key === toolKey)
  }

  function isMprLayoutView(viewType: ViewerTabItem['viewType'] | undefined): boolean {
    return viewType === 'MPR' || viewType === '4D'
  }

  function getDefaultMprLayoutSelectionValue(): string {
    return toMprLayoutSelectionValue(mprDefaultLayoutKey.value)
  }

  function withViewDefaultSelections(
    selections: Partial<Record<string, string>>,
    viewType: ViewerTabItem['viewType'] | undefined
  ): Partial<Record<string, string>> {
    if (!isMprLayoutView(viewType)) {
      return selections
    }

    const selectedMprLayout = parseMprLayoutSelectionValue(selections.mprLayout)
    if (selectedMprLayout) {
      return selections
    }

    return {
      ...selections,
      mprLayout: getDefaultMprLayoutSelectionValue()
    }
  }

  function getDefaultOperationValue(viewType: ViewerTabItem['viewType'] | undefined): string {
    if (viewType === 'MPR' || viewType === '4D') {
      return `${STACK_OPERATION_PREFIX}${VIEW_OPERATION_TYPES.crosshair}`
    }
    return getModeOperationValue(getDefaultToolbarToolKey(viewType))
  }

  function captureToolbarState(tabKey: string | undefined): void {
    if (!tabKey) {
      return
    }

    toolbarStateByTabKey.set(tabKey, {
      activeOperation: options.activeOperation.value,
      activeToolKey: activeToolbarToolKey.value,
      selections: { ...stackToolSelections.value }
    })
  }

  function restoreToolbarState(tabKey: string | undefined, viewType: ViewerTabItem['viewType'] | undefined): void {
    const savedState = tabKey ? toolbarStateByTabKey.get(tabKey) : null
    if (savedState) {
      const defaultToolKey = getDefaultToolbarToolKey(viewType)
      const activeToolKey = isToolAvailable(savedState.activeToolKey) ? savedState.activeToolKey : defaultToolKey
      stackToolSelections.value = withViewDefaultSelections({
        ...stackToolSelections.value,
        ...savedState.selections
      }, viewType)
      setToolbarToolActive(activeToolKey)
      options.emitSetActiveOperation(activeToolKey === savedState.activeToolKey && savedState.activeOperation ? savedState.activeOperation : getDefaultOperationValue(viewType))
      return
    }

    const defaultToolKey = getDefaultToolbarToolKey(viewType)
    stackToolSelections.value = isMprLayoutView(viewType)
      ? {
          ...stackToolSelections.value,
          mprLayout: getDefaultMprLayoutSelectionValue()
        }
      : stackToolSelections.value
    setToolbarToolActive(defaultToolKey)
    options.emitSetActiveOperation(getDefaultOperationValue(viewType))
  }

  function flashToolActive(toolKey: string, nextToolKey: string, callback?: () => void): void {
    pendingTransientCallback.value = callback ?? null
    toolbarActivationController.flash(toolKey, nextToolKey)
  }

  function getSelectedOption(toolKey: string): StackToolOption | null {
    const tool =
      activeTools.value.find((item) => item.key === toolKey) ??
      stackTools.find((item) => item.key === toolKey) ??
      genericTools.find((item) => item.key === toolKey) ??
      volumeTools.find((item) => item.key === toolKey)
    const selectedValue = stackToolSelections.value[toolKey]
    if (!tool?.options || !selectedValue) {
      return null
    }
    return tool.options.find((item) => item.value === selectedValue) ?? null
  }

  function getSelectedExportFormat(): ViewerExportFormat {
    const selectedFormat = (stackToolSelections.value.export ?? 'png') as ViewerExportFormat
    const exportOptions = activeTools.value.find((tool) => tool.key === 'export')?.options ?? []
    return exportOptions.some((option) => option.value === selectedFormat) ? selectedFormat : 'png'
  }

  function getSelectedExportTargetForActiveTab(): string | undefined {
    return getSelectedExportTargetViewportKey(
      options.activeTab.value,
      options.activeViewportKey.value,
      stackToolSelections.value.exportTarget
    ) ?? undefined
  }

  function activateSelectedOption(toolKey: string): string | null {
    const selectedOption = getSelectedOption(toolKey)
    if (!selectedOption) {
      return null
    }
    options.emitSetActiveOperation(`${STACK_OPERATION_PREFIX}${selectedOption.value}`)
    return selectedOption.value
  }

  function normalizeQaOperation(value: string): string {
    if (value === 'qa:water-accuracy' || value === 'qa:water-uniformity') {
      return WATER_PHANTOM_QA_OPERATION
    }
    if (value === 'qa:mtf' || value === WATER_PHANTOM_QA_OPERATION) {
      return value
    }
    return DEFAULT_QA_OPERATION
  }

  function isToolSelected(tool: StackTool): boolean {
    if (tool.key === 'fusionRegistration') {
      return options.activeTab.value?.viewType === 'PETCTFusion' && options.activeTab.value.fusionManualRegistration === true
    }
    if (transientActiveToolKey.value === tool.key) {
      return true
    }
    return activeToolbarToolKey.value === tool.key
  }

  function closeMenus(): void {
    menuController.close()
  }

  function closeMenusIfNeeded(behavior?: StackToolOptionSelectBehavior): void {
    if (behavior?.keepMenuOpen) {
      return
    }
    closeMenus()
  }

  function setMenuOpen(toolKey: string | null): void {
    if (toolKey == null) {
      menuController.close()
      return
    }
    menuController.toggle(toolKey)
  }

  function stopPlayback(): void {
    if (playbackTimer != null) {
      window.clearInterval(playbackTimer)
      playbackTimer = null
    }
    playbackTarget = null
    playbackController.stop()
  }

  function startPlaybackTimer(): void {
    if (playbackTimer != null) {
      window.clearInterval(playbackTimer)
    }
    playbackTimer = window.setInterval(() => {
      tickPlayback()
    }, getStackPlaybackIntervalMs())
  }

  function restartPlaybackTimerIfActive(): void {
    if (!isPlaying.value) {
      return
    }
    startPlaybackTimer()
  }

  function getCurrentSlicePlaybackInfo(): { current: number; total: number; viewportKey: string } | null {
    const activeTab = options.activeTab.value
    if (!activeTab || !supportsSlicePlayback(activeTab.viewType)) {
      return null
    }

    const viewportKey = getPlaybackViewportKey()
    const mprViewportKey = activeTab.viewType === 'MPR' || activeTab.viewType === '4D' ? resolveActiveMprViewportKey(activeTab) : null
    const sliceLabel =
      activeTab.viewType === 'Layout'
        ? (getActiveLayoutSlot(activeTab)?.sliceLabel ?? '')
        : mprViewportKey
          ? (activeTab.viewportSliceLabels?.[mprViewportKey] ?? '')
          : activeTab.sliceLabel
    const match = sliceLabel.trim().match(/^(\d+)\s*\/\s*(\d+)$/)
    if (!match) {
      return null
    }

    const current = Number(match[1])
    const total = Number(match[2])
    if (!Number.isFinite(current) || !Number.isFinite(total) || total <= 1) {
      return null
    }

    return { current, total, viewportKey }
  }

  function getPlaybackViewportKey(): string {
    const activeTab = options.activeTab.value
    if (activeTab?.viewType === 'Layout') {
      return getActiveLayoutSlot(activeTab)?.id ?? options.activeViewportKey.value
    }
    if (activeTab?.viewType === 'MPR' || activeTab?.viewType === '4D') {
      return resolveActiveMprViewportKey(activeTab)
    }
    return 'single'
  }

  function tickPlayback(): void {
    const sliceInfo = getCurrentSlicePlaybackInfo()
    if (!playbackTarget || !sliceInfo) {
      stopPlayback()
      return
    }

    playbackTarget = sliceInfo
    const delta = sliceInfo.current >= sliceInfo.total ? -(sliceInfo.total - 1) : 1
    playbackTarget.current = delta < 0 ? 1 : sliceInfo.current + 1
    options.emitViewportWheel({
      viewportKey: playbackTarget.viewportKey,
      deltaY: delta,
      exact: true
    })
  }

  function startPlayback(behavior?: StackToolOptionSelectBehavior): void {
    if (!supportsSlicePlayback(options.activeTab.value?.viewType)) {
      return
    }
    const sliceInfo = getCurrentSlicePlaybackInfo()
    if (!sliceInfo) {
      return
    }

    playbackTarget = { current: sliceInfo.current, total: sliceInfo.total, viewportKey: sliceInfo.viewportKey }
    closeMenusIfNeeded(behavior)
    playbackController.start()
    startPlaybackTimer()
  }

  function resumePlayback(behavior?: StackToolOptionSelectBehavior): void {
    if (!supportsSlicePlayback(options.activeTab.value?.viewType)) {
      stopPlayback()
      return
    }
    if (!playbackTarget && !getCurrentSlicePlaybackInfo()) {
      stopPlayback()
      return
    }

    closeMenusIfNeeded(behavior)
    playbackController.resume()
    startPlaybackTimer()
  }

  function pausePlayback(behavior?: StackToolOptionSelectBehavior): void {
    closeMenusIfNeeded(behavior)
    if (isPlaying.value) {
      if (playbackTimer != null) {
        window.clearInterval(playbackTimer)
        playbackTimer = null
      }
      playbackController.pause()
      return
    }
    if (isPlaybackPaused.value) {
      resumePlayback(behavior)
    }
  }

  function endPlayback(behavior?: StackToolOptionSelectBehavior): void {
    closeMenusIfNeeded(behavior)
    stopPlayback()
  }

  function updateActiveMprMipConfig(config: MprMipConfig, actionType?: 'move' | 'end'): void {
    const activeTab = options.activeTab.value
    if (!activeTab || (activeTab.viewType !== 'MPR' && activeTab.viewType !== '4D')) {
      return
    }

    options.emitTriggerViewAction({ action: 'mprMipConfig', actionType, config })
  }

  function updateActiveMprSegmentationConfig(config: MprSegmentationConfig, actionType?: MprSegmentationConfigActionType): void {
    const activeTab = options.activeTab.value
    if (!activeTab || activeTab.viewType !== 'MPR') {
      return
    }

    options.emitTriggerViewAction({ action: 'mprSegmentation', actionType, segmentationConfig: config })
  }

  function closeMprSegmentationPanel(): void {
    isMprSegmentationPanelOpen.value = false
  }

  function isSegmentationOption(value: string | null | undefined): value is 'segmentation:threshold' | 'segmentation:voi' {
    return value === 'segmentation:threshold' || value === 'segmentation:voi'
  }

  function createSegmentationConfigForOption(value: string): MprSegmentationConfig | null {
    const current = activeMprSegmentationConfig.value
    if (!current || !isSegmentationOption(value)) {
      return null
    }
    if (value === 'segmentation:threshold') {
      return normalizeMprSegmentationConfig({
        ...current,
        enabled: true
      })
    }
    return normalizeMprSegmentationConfig({
      ...current,
      enabled: current.enabled
    })
  }

  function activateSegmentationOption(value: string): void {
    const nextConfig = createSegmentationConfigForOption(value)
    if (!nextConfig) {
      return
    }
    closeMenus()
    options.cleanupPointerInteractions()
    setToolbarToolActive('segmentation')
    isVolumeConfigPanelOpen.value = false
    isMprMipPanelOpen.value = false
    isMprSegmentationPanelOpen.value = true
    stackToolSelections.value = {
      ...stackToolSelections.value,
      segmentation: value
    }
    options.emitSetActiveOperation(`${STACK_OPERATION_PREFIX}${value}`)
    updateActiveMprSegmentationConfig(nextConfig, 'end')
  }

  function activateSegmentationSelectionMode(value: 'segmentation:threshold' | 'segmentation:voi'): void {
    closeMenus()
    options.cleanupPointerInteractions()
    setToolbarToolActive('segmentation')
    isVolumeConfigPanelOpen.value = false
    isMprMipPanelOpen.value = false
    isMprSegmentationPanelOpen.value = true
    stackToolSelections.value = {
      ...stackToolSelections.value,
      segmentation: value
    }
    options.emitSetActiveOperation(`${STACK_OPERATION_PREFIX}${value}`)
  }

  function activateModeTool(tool: StackTool, behavior?: StackToolOptionSelectBehavior): void {
    closeMenusIfNeeded(behavior)
    if (tool.key === 'measure') {
      options.stopViewportDrag()
    } else {
      options.cleanupPointerInteractions()
    }
    setToolbarToolActive(tool.key)
    if (tool.key === 'volumeClip') {
      stackToolSelections.value = {
        ...stackToolSelections.value,
        volumeClip: 'volumeClip:inside'
      }
      options.emitSetActiveOperation(`${STACK_OPERATION_PREFIX}volumeClip:inside`)
      return
    }
    if ((tool.key === 'measure' || tool.key === 'qa' || tool.key === 'volumeClip') && getSelectedOption(tool.key)) {
      activateSelectedOption(tool.key)
    } else {
      options.emitSetActiveOperation(getModeOperationValue(tool.key))
    }
  }

  function toggleToolMenu(tool: StackTool): void {
    setMenuOpen(openMenuKey.value === tool.key ? null : tool.key)
  }

  function applyResetTool(): void {
    closeMenus()
    options.stopViewportDrag()
    stackToolSelections.value = {
      ...stackToolSelections.value,
      reset: 'reset:view'
    }
    if (isActiveRender3dViewport()) {
      stackToolSelections.value = {
        ...stackToolSelections.value,
        render3dMode: 'render3dMode:volume',
        volumePreset: options.activeTab.value?.volumePreset || 'volumePreset:aaa'
      }
    }
    options.emitTriggerViewAction({ action: 'reset' })
    const defaultToolKey = getDefaultToolbarToolKey(options.activeTab.value?.viewType)
    flashToolActive('reset', defaultToolKey, () => {
      options.emitSetActiveOperation(getModeOperationValue(defaultToolKey))
    })
  }

  function applySelectedViewAction(
    tool: StackTool,
    action: 'volumePreset' | 'surfacePreset' | 'render3dMode' | 'rotate' | 'pseudocolor' | 'fusionPseudocolor'
  ): void {
    closeMenus()
    const selectedOption = getSelectedOption(tool.key)
    if (!selectedOption) {
      return
    }
    flashToolActive(tool.key, activeToolbarToolKey.value, () => {
      options.emitTriggerViewAction({ action, value: selectedOption.value })
    })
  }

  function applySelectedModeTool(tool: StackTool, behavior?: StackToolOptionSelectBehavior): void {
    closeMenusIfNeeded(behavior)
    const selectedOption = getSelectedOption(tool.key)
    if (!selectedOption) {
      return
    }
    if (tool.key === 'volumeClip' && selectedOption.value === 'volumeClip:reset') {
      closeMenusIfNeeded(behavior)
      flashToolActive(tool.key, activeToolbarToolKey.value, () => {
        options.emitTriggerViewAction({ action: 'volumeClipReset' })
      })
      return
    }
    if (tool.key === 'measure') {
      options.stopViewportDrag()
    } else {
      options.cleanupPointerInteractions()
    }
    setToolbarToolActive(tool.key)
    const nextOperation = `${STACK_OPERATION_PREFIX}${selectedOption.value}`
    if (options.activeOperation.value !== nextOperation) {
      options.emitSetActiveOperation(nextOperation)
    }
  }

  const toolApplyHandlers: Record<string, (tool: StackTool, behavior?: StackToolOptionSelectBehavior) => void> = {
    compareSync: toggleToolMenu,
    display: toggleToolMenu,
    layout: toggleToolMenu,
    mprLayout: toggleToolMenu,
    reset: () => applyResetTool(),
    volumeParams: () => {
      closeMenus()
      const nextOpen = !isVolumeConfigPanelOpen.value
      isMprMipPanelOpen.value = false
      isMprSegmentationPanelOpen.value = false
      isVolumeConfigPanelOpen.value = nextOpen
    },
    surfaceParams: () => {
      closeMenus()
      const nextOpen = !isVolumeConfigPanelOpen.value
      isMprMipPanelOpen.value = false
      isMprSegmentationPanelOpen.value = false
      isVolumeConfigPanelOpen.value = nextOpen
    },
    mprMip: () => {
      closeMenus()
      isVolumeConfigPanelOpen.value = false
      isMprSegmentationPanelOpen.value = false
      isMprMipPanelOpen.value = !isMprMipPanelOpen.value
    },
    segmentation: () => {
      const selectedOption = stackToolSelections.value.segmentation ?? 'segmentation:threshold'
      if (!isSegmentationOption(selectedOption) || options.activeTab.value?.viewType !== 'MPR') {
        return
      }
      if (isMprSegmentationPanelOpen.value) {
        activateSegmentationSelectionMode(selectedOption)
        return
      }
      activateSegmentationOption(selectedOption)
    },
    volumePreset: (tool) => applySelectedViewAction(tool, 'volumePreset'),
    surfacePreset: (tool) => applySelectedViewAction(tool, 'surfacePreset'),
    volumeOrientation: toggleToolMenu,
    render3dMode: (tool) => applySelectedViewAction(tool, 'render3dMode'),
    volumeRemoveBed: () => {
      closeMenus()
      flashToolActive('volumeRemoveBed', activeToolbarToolKey.value, () => {
        options.emitTriggerViewAction({
          action: 'volumeRenderOptions',
          enabled: !(options.activeTab.value?.volumeRenderOptions?.removeBed === true)
        })
      })
    },
    rotate: (tool) => applySelectedViewAction(tool, 'rotate'),
    pseudocolor: (tool) => applySelectedViewAction(tool, 'pseudocolor'),
    fusionPseudocolor: (tool) => applySelectedViewAction(tool, 'fusionPseudocolor'),
    fusionRegistration: () => {
      closeMenus()
      options.emitTriggerViewAction({
        action: 'fusionManualRegistration',
        enabled: !(options.activeTab.value?.fusionManualRegistration === true)
      })
    },
    fusionManualRegistration: () => {
      closeMenus()
      options.emitTriggerViewAction({
        action: 'fusionManualRegistration',
        enabled: !(options.activeTab.value?.fusionManualRegistration === true)
      })
    },
    fusionRegistrationReset: () => {
      closeMenus()
      options.emitTriggerViewAction({ action: 'fusionRegistrationReset' })
    },
    fusionRegistrationSave: () => {
      closeMenus()
      options.emitTriggerViewAction({ action: 'fusionRegistrationSave' })
    },
    fusionRegistrationLoad: () => {
      closeMenus()
      options.emitTriggerViewAction({ action: 'fusionRegistrationLoad' })
    },
    measure: applySelectedModeTool,
    qa: applySelectedModeTool,
    play: (_tool, behavior) => {
      closeMenusIfNeeded(behavior)
      startPlayback(behavior)
    },
    tag: () => {
      closeMenus()
      const seriesId = getActiveSeriesIdForTab(options.activeTab.value)
      if (seriesId) {
        options.emitOpenSeriesView(seriesId, 'Tag')
      }
    },
    export: (tool) => {
      if (getValidExportTargetViewportKeys(options.activeTab.value).length > 0) {
        toggleToolMenu(tool)
        return
      }
      closeMenus()
      options.exportCurrentView(getSelectedExportFormat(), getSelectedExportTargetForActiveTab())
    }
  }

  function applyTool(tool: StackTool, behavior?: StackToolOptionSelectBehavior): void {
    if (areToolbarActionsDisabled.value && tool.key !== 'play') {
      return
    }

    if (MODE_TOOL_KEYS.has(tool.key) || tool.key === 'page') {
      activateModeTool(tool, behavior)
      return
    }

    toolApplyHandlers[tool.key]?.(tool, behavior)
  }

  function selectToolOption(tool: StackTool, optionValue: string, behavior?: StackToolOptionSelectBehavior): void {
    if (tool.key === 'zoom' && optionValue.startsWith('transform:zoom:')) {
      const zoom = Number(optionValue.replace(/^transform:zoom:/, ''))
      if (!Number.isFinite(zoom) || zoom <= 0) {
        return
      }
      closeMenusIfNeeded(behavior)
      options.stopViewportDrag()
      setToolbarToolActive(tool.key)
      options.emitTriggerViewAction({
        action: 'transformZoomPreset',
        transformZoom: zoom
      })
      return
    }

    if (optionValue === 'transform:reset') {
      closeMenusIfNeeded(behavior)
      options.stopViewportDrag()
      setToolbarToolActive(tool.key)
      options.emitTriggerViewAction({
        action: 'transformReset',
        transformScope: tool.key === 'pan' ? 'pan' : tool.key === 'zoom' ? 'zoom' : 'all'
      })
      return
    }

    if (tool.key === 'crosshair' && optionValue === 'mprCrosshair:reset') {
      closeMenusIfNeeded(behavior)
      options.stopViewportDrag()
      setToolbarToolActive(tool.key)
      options.emitTriggerViewAction({ action: 'mprCrosshairReset' })
      return
    }

    if (tool.key === 'rotate3d' && optionValue === 'rotate3d:reset') {
      closeMenusIfNeeded(behavior)
      options.stopViewportDrag()
      setToolbarToolActive(tool.key)
      options.emitTriggerViewAction({ action: 'rotate3dReset' })
      return
    }

    if (tool.key === 'volumeOrientation') {
      const face = optionValue === 'volumeOrientation:reset'
        ? DEFAULT_VOLUME_ORIENTATION_FACE
        : optionValue.replace(/^volumeOrientation:/, '').toUpperCase()
      if (!isVolumeOrientationFace(face) || !isActiveRender3dViewport()) {
        return
      }
      closeMenusIfNeeded(behavior)
      options.stopViewportDrag()
      setToolbarToolActive(tool.key)
      stackToolSelections.value = {
        ...stackToolSelections.value,
        volumeOrientation: `volumeOrientation:${face}`
      }
      options.emitTriggerViewAction({
        action: 'volumeOrientation',
        value: face
      })
      return
    }

    if (tool.key === 'display') {
      const overlay = parseDisplayOverlaySelectionValue(optionValue)
      const selectedOption = tool.options?.find((option) => option.value === optionValue)
      const activeViewType = options.activeTab.value?.viewType
      if (!overlay || !supportsDisplayTool(activeViewType)) {
        return
      }
      const tabKey = options.activeTab.value?.key
      const enabled = !selectedOption?.checked
      if (tabKey) {
        setDisplayOverlayDraft(tabKey, overlay, enabled)
      }

      options.emitTriggerViewAction({
        action: 'displayOverlay',
        overlay,
        enabled
      })
      return
    }

    if (tool.key === 'crosshair') {
      const mode = parseMprCrosshairModeSelectionValue(optionValue)
      const activeViewType = options.activeTab.value?.viewType
      if (!mode || (activeViewType !== 'MPR' && activeViewType !== '4D')) {
        return
      }

      stackToolSelections.value = {
        ...stackToolSelections.value,
        crosshair: toMprCrosshairModeSelectionValue(mode)
      }
      closeMenusIfNeeded(behavior)
      options.emitTriggerViewAction({ action: 'mprCrosshairMode', mode })
      return
    }

    if (tool.key === 'mprLayout') {
      const layoutKey = parseMprLayoutSelectionValue(optionValue)
      const selectedOption = tool.options?.find((option) => option.value === optionValue)
      if (!layoutKey || selectedOption?.disabled) {
        return
      }

      if (layoutKey === activeMprLayoutKey.value) {
        closeMenusIfNeeded(behavior)
        return
      }

      stackToolSelections.value = {
        ...stackToolSelections.value,
        mprLayout: optionValue
      }
      closeMenusIfNeeded(behavior)
      return
    }

    if (tool.key === 'segmentation') {
      if (options.activeTab.value?.viewType !== 'MPR') {
        return
      }
      activateSegmentationOption(optionValue)
      return
    }

    if (tool.key === 'layout') {
      const template = parseViewerLayoutOptionValue(optionValue)
      if (!template) {
        return
      }

      const activeTab = options.activeTab.value
      if (
        activeTab?.viewType === 'Layout' &&
        activeTab.layoutTemplate?.rows === template.rows &&
        activeTab.layoutTemplate?.columns === template.columns
      ) {
        closeMenusIfNeeded(behavior)
        return
      }

      stackToolSelections.value = {
        ...stackToolSelections.value,
        layout: optionValue
      }
      closeMenusIfNeeded(behavior)
      void options.emitOpenLayoutView(template)
      return
    }

    if (tool.key === 'compareSync') {
      const activeTab = options.activeTab.value
      const selectedOption = tool.options?.find((option) => option.value === optionValue)
      if (!activeTab || (activeTab.viewType !== 'CompareStack' && activeTab.viewType !== 'Layout') || !selectedOption?.syncKey) {
        return
      }
      options.emitCompareSyncChange({
        tabKey: activeTab.key,
        key: selectedOption.syncKey,
        value: !selectedOption.checked
      })
      return
    }

    if (tool.key === 'play') {
      const fps = parseStackPlaybackFps(optionValue)
      stackToolSelections.value = {
        ...stackToolSelections.value,
        play: `playbackFps:${fps}`
      }
      closeMenusIfNeeded(behavior)
      restartPlaybackTimerIfActive()
      return
    }

    if (tool.key === 'measure' && optionValue === 'reset:measurements') {
      closeMenusIfNeeded(behavior)
      options.stopViewportDrag()
      options.emitTriggerViewAction({ action: 'clearMeasurements' })
      return
    }

    if (tool.key === 'qa' && optionValue === 'reset:mtf') {
      closeMenusIfNeeded(behavior)
      options.stopViewportDrag()
      options.emitTriggerViewAction({ action: 'clearMtf' })
      return
    }

    if (tool.key === 'qa' && optionValue === 'reset:qa-water') {
      closeMenusIfNeeded(behavior)
      options.stopViewportDrag()
      return
    }

    if (tool.key === 'annotate' && optionValue === 'reset:annotations') {
      closeMenusIfNeeded(behavior)
      options.stopViewportDrag()
      options.emitTriggerViewAction({ action: 'clearAnnotations' })
      return
    }

    if (tool.key === 'export') {
      const targetViewportKey = parseExportTargetSelectionValue(optionValue)
      if (targetViewportKey) {
        const validTargets = getValidExportTargetViewportKeys(options.activeTab.value)
        if (!validTargets.includes(targetViewportKey)) {
          return
        }
        stackToolSelections.value = {
          ...stackToolSelections.value,
          exportTarget: toExportTargetSelectionValue(targetViewportKey)
        }
        return
      }

      const exportOptions = activeTools.value.find((item) => item.key === 'export')?.options ?? []
      if (!exportOptions.some((option) => option.value === optionValue)) {
        return
      }
      stackToolSelections.value = {
        ...stackToolSelections.value,
        export: optionValue
      }
      closeMenus()
      flashToolActive(tool.key, activeToolbarToolKey.value)
      options.exportCurrentView(optionValue as ViewerExportFormat, getSelectedExportTargetForActiveTab())
      return
    }

    stackToolSelections.value = {
      ...stackToolSelections.value,
      [tool.key]: optionValue
    }
    closeMenusIfNeeded(behavior)

    if (tool.key === 'rotate') {
      flashToolActive(tool.key, activeToolbarToolKey.value, () => {
        options.emitTriggerViewAction({ action: 'rotate', value: optionValue })
      })
      return
    }

    if (tool.key === 'pseudocolor') {
      flashToolActive(tool.key, activeToolbarToolKey.value, () => {
        options.emitTriggerViewAction({ action: 'pseudocolor', value: optionValue })
      })
      return
    }

    if (tool.key === 'fusionPseudocolor') {
      options.emitTriggerViewAction({ action: 'fusionPseudocolor', value: optionValue })
      return
    }

    if (tool.key === 'fusionPetDisplay') {
      if (optionValue.startsWith('fusionPetPseudocolor:')) {
        options.emitTriggerViewAction({
          action: 'fusionPseudocolor',
          value: optionValue.replace(/^fusionPetPseudocolor:/, 'fusionPseudocolor:')
        })
        return
      }
      if (optionValue.startsWith('fusionPetUnit:')) {
        options.emitTriggerViewAction({ action: 'fusionPetUnit', value: optionValue })
        return
      }
      if (optionValue.startsWith('fusionPetWindow:')) {
        options.emitTriggerViewAction({ action: 'fusionPetWindow', value: optionValue })
        return
      }
      if (optionValue.startsWith('petUnit:')) {
        options.emitTriggerViewAction({ action: 'petUnit', value: optionValue })
        return
      }
      if (optionValue.startsWith('petWindow:')) {
        options.emitTriggerViewAction({ action: 'petWindow', value: optionValue })
        return
      }
      if (optionValue === 'petDisplay:reset') {
        options.emitTriggerViewAction({ action: 'petDisplayReset' })
        return
      }
      if (optionValue === 'fusionPetDisplay:reset') {
        options.emitTriggerViewAction({ action: 'fusionPetDisplayReset' })
        return
      }
    }

    if (tool.key === 'fusionRegistration') {
      if (optionValue === 'fusionRegistration:toggle') {
        options.emitTriggerViewAction({
          action: 'fusionManualRegistration',
          enabled: !(options.activeTab.value?.fusionManualRegistration === true)
        })
        return
      }
      if (optionValue === 'fusionRegistration:exit') {
        options.emitTriggerViewAction({
          action: 'fusionManualRegistration',
          enabled: false
        })
        return
      }
      if (optionValue === 'fusionRegistration:help') {
        return
      }
      if (optionValue === 'fusionRegistration:reset') {
        options.emitTriggerViewAction({ action: 'fusionRegistrationReset' })
        return
      }
      if (optionValue === 'fusionRegistration:save') {
        options.emitTriggerViewAction({ action: 'fusionRegistrationSave' })
        return
      }
      if (optionValue === 'fusionRegistration:load') {
        options.emitTriggerViewAction({ action: 'fusionRegistrationLoad' })
      }
      return
    }

    if (tool.key === 'window') {
      if (optionValue === 'window:reset') {
        const activeTab = options.activeTab.value
        if (!activeTab) {
          return
        }
        options.stopViewportDrag()
        setToolbarToolActive('window')
        if (options.activeOperation.value !== `${STACK_OPERATION_PREFIX}${VIEW_OPERATION_TYPES.window}`) {
          options.emitSetActiveOperation(`${STACK_OPERATION_PREFIX}${VIEW_OPERATION_TYPES.window}`)
        }
        const targetKey = getWindowSelectionTargetKey(activeTab)
        const resetValue = explicitWindowSelectionByTargetKey.get(targetKey) ?? getInitialWindowSelectionValue(activeTab)
        if (!resetValue || !parseWindowPresetValue(resetValue)) {
          closeMenusIfNeeded(behavior)
          return
        }
        stackToolSelections.value = {
          ...stackToolSelections.value,
          window: resetValue
        }
        closeMenusIfNeeded(behavior)
        options.emitTriggerViewAction({ action: 'windowPreset', value: resetValue })
        return
      }

      const parsedWindowValue = parseWindowPresetValue(optionValue)
      if (!parsedWindowValue) {
        return
      }
      const selectedPreset = windowPresets.value.find((preset) => formatWindowPresetValue(preset.ww, preset.wl) === optionValue)
      if (selectedPreset) {
        selectedWindowPresetId.value = selectedPreset.id
      }
      options.stopViewportDrag()
      setToolbarToolActive('window')
      if (options.activeOperation.value !== `${STACK_OPERATION_PREFIX}${VIEW_OPERATION_TYPES.window}`) {
        options.emitSetActiveOperation(`${STACK_OPERATION_PREFIX}${VIEW_OPERATION_TYPES.window}`)
      }
      const activeTab = options.activeTab.value
      if (activeTab) {
        explicitWindowSelectionByTargetKey.set(getWindowSelectionTargetKey(activeTab), formatWindowPresetValue(parsedWindowValue.ww, parsedWindowValue.wl))
      }
      stackToolSelections.value = {
        ...stackToolSelections.value,
        window: formatWindowPresetValue(parsedWindowValue.ww, parsedWindowValue.wl)
      }
      closeMenusIfNeeded(behavior)
      options.emitTriggerViewAction({ action: 'windowPreset', value: formatWindowPresetValue(parsedWindowValue.ww, parsedWindowValue.wl) })
      return
    }

    if (tool.key === 'measure' || tool.key === 'qa') {
      options.stopViewportDrag()
      setToolbarToolActive(tool.key)
      options.emitSetActiveOperation(`${STACK_OPERATION_PREFIX}${optionValue}`)
      return
    }

    if (tool.key === 'volumeClip') {
      if (optionValue === 'volumeClip:reset') {
        stackToolSelections.value = {
          ...stackToolSelections.value,
          volumeClip: 'volumeClip:inside'
        }
        closeMenusIfNeeded(behavior)
        options.stopViewportDrag()
        flashToolActive(tool.key, activeToolbarToolKey.value, () => {
          options.emitTriggerViewAction({ action: 'volumeClipReset' })
        })
        return
      }
      if (optionValue !== 'volumeClip:inside' && optionValue !== 'volumeClip:outside') {
        return
      }
      closeMenusIfNeeded(behavior)
      options.stopViewportDrag()
      setToolbarToolActive(tool.key)
      options.emitSetActiveOperation(`${STACK_OPERATION_PREFIX}${optionValue}`)
      return
    }

    if (tool.key === 'reset') {
      stackToolSelections.value = {
        ...stackToolSelections.value,
        reset: 'reset:view'
      }
      flashToolActive(tool.key, activeToolbarToolKey.value, () => {
        if (optionValue === 'reset:measurements') {
          options.emitTriggerViewAction({ action: 'clearMeasurements' })
          return
        }
        if (optionValue === 'reset:mtf') {
          options.emitTriggerViewAction({ action: 'clearMtf' })
          return
        }
        if (optionValue === 'reset:annotations') {
          options.emitTriggerViewAction({ action: 'clearAnnotations' })
          return
        }
        if (optionValue === 'reset:all') {
          options.emitTriggerViewAction({ action: 'resetAll' })
          return
        }
        options.emitTriggerViewAction({ action: 'reset' })
      })
      return
    }

    if (tool.key === 'volumePreset' || tool.key === 'surfacePreset' || tool.key === 'render3dMode') {
      flashToolActive(tool.key, activeToolbarToolKey.value, () => {
        options.emitTriggerViewAction({
          action: tool.key === 'volumePreset' ? 'volumePreset' : tool.key === 'surfacePreset' ? 'surfacePreset' : 'render3dMode',
          value: optionValue
        })
      })
      return
    }

  }

  function handleViewportClick(viewportKey: string): void {
    options.setActiveViewport(viewportKey)
  }

  function handleViewportWheel(payload: { viewportKey: string; deltaY: number; exact?: boolean; deltaX?: number; deltaMode?: number; ctrlKey?: boolean; canvasX?: number; canvasY?: number; canvasWidth?: number; canvasHeight?: number }): void {
    options.setActiveViewport(payload.viewportKey)
    if (!Number.isFinite(payload.deltaY) || payload.deltaY === 0) {
      return
    }
    options.emitViewportWheel(payload)
  }

  watch(
    () => [options.activeTab.value?.key, options.activeTab.value?.viewType] as const,
    ([tabKey, viewType], previousValue) => {
      const previousTabKey = previousValue?.[0]
      const previousViewType = previousValue?.[1]
      const tabOrViewChanged =
        previousTabKey === undefined || viewType !== previousViewType || options.activeTab.value?.key !== previousTabKey

      if (previousTabKey !== undefined && tabOrViewChanged) {
        options.stopViewportDrag()
      }

      if (tabOrViewChanged) {
        if (previousTabKey !== undefined && previousTabKey !== tabKey) {
          captureToolbarState(previousTabKey)
        }
        stopPlayback()
        isVolumeConfigPanelOpen.value = false
        isMprMipPanelOpen.value = false
        isMprSegmentationPanelOpen.value = false
        options.setActiveViewport(
          viewType === 'MPR' || viewType === '4D'
            ? 'mpr-ax'
            : viewType === '3D'
              ? 'volume'
              : viewType === 'CompareStack'
                ? COMPARE_STACK_SOURCE_PANE_KEY
                : viewType === 'Layout'
                  ? (options.activeTab.value?.layoutSlots?.find((slot) => Boolean(slot.viewId))?.id ?? 'layout')
                  : viewType === 'PETCTFusion'
                    ? FUSION_OVERLAY_AXIAL_PANE_KEY
                    : 'single'
        )
        restoreToolbarState(tabKey, viewType)
        closeMenus()
      }
    },
    { immediate: true }
  )

  watch(
    () => options.activeOperation.value,
    (value, previousValue) => {
      const normalizeOperation = (operation: string | undefined): string =>
        operation ? (operation.startsWith(STACK_OPERATION_PREFIX) ? operation.slice(STACK_OPERATION_PREFIX.length) : operation) : ''

      const previousNormalized = normalizeOperation(previousValue)
      const currentNormalized = normalizeOperation(value)
      const isMeasurementToMeasurementSwitch =
        previousNormalized.startsWith('measure:') && currentNormalized.startsWith('measure:')

      if (previousValue !== undefined && value !== previousValue && !isMeasurementToMeasurementSwitch) {
        options.cleanupPointerInteractions()
      }
      if (!value) {
        const defaultToolKey = getDefaultToolbarToolKey(options.activeTab.value?.viewType)
        setToolbarToolActive(defaultToolKey)
        options.emitSetActiveOperation(getModeOperationValue(defaultToolKey))
        return
      }

      const operationWithoutPrefix = value.startsWith(STACK_OPERATION_PREFIX)
        ? value.slice(STACK_OPERATION_PREFIX.length)
        : value
      if (operationWithoutPrefix.startsWith('qa:')) {
        stackToolSelections.value = {
          ...stackToolSelections.value,
          qa: normalizeQaOperation(operationWithoutPrefix)
        }
      }

      const matchedToolKey = getOperationToolKey(value)
      if (SELECTABLE_TOOL_KEYS.has(matchedToolKey)) {
        if (!isToolAvailable(matchedToolKey)) {
          return
        }
        setToolbarToolActive(matchedToolKey)
      }
      captureToolbarState(options.activeTab.value?.key)
    },
    { immediate: true }
  )

  watch(
    () => mprDefaultLayoutKey.value,
    (value) => {
      if (!isMprLayoutView(options.activeTab.value?.viewType) && options.activeTab.value) {
        return
      }

      stackToolSelections.value = {
        ...stackToolSelections.value,
        mprLayout: toMprLayoutSelectionValue(value)
      }
    }
  )

  watch(
    () => selectedWindowPresetId.value,
    (value) => {
      const selectedPreset = windowPresets.value.find((preset) => preset.id === value) ?? windowPresets.value[0]
      if (!selectedPreset) {
        return
      }

      stackToolSelections.value = {
        ...stackToolSelections.value,
        window: formatWindowPresetValue(selectedPreset.ww, selectedPreset.wl)
      }
    },
    { immediate: true }
  )

  watch(
    () => [
      options.activeTab.value?.key,
      options.activeTab.value?.showCornerInfo,
      options.activeTab.value?.showScaleBar,
      options.activeTab.value?.showPseudocolorBar,
      options.activeTab.value?.showVolumeOrientationCube,
      options.activeTab.value?.showSliceSlider,
      options.activeTab.value?.showCrosshair
    ] as const,
    () => pruneSettledDisplayOverlayDraft(options.activeTab.value)
  )

  watch(
    () => options.activeTab.value?.mprCrosshairMode,
    (value) => {
      const mode = value === 'double-oblique' ? 'double-oblique' : 'orthogonal'
      stackToolSelections.value = {
        ...stackToolSelections.value,
        crosshair: toMprCrosshairModeSelectionValue(mode)
      }
    },
    { immediate: true }
  )

  watch(
    () => [options.activeTab.value?.render3dMode, options.activeViewportKey.value, isActiveMpr3dLayout.value] as const,
    (value) => {
      const [render3dMode] = value
      if (!isActiveRender3dViewport()) {
        return
      }
      stackToolSelections.value = {
        ...stackToolSelections.value,
        render3dMode: `render3dMode:${render3dMode === 'surface' ? 'surface' : 'volume'}`
      }
      if (render3dMode === 'surface') {
        const activeToolUnavailable = !isToolAvailable(activeToolbarToolKey.value)
        const activeOperationToolKey = getOperationToolKey(options.activeOperation.value)
        if (activeToolUnavailable || activeOperationToolKey === 'window') {
          setToolbarToolActive('rotate3d')
          options.emitSetActiveOperation(getModeOperationValue('rotate3d'))
        }
      }
    },
    { immediate: true }
  )

  watch(
    () => options.activeTab.value?.volumePreset,
    (value) => {
      if (!isActiveRender3dViewport()) {
        return
      }
      stackToolSelections.value = {
        ...stackToolSelections.value,
        volumePreset: value || 'volumePreset:aaa'
      }
    },
    { immediate: true }
  )

  watch(
    () => options.activeTab.value?.surfaceRenderConfig?.preset,
    (value) => {
      if (!isActiveRender3dViewport()) {
        return
      }
      stackToolSelections.value = {
        ...stackToolSelections.value,
        surfacePreset: `surfacePreset:${value || 'bone'}`
      }
    },
    { immediate: true }
  )

  watch(
    () => {
      const tab = options.activeTab.value
      if (!tab) {
        return selectedPseudocolorKey.value
      }
      if (tab.viewType === 'MPR' || tab.viewType === '4D') {
        return tab.viewportPseudocolorPresets?.[
          (options.activeViewportKey.value === 'single' || options.activeViewportKey.value === 'volume'
            ? 'mpr-ax'
            : options.activeViewportKey.value) as 'mpr-ax' | 'mpr-cor' | 'mpr-sag'
        ] ?? tab.pseudocolorPreset
      }
      if (tab.viewType === 'CompareStack') {
        const viewportKey =
          options.activeViewportKey.value === COMPARE_STACK_TARGET_PANE_KEY
            ? COMPARE_STACK_TARGET_PANE_KEY
            : COMPARE_STACK_SOURCE_PANE_KEY
        return tab.comparePseudocolorPresets?.[viewportKey] ?? tab.pseudocolorPreset
      }
      return tab.pseudocolorPreset
    },
    (value) => {
      stackToolSelections.value = {
        ...stackToolSelections.value,
        pseudocolor: toPseudocolorSelectionValue(value)
      }
    },
    { immediate: true }
  )

  watch(
    () => selectedPseudocolorKey.value,
    (value) => {
      if (options.activeTab.value) {
        return
      }

      stackToolSelections.value = {
        ...stackToolSelections.value,
        pseudocolor: toPseudocolorSelectionValue(value)
      }
    },
    { immediate: true }
  )

  watch(
    () => options.activeTab.value?.viewType === 'PETCTFusion'
      ? options.activeTab.value.fusionInfo?.petPseudocolorPreset ?? 'petct-rainbow'
      : null,
    (value) => {
      if (!value) {
        return
      }
      stackToolSelections.value = {
        ...stackToolSelections.value,
        fusionPseudocolor: toFusionPseudocolorSelectionValue(value)
      }
    },
    { immediate: true }
  )

  const playbackSubscription = playbackController.subscribe((snapshot) => {
    playbackSnapshot.value = snapshot
  })
  const menuSubscription = menuController.subscribe((snapshot) => {
    menuSnapshot.value = snapshot
  })
  const toolbarActivationSubscription = toolbarActivationController.subscribe((snapshot) => {
    const previousTransientKey = toolbarActivationSnapshot.value.context.transientKey
    toolbarActivationSnapshot.value = snapshot
    if (previousTransientKey != null && snapshot.context.transientKey == null) {
      pendingTransientCallback.value?.()
      pendingTransientCallback.value = null
    }
  })

  onBeforeUnmount(() => {
    stopPlayback()
    playbackSubscription.unsubscribe()
    menuSubscription.unsubscribe()
    toolbarActivationSubscription.unsubscribe()
    playbackController.shutdown()
    menuController.shutdown()
    toolbarActivationController.shutdown()
    pendingTransientCallback.value = null
  })

  return {
    activeTools,
    activeToolbarToolKey,
    activeMprMipConfig,
    activeMprSegmentationConfig,
    activeVolumeRenderConfig,
    activeSurfaceRenderConfig,
    applyTool,
    areToolbarActionsDisabled,
    closeMprSegmentationPanel,
    closeMenus,
    endPlayback,
    handleViewportClick,
    handleViewportWheel,
    isPlaying,
    isPlaybackPaused,
    isMprMipPanelOpen,
    isMprSegmentationPanelOpen,
    isToolSelected,
    isVolumeConfigPanelOpen,
    menuIconSize,
    openMenuKey,
    pausePlayback,
    activateSegmentationSelectionMode,
    selectToolOption,
    setMenuOpen,
    stackToolSelections,
    toolbarIconSize,
    toggleIconSize,
    updateActiveMprMipConfig,
    updateActiveMprSegmentationConfig
  }
}
