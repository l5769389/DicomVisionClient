<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import AppIcon from '../AppIcon.vue'
import { PSEUDOCOLOR_PRESET_OPTIONS } from '../../constants/pseudocolor'
import { useUiLocale } from '../../composables/ui/useUiLocale'
import { DEFAULT_DICOM_DEIDENTIFY_FIELD_KEYS, MAX_CUSTOM_WINDOW_PRESETS, MAX_HANGING_PROTOCOL_RULES, type AppLocale, type DicomDeidentifyFieldKey, type DicomTagDisplayMode, type HangingProtocolRule, type MeasurementLineStyle, type QaWaterMetricPreference, useUiPreferences } from '../../composables/ui/useUiPreferences'
import { useExportSettings } from '../../composables/settings/useExportSettings'
import type { SettingsCopy } from '../../composables/ui/uiMessages'
import { canChooseCustomExportDirectory, chooseCustomExportDirectory, getDefaultExportLocationLabel, openExportLocation } from '../../platform/exporting'
import { viewerRuntime } from '../../platform/runtime'
import ExportSettingsPanel from './settings/ExportSettingsPanel.vue'
import PacsSettingsPanel from './settings/PacsSettingsPanel.vue'
import MprLayoutMenuPanel from '../workspace/shell/MprLayoutMenuPanel.vue'
import {
  DEFAULT_MPR_LAYOUT_KEY,
  MPR_LAYOUT_OPTIONS,
  parseMprLayoutSelectionValue,
  toMprLayoutSelectionValue,
  type MprDefaultLayoutKey
} from '../../composables/workspace/layout/mprLayoutOptions'

defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

type SettingsSection =
  | 'language'
  | 'shortcuts'
  | 'windowPresets'
  | 'hangingProtocol'
  | 'dicomTags'
  | 'qa'
  | 'dicomExport'
  | 'deidentifyExport'
  | 'displayCrosshair'
  | 'displayMprLayout'
  | 'displayScaleBar'
  | 'displayMeasurement'
  | 'displayPseudocolor'
  | 'displayRoi'
  | 'pacs'
type SettingsNavGroupKey = 'general' | 'dataSource' | 'display' | 'dicomTags' | 'export' | 'qa'
type MprViewportKey = 'mpr-ax' | 'mpr-cor' | 'mpr-sag'

interface SettingsNavItem {
  key: SettingsSection
  title: string
  subtitle: string
  icon: string
}

interface SettingsNavGroup {
  key: SettingsNavGroupKey
  title: string
  subtitle: string
  icon: string
  items: SettingsNavItem[]
}

interface ShortcutItem {
  id: string
  action: string
  description: string
  combo: string
}

interface CrosshairViewportConfig {
  key: MprViewportKey
  label: string
  color: string
  thickness: number
}

interface ScaleBarConfig {
  enabled: boolean
  color: string
}

interface RoiStatOption {
  key: string
  label: string
  enabled: boolean
}

interface ThemePreset {
  id: string
  labelZh: string
  labelEn: string
  summaryZh: string
  summaryEn: string
  preview: string
}

interface ColorPreset {
  value: string
  label: string
}

const SETTINGS_SEARCH_SEPARATOR_PATTERN = /[\s_\-./\\|:，。；;、（）()[\]{}]+/g

const SETTINGS_GROUP_SEARCH_ALIASES: Record<SettingsNavGroupKey, string[]> = {
  general: ['常规', '基础', '偏好', 'general', 'basic', 'preference', 'language', 'shortcut'],
  dataSource: ['数据源', 'pacs', 'dicomweb', 'qido', 'orthanc', 'dcm4chee', 'source', 'archive'],
  display: ['显示', '图像', 'display', 'image', 'viewer', 'visual', 'layout', 'window', 'measure'],
  dicomTags: ['dicom tag', 'tag', '标签', '元数据', 'metadata', 'edit'],
  export: ['导出', '保存', '脱敏', '匿名', 'export', 'save', 'deidentify', 'anonymize'],
  qa: ['qa', '质控', '质量', 'mtf', '水模', 'phantom', 'quality']
}

const SETTINGS_SECTION_SEARCH_ALIASES: Record<SettingsSection, string[]> = {
  language: ['语言', '主题', '界面', '中文', '英文', 'language', 'locale', 'theme', 'skin', 'ui', 'zh', 'en'],
  shortcuts: ['快捷键', '键盘', '热键', 'shortcut', 'hotkey', 'keyboard', 'keymap'],
  pacs: ['pacs', 'dicomweb', 'qido', 'orthanc', 'dcm4chee', '数据源', '远程', '归档', 'archive', 'remote'],
  windowPresets: ['窗模板', '窗宽', '窗位', '调窗', 'window', 'preset', 'ww', 'wl', 'windowlevel'],
  hangingProtocol: ['挂片协议', '挂片', '布局规则', 'hanging', 'protocol', 'layout', 'rule'],
  dicomTags: ['dicom tag', 'tag', '标签', '元数据', '修改', '保存位置', 'metadata', 'edit', 'save'],
  qa: ['qa', '质控', '质量', 'mtf', '水模', 'phantom', 'water', 'quality'],
  dicomExport: ['dicom导出', '导出', '保存', '位置', 'dicom', 'export', 'save', 'location'],
  deidentifyExport: ['脱敏', '匿名', '隐私', 'deidentify', 'de-identify', 'anonymize', 'anonymous', 'privacy'],
  displayCrosshair: ['十字线', 'mpr', 'crosshair', 'axis', '定位线'],
  displayMprLayout: ['mpr', '布局', '重建', '宫格', 'layout', 'grid', 'viewport'],
  displayScaleBar: ['比例尺', '标尺', 'scale', 'scalebar', 'ruler'],
  displayMeasurement: ['测量', '标注', '线宽', '颜色', 'measure', 'measurement', 'annotation', 'line', 'style'],
  displayPseudocolor: ['伪彩', '色图', '色带', '默认伪彩', 'pseudocolor', 'colormap', 'color', 'palette', 'bw', 'rainbow', 'pet', 'cardiac'],
  displayRoi: ['roi', '统计', '均值', '面积', '最大值', '最小值', 'stats', 'mean', 'area', 'min', 'max']
}

const DEFAULT_THEME_ID = 'industrial-utility'
const DEFAULT_PSEUDOCOLOR_KEY = 'bw'

const themePresets: ThemePreset[] = [
  {
    id: 'industrial-utility',
    labelZh: '工业实用风（默认）',
    labelEn: 'Industrial Utility (Default)',
    summaryZh: '深色控制台配色，强调边界、禁用态和高频操作识别。',
    summaryEn: 'Dark console styling with clearer control boundaries, disabled states, and action contrast.',
    preview: 'linear-gradient(135deg,#05080b 0%,#111820 42%,#202a32 72%,#6fa9c4 100%)'
  },
  {
    id: 'aurora',
    labelZh: '冷蓝深色',
    labelEn: 'Aurora Dark',
    summaryZh: '深蓝背景配冷蓝高亮，保留原始界面的柔和层次。',
    summaryEn: 'Deep navy surfaces with cool blue highlights and the original softer layering.',
    preview: 'linear-gradient(135deg,#07111d 0%,#0d1b2d 48%,#16324d 78%,#66d0ff 100%)'
  },
  {
    id: 'clinical-light',
    labelZh: '临床浅色',
    labelEn: 'Clinical Light',
    summaryZh: '浅灰白界面配冷蓝强调，适合明亮环境和演示场景。',
    summaryEn: 'Light gray clinical surfaces with restrained blue accents for bright rooms and demos.',
    preview: 'linear-gradient(135deg,#f7fbff 0%,#e8f1f8 42%,#d7e5f2 72%,#6aaed6 100%)'
  }
]

const scaleBarColorPresets: ColorPreset[] = [
  { value: '#f8fafc', label: 'White' },
  { value: '#22c55e', label: 'Green' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#ef4444', label: 'Red' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#a855f7', label: 'Violet' }
]

const measurementColorPresets: ColorPreset[] = [
  { value: '#ffb84d', label: 'Amber' },
  { value: '#55e7ff', label: 'Cyan' },
  { value: '#f8fafc', label: 'White' },
  { value: '#22c55e', label: 'Green' },
  { value: '#ef4444', label: 'Red' },
  { value: '#a855f7', label: 'Violet' }
]

function createDefaultRoiStatOptions(): RoiStatOption[] {
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

function createDefaultCrosshairConfigs(): CrosshairViewportConfig[] {
  return [
    { key: 'mpr-ax', label: 'AX', color: '#ef4444', thickness: 2 },
    { key: 'mpr-cor', label: 'COR', color: '#22c55e', thickness: 2 },
    { key: 'mpr-sag', label: 'SAG', color: '#3b82f6', thickness: 2 }
  ]
}

function createDefaultScaleBarPreference(): ScaleBarConfig {
  return {
    enabled: true,
    color: '#f8fafc'
  }
}

function createDefaultMeasurementStylePreference() {
  return {
    editingColor: '#ffb84d',
    completedColor: '#55e7ff',
    lineWidth: 2.5,
    editingLineStyle: 'dash' as MeasurementLineStyle,
    completedLineStyle: 'solid' as MeasurementLineStyle
  }
}

function createShortcutGroups(copyValue: SettingsCopy, isZh: boolean): Array<{ title: string; items: ShortcutItem[] }> {
  if (isZh) {
    return [
      {
        title: copyValue.navGroup,
        items: [
          { id: 'scroll-slice', action: '活动视口翻页', description: '鼠标滚轮翻动当前活动视口，MPR 中对活动切面生效，不受当前工具影响。', combo: 'Wheel' },
          { id: 'first-slice', action: '翻到首张图像', description: '直接跳到当前序列第一张图像。', combo: 'Home' },
          { id: 'last-slice', action: '翻到末张图像', description: '直接跳到当前序列最后一张图像。', combo: 'End' },
          { id: 'page-prev-slice', action: '键盘上一张', description: '用键盘翻到当前活动视口上一张图像。', combo: 'PageUp' },
          { id: 'page-next-slice', action: '键盘下一张', description: '用键盘翻到当前活动视口下一张图像。', combo: 'PageDown' },
          { id: 'prev-slice', action: '向前一张', description: '向前移动 1 张图像。', combo: 'ArrowLeft' },
          { id: 'next-slice', action: '向后一张', description: '向后移动 1 张图像。', combo: 'ArrowRight' },
          { id: 'prev-ten-slices', action: '向前十张', description: '向前快速移动 10 张图像。', combo: 'Shift + PageUp / ArrowLeft' },
          { id: 'next-ten-slices', action: '向后十张', description: '向后快速移动 10 张图像。', combo: 'Shift + PageDown / ArrowRight' },
          { id: 'window-level', action: '调窗', description: '左键拖拽视口空白区域默认调整窗宽窗位；命中测量、标注或十字线时优先执行对应工具。', combo: 'Left Drag' },
          { id: 'zoom-view', action: '缩放', description: '按下右键并滑动以缩放当前视口。', combo: 'Right Click + Drag' }
        ]
      },
      {
        title: copyValue.measureGroup,
        items: [
          { id: 'line-measure', action: '直线测量', description: '进入线段测量工具。', combo: 'L' },
          { id: 'rect-measure', action: '矩形 ROI', description: '进入矩形 ROI 工具。', combo: 'R' },
          { id: 'copy-measurement', action: '复制测量', description: '复制当前选中的测量项。', combo: 'Ctrl + C' }
        ]
      },
      {
        title: copyValue.workspaceGroup,
        items: [
          { id: 'quick-preview', action: '快速预览', description: '打开当前序列的 Stack 视图。', combo: 'Enter' },
          { id: 'screenshot-png', action: '屏幕截图保存为 PNG', description: '将当前视口截图保存为 PNG。', combo: 'F10' },
          { id: 'screenshot-dicom', action: '屏幕截图保存为 DICOM', description: '将当前视口截图保存为 DICOM。', combo: 'F11' },
          { id: 'close-tab', action: '关闭标签页', description: '关闭当前活动标签页。', combo: 'Ctrl + W' },
          { id: 'toggle-sidebar', action: '收起侧栏', description: '切换左侧面板显示状态。', combo: 'Tab' }
        ]
      }
    ]
  }

  return [
    {
      title: copyValue.navGroup,
      items: [
        { id: 'scroll-slice', action: 'Scroll Active Viewport', description: 'Use the wheel to move the active viewport; in MPR this targets the active plane regardless of the selected tool.', combo: 'Wheel' },
        { id: 'first-slice', action: 'First Image', description: 'Jump to the first image in the current series.', combo: 'Home' },
        { id: 'last-slice', action: 'Last Image', description: 'Jump to the last image in the current series.', combo: 'End' },
        { id: 'page-prev-slice', action: 'Keyboard Previous Image', description: 'Move the active viewport back by one image from the keyboard.', combo: 'PageUp' },
        { id: 'page-next-slice', action: 'Keyboard Next Image', description: 'Move the active viewport forward by one image from the keyboard.', combo: 'PageDown' },
        { id: 'prev-slice', action: 'Previous Image', description: 'Move back by one image.', combo: 'ArrowLeft' },
        { id: 'next-slice', action: 'Next Image', description: 'Move forward by one image.', combo: 'ArrowRight' },
        { id: 'prev-ten-slices', action: 'Previous 10 Images', description: 'Move back by ten images quickly.', combo: 'Shift + PageUp / ArrowLeft' },
        { id: 'next-ten-slices', action: 'Next 10 Images', description: 'Move forward by ten images quickly.', combo: 'Shift + PageDown / ArrowRight' },
        { id: 'window-level', action: 'Window Level', description: 'Left-drag empty viewport space to adjust WW/WL by default; measurements, annotations, and crosshairs keep priority when hit.', combo: 'Left Drag' },
        { id: 'zoom-view', action: 'Zoom View', description: 'Hold the right mouse button and drag to zoom the active viewport.', combo: 'Right Click + Drag' }
      ]
    },
    {
      title: copyValue.measureGroup,
      items: [
        { id: 'line-measure', action: 'Line Measure', description: 'Enter the line measurement tool.', combo: 'L' },
        { id: 'rect-measure', action: 'Rect ROI', description: 'Enter the rectangle ROI tool.', combo: 'R' },
        { id: 'copy-measurement', action: 'Copy Measurement', description: 'Copy the selected measurement item.', combo: 'Ctrl + C' }
      ]
    },
    {
      title: copyValue.workspaceGroup,
      items: [
        { id: 'quick-preview', action: 'Quick Preview', description: 'Open the current series in Stack view.', combo: 'Enter' },
        { id: 'screenshot-png', action: 'Save Screenshot as PNG', description: 'Save the current viewport screenshot as PNG.', combo: 'F10' },
        { id: 'screenshot-dicom', action: 'Save Screenshot as DICOM', description: 'Save the current viewport screenshot as DICOM.', combo: 'F11' },
        { id: 'close-tab', action: 'Close Tab', description: 'Close the active tab.', combo: 'Ctrl + W' },
        { id: 'toggle-sidebar', action: 'Toggle Sidebar', description: 'Show or hide the left panel.', combo: 'Tab' }
      ]
    }
  ]
}

const { locale, settingsCopy } = useUiLocale()
const {
  locale: globalLocale,
  setLocale,
  addCustomWindowPreset,
  addHangingProtocolRule,
  crosshairConfigs,
  dicomDeidentifyPreference,
  dicomTagDisplayMode,
  dicomTagEditSavePreference,
  getWindowPresetLabel,
  hangingProtocolRules,
  measurementStylePreference,
  mprDefaultLayoutKey,
  qaWaterMetrics,
  removeHangingProtocolRule,
  removeCustomWindowPresets,
  roiStatOptions,
  scaleBarPreference,
  selectedPseudocolorKey,
  selectedWindowPresetId,
  setCrosshairConfigs,
  setDicomDeidentifyPreference,
  setDicomTagEditSavePreference,
  setHangingProtocolRules,
  updateHangingProtocolRule,
  setMeasurementStylePreference,
  setMprDefaultLayoutKey,
  setQaWaterMetrics,
  setScaleBarPreference,
  systemWindowPresets,
  setRoiStatOptions,
  themeId,
  windowPresets
} = useUiPreferences()

const activeSection = ref<SettingsSection>('language')
const settingsNavSearch = ref('')
const manuallyExpandedSettingsGroups = ref<SettingsNavGroupKey[]>([])
const manuallyCollapsedSettingsGroups = ref<SettingsNavGroupKey[]>([])
const settingsContentScrollRef = ref<HTMLElement | null>(null)
const customPresetZhName = ref('')
const customPresetEnName = ref('')
const customPresetWw = ref('400')
const customPresetWl = ref('40')
const selectedCustomPresetIds = ref<string[]>([])
const hangingProtocolName = ref('')
const hangingProtocolModality = ref('CT')
const hangingProtocolKeyword = ref('')
const hangingProtocolRows = ref('1')
const hangingProtocolColumns = ref('2')
const tagEditSaveDefaultLocationLabel = ref('')
const tagEditSaveLocationError = ref('')
const isChoosingTagEditSaveLocation = ref(false)
const appVersion = __APP_VERSION__

const isZh = computed(() => locale.value === 'zh-CN')
const copy = settingsCopy
const { resetExportSection } = useExportSettings(copy)
const sections = computed<SettingsNavItem[]>(() => [
  { key: 'language' as const, title: isZh.value ? '语言与主题' : 'Language & Theme', subtitle: isZh.value ? '界面偏好' : 'UI preferences', icon: 'language' },
  { key: 'shortcuts' as const, title: copy.value.shortcuts, subtitle: isZh.value ? '快捷键列表' : 'Keyboard shortcuts', icon: 'keyboard' },
  { key: 'pacs' as const, title: isZh.value ? 'PACS 数据源' : 'PACS Source', subtitle: isZh.value ? 'DICOMweb / DIMSE 配置' : 'DICOMweb / DIMSE profiles', icon: 'pacs' },
  { key: 'displayPseudocolor' as const, title: copy.value.pseudocolor, subtitle: isZh.value ? '默认伪彩' : 'Default pseudocolor', icon: 'pseudocolor' },
  { key: 'displayMprLayout' as const, title: isZh.value ? 'MPR 布局' : 'MPR Layout', subtitle: isZh.value ? '默认视口排布' : 'Default viewport grid', icon: 'layout' },
  { key: 'windowPresets' as const, title: copy.value.windowPresets, subtitle: isZh.value ? '窗宽窗位预设' : 'WW/WL presets', icon: 'contrast' },
  { key: 'displayCrosshair' as const, title: copy.value.crosshairTitle, subtitle: isZh.value ? 'MPR 十字线' : 'MPR crosshair', icon: 'crosshair' },
  { key: 'displayScaleBar' as const, title: copy.value.scaleBarTitle, subtitle: isZh.value ? '比例尺样式' : 'Scale bar style', icon: 'measure' },
  { key: 'displayMeasurement' as const, title: copy.value.measurementStyleTitle, subtitle: isZh.value ? '测量线样式' : 'Measurement style', icon: 'measure-line' },
  { key: 'displayRoi' as const, title: copy.value.roiStatsTitle, subtitle: isZh.value ? 'ROI 统计项' : 'ROI stats', icon: 'measure-rect' },
  { key: 'hangingProtocol' as const, title: isZh.value ? '挂片协议' : 'Hanging Protocol', subtitle: isZh.value ? '自动布局规则' : 'Layout rules', icon: 'layout' },
  { key: 'dicomTags' as const, title: isZh.value ? 'DICOM 标签' : 'DICOM Tags', subtitle: isZh.value ? '显示与修改保存' : 'Display and edit save', icon: 'tag' },
  { key: 'dicomExport' as const, title: isZh.value ? 'DICOM 导出' : 'DICOM Export', subtitle: isZh.value ? '导出位置与内容' : 'Location and overlays', icon: 'export' },
  { key: 'deidentifyExport' as const, title: isZh.value ? '脱敏导出' : 'De-identify Export', subtitle: isZh.value ? '匿名字段规则' : 'Anonymization rules', icon: 'shield' },
  { key: 'qa' as const, title: copy.value.qaSection, subtitle: isZh.value ? '质控指标' : 'Quality metrics', icon: 'qa' }
])
const navigationGroups = computed<SettingsNavGroup[]>(() => {
  const getSection = (key: SettingsSection): SettingsNavItem => (
    sections.value.find((section) => section.key === key) ?? sections.value[0]!
  )

  return [
    {
      key: 'general',
      title: isZh.value ? '常规' : 'General',
      subtitle: isZh.value ? '基础偏好' : 'Basic preferences',
      icon: 'settings',
      items: [getSection('language'), getSection('shortcuts')]
    },
    {
      key: 'dataSource',
      title: isZh.value ? '数据源' : 'Data Sources',
      subtitle: isZh.value ? '本地与 PACS' : 'Local and PACS',
      icon: 'pacs',
      items: [getSection('pacs')]
    },
    {
      key: 'display',
      title: copy.value.display,
      subtitle: isZh.value ? '图像显示' : 'Image display',
      icon: 'crosshair',
      items: [
        getSection('displayPseudocolor'),
        getSection('displayMprLayout'),
        getSection('windowPresets'),
        getSection('displayCrosshair'),
        getSection('displayScaleBar'),
        getSection('displayMeasurement'),
        getSection('displayRoi'),
        getSection('hangingProtocol')
      ]
    },
    {
      key: 'dicomTags',
      title: isZh.value ? 'DICOM 标签' : 'DICOM Tags',
      subtitle: isZh.value ? 'Tag 设置' : 'Tag settings',
      icon: 'tag',
      items: [getSection('dicomTags')]
    },
    {
      key: 'export',
      title: copy.value.exportSection ?? 'Export',
      subtitle: isZh.value ? '保存与匿名化' : 'Save and anonymize',
      icon: 'export',
      items: [getSection('dicomExport'), getSection('deidentifyExport')]
    },
    {
      key: 'qa',
      title: copy.value.qaSection,
      subtitle: copy.value.qaSectionSub,
      icon: 'qa',
      items: [getSection('qa')]
    }
  ]
})
const normalizedSettingsNavSearch = computed(() => normalizeSettingsSearch(settingsNavSearch.value))
const hasSettingsNavSearch = computed(() => normalizedSettingsNavSearch.value.length > 0)
const manuallyExpandedSettingsGroupSet = computed(() => new Set(manuallyExpandedSettingsGroups.value))
const manuallyCollapsedSettingsGroupSet = computed(() => new Set(manuallyCollapsedSettingsGroups.value))
const settingsGroupSearchTerms = computed(() => new Map(
  navigationGroups.value.map((group) => [group.key, normalizeSettingsTerms(getSettingsGroupSearchTerms(group))])
))
const settingsSectionSearchTerms = computed(() => new Map(
  sections.value.map((section) => [section.key, normalizeSettingsTerms(getSettingsSectionSearchTerms(section))])
))
const filteredNavigationGroups = computed<SettingsNavGroup[]>(() => {
  const query = normalizedSettingsNavSearch.value
  if (!query) {
    return navigationGroups.value
  }

  return navigationGroups.value.flatMap((group) => {
    const groupMatches = matchesSettingsSearch(settingsGroupSearchTerms.value.get(group.key) ?? [], query)
    const items = groupMatches
      ? group.items
      : group.items.filter((item) => matchesSettingsSearch(settingsSectionSearchTerms.value.get(item.key) ?? [], query))

    return items.length ? [{ ...group, items }] : []
  })
})
const shortcutGroups = computed(() => createShortcutGroups(copy.value, isZh.value))
const currentSection = computed(() => sections.value.find((item) => item.key === activeSection.value) ?? sections.value[0]!)
const currentSectionTitle = computed(() => currentSection.value?.title ?? copy.value.title)
const currentSectionSubtitle = computed(() => currentSection.value?.subtitle ?? '')
const selectedWindowPreset = computed(() => windowPresets.value.find((preset) => preset.id === selectedWindowPresetId.value) ?? windowPresets.value[0] ?? null)
const displayCustomWindowPresets = computed(() => windowPresets.value.filter((preset) => preset.source === 'custom'))
const selectedCustomPresetIdSet = computed(() => new Set(selectedCustomPresetIds.value))
const hasSelectedCustomPresets = computed(() => selectedCustomPresetIds.value.length > 0)
const areAllCustomPresetsSelected = computed(() => (
  displayCustomWindowPresets.value.length > 0 &&
  displayCustomWindowPresets.value.every((preset) => selectedCustomPresetIdSet.value.has(preset.id))
))
const canAddCustomWindowPreset = computed(() => displayCustomWindowPresets.value.length < MAX_CUSTOM_WINDOW_PRESETS)
const customPresetLimitLabel = computed(() => `${displayCustomWindowPresets.value.length}/${MAX_CUSTOM_WINDOW_PRESETS}`)
const hangingProtocolRuleCountLabel = computed(() => `${hangingProtocolRules.value.length}/${MAX_HANGING_PROTOCOL_RULES}`)
const canAddHangingProtocolRule = computed(() => hangingProtocolRules.value.length < MAX_HANGING_PROTOCOL_RULES)
const hangingProtocolModalityOptions = ['ALL', 'CT', 'MR', 'PT', 'US', 'XA', 'CR', 'DX', 'OT']
const mprDefaultLayoutSelectionValue = computed(() => toMprLayoutSelectionValue(mprDefaultLayoutKey.value))
const mprDefaultLayoutOptions = computed(() =>
  MPR_LAYOUT_OPTIONS.map((option) => ({
    value: toMprLayoutSelectionValue(option.key),
    label: getMprLayoutLabel(option.key),
    icon: 'layout',
    disabled: option.disabled,
    mprLayoutKey: option.key
  }))
)
const enabledQaWaterMetricCount = computed(() => qaWaterMetrics.value.filter((item) => item.enabled).length)
const dicomTagDisplayModeOptions = computed<Array<{ value: DicomTagDisplayMode; title: string; description: string; badge: string }>>(() => [
  {
    value: 'flat',
    title: isZh.value ? '平铺列表' : 'Flat list',
    description: isZh.value ? '按后端返回顺序显示所有 Tag，不做层级缩进。' : 'Show all tags in backend order without hierarchy indentation.',
    badge: 'LIST'
  },
  {
    value: 'tree',
    title: isZh.value ? '树形缩进' : 'Tree indent',
    description: isZh.value ? '对序列等嵌套 Tag 按 depth 缩进，搜索时保留上下文。' : 'Indent nested sequence tags by depth and keep context while searching.',
    badge: 'TREE'
  }
])
const currentDicomTagDisplayModeTitle = computed(() => dicomTagDisplayModeOptions.value.find((option) => option.value === dicomTagDisplayMode.value)?.title ?? '')
const dicomDeidentifyOptions = computed<Array<{ key: DicomDeidentifyFieldKey; title: string; description: string; badge: string; recommended: boolean }>>(() => [
  {
    key: 'patientIdentity',
    title: isZh.value ? '患者身份' : 'Patient identity',
    description: isZh.value ? 'Patient Name、Patient ID、联系方式、地址等直接身份信息。' : 'Patient name, ID, contact details, address, and direct identifiers.',
    badge: 'ID',
    recommended: true
  },
  {
    key: 'patientDemographics',
    title: isZh.value ? '患者人口学' : 'Patient demographics',
    description: isZh.value ? '生日、性别、年龄、身高体重等人口学字段。' : 'Birth date, sex, age, height, weight, and demographic fields.',
    badge: 'BIO',
    recommended: true
  },
  {
    key: 'datesAndTimes',
    title: isZh.value ? '日期与时间' : 'Dates and times',
    description: isZh.value ? '清空 Study / Series / Acquisition 等日期和时间字段。' : 'Clear study, series, acquisition, and content date/time fields.',
    badge: 'TIME',
    recommended: true
  },
  {
    key: 'accessionInstitution',
    title: isZh.value ? '检查号与机构' : 'Accession and institution',
    description: isZh.value ? 'Accession Number、Institution、Department、Study ID 等字段。' : 'Accession number, institution, department, study ID, and related fields.',
    badge: 'ORG',
    recommended: true
  },
  {
    key: 'physiciansOperators',
    title: isZh.value ? '医生与操作者' : 'Physicians and operators',
    description: isZh.value ? 'Referring / Performing Physician、Operators 等人员字段。' : 'Referring physician, performing physician, operators, and related staff fields.',
    badge: 'DOC',
    recommended: true
  },
  {
    key: 'descriptions',
    title: isZh.value ? '描述文本' : 'Description text',
    description: isZh.value ? 'Study Description、Series Description、Protocol Name，可能包含备注但会影响语义可读性。' : 'Study description, series description, and protocol name. Useful when notes may contain identifiers.',
    badge: 'DESC',
    recommended: false
  },
  {
    key: 'deviceInfo',
    title: isZh.value ? '设备信息' : 'Device info',
    description: isZh.value ? 'Station Name、设备序列号、型号、软件版本等设备标识。' : 'Station name, device serial number, model, software versions, and equipment identifiers.',
    badge: 'DEV',
    recommended: false
  },
  {
    key: 'privateTags',
    title: isZh.value ? '私有 Tag' : 'Private tags',
    description: isZh.value ? '删除厂商私有 Tag，避免隐藏字段携带身份信息。' : 'Remove vendor private tags that may hide identifying data.',
    badge: 'PRIV',
    recommended: true
  },
  {
    key: 'uids',
    title: isZh.value ? '重生成 UID' : 'Regenerate UIDs',
    description: isZh.value ? '重生成 Study / Series / SOP Instance UID，并同步 file meta。' : 'Regenerate Study, Series, and SOP Instance UIDs and sync file meta.',
    badge: 'UID',
    recommended: true
  }
])
const selectedDicomDeidentifyFieldKeySet = computed(() => new Set(dicomDeidentifyPreference.value.selectedFieldKeys))
const selectedDicomDeidentifyCount = computed(() => dicomDeidentifyPreference.value.selectedFieldKeys.length)
const canPickTagEditSaveLocation = computed(() => viewerRuntime.platform === 'desktop' && canChooseCustomExportDirectory())
const tagEditSaveCustomLocationLabel = computed(() =>
  dicomTagEditSavePreference.value.desktopDirectory || (isZh.value ? '尚未选择文件夹' : 'No folder selected')
)
const tagEditSaveLocationLabel = computed(() => {
  if (dicomTagEditSavePreference.value.locationMode === 'custom') {
    return tagEditSaveCustomLocationLabel.value
  }

  return tagEditSaveDefaultLocationLabel.value || (isZh.value ? '系统默认下载目录' : 'System default downloads')
})
const tagEditSaveLocationModeLabel = computed(() =>
  dicomTagEditSavePreference.value.locationMode === 'custom'
    ? (isZh.value ? '自定义位置' : 'Custom location')
    : (isZh.value ? '默认位置' : 'Default location')
)
const canOpenTagEditSaveLocation = computed(() => {
  if (viewerRuntime.platform !== 'desktop') {
    return false
  }
  if (dicomTagEditSavePreference.value.locationMode === 'custom') {
    return Boolean(dicomTagEditSavePreference.value.desktopDirectory)
  }
  return Boolean(tagEditSaveDefaultLocationLabel.value)
})

function getThemeSummary(theme: ThemePreset): string {
  return isZh.value ? theme.summaryZh : theme.summaryEn
}

function getThemeLabel(theme: ThemePreset): string {
  return isZh.value ? theme.labelZh : theme.labelEn
}

function normalizeSettingsSearch(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(SETTINGS_SEARCH_SEPARATOR_PATTERN, '')
}

function normalizeSettingsTerms(terms: string[]): string[] {
  return [...new Set(terms.map(normalizeSettingsSearch).filter(Boolean))]
}

function isOrderedFuzzyMatch(text: string, query: string): boolean {
  if (!query) {
    return true
  }

  let queryIndex = 0
  for (const char of text) {
    if (char === query[queryIndex]) {
      queryIndex += 1
      if (queryIndex === query.length) {
        return true
      }
    }
  }
  return false
}

function matchesSettingsSearch(normalizedTerms: string[], normalizedQuery: string): boolean {
  return normalizedTerms.some((term) => term.includes(normalizedQuery) || isOrderedFuzzyMatch(term, normalizedQuery))
}

function getSettingsGroupSearchTerms(group: SettingsNavGroup): string[] {
  return [group.key, group.title, group.subtitle, ...SETTINGS_GROUP_SEARCH_ALIASES[group.key]]
}

function getSettingsSectionSearchTerms(item: SettingsNavItem): string[] {
  return [item.key, item.title, item.subtitle, ...SETTINGS_SECTION_SEARCH_ALIASES[item.key]]
}

function getMprLayoutLabel(key: string): string {
  if (key === 'three-columns') {
    return isZh.value ? '三列均分' : '3 columns'
  }
  if (key === 'right-primary') {
    return isZh.value ? '右侧主视图' : 'Primary right'
  }
  if (key === 'three-rows') {
    return isZh.value ? '三行均分' : '3 rows'
  }
  if (key === 'quad') {
    return isZh.value ? '2 x 2 宫格' : '2 x 2 grid'
  }
  return isZh.value ? 'MPR + 3D' : 'MPR + 3D'
}

function handleSelectMprDefaultLayout(optionValue: string): void {
  const layoutKey = parseMprLayoutSelectionValue(optionValue)
  if (!layoutKey) {
    return
  }

  setMprDefaultLayoutKey(layoutKey as MprDefaultLayoutKey)
}

function isNavigationGroupActive(group: SettingsNavGroup): boolean {
  return group.items.some((item) => item.key === activeSection.value)
}

function isNavigationGroupExpanded(group: SettingsNavGroup): boolean {
  if (hasSettingsNavSearch.value) return true
  if (manuallyCollapsedSettingsGroupSet.value.has(group.key)) return false
  return isNavigationGroupActive(group) || manuallyExpandedSettingsGroupSet.value.has(group.key)
}

function shouldShowNavigationGroupItems(group: SettingsNavGroup): boolean {
  return (group.items.length > 1 && isNavigationGroupExpanded(group)) || (hasSettingsNavSearch.value && group.items.length === 1)
}

function setNavigationGroupExpanded(groupKey: SettingsNavGroupKey, expanded: boolean): void {
  const expandedKeys = new Set(manuallyExpandedSettingsGroups.value)
  const collapsedKeys = new Set(manuallyCollapsedSettingsGroups.value)

  if (expanded) {
    expandedKeys.add(groupKey)
    collapsedKeys.delete(groupKey)
  } else {
    expandedKeys.delete(groupKey)
    collapsedKeys.add(groupKey)
  }

  manuallyExpandedSettingsGroups.value = [...expandedKeys]
  manuallyCollapsedSettingsGroups.value = [...collapsedKeys]
}

function handleNavigationGroupClick(group: SettingsNavGroup): void {
  const firstSectionKey = group.items[0]?.key
  if (!firstSectionKey) return

  if (group.items.length <= 1) {
    activeSection.value = firstSectionKey
    return
  }

  if (hasSettingsNavSearch.value) {
    activeSection.value = firstSectionKey
    setNavigationGroupExpanded(group.key, true)
    return
  }

  if (isNavigationGroupExpanded(group)) {
    setNavigationGroupExpanded(group.key, false)
    return
  }

  activeSection.value = firstSectionKey
  setNavigationGroupExpanded(group.key, true)
}

function isDicomTagDisplayModeActive(value: DicomTagDisplayMode): boolean {
  return dicomTagDisplayMode.value === value
}

function handleSelectDicomTagDisplayMode(value: DicomTagDisplayMode): void {
  dicomTagDisplayMode.value = value
}

function normalizeHangingProtocolGridInput(value: string): number {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? Math.min(6, Math.max(1, parsed)) : 1
}

function getHangingProtocolRuleSummary(rule: HangingProtocolRule): string {
  const conditionParts = [
    rule.modality === 'ALL' ? (isZh.value ? '全部检查模态' : 'Any modality') : (isZh.value ? `检查模态 ${rule.modality}` : rule.modality),
    rule.seriesDescriptionKeyword
      ? (isZh.value ? `序列描述包含 "${rule.seriesDescriptionKeyword}"` : `Description contains "${rule.seriesDescriptionKeyword}"`)
      : (isZh.value ? '不限制序列描述' : 'Any description')
  ]
  return `${conditionParts.join(' / ')} -> ${rule.rows} x ${rule.columns}`
}

function handleAddHangingProtocolRule(): void {
  if (!canAddHangingProtocolRule.value) {
    return
  }

  const rows = normalizeHangingProtocolGridInput(hangingProtocolRows.value)
  const columns = normalizeHangingProtocolGridInput(hangingProtocolColumns.value)
  const fallbackName = `${hangingProtocolModality.value || 'ALL'} ${rows}x${columns}`
  addHangingProtocolRule({
    name: hangingProtocolName.value.trim() || fallbackName,
    enabled: true,
    modality: hangingProtocolModality.value,
    seriesDescriptionKeyword: hangingProtocolKeyword.value.trim(),
    rows,
    columns
  })
  hangingProtocolName.value = ''
  hangingProtocolKeyword.value = ''
}

function toggleHangingProtocolRule(rule: HangingProtocolRule): void {
  updateHangingProtocolRule(rule.id, { enabled: !rule.enabled })
}

function isDicomDeidentifyFieldSelected(key: DicomDeidentifyFieldKey): boolean {
  return selectedDicomDeidentifyFieldKeySet.value.has(key)
}

function toggleDicomDeidentifyField(key: DicomDeidentifyFieldKey): void {
  const nextKeys = new Set(dicomDeidentifyPreference.value.selectedFieldKeys)
  if (nextKeys.has(key)) {
    nextKeys.delete(key)
  } else {
    nextKeys.add(key)
  }
  setDicomDeidentifyPreference({
    ...dicomDeidentifyPreference.value,
    selectedFieldKeys: [...nextKeys]
  })
}

function selectAllDicomDeidentifyFields(): void {
  setDicomDeidentifyPreference({
    ...dicomDeidentifyPreference.value,
    selectedFieldKeys: dicomDeidentifyOptions.value.map((option) => option.key)
  })
}

function restoreDefaultDicomDeidentifyFields(): void {
  setDicomDeidentifyPreference({
    ...dicomDeidentifyPreference.value,
    selectedFieldKeys: [...DEFAULT_DICOM_DEIDENTIFY_FIELD_KEYS]
  })
}

function updateDicomDeidentifyReplacementPrefix(event: Event): void {
  const target = event.target
  if (!(target instanceof HTMLInputElement)) {
    return
  }
  setDicomDeidentifyPreference({
    ...dicomDeidentifyPreference.value,
    replacementPrefix: target.value
  })
}

function handleSelectDefaultTagEditSaveLocation(): void {
  tagEditSaveLocationError.value = ''
  setDicomTagEditSavePreference({
    ...dicomTagEditSavePreference.value,
    locationMode: 'default'
  })
}

function handleSelectCustomTagEditSaveLocation(): void {
  if (!canPickTagEditSaveLocation.value) {
    return
  }

  tagEditSaveLocationError.value = ''
  setDicomTagEditSavePreference({
    ...dicomTagEditSavePreference.value,
    locationMode: 'custom'
  })
}

async function handleChooseTagEditSaveLocation(): Promise<void> {
  if (!canPickTagEditSaveLocation.value) {
    return
  }

  tagEditSaveLocationError.value = ''
  isChoosingTagEditSaveLocation.value = true
  try {
    const selectedDirectory = await chooseCustomExportDirectory()
    if (!selectedDirectory?.desktopDirectory) {
      return
    }

    setDicomTagEditSavePreference({
      locationMode: 'custom',
      desktopDirectory: selectedDirectory.desktopDirectory
    })
  } catch (error) {
    console.error('Failed to choose DICOM tag edit save location.', error)
    tagEditSaveLocationError.value = isZh.value ? '选择保存位置失败。' : 'Failed to choose save location.'
  } finally {
    isChoosingTagEditSaveLocation.value = false
  }
}

async function handleOpenTagEditSaveLocation(): Promise<void> {
  const directoryPath =
    dicomTagEditSavePreference.value.locationMode === 'custom'
      ? dicomTagEditSavePreference.value.desktopDirectory
      : tagEditSaveDefaultLocationLabel.value

  if (!directoryPath) {
    return
  }

  tagEditSaveLocationError.value = ''
  const opened = await openExportLocation({ directoryPath })
  if (!opened) {
    tagEditSaveLocationError.value = isZh.value ? '打开保存位置失败。' : 'Failed to open save location.'
  }
}

function handleClearTagEditSaveLocation(): void {
  tagEditSaveLocationError.value = ''
  setDicomTagEditSavePreference({
    locationMode: 'default',
    desktopDirectory: null
  })
}

function getShortcutComboParts(combo: string): string[] {
  return combo.split(' + ').map((item) => item.trim()).filter(Boolean)
}

function getShortcutComboLabel(part: string): string {
  if (part === 'ArrowLeft') {
    return '←'
  }
  if (part === 'ArrowRight') {
    return '→'
  }
  return part
}

function getCrosshairPreviewAxes(viewportKey: MprViewportKey): { vertical: CrosshairViewportConfig; horizontal: CrosshairViewportConfig } {
  const axial = crosshairConfigs.value.find((item) => item.key === 'mpr-ax') ?? crosshairConfigs.value[0]
  const coronal = crosshairConfigs.value.find((item) => item.key === 'mpr-cor') ?? crosshairConfigs.value[1]
  const sagittal = crosshairConfigs.value.find((item) => item.key === 'mpr-sag') ?? crosshairConfigs.value[2]

  if (viewportKey === 'mpr-ax') {
    return { vertical: sagittal, horizontal: coronal }
  }
  if (viewportKey === 'mpr-cor') {
    return { vertical: sagittal, horizontal: axial }
  }
  return { vertical: coronal, horizontal: axial }
}

function getQaWaterMetricLabel(metric: QaWaterMetricPreference): string {
  if (metric.key === 'accuracy') {
    return copy.value.qaWaterAccuracy
  }
  if (metric.key === 'uniformity') {
    return copy.value.qaWaterUniformity
  }
  return copy.value.qaWaterNoise
}

function getQaWaterMetricDescription(metric: QaWaterMetricPreference): string {
  if (metric.key === 'accuracy') {
    return copy.value.qaWaterAccuracyDesc
  }
  if (metric.key === 'uniformity') {
    return copy.value.qaWaterUniformityDesc
  }
  return copy.value.qaWaterNoiseDesc
}

function resetLanguageSection(): void {
  setLocale('zh-CN')
  themeId.value = DEFAULT_THEME_ID
}

function resetWindowPresetSection(): void {
  const customPresetIds = displayCustomWindowPresets.value.map((preset) => preset.id)
  if (customPresetIds.length) {
    removeCustomWindowPresets(customPresetIds)
  }
  selectedWindowPresetId.value = systemWindowPresets[0]?.id ?? 'lung'
  selectedCustomPresetIds.value = []
  customPresetZhName.value = ''
  customPresetEnName.value = ''
  customPresetWw.value = '400'
  customPresetWl.value = '40'
}

function resetDisplaySubSection(section: SettingsSection): void {
  if (section === 'displayPseudocolor') {
    selectedPseudocolorKey.value = DEFAULT_PSEUDOCOLOR_KEY
    return
  }
  if (section === 'displayRoi') {
    setRoiStatOptions(createDefaultRoiStatOptions())
    return
  }
  if (section === 'displayCrosshair') {
    setCrosshairConfigs(createDefaultCrosshairConfigs())
    return
  }
  if (section === 'displayMprLayout') {
    setMprDefaultLayoutKey(DEFAULT_MPR_LAYOUT_KEY)
    return
  }
  if (section === 'displayScaleBar') {
    setScaleBarPreference(createDefaultScaleBarPreference())
    return
  }
  if (section === 'displayMeasurement') {
    setMeasurementStylePreference(createDefaultMeasurementStylePreference())
  }
}

function resetDicomTagSection(): void {
  dicomTagDisplayMode.value = 'tree'
  setDicomTagEditSavePreference({
    locationMode: 'default',
    desktopDirectory: null
  })
}

function resetDeidentifyExportSection(): void {
  setDicomDeidentifyPreference({
    selectedFieldKeys: [...DEFAULT_DICOM_DEIDENTIFY_FIELD_KEYS],
    replacementPrefix: 'ANON'
  })
}

function resetHangingProtocolSection(): void {
  setHangingProtocolRules([])
  hangingProtocolName.value = ''
  hangingProtocolModality.value = 'CT'
  hangingProtocolKeyword.value = ''
  hangingProtocolRows.value = '1'
  hangingProtocolColumns.value = '2'
}

function resetQaSection(): void {
  setQaWaterMetrics(createDefaultQaWaterMetrics())
}

function resetCurrentSection(): void {
  if (activeSection.value === 'language') {
    resetLanguageSection()
    return
  }
  if (activeSection.value === 'windowPresets') {
    resetWindowPresetSection()
    return
  }
  if (activeSection.value === 'dicomExport') {
    resetExportSection()
    return
  }
  if (activeSection.value === 'deidentifyExport') {
    resetDeidentifyExportSection()
    return
  }
  if (activeSection.value === 'qa') {
    resetQaSection()
    return
  }
  if (activeSection.value === 'dicomTags') {
    resetDicomTagSection()
    return
  }
  if (activeSection.value === 'hangingProtocol') {
    resetHangingProtocolSection()
    return
  }
  if (
    activeSection.value === 'displayCrosshair' ||
    activeSection.value === 'displayMprLayout' ||
    activeSection.value === 'displayScaleBar' ||
    activeSection.value === 'displayMeasurement' ||
    activeSection.value === 'displayPseudocolor' ||
    activeSection.value === 'displayRoi'
  ) {
    resetDisplaySubSection(activeSection.value)
  }
}

function toggleScaleBarEnabled(): void {
  const scrollContainer = settingsContentScrollRef.value
  const currentScrollTop = scrollContainer?.scrollTop ?? 0
  scaleBarPreference.value.enabled = !scaleBarPreference.value.enabled

  requestAnimationFrame(() => {
    if (scrollContainer) {
      scrollContainer.scrollTop = currentScrollTop
    }
  })
}

function handleLocaleChange(nextLocale: AppLocale): void {
  setLocale(nextLocale)
}

function handleAddCustomWindowPreset(): void {
  if (!canAddCustomWindowPreset.value) {
    return
  }

  const nextId = addCustomWindowPreset({
    zhName: customPresetZhName.value,
    enName: customPresetEnName.value,
    ww: Number.parseFloat(customPresetWw.value),
    wl: Number.parseFloat(customPresetWl.value)
  })

  selectedWindowPresetId.value = nextId
  customPresetZhName.value = ''
  customPresetEnName.value = ''
  customPresetWw.value = '400'
  customPresetWl.value = '40'
}

function syncSelectedCustomPresetIds(): void {
  const availableIds = new Set(displayCustomWindowPresets.value.map((preset) => preset.id))
  selectedCustomPresetIds.value = selectedCustomPresetIds.value.filter((id) => availableIds.has(id))
}

function toggleCustomPresetSelection(id: string): void {
  if (selectedCustomPresetIdSet.value.has(id)) {
    selectedCustomPresetIds.value = selectedCustomPresetIds.value.filter((item) => item !== id)
    return
  }

  selectedCustomPresetIds.value = [...selectedCustomPresetIds.value, id]
}

function toggleAllCustomPresetSelection(): void {
  if (areAllCustomPresetsSelected.value) {
    selectedCustomPresetIds.value = []
    return
  }

  selectedCustomPresetIds.value = displayCustomWindowPresets.value.map((preset) => preset.id)
}

function handleRemoveSelectedCustomWindowPresets(): void {
  syncSelectedCustomPresetIds()
  if (!selectedCustomPresetIds.value.length) {
    return
  }

  removeCustomWindowPresets(selectedCustomPresetIds.value)
  selectedCustomPresetIds.value = []
}

watch(displayCustomWindowPresets, () => {
  syncSelectedCustomPresetIds()
})

onMounted(async () => {
  try {
    tagEditSaveDefaultLocationLabel.value = await getDefaultExportLocationLabel()
  } catch (error) {
    console.error('Failed to resolve DICOM tag edit default save location.', error)
    tagEditSaveDefaultLocationLabel.value = ''
  }
})

</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="settings-dialog-backdrop fixed inset-0 z-[1300] flex items-center justify-center bg-[radial-gradient(circle_at_top,color-mix(in_srgb,var(--theme-accent)_16%,transparent),transparent_38%),rgba(3,8,15,0.42)] px-4 py-6 backdrop-blur-[8px]"
      @click.self="emit('close')"
    >
      <div class="settings-dialog-shell theme-shell-panel relative flex h-[min(92vh,860px)] w-full max-w-[1320px] flex-col overflow-hidden rounded-[34px] border shadow-[0_36px_96px_rgba(0,0,0,0.5)]">
        <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,color-mix(in_srgb,var(--theme-accent)_14%,transparent),transparent_26%),radial-gradient(circle_at_bottom_left,color-mix(in_srgb,var(--theme-accent-warm)_12%,transparent),transparent_22%)]"></div>
        <div class="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[color:color-mix(in_srgb,var(--theme-text-primary)_40%,transparent)] to-transparent"></div>

        <div class="settings-dialog-header relative flex items-center justify-between gap-4 border-b border-[var(--theme-border-soft)] px-6 py-3.5">
          <div class="min-w-0">
            <div class="flex items-center gap-3">
              <div class="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--theme-border-strong)] bg-[color:color-mix(in_srgb,var(--theme-accent)_10%,transparent)] text-[var(--theme-text-primary)]">
                <AppIcon name="settings" :size="18" />
              </div>
              <div class="min-w-0">
                <div class="text-lg font-semibold tracking-[0.04em] text-[var(--theme-text-primary)]">{{ copy.title }}</div>
                <div class="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-[var(--theme-text-muted)]">
                  <span>{{ copy.productName }}</span>
                  <span class="h-1 w-1 rounded-full bg-[var(--theme-border-strong)]"></span>
                  <span>{{ copy.versionLabel }} {{ copy.versionBadge(appVersion) }}</span>
                </div>
              </div>
            </div>
          </div>
          <button type="button" class="theme-button-secondary flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition hover:brightness-110" :aria-label="copy.title" @click="emit('close')">
            <AppIcon name="close" :size="16" />
          </button>
        </div>

        <div class="relative grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[340px_minmax(0,1fr)]">
          <aside class="theme-shell-panel-soft settings-nav-scroll min-h-0 overflow-auto border-b px-5 py-5 lg:border-b-0 lg:border-r">
            <label class="settings-nav-search mb-4 flex min-h-12 items-center gap-2 rounded-2xl border px-3">
              <AppIcon name="search" :size="16" />
              <input
                v-model="settingsNavSearch"
                type="text"
                class="settings-nav-search__input min-w-0 flex-1 text-sm font-medium text-[var(--theme-text-primary)] outline-none placeholder:text-[var(--theme-text-muted)]"
                :placeholder="isZh ? '搜索设置 / Search' : 'Search settings'"
              />
              <button
                v-if="settingsNavSearch"
                type="button"
                class="grid h-7 w-7 shrink-0 place-items-center rounded-xl border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] text-[var(--theme-text-secondary)] transition hover:border-[var(--theme-border-strong)] hover:text-[var(--theme-text-primary)]"
                :aria-label="isZh ? '清空搜索' : 'Clear search'"
                @click="settingsNavSearch = ''"
              >
                <AppIcon name="close" :size="13" />
              </button>
            </label>

            <div class="space-y-4">
              <div
                v-if="filteredNavigationGroups.length === 0"
                class="rounded-2xl border border-dashed border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] px-4 py-6 text-center"
              >
                <AppIcon name="search" :size="20" class="mx-auto text-[var(--theme-text-muted)]" />
                <div class="mt-2 text-sm font-semibold text-[var(--theme-text-primary)]">{{ isZh ? '没有匹配的设置' : 'No settings found' }}</div>
                <div class="mt-1 text-xs leading-5 text-[var(--theme-text-muted)]">{{ isZh ? '试试中文或英文关键词。' : 'Try a Chinese or English keyword.' }}</div>
              </div>

              <template v-else>
                <div v-for="group in filteredNavigationGroups" :key="group.key" class="settings-nav-group">
                  <div
                    class="settings-nav-item group flex w-full cursor-pointer items-start gap-3 rounded-[22px] border px-4 py-4 text-left transition duration-150"
                    :class="isNavigationGroupActive(group) ? 'settings-nav-item--active' : 'settings-nav-item--inactive'"
                    role="button"
                    tabindex="0"
                    @click="handleNavigationGroupClick(group)"
                    @keydown.enter.prevent="handleNavigationGroupClick(group)"
                    @keydown.space.prevent="handleNavigationGroupClick(group)"
                  >
                    <div class="settings-nav-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition" :class="isNavigationGroupActive(group) ? 'border-[var(--theme-border-strong)] bg-[color:color-mix(in_srgb,var(--theme-accent)_12%,transparent)] text-[var(--theme-text-primary)]' : 'border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] text-[var(--theme-text-secondary)] group-hover:text-[var(--theme-text-primary)]'">
                      <AppIcon :name="group.icon" :size="18" />
                    </div>
                    <div class="min-w-0">
                      <div class="text-sm font-semibold text-[var(--theme-text-primary)]">{{ group.title }}</div>
                      <div class="mt-1 text-xs leading-5" :class="isNavigationGroupActive(group) ? 'text-[var(--theme-text-secondary)]' : 'text-[var(--theme-text-muted)]'">{{ group.subtitle }}</div>
                    </div>
                    <span
                      v-if="group.items.length > 1"
                      class="settings-nav-chevron ml-auto mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-xl border transition"
                      :class="isNavigationGroupExpanded(group) ? 'settings-nav-chevron--open' : 'settings-nav-chevron--closed'"
                      aria-hidden="true"
                    >
                      <AppIcon name="chevron-down" :size="16" />
                    </span>
                  </div>

                  <div v-if="shouldShowNavigationGroupItems(group)" class="settings-nav-sublist mt-2 grid gap-1.5 pl-4">
                    <button
                      v-for="section in group.items"
                      :key="section.key"
                      type="button"
                      class="settings-nav-subitem flex w-full items-center gap-3 rounded-2xl border px-3 py-2 text-left transition duration-150"
                      :class="section.key === activeSection ? 'settings-nav-subitem--active' : 'settings-nav-subitem--inactive'"
                      @click="activeSection = section.key"
                    >
                      <span class="settings-nav-subitem__dot h-2 w-2 shrink-0 rounded-full"></span>
                      <span class="block min-w-0 truncate text-xs font-semibold text-[var(--theme-text-primary)]">{{ section.title }}</span>
                    </button>
                  </div>
                </div>
              </template>
            </div>
          </aside>

          <section class="flex min-h-0 flex-col overflow-hidden px-6 py-5 lg:px-7">
            <div class="mb-5 flex shrink-0 items-end justify-between gap-4">
              <div class="min-w-0">
                <div class="text-2xl font-semibold tracking-[0.04em] text-[var(--theme-text-primary)]">{{ currentSectionTitle }}</div>
                <div v-if="currentSectionSubtitle" class="mt-1 text-sm text-[var(--theme-text-muted)]">{{ currentSectionSubtitle }}</div>
              </div>
              <div class="hidden items-center gap-2 md:flex">
                <button type="button" class="theme-button-secondary rounded-2xl border px-4 py-2 text-sm font-medium transition hover:brightness-110" @click="resetCurrentSection">{{ copy.reset }}</button>
                <button type="button" class="theme-button-primary rounded-2xl border px-4 py-2 text-sm font-semibold transition hover:brightness-110">{{ copy.applyDraft }}</button>
              </div>
            </div>

            <div ref="settingsContentScrollRef" class="settings-content-scroll min-h-0 flex-1 overflow-auto pr-2">
              <div class="space-y-5 pb-12">
                <template v-if="activeSection === 'language'">
                  <div class="grid gap-5 xl:grid-cols-[minmax(280px,0.72fr)_minmax(0,1.28fr)]">
                    <div class="theme-card-soft rounded-[28px] p-5">
                      <div class="mb-4 flex items-center gap-2 text-[var(--theme-text-primary)]">
                        <AppIcon name="language" :size="18" />
                        <span class="text-lg font-semibold">{{ copy.languageTitle }}</span>
                      </div>
                      <div class="grid gap-3">
                        <button
                          type="button"
                          class="rounded-[22px] border px-4 py-4 text-left transition duration-150"
                          :class="globalLocale === 'zh-CN' ? 'border-[var(--theme-border-strong)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--theme-accent)_18%,transparent),color-mix(in_srgb,var(--theme-accent-warm)_10%,transparent))]' : 'border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] hover:bg-[var(--theme-surface-card-soft)]'"
                          @click="handleLocaleChange('zh-CN')"
                        >
                          <div class="flex items-center justify-between gap-3">
                            <div class="text-sm font-semibold text-[var(--theme-text-primary)]">{{ copy.zhCn }}</div>
                            <span class="rounded-full border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card-soft)] px-2.5 py-1 text-[10px] font-semibold text-[var(--theme-text-secondary)]">zh-CN</span>
                          </div>
                        </button>
                        <button
                          type="button"
                          class="rounded-[22px] border px-4 py-4 text-left transition duration-150"
                          :class="globalLocale === 'en-US' ? 'border-[var(--theme-border-strong)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--theme-accent)_18%,transparent),color-mix(in_srgb,var(--theme-accent-warm)_10%,transparent))]' : 'border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] hover:bg-[var(--theme-surface-card-soft)]'"
                          @click="handleLocaleChange('en-US')"
                        >
                          <div class="flex items-center justify-between gap-3">
                            <div class="text-sm font-semibold text-[var(--theme-text-primary)]">{{ copy.enUs }}</div>
                            <span class="rounded-full border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card-soft)] px-2.5 py-1 text-[10px] font-semibold text-[var(--theme-text-secondary)]">en-US</span>
                          </div>
                        </button>
                      </div>
                    </div>

                    <div class="theme-card-soft rounded-[28px] p-5">
                      <div class="mb-4 flex items-center gap-2 text-[var(--theme-text-primary)]">
                        <AppIcon name="palette" :size="18" />
                        <span class="text-lg font-semibold">{{ copy.themePresetTitle }}</span>
                      </div>
                      <div class="grid gap-3">
                        <button
                          v-for="theme in themePresets"
                          :key="theme.id"
                          type="button"
                          class="flex items-center gap-4 rounded-[22px] border px-4 py-4 text-left transition duration-150"
                          :class="themeId === theme.id ? 'border-[var(--theme-border-strong)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--theme-accent)_18%,transparent),color-mix(in_srgb,var(--theme-accent-warm)_10%,transparent))]' : 'border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] hover:bg-[var(--theme-surface-card-soft)]'"
                          @click="themeId = theme.id"
                        >
                          <span class="h-12 w-20 shrink-0 rounded-2xl border border-[var(--theme-border-soft)]" :style="{ background: theme.preview }"></span>
                          <div class="min-w-0">
                            <div class="text-sm font-semibold text-[var(--theme-text-primary)]">{{ getThemeLabel(theme) }}</div>
                            <div class="mt-1 text-xs text-[var(--theme-text-secondary)]">{{ getThemeSummary(theme) }}</div>
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>
                </template>

                <template v-else-if="activeSection === 'shortcuts'">
                  <div class="theme-card-soft rounded-[28px] p-5">
                    <div class="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <div class="text-lg font-semibold text-[var(--theme-text-primary)]">{{ copy.shortcutsTitle }}</div>
                      </div>
                    </div>

                    <div class="space-y-4">
                      <div v-for="group in shortcutGroups" :key="group.title" class="theme-card-soft rounded-[24px] p-4">
                        <div class="mb-3 flex items-center justify-between gap-2">
                          <div class="text-sm font-semibold text-[var(--theme-text-primary)]">{{ group.title }}</div>
                          <span class="rounded-full border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--theme-text-secondary)]">{{ group.items.length }} {{ copy.items }}</span>
                        </div>
                        <div class="space-y-2">
                            <div v-for="item in group.items" :key="item.id" class="grid gap-3 rounded-[20px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                            <div class="min-w-0">
                                <div class="text-sm font-medium text-[var(--theme-text-primary)]">{{ item.action }}</div>
                                <div class="mt-1 text-xs leading-5 text-[var(--theme-text-secondary)]">{{ item.description }}</div>
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="flex items-center gap-1.5 rounded-2xl border border-[var(--theme-border-soft)] bg-[var(--theme-surface-panel-strong)] px-3 py-2 text-[12px] font-semibold tracking-[0.06em] text-[var(--theme-text-primary)]">
                                <template v-for="(part, index) in getShortcutComboParts(item.combo)" :key="`${item.id}-${part}-${index}`">
                                  <span class="rounded-lg border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] px-2 py-1 font-mono leading-none">{{ getShortcutComboLabel(part) }}</span>
                                  <span v-if="index < getShortcutComboParts(item.combo).length - 1" class="text-[var(--theme-text-muted)]">+</span>
                                </template>
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </template>

                <template v-else-if="activeSection === 'pacs'">
                  <PacsSettingsPanel />
                </template>

                <template v-else-if="activeSection === 'windowPresets'">
                  <div class="theme-card-soft rounded-[28px] p-5">
                    <div class="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <div class="text-lg font-semibold text-[var(--theme-text-primary)]">{{ copy.windowPresetsTitle }}</div>
                        <div class="mt-1 text-sm text-[var(--theme-text-secondary)]">{{ copy.windowPresetsDesc }}</div>
                      </div>
                      <span class="rounded-full border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--theme-text-secondary)]">{{ selectedWindowPreset?.source === 'custom' ? copy.custom : copy.builtIn }}</span>
                    </div>

                    <div class="grid gap-5 xl:grid-cols-[minmax(0,1.02fr)_minmax(340px,0.98fr)]">
                      <div class="space-y-5">
                        <div class="theme-card-soft rounded-[24px] p-4">
                          <div class="mb-3 text-sm font-semibold text-[var(--theme-text-primary)]">{{ copy.systemPresets }}</div>
                          <div class="grid gap-3 md:grid-cols-2">
                            <button
                              v-for="preset in systemWindowPresets"
                              :key="preset.id"
                              type="button"
                              class="rounded-[22px] border p-4 text-left transition duration-150"
                              :class="selectedWindowPresetId === preset.id ? 'border-[var(--theme-border-strong)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--theme-accent)_18%,transparent),color-mix(in_srgb,var(--theme-accent-warm)_10%,transparent))]' : 'border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] hover:border-[var(--theme-border-strong)] hover:bg-[var(--theme-surface-card-soft)]'"
                              @click="selectedWindowPresetId = preset.id"
                            >
                              <div class="min-w-0">
                                <div class="text-sm font-semibold text-[var(--theme-text-primary)]">{{ getWindowPresetLabel(preset) }}</div>
                                <div class="mt-1 text-xs text-[var(--theme-text-secondary)]">WW {{ preset.ww }} / WL {{ preset.wl }}</div>
                              </div>
                            </button>
                          </div>
                        </div>

                        <div class="theme-card-soft rounded-[24px] p-4">
                          <div class="mb-3 flex items-center justify-between gap-3">
                            <div class="text-sm font-semibold text-[var(--theme-text-primary)]">{{ copy.customPresets }}</div>
                            <div class="flex items-center gap-2">
                              <span class="rounded-full border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--theme-text-secondary)]">{{ customPresetLimitLabel }}</span>
                              <button type="button" class="theme-button-secondary rounded-2xl px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50" :disabled="!displayCustomWindowPresets.length" @click="toggleAllCustomPresetSelection">{{ areAllCustomPresetsSelected ? (isZh ? '取消全选' : 'Clear') : (isZh ? '全选' : 'Select All') }}</button>
                              <button type="button" class="theme-button-secondary rounded-2xl px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50" :disabled="!hasSelectedCustomPresets" @click="handleRemoveSelectedCustomWindowPresets">{{ copy.removeTemplate }}</button>
                            </div>
                          </div>
                          <div v-if="displayCustomWindowPresets.length" class="space-y-2">
                            <div
                              v-for="preset in displayCustomWindowPresets"
                              :key="preset.id"
                              class="flex w-full items-center gap-3 rounded-[18px] border px-3 py-3 text-left transition duration-150"
                              :class="[
                                selectedWindowPresetId === preset.id ? 'border-[var(--theme-border-strong)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--theme-accent)_18%,transparent),color-mix(in_srgb,var(--theme-accent-warm)_10%,transparent))]' : 'border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] hover:border-[var(--theme-border-strong)] hover:bg-[var(--theme-surface-card-soft)]',
                                selectedCustomPresetIdSet.has(preset.id) ? 'ring-1 ring-[color:color-mix(in_srgb,var(--theme-accent)_55%,transparent)]' : ''
                              ]"
                            >
                              <button
                                type="button"
                                class="grid h-8 w-8 shrink-0 place-items-center rounded-xl border transition"
                                :class="selectedCustomPresetIdSet.has(preset.id) ? 'border-[var(--theme-accent)] bg-[color:color-mix(in_srgb,var(--theme-accent)_18%,transparent)] text-[var(--theme-accent)]' : 'border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] text-transparent hover:border-[var(--theme-border-strong)]'"
                                :aria-pressed="selectedCustomPresetIdSet.has(preset.id)"
                                @click.stop="toggleCustomPresetSelection(preset.id)"
                              >
                                <AppIcon name="check" :size="16" />
                              </button>
                              <button type="button" class="min-w-0 flex-1 text-left" @click="selectedWindowPresetId = preset.id">
                                <div class="truncate text-sm font-semibold text-[var(--theme-text-primary)]">{{ getWindowPresetLabel(preset) }}</div>
                                <div class="mt-1 text-xs text-[var(--theme-text-secondary)]">WW {{ preset.ww }} / WL {{ preset.wl }}</div>
                              </button>
                            </div>
                          </div>
                          <div v-else class="rounded-[20px] border border-dashed border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] px-4 py-4 text-xs leading-6 text-[var(--theme-text-secondary)]">
                            <div class="font-medium text-[var(--theme-text-primary)]">{{ copy.emptyCustom }}</div>
                            <div class="mt-1">{{ copy.emptyCustomDesc }}</div>
                          </div>
                        </div>
                      </div>

                      <div class="theme-card-soft rounded-[24px] p-4">
                        <div class="mb-3 flex items-center justify-between gap-3">
                          <div class="text-sm font-semibold text-[var(--theme-text-primary)]">{{ copy.addCustom }}</div>
                          <span class="rounded-full border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--theme-text-secondary)]">{{ customPresetLimitLabel }}</span>
                        </div>
                        <div class="grid gap-3 md:grid-cols-2">
                          <label class="block">
                            <span class="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--theme-text-muted)]">{{ copy.zhName }}</span>
                            <input v-model="customPresetZhName" type="text" class="w-full rounded-2xl border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] px-4 py-3 text-sm text-[var(--theme-text-primary)] outline-none transition placeholder:text-[var(--theme-text-muted)] focus:border-[var(--theme-border-strong)] disabled:cursor-not-allowed disabled:opacity-50" :placeholder="copy.zhName" :disabled="!canAddCustomWindowPreset" />
                          </label>
                          <label class="block">
                            <span class="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--theme-text-muted)]">{{ copy.enName }}</span>
                            <input v-model="customPresetEnName" type="text" class="w-full rounded-2xl border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] px-4 py-3 text-sm text-[var(--theme-text-primary)] outline-none transition placeholder:text-[var(--theme-text-muted)] focus:border-[var(--theme-border-strong)] disabled:cursor-not-allowed disabled:opacity-50" :placeholder="copy.enName" :disabled="!canAddCustomWindowPreset" />
                          </label>
                          <label class="block">
                            <span class="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--theme-text-muted)]">{{ copy.ww }}</span>
                            <input v-model="customPresetWw" type="number" class="w-full rounded-2xl border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] px-4 py-3 text-sm text-[var(--theme-text-primary)] outline-none transition placeholder:text-[var(--theme-text-muted)] focus:border-[var(--theme-border-strong)] disabled:cursor-not-allowed disabled:opacity-50" :disabled="!canAddCustomWindowPreset" />
                          </label>
                          <label class="block">
                            <span class="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--theme-text-muted)]">{{ copy.wl }}</span>
                            <input v-model="customPresetWl" type="number" class="w-full rounded-2xl border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] px-4 py-3 text-sm text-[var(--theme-text-primary)] outline-none transition placeholder:text-[var(--theme-text-muted)] focus:border-[var(--theme-border-strong)] disabled:cursor-not-allowed disabled:opacity-50" :disabled="!canAddCustomWindowPreset" />
                          </label>
                        </div>

                        <div v-if="!canAddCustomWindowPreset" class="mt-3 rounded-2xl border border-[color:color-mix(in_srgb,var(--theme-accent-warm)_30%,var(--theme-border-soft))] bg-[color:color-mix(in_srgb,var(--theme-accent-warm)_10%,transparent)] px-4 py-3 text-xs leading-5 text-[var(--theme-text-secondary)]">
                          {{ isZh ? `最多只能保留 ${MAX_CUSTOM_WINDOW_PRESETS} 个自定义模板。` : `Up to ${MAX_CUSTOM_WINDOW_PRESETS} custom templates can be saved.` }}
                        </div>
                        <div class="mt-4 flex flex-wrap gap-2">
                          <button type="button" class="theme-button-primary rounded-2xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50" :disabled="!canAddCustomWindowPreset" @click="handleAddCustomWindowPreset">{{ copy.addTemplate }}</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </template>

                <template v-else-if="activeSection === 'hangingProtocol'">
                  <div class="space-y-5">
                    <section class="theme-card-soft rounded-[28px] p-5">
                      <div class="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div class="min-w-0">
                          <div class="flex items-center gap-2 text-[var(--theme-text-primary)]">
                            <span class="grid h-10 w-10 place-items-center rounded-2xl border border-[color:color-mix(in_srgb,var(--theme-accent)_28%,var(--theme-border-soft))] bg-[color:color-mix(in_srgb,var(--theme-accent)_13%,transparent)] text-[var(--theme-accent)]">
                              <AppIcon name="layout" :size="20" />
                            </span>
                            <div>
                              <div class="flex flex-wrap items-center gap-2">
                                <span class="text-lg font-semibold">{{ isZh ? '挂片协议' : 'Hanging Protocol' }}</span>
                                <span v-if="isZh" class="rounded-full border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--theme-text-secondary)]">布局规则</span>
                              </div>
                              <div class="mt-1 text-sm leading-6 text-[var(--theme-text-secondary)]">
                                {{ isZh ? '按 Modality、Series Description 等序列信息匹配布局规则，用于一键或自动套用常用诊断布局。' : 'Persist layout rules matched by series metadata for one-click or automatic diagnostic layouts.' }}
                              </div>
                            </div>
                          </div>
                        </div>
                        <span class="shrink-0 rounded-full border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--theme-text-secondary)]">
                          {{ hangingProtocolRuleCountLabel }}
                        </span>
                      </div>

                      <div class="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                        <div class="rounded-[24px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] p-4">
                          <div class="mb-4">
                            <div class="text-sm font-semibold text-[var(--theme-text-primary)]">{{ isZh ? '新增挂片规则' : 'Add Hanging Protocol Rule' }}</div>
                            <div class="mt-1 text-xs leading-6 text-[var(--theme-text-secondary)]">
                              {{ isZh ? '按检查模态和序列描述关键字匹配，命中后自动使用指定行列布局。' : 'Match by modality and series description keyword, then use the selected grid.' }}
                            </div>
                          </div>

                          <div class="grid gap-3">
                            <label class="block">
                              <span class="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--theme-text-muted)]">{{ isZh ? '规则名称' : 'Rule name' }}</span>
                              <input v-model="hangingProtocolName" maxlength="48" class="w-full rounded-2xl border border-[var(--theme-border-soft)] bg-[var(--theme-surface-panel)] px-4 py-3 text-sm text-[var(--theme-text-primary)] outline-none transition placeholder:text-[var(--theme-text-muted)] focus:border-[var(--theme-border-strong)]" :placeholder="isZh ? '例如：胸部 CT 双窗布局' : 'e.g. Chest CT dual viewport'" />
                            </label>

                            <div class="grid gap-3 md:grid-cols-2">
                              <label class="block">
                                <span class="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--theme-text-muted)]">{{ isZh ? '检查模态 Modality' : 'Modality' }}</span>
                                <select v-model="hangingProtocolModality" class="w-full rounded-2xl border border-[var(--theme-border-soft)] bg-[var(--theme-surface-panel)] px-4 py-3 text-sm text-[var(--theme-text-primary)] outline-none transition focus:border-[var(--theme-border-strong)]">
                                  <option v-for="modality in hangingProtocolModalityOptions" :key="modality" :value="modality">
                                    {{ modality === 'ALL' ? (isZh ? '全部' : 'All') : modality }}
                                  </option>
                                </select>
                              </label>
                              <label class="block">
                                <span class="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--theme-text-muted)]">{{ isZh ? '序列描述关键字' : 'Description keyword' }}</span>
                                <input v-model="hangingProtocolKeyword" maxlength="64" class="w-full rounded-2xl border border-[var(--theme-border-soft)] bg-[var(--theme-surface-panel)] px-4 py-3 text-sm text-[var(--theme-text-primary)] outline-none transition placeholder:text-[var(--theme-text-muted)] focus:border-[var(--theme-border-strong)]" :placeholder="isZh ? '可留空，例如 chest / lung' : 'Optional, e.g. chest / lung'" />
                              </label>
                            </div>

                            <div class="grid gap-3 md:grid-cols-2">
                              <label class="block">
                                <span class="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--theme-text-muted)]">{{ isZh ? '布局行数' : 'Rows' }}</span>
                                <input v-model="hangingProtocolRows" type="number" min="1" max="6" step="1" class="w-full rounded-2xl border border-[var(--theme-border-soft)] bg-[var(--theme-surface-panel)] px-4 py-3 text-sm text-[var(--theme-text-primary)] outline-none transition focus:border-[var(--theme-border-strong)]" />
                              </label>
                              <label class="block">
                                <span class="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--theme-text-muted)]">{{ isZh ? '布局列数' : 'Columns' }}</span>
                                <input v-model="hangingProtocolColumns" type="number" min="1" max="6" step="1" class="w-full rounded-2xl border border-[var(--theme-border-soft)] bg-[var(--theme-surface-panel)] px-4 py-3 text-sm text-[var(--theme-text-primary)] outline-none transition focus:border-[var(--theme-border-strong)]" />
                              </label>
                            </div>
                          </div>

                          <div v-if="!canAddHangingProtocolRule" class="mt-4 rounded-2xl border border-[color:color-mix(in_srgb,#f4b860_38%,var(--theme-border-soft))] bg-[color:color-mix(in_srgb,#f4b860_10%,transparent)] px-4 py-3 text-xs leading-5 text-[color:color-mix(in_srgb,#f4b860_78%,var(--theme-text-primary))]">
                            {{ isZh ? `最多只能保存 ${MAX_HANGING_PROTOCOL_RULES} 条布局规则。` : `Up to ${MAX_HANGING_PROTOCOL_RULES} layout rules can be saved.` }}
                          </div>
                          <div class="mt-4 flex flex-wrap gap-2">
                            <button type="button" class="theme-button-primary rounded-2xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60" :disabled="!canAddHangingProtocolRule" @click="handleAddHangingProtocolRule">
                              {{ isZh ? '保存挂片规则' : 'Save rule' }}
                            </button>
                          </div>
                        </div>

                        <div class="rounded-[24px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] p-4">
                          <div class="mb-4 flex items-center justify-between gap-3">
                            <div>
                              <div class="text-sm font-semibold text-[var(--theme-text-primary)]">{{ isZh ? '已保存挂片规则' : 'Saved Rules' }}</div>
                              <div class="mt-1 text-xs leading-6 text-[var(--theme-text-secondary)]">
                                {{ isZh ? '规则按列表顺序匹配；关闭后会保留在设置中，但不会参与自动匹配。' : 'Rules match in list order. Disabled rules are kept but ignored.' }}
                              </div>
                            </div>
                          </div>

                          <div v-if="hangingProtocolRules.length === 0" class="grid min-h-[220px] place-items-center rounded-[20px] border border-dashed border-[var(--theme-border-soft)] bg-[var(--theme-surface-panel)] px-5 py-8 text-center">
                            <div>
                              <div class="text-sm font-semibold text-[var(--theme-text-primary)]">{{ isZh ? '还没有挂片规则' : 'No layout rules yet' }}</div>
                              <div class="mt-2 text-xs leading-5 text-[var(--theme-text-secondary)]">
                                {{ isZh ? '新增规则后会随设置持久化保存。' : 'New rules are persisted with your settings.' }}
                              </div>
                            </div>
                          </div>

                          <div v-else class="grid gap-3">
                            <div
                              v-for="rule in hangingProtocolRules"
                              :key="rule.id"
                              class="rounded-[20px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-panel)] px-4 py-4"
                            >
                              <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                <div class="min-w-0">
                                  <div class="flex flex-wrap items-center gap-2">
                                    <span class="truncate text-sm font-semibold text-[var(--theme-text-primary)]">{{ rule.name }}</span>
                                    <span class="rounded-full border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--theme-text-secondary)]">{{ rule.rows }} x {{ rule.columns }}</span>
                                    <span class="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]" :class="rule.enabled ? 'border-[color:color-mix(in_srgb,var(--theme-accent)_36%,var(--theme-border-soft))] text-[var(--theme-accent)]' : 'border-[var(--theme-border-soft)] text-[var(--theme-text-muted)]'">
                                      {{ rule.enabled ? (isZh ? '启用' : 'On') : (isZh ? '关闭' : 'Off') }}
                                    </span>
                                  </div>
                                  <div class="mt-2 text-xs leading-5 text-[var(--theme-text-secondary)]">{{ getHangingProtocolRuleSummary(rule) }}</div>
                                </div>
                                <div class="flex shrink-0 flex-wrap gap-2">
                                  <button type="button" class="theme-button-secondary rounded-2xl px-3 py-2 text-xs font-semibold" @click="toggleHangingProtocolRule(rule)">
                                    {{ rule.enabled ? (isZh ? '关闭' : 'Disable') : (isZh ? '启用' : 'Enable') }}
                                  </button>
                                  <button type="button" class="theme-button-secondary rounded-2xl px-3 py-2 text-xs font-semibold" @click="removeHangingProtocolRule(rule.id)">
                                    {{ isZh ? '删除' : 'Remove' }}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </section>
                  </div>
                </template>

                <template v-else-if="activeSection === 'dicomExport'">
                  <ExportSettingsPanel mode="dicom" />
                </template>

                <template v-else-if="activeSection === 'qa'">
                  <div class="space-y-5">
                    <section class="theme-card-soft rounded-[28px] p-5">
                      <div class="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div class="min-w-0">
                          <div class="flex items-center gap-2 text-[var(--theme-text-primary)]">
                            <span class="grid h-10 w-10 place-items-center rounded-2xl border border-[color:color-mix(in_srgb,var(--theme-accent)_28%,var(--theme-border-soft))] bg-[color:color-mix(in_srgb,var(--theme-accent)_13%,transparent)] text-[var(--theme-accent)]">
                              <AppIcon name="qa" :size="20" />
                            </span>
                            <div>
                              <div class="text-lg font-semibold">{{ copy.qaTitle }}</div>
                              <div class="mt-1 text-sm leading-6 text-[var(--theme-text-secondary)]">{{ copy.qaDesc }}</div>
                            </div>
                          </div>
                        </div>
                        <span class="shrink-0 rounded-full border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--theme-text-secondary)]">
                          {{ copy.qaWaterSelectedCount(enabledQaWaterMetricCount) }}
                        </span>
                      </div>

                      <div class="rounded-[24px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] p-4">
                        <div class="mb-4 flex items-start gap-3">
                          <span class="grid h-9 w-9 shrink-0 place-items-center rounded-2xl border border-[color:color-mix(in_srgb,var(--theme-accent)_24%,var(--theme-border-soft))] bg-[color:color-mix(in_srgb,var(--theme-accent)_10%,transparent)] text-[var(--theme-accent)]">
                            <AppIcon name="water-phantom" :size="18" />
                          </span>
                          <div class="min-w-0">
                            <div class="text-sm font-semibold text-[var(--theme-text-primary)]">{{ copy.qaWaterPhantomTitle }}</div>
                            <div class="mt-1 text-xs leading-6 text-[var(--theme-text-secondary)]">{{ copy.qaWaterPhantomDesc }}</div>
                          </div>
                        </div>

                        <div class="grid gap-3 md:grid-cols-3">
                          <label
                            v-for="metric in qaWaterMetrics"
                            :key="metric.key"
                            class="flex cursor-pointer flex-col gap-3 rounded-[20px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-panel)] px-4 py-4 transition hover:border-[var(--theme-border-strong)] hover:bg-[var(--theme-surface-card-soft)]"
                          >
                            <span class="flex items-center justify-between gap-3">
                              <span class="text-sm font-semibold text-[var(--theme-text-primary)]">{{ getQaWaterMetricLabel(metric) }}</span>
                              <input
                                v-model="metric.enabled"
                                type="checkbox"
                                class="h-4 w-4 rounded border-[var(--theme-border-soft)] accent-[var(--theme-accent)]"
                              />
                            </span>
                            <span class="text-xs leading-5 text-[var(--theme-text-secondary)]">{{ getQaWaterMetricDescription(metric) }}</span>
                          </label>
                        </div>
                      </div>
                    </section>
                  </div>
                </template>

                <template v-else-if="activeSection === 'dicomTags' || activeSection === 'deidentifyExport'">
                  <div class="space-y-5">
                    <section class="theme-card-soft rounded-[28px] p-5">
                      <div class="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div class="min-w-0">
                          <div class="flex items-center gap-2 text-[var(--theme-text-primary)]">
                            <span class="grid h-10 w-10 place-items-center rounded-2xl border border-[color:color-mix(in_srgb,var(--theme-accent)_28%,var(--theme-border-soft))] bg-[color:color-mix(in_srgb,var(--theme-accent)_13%,transparent)] text-[var(--theme-accent)]">
                              <AppIcon :name="activeSection === 'deidentifyExport' ? 'shield' : 'tag'" :size="20" />
                            </span>
                            <div>
                              <div class="text-lg font-semibold">{{ activeSection === 'deidentifyExport' ? (isZh ? 'DICOM 脱敏导出' : 'DICOM De-identification Export') : (isZh ? 'DICOM Tag 设置' : 'DICOM Tag Settings') }}</div>
                              <div class="mt-1 text-sm leading-6 text-[var(--theme-text-secondary)]">
                                {{
                                  activeSection === 'deidentifyExport'
                                    ? (isZh ? '选择脱敏字段与匿名前缀，导出时生成新的 DICOM 副本。' : 'Choose anonymized fields and prefix for exported DICOM copies.')
                                    : (isZh ? '管理 Tag 显示方式和修改副本保存位置。' : 'Manage tag display mode and modified-copy save location.')
                                }}
                              </div>
                            </div>
                          </div>
                        </div>
                        <span v-if="activeSection === 'dicomTags'" class="shrink-0 rounded-full border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--theme-text-secondary)]">
                          {{ isZh ? '当前：' : 'Current: ' }}{{ currentDicomTagDisplayModeTitle }}
                        </span>
                        <span v-else class="shrink-0 rounded-full border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--theme-text-secondary)]">
                          {{ selectedDicomDeidentifyCount }} / {{ dicomDeidentifyOptions.length }}
                        </span>
                      </div>

                      <div v-if="activeSection === 'dicomTags'" class="rounded-[24px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] p-4">
                        <div class="mb-4 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div class="text-sm font-semibold text-[var(--theme-text-primary)]">{{ isZh ? 'Tag 显示方式' : 'Tag Display Mode' }}</div>
                            <div class="mt-1 text-xs leading-6 text-[var(--theme-text-secondary)]">
                              {{ isZh ? '平铺适合快速浏览；树形缩进适合查看序列等嵌套 Tag。' : 'Flat is best for quick scanning; tree indentation helps inspect nested sequence tags.' }}
                            </div>
                          </div>
                        </div>

                        <div class="grid gap-3 lg:grid-cols-2">
                          <button
                            v-for="option in dicomTagDisplayModeOptions"
                            :key="option.value"
                            type="button"
                            class="settings-choice-card group min-h-[82px] rounded-[6px] border px-5 py-4 text-left transition duration-150"
                            :aria-pressed="isDicomTagDisplayModeActive(option.value)"
                            :class="{ 'settings-choice-card--active': isDicomTagDisplayModeActive(option.value) }"
                            @click="handleSelectDicomTagDisplayMode(option.value)"
                          >
                            <div class="flex min-w-0 items-start gap-4">
                              <span class="settings-choice-card__check mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-[4px] border">
                                <AppIcon v-if="isDicomTagDisplayModeActive(option.value)" name="check" :size="18" />
                              </span>
                              <div class="min-w-0">
                                <div class="truncate text-base font-semibold text-[var(--theme-text-primary)]">{{ option.title }}</div>
                                <div class="mt-1 line-clamp-2 text-xs leading-5 text-[var(--theme-text-secondary)]">{{ option.description }}</div>
                              </div>
                            </div>
                          </button>
                        </div>
                      </div>

                      <div v-if="activeSection === 'dicomTags'" class="mt-5 rounded-[24px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] p-4">
                        <div class="mb-4 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div class="text-sm font-semibold text-[var(--theme-text-primary)]">{{ isZh ? 'Tag 修改保存位置' : 'Tag Edit Save Location' }}</div>
                            <div class="mt-1 text-xs leading-6 text-[var(--theme-text-secondary)]">
                              {{ isZh ? '右键修改标签后生成的新 DICOM 文件会保存到这里；同一个序列会归档在同一个子文件夹中。' : 'Modified DICOM copies created from tag edits are saved here; each series is grouped into one subfolder.' }}
                            </div>
                          </div>
                          <span class="w-fit rounded-full border border-[var(--theme-border-soft)] bg-[var(--theme-surface-panel)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--theme-text-secondary)]">
                            {{ tagEditSaveLocationModeLabel }}
                          </span>
                        </div>

                        <div class="grid gap-3 lg:grid-cols-2">
                          <button
                            type="button"
                            class="settings-choice-card group min-h-[92px] rounded-[6px] border px-5 py-4 text-left transition duration-150"
                            :class="{ 'settings-choice-card--active': dicomTagEditSavePreference.locationMode === 'default' }"
                            @click="handleSelectDefaultTagEditSaveLocation"
                          >
                            <div class="flex min-w-0 items-start gap-4">
                              <span class="settings-choice-card__check mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-[4px] border">
                                <AppIcon v-if="dicomTagEditSavePreference.locationMode === 'default'" name="check" :size="18" />
                              </span>
                              <div class="min-w-0">
                                <div class="truncate text-base font-semibold text-[var(--theme-text-primary)]">{{ isZh ? '默认下载目录' : 'Default downloads' }}</div>
                                <div class="mt-1 text-xs leading-5 text-[var(--theme-text-secondary)]">{{ isZh ? '跟随系统默认导出位置。' : 'Use the system default export location.' }}</div>
                                <div class="mt-2 truncate text-[11px] font-medium text-[var(--theme-text-muted)]" :title="tagEditSaveDefaultLocationLabel || (isZh ? '系统默认下载目录' : 'System default downloads')">
                                  {{ tagEditSaveDefaultLocationLabel || (isZh ? '系统默认下载目录' : 'System default downloads') }}
                                </div>
                              </div>
                            </div>
                          </button>

                          <button
                            type="button"
                            class="settings-choice-card group min-h-[92px] rounded-[6px] border px-5 py-4 text-left transition duration-150 disabled:cursor-not-allowed disabled:opacity-60"
                            :disabled="!canPickTagEditSaveLocation"
                            :class="{ 'settings-choice-card--active': dicomTagEditSavePreference.locationMode === 'custom' }"
                            @click="handleSelectCustomTagEditSaveLocation"
                          >
                            <div class="flex min-w-0 items-start gap-4">
                              <span class="settings-choice-card__check mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-[4px] border">
                                <AppIcon v-if="dicomTagEditSavePreference.locationMode === 'custom'" name="check" :size="18" />
                              </span>
                              <div class="min-w-0">
                                <div class="truncate text-base font-semibold text-[var(--theme-text-primary)]">{{ isZh ? '自定义文件夹' : 'Custom folder' }}</div>
                                <div class="mt-1 text-xs leading-5 text-[var(--theme-text-secondary)]">
                                  {{ canPickTagEditSaveLocation ? (isZh ? '选择一个专门保存 Tag 修改副本的位置。' : 'Choose a dedicated location for tag edit copies.') : (isZh ? '当前环境不支持选择本地文件夹。' : 'Folder picking is not available in this environment.') }}
                                </div>
                                <div class="mt-2 truncate text-[11px] font-medium text-[var(--theme-text-muted)]" :title="tagEditSaveCustomLocationLabel">
                                  {{ tagEditSaveCustomLocationLabel }}
                                </div>
                              </div>
                            </div>
                          </button>
                        </div>

                        <div class="mt-4 rounded-[20px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-panel)] px-4 py-4">
                          <div class="flex flex-col gap-4">
                            <div class="min-w-0">
                              <div class="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--theme-text-muted)]">{{ isZh ? '当前保存位置' : 'Current save location' }}</div>
                              <div class="mt-2 max-w-full truncate whitespace-nowrap text-sm font-medium leading-6 text-[var(--theme-text-primary)]" :title="tagEditSaveLocationLabel">{{ tagEditSaveLocationLabel }}</div>
                              <div class="mt-2 text-xs leading-6 text-[var(--theme-text-secondary)]">
                                {{
                                  viewerRuntime.platform === 'desktop'
                                    ? (isZh ? '实际生成目录会追加 DicomVisionTagEdits/<series-id>，避免不同序列的修改文件混在一起。' : 'The actual output appends DicomVisionTagEdits/<series-id> so different series stay separated.')
                                    : (isZh ? 'Web 端会保存后端返回的 DICOM 或 ZIP 下载文件，具体位置由浏览器决定。' : 'On web, the returned DICOM or ZIP is downloaded and the browser decides the final location.')
                                }}
                              </div>
                            </div>
                            <div class="flex flex-wrap gap-2">
                              <button
                                v-if="canOpenTagEditSaveLocation"
                                type="button"
                                class="theme-button-primary min-w-[120px] rounded-2xl px-4 py-2 text-sm font-semibold"
                                @click="handleOpenTagEditSaveLocation"
                              >
                                {{ isZh ? '打开' : 'Open' }}
                              </button>
                              <template v-if="dicomTagEditSavePreference.locationMode === 'custom'">
                                <button
                                  type="button"
                                  class="theme-button-primary min-w-[150px] rounded-2xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                                  :disabled="!canPickTagEditSaveLocation || isChoosingTagEditSaveLocation"
                                  @click="handleChooseTagEditSaveLocation"
                                >
                                  {{ isChoosingTagEditSaveLocation ? '...' : (isZh ? '选择文件夹' : 'Choose folder') }}
                                </button>
                                <button
                                  type="button"
                                  class="theme-button-secondary min-w-[150px] rounded-2xl px-4 py-2 text-sm font-medium"
                                  @click="handleClearTagEditSaveLocation"
                                >
                                  {{ isZh ? '恢复默认' : 'Use default' }}
                                </button>
                              </template>
                            </div>
                          </div>
                          <div
                            v-if="tagEditSaveLocationError"
                            class="mt-4 rounded-2xl border border-[color:color-mix(in_srgb,#ef7777_36%,var(--theme-border-soft))] bg-[color:color-mix(in_srgb,#ef7777_10%,transparent)] px-4 py-3 text-xs leading-5 text-[color:color-mix(in_srgb,#ef7777_76%,var(--theme-text-primary))]"
                          >
                            {{ tagEditSaveLocationError }}
                          </div>
                        </div>
                      </div>

                      <div v-if="activeSection === 'deidentifyExport'" class="rounded-[24px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] p-4">
                        <div class="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div class="flex items-start gap-3">
                            <span class="grid h-9 w-9 shrink-0 place-items-center rounded-2xl border border-[color:color-mix(in_srgb,var(--theme-accent)_24%,var(--theme-border-soft))] bg-[color:color-mix(in_srgb,var(--theme-accent)_10%,transparent)] text-[var(--theme-accent)]">
                              <AppIcon name="shield" :size="18" />
                            </span>
                            <div>
                              <div class="text-sm font-semibold text-[var(--theme-text-primary)]">{{ isZh ? 'DICOM 脱敏导出' : 'DICOM De-identification Export' }}</div>
                              <div class="mt-1 text-xs leading-6 text-[var(--theme-text-secondary)]">
                                {{ isZh ? '右键序列执行脱敏导出时，会按这里勾选的规则生成新的 DICOM 副本，不覆盖原文件。' : 'Series context-menu de-identification exports use these rules and never overwrite source files.' }}
                              </div>
                            </div>
                          </div>
                          <span class="w-fit rounded-full border border-[var(--theme-border-soft)] bg-[var(--theme-surface-panel)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--theme-text-secondary)]">
                            {{ selectedDicomDeidentifyCount }} / {{ dicomDeidentifyOptions.length }}
                          </span>
                        </div>

                        <div class="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                          <button
                            v-for="option in dicomDeidentifyOptions"
                            :key="option.key"
                            type="button"
                            class="group min-h-[128px] rounded-[22px] border px-4 py-4 text-left transition duration-150"
                            :aria-pressed="isDicomDeidentifyFieldSelected(option.key)"
                            :class="isDicomDeidentifyFieldSelected(option.key) ? 'border-[color:color-mix(in_srgb,var(--theme-accent)_58%,var(--theme-border-strong))] bg-[color:color-mix(in_srgb,var(--theme-accent)_11%,var(--theme-surface-card))]' : 'border-[var(--theme-border-soft)] bg-[var(--theme-surface-panel)] hover:border-[var(--theme-border-strong)] hover:bg-[var(--theme-surface-card-soft)]'"
                            @click="toggleDicomDeidentifyField(option.key)"
                          >
                            <span class="flex items-start justify-between gap-3">
                              <span class="min-w-0">
                                <span class="inline-flex rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em]" :class="isDicomDeidentifyFieldSelected(option.key) ? 'border-[color:color-mix(in_srgb,var(--theme-accent)_48%,var(--theme-border-strong))] bg-[color:color-mix(in_srgb,var(--theme-accent)_16%,transparent)] text-[var(--theme-text-primary)]' : 'border-[var(--theme-border-soft)] text-[var(--theme-text-muted)]'">
                                  {{ option.badge }}
                                </span>
                                <span class="mt-3 block text-sm font-semibold text-[var(--theme-text-primary)]">{{ option.title }}</span>
                              </span>
                              <span
                                class="grid h-5 w-5 shrink-0 place-items-center rounded-md border transition"
                                :class="isDicomDeidentifyFieldSelected(option.key) ? 'border-[var(--theme-accent)] bg-[var(--theme-accent)] text-[var(--theme-accent-contrast)] shadow-[0_0_0_4px_color-mix(in_srgb,var(--theme-accent)_18%,transparent)]' : 'border-[var(--theme-border-strong)] bg-transparent text-transparent'"
                              >
                                <AppIcon name="check" :size="12" />
                              </span>
                            </span>
                            <span class="mt-3 block text-xs leading-5 text-[var(--theme-text-secondary)]">{{ option.description }}</span>
                            <span v-if="option.recommended" class="mt-3 inline-flex rounded-full border border-[color:color-mix(in_srgb,var(--theme-accent)_22%,var(--theme-border-soft))] bg-[color:color-mix(in_srgb,var(--theme-accent)_8%,transparent)] px-2 py-0.5 text-[10px] font-semibold text-[var(--theme-text-secondary)]">
                              {{ isZh ? '常用默认' : 'Default' }}
                            </span>
                          </button>
                        </div>

                        <div class="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                          <label class="rounded-[20px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-panel)] px-4 py-3">
                            <span class="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--theme-text-muted)]">{{ isZh ? '替换前缀' : 'Replacement prefix' }}</span>
                            <input
                              :value="dicomDeidentifyPreference.replacementPrefix"
                              maxlength="24"
                              class="mt-2 w-full border-0 bg-transparent text-sm font-semibold text-[var(--theme-text-primary)] outline-none placeholder:text-[var(--theme-text-muted)]"
                              placeholder="ANON"
                              @input="updateDicomDeidentifyReplacementPrefix"
                            />
                            <span class="mt-1 block text-xs leading-5 text-[var(--theme-text-secondary)]">
                              {{ isZh ? '用于生成匿名 Patient ID，例如 ANON-XXXX。' : 'Used to generate anonymous Patient ID values such as ANON-XXXX.' }}
                            </span>
                          </label>
                          <div class="flex flex-wrap items-center gap-2 lg:justify-end">
                            <button type="button" class="theme-button-secondary rounded-2xl px-4 py-2 text-sm font-medium" @click="restoreDefaultDicomDeidentifyFields">
                              {{ isZh ? '恢复常用' : 'Use defaults' }}
                            </button>
                            <button type="button" class="theme-button-primary rounded-2xl px-4 py-2 text-sm font-semibold" @click="selectAllDicomDeidentifyFields">
                              {{ isZh ? '全选' : 'Select all' }}
                            </button>
                          </div>
                        </div>

                        <div
                          v-if="selectedDicomDeidentifyCount === 0"
                          class="mt-4 rounded-2xl border border-[color:color-mix(in_srgb,#f4b860_38%,var(--theme-border-soft))] bg-[color:color-mix(in_srgb,#f4b860_10%,transparent)] px-4 py-3 text-xs leading-5 text-[color:color-mix(in_srgb,#f4b860_78%,var(--theme-text-primary))]"
                        >
                          {{ isZh ? '至少选择一个脱敏项后，右键菜单中的脱敏导出才会执行。' : 'Select at least one de-identification option before using context-menu export.' }}
                        </div>
                      </div>
                    </section>
                  </div>
                </template>

                <template
                  v-else-if="
                    activeSection === 'displayCrosshair' ||
                    activeSection === 'displayMprLayout' ||
                    activeSection === 'displayScaleBar' ||
                    activeSection === 'displayMeasurement' ||
                    activeSection === 'displayPseudocolor' ||
                    activeSection === 'displayRoi'
                  "
                >
                  <div class="space-y-5">
                    <div v-if="activeSection === 'displayCrosshair'" class="theme-card-soft rounded-[28px] p-5">
                      <div class="mb-5 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div class="flex items-center gap-2 text-[var(--theme-text-primary)]">
                            <AppIcon name="crosshair" :size="18" />
                            <span class="text-lg font-semibold">{{ copy.crosshairTitle }}</span>
                          </div>
                          <div class="mt-2 text-sm text-[var(--theme-text-secondary)]">{{ copy.crosshairDesc }}</div>
                        </div>
                      </div>

                      <div class="grid min-w-0 gap-5 2xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
                        <div class="min-w-0">
                          <div class="mb-3 text-sm font-semibold text-[var(--theme-text-primary)]">{{ copy.crosshairStyleTitle }}</div>
                          <div class="grid gap-4 xl:grid-cols-3 2xl:grid-cols-1">
                            <div
                              v-for="config in crosshairConfigs"
                              :key="config.key"
                              class="theme-card-soft rounded-[20px] p-4"
                            >
                              <div class="mb-3 text-sm font-semibold text-[var(--theme-text-primary)]">{{ config.label }}</div>

                              <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                                <label class="block">
                                  <span class="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--theme-text-muted)]">{{ copy.crosshairColor }}</span>
                                  <div class="flex items-center gap-3 rounded-[18px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-panel-strong)] px-3 py-3">
                                    <input v-model="config.color" type="color" class="h-10 w-12 cursor-pointer rounded-xl border border-[var(--theme-border-soft)] bg-transparent" />
                                    <div class="min-w-0">
                                      <div class="text-sm font-medium text-[var(--theme-text-primary)]">{{ config.color }}</div>
                                    </div>
                                  </div>
                                </label>

                                <label class="block">
                                  <span class="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--theme-text-muted)]">{{ copy.crosshairWidth }}</span>
                                  <div class="rounded-[18px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-panel-strong)] px-4 py-4">
                                    <input v-model="config.thickness" type="range" min="1" max="4" step="1" class="w-full accent-[var(--theme-accent)]" />
                                    <div class="mt-2 flex items-center justify-between text-xs text-[var(--theme-text-secondary)]">
                                      <span>{{ copy.thin }}</span>
                                      <span>{{ config.thickness }} px</span>
                                      <span>{{ copy.bold }}</span>
                                    </div>
                                  </div>
                                </label>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div class="min-w-0">
                          <div class="mb-3 flex items-center gap-2 text-[var(--theme-text-primary)]">
                            <AppIcon name="palette" :size="18" />
                            <span class="text-sm font-semibold">{{ copy.visualPreview }}</span>
                          </div>
                          <div class="grid gap-4 md:grid-cols-3 2xl:grid-cols-1">
                            <div
                              v-for="config in crosshairConfigs"
                              :key="`${config.key}-preview`"
                              class="rounded-[20px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-panel-strong)] p-3"
                            >
                              <div class="mb-2 flex items-center justify-between">
                                <span class="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--theme-text-secondary)]">{{ config.label }}</span>
                              </div>
                              <div class="relative h-[170px] overflow-hidden rounded-[16px] border border-[var(--theme-border-soft)] bg-[radial-gradient(circle_at_top,color-mix(in_srgb,var(--theme-text-primary)_6%,transparent),transparent_36%),linear-gradient(180deg,var(--theme-surface-panel-solid),var(--theme-surface-panel-strong-solid))]">
                                <div class="absolute left-[16%] top-[18%] h-8 w-8 rounded-full border border-[color:color-mix(in_srgb,var(--theme-text-primary)_8%,transparent)] bg-[color:color-mix(in_srgb,var(--theme-text-primary)_3%,transparent)] blur-[1px]"></div>
                                <div class="absolute right-[14%] top-[26%] h-12 w-12 rounded-full border border-[color:color-mix(in_srgb,var(--theme-text-primary)_7%,transparent)] bg-[color:color-mix(in_srgb,var(--theme-text-primary)_2%,transparent)] blur-[2px]"></div>
                                <div class="absolute bottom-[16%] left-[22%] h-10 w-10 rounded-full border border-[color:color-mix(in_srgb,var(--theme-text-primary)_6%,transparent)] bg-[color:color-mix(in_srgb,var(--theme-text-primary)_2%,transparent)] blur-[1px]"></div>
                                <div class="absolute inset-y-0 left-1/2 -translate-x-1/2" :style="{ width: `${getCrosshairPreviewAxes(config.key).vertical.thickness}px`, backgroundColor: getCrosshairPreviewAxes(config.key).vertical.color, boxShadow: `0 0 14px ${getCrosshairPreviewAxes(config.key).vertical.color}88` }"></div>
                                <div class="absolute inset-x-0 top-1/2 -translate-y-1/2" :style="{ height: `${getCrosshairPreviewAxes(config.key).horizontal.thickness}px`, backgroundColor: getCrosshairPreviewAxes(config.key).horizontal.color, boxShadow: `0 0 14px ${getCrosshairPreviewAxes(config.key).horizontal.color}88` }"></div>
                                <div class="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[color:color-mix(in_srgb,var(--theme-text-primary)_12%,transparent)] bg-[color:color-mix(in_srgb,var(--theme-surface-panel-strong-solid)_78%,black)]"></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div v-if="activeSection === 'displayMprLayout'" class="theme-card-soft rounded-[24px] p-4">
                      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div class="min-w-0">
                          <div class="flex items-center gap-2 text-[var(--theme-text-primary)]">
                            <AppIcon name="layout" :size="18" />
                            <span class="text-sm font-semibold">{{ isZh ? 'MPR 默认布局' : 'Default MPR Layout' }}</span>
                          </div>
                          <div class="mt-2 max-w-2xl text-xs leading-5 text-[var(--theme-text-secondary)]">
                            {{ isZh ? '新打开的 MPR / 4D MPR 默认使用该视口排布；当前 MPR 视图也会立即应用。' : 'New MPR and 4D MPR views use this viewport arrangement by default. The active MPR view updates immediately.' }}
                          </div>
                        </div>
                        <div class="rounded-full border border-[var(--theme-border-soft)] bg-[var(--theme-surface-panel)] px-3 py-1.5 text-xs font-semibold text-[var(--theme-text-secondary)]">
                          {{ getMprLayoutLabel(mprDefaultLayoutKey) }}
                        </div>
                      </div>

                      <div class="mt-5 flex flex-col gap-4 xl:flex-row xl:items-center">
                        <MprLayoutMenuPanel
                          class="settings-mpr-layout-panel"
                          :options="mprDefaultLayoutOptions"
                          :active-value="mprDefaultLayoutSelectionValue"
                          @select="handleSelectMprDefaultLayout"
                        />
                        <div class="grid gap-2 text-xs leading-5 text-[var(--theme-text-secondary)]">
                          <div class="font-semibold uppercase tracking-[0.16em] text-[var(--theme-text-muted)]">
                            {{ isZh ? '可选布局' : 'Available layouts' }}
                          </div>
                          <div>{{ isZh ? '三列、右侧主视图、三行、2 x 2，以及 MPR + 3D 组合布局。' : '3 columns, primary-right, 3 rows, 2 x 2, and the combined MPR + 3D layout.' }}</div>
                        </div>
                      </div>
                    </div>

                    <div v-if="activeSection === 'displayScaleBar'" class="theme-card-soft rounded-[24px] p-4">
                      <div class="mb-4">
                        <div class="flex items-center gap-2 text-[var(--theme-text-primary)]">
                          <AppIcon name="measure" :size="18" />
                          <span class="text-sm font-semibold">{{ copy.scaleBarTitle }}</span>
                        </div>
                        <div class="mt-1 max-w-3xl text-xs leading-5 text-[var(--theme-text-secondary)]">{{ copy.scaleBarDesc }}</div>
                      </div>

                      <div class="grid min-w-0 gap-4 xl:grid-cols-2">
                        <div class="scale-bar-control-card rounded-[18px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-panel-strong)] px-4 py-3">
                          <button
                            type="button"
                            role="switch"
                            class="scale-bar-toggle-control flex min-h-[74px] w-full cursor-pointer items-center justify-between gap-4 text-left"
                            :aria-checked="scaleBarPreference.enabled"
                            @click="toggleScaleBarEnabled"
                          >
                            <div class="min-w-0">
                              <div class="text-sm font-semibold text-[var(--theme-text-primary)]">{{ copy.scaleBarEnabled }}</div>
                              <div class="mt-1 text-xs leading-5 text-[var(--theme-text-secondary)]">
                                {{ scaleBarPreference.enabled ? copy.enabledLabel : copy.disabledLabel }}
                              </div>
                            </div>
                            <span class="relative h-6 w-11 shrink-0 rounded-full border transition" :class="scaleBarPreference.enabled ? 'border-[var(--theme-accent)] bg-[var(--theme-accent)]' : 'border-[var(--theme-border-strong)] bg-[var(--theme-surface-card)]'">
                              <span class="absolute top-1 h-4 w-4 rounded-full bg-white shadow transition" :class="scaleBarPreference.enabled ? 'left-6' : 'left-1'"></span>
                            </span>
                          </button>
                        </div>

                        <div class="scale-bar-control-card rounded-[18px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-panel-strong)] px-3 py-3">
                          <div class="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--theme-text-muted)]">{{ copy.scaleBarColor }}</div>
                          <div class="flex items-center gap-3">
                            <input v-model="scaleBarPreference.color" type="color" class="h-10 w-12 cursor-pointer rounded-xl border border-[var(--theme-border-soft)] bg-transparent" />
                            <div class="min-w-0">
                              <div class="text-sm font-medium text-[var(--theme-text-primary)]">{{ scaleBarPreference.color }}</div>
                            </div>
                          </div>
                          <div class="mt-3 grid grid-cols-6 gap-2">
                            <button
                              v-for="preset in scaleBarColorPresets"
                              :key="preset.value"
                              type="button"
                              class="flex aspect-square min-h-8 items-center justify-center rounded-full border transition duration-150"
                              :class="scaleBarPreference.color.toLowerCase() === preset.value.toLowerCase() ? 'border-[var(--theme-border-strong)] ring-2 ring-[color:color-mix(in_srgb,var(--theme-accent)_38%,transparent)]' : 'border-[var(--theme-border-soft)] hover:border-[var(--theme-border-strong)]'"
                              :style="{ backgroundColor: preset.value }"
                              :title="preset.label"
                              @click="scaleBarPreference.color = preset.value"
                            >
                              <span
                                v-if="scaleBarPreference.color.toLowerCase() === preset.value.toLowerCase()"
                                class="h-2.5 w-2.5 rounded-full border border-black/20 bg-white/80"
                              ></span>
                            </button>
                          </div>
                        </div>

                        <div class="scale-bar-control-card rounded-[20px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-panel-strong)] p-4 xl:col-span-2">
                          <div class="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--theme-text-muted)]">{{ copy.visualPreview }}</div>
                          <div class="scale-bar-preview-surface relative min-h-[96px] overflow-hidden rounded-[16px] border border-[var(--theme-border-soft)] bg-[radial-gradient(circle_at_top,color-mix(in_srgb,var(--theme-text-primary)_6%,transparent),transparent_36%),linear-gradient(180deg,var(--theme-surface-panel-solid),var(--theme-surface-panel-strong-solid))]">
                            <div
                              class="scale-bar-preview-mark absolute bottom-3 left-1/2 -translate-x-1/2 transition duration-150"
                              :class="scaleBarPreference.enabled ? 'opacity-100' : 'opacity-30 grayscale'"
                              :style="{ color: scaleBarPreference.color }"
                            >
                              <div class="mb-1 text-center text-[11px] font-semibold tracking-[0.12em]">10 cm</div>
                              <div class="relative h-4 w-32">
                                <div class="absolute inset-x-0 bottom-0 h-[2px] rounded-full" :style="{ backgroundColor: scaleBarPreference.color, boxShadow: `0 0 8px ${scaleBarPreference.color}55` }"></div>
                                <div
                                  v-for="tick in 11"
                                  :key="tick"
                                  class="absolute bottom-0 -translate-x-1/2"
                                  :style="{
                                    left: `${((tick - 1) / 10) * 128}px`,
                                    width: tick === 1 || tick === 6 || tick === 11 ? '2px' : '1px',
                                    height: tick === 1 || tick === 6 || tick === 11 ? '14px' : '7px',
                                    backgroundColor: scaleBarPreference.color,
                                    boxShadow: `0 0 8px ${scaleBarPreference.color}55`
                                  }"
                                ></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div v-if="activeSection === 'displayMeasurement'" class="theme-card-soft rounded-[24px] p-4">
                      <div class="mb-4 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div class="flex items-center gap-2 text-[var(--theme-text-primary)]">
                            <AppIcon name="measure-line" :size="18" />
                            <span class="text-sm font-semibold">{{ copy.measurementStyleTitle }}</span>
                          </div>
                          <div class="mt-2 text-xs leading-5 text-[var(--theme-text-secondary)]">{{ copy.measurementStyleDesc }}</div>
                        </div>
                      </div>

                      <div class="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(260px,0.75fr)]">
                        <div class="rounded-[18px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-panel-strong)] p-4">
                          <div class="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--theme-text-muted)]">{{ copy.measurementEditingColor }}</div>
                          <div class="flex items-center gap-3">
                            <input v-model="measurementStylePreference.editingColor" type="color" class="h-10 w-12 cursor-pointer rounded-xl border border-[var(--theme-border-soft)] bg-transparent" />
                            <div class="min-w-0 text-sm font-medium text-[var(--theme-text-primary)]">{{ measurementStylePreference.editingColor }}</div>
                          </div>
                          <div class="mt-3 grid grid-cols-6 gap-2">
                            <button
                              v-for="preset in measurementColorPresets"
                              :key="`editing-${preset.value}`"
                              type="button"
                              class="flex aspect-square min-h-8 items-center justify-center rounded-full border transition duration-150"
                              :class="measurementStylePreference.editingColor.toLowerCase() === preset.value.toLowerCase() ? 'border-[var(--theme-border-strong)] ring-2 ring-[color:color-mix(in_srgb,var(--theme-accent)_38%,transparent)]' : 'border-[var(--theme-border-soft)] hover:border-[var(--theme-border-strong)]'"
                              :style="{ backgroundColor: preset.value }"
                              :title="preset.label"
                              @click="measurementStylePreference.editingColor = preset.value"
                            >
                              <span
                                v-if="measurementStylePreference.editingColor.toLowerCase() === preset.value.toLowerCase()"
                                class="h-2.5 w-2.5 rounded-full border border-black/20 bg-white/80"
                              ></span>
                            </button>
                          </div>
                        </div>

                        <div class="rounded-[18px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-panel-strong)] p-4">
                          <div class="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--theme-text-muted)]">{{ copy.measurementCompletedColor }}</div>
                          <div class="flex items-center gap-3">
                            <input v-model="measurementStylePreference.completedColor" type="color" class="h-10 w-12 cursor-pointer rounded-xl border border-[var(--theme-border-soft)] bg-transparent" />
                            <div class="min-w-0 text-sm font-medium text-[var(--theme-text-primary)]">{{ measurementStylePreference.completedColor }}</div>
                          </div>
                          <div class="mt-3 grid grid-cols-6 gap-2">
                            <button
                              v-for="preset in measurementColorPresets"
                              :key="`completed-${preset.value}`"
                              type="button"
                              class="flex aspect-square min-h-8 items-center justify-center rounded-full border transition duration-150"
                              :class="measurementStylePreference.completedColor.toLowerCase() === preset.value.toLowerCase() ? 'border-[var(--theme-border-strong)] ring-2 ring-[color:color-mix(in_srgb,var(--theme-accent)_38%,transparent)]' : 'border-[var(--theme-border-soft)] hover:border-[var(--theme-border-strong)]'"
                              :style="{ backgroundColor: preset.value }"
                              :title="preset.label"
                              @click="measurementStylePreference.completedColor = preset.value"
                            >
                              <span
                                v-if="measurementStylePreference.completedColor.toLowerCase() === preset.value.toLowerCase()"
                                class="h-2.5 w-2.5 rounded-full border border-black/20 bg-white/80"
                              ></span>
                            </button>
                          </div>
                        </div>

                        <div class="rounded-[18px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-panel-strong)] p-4">
                          <div class="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--theme-text-muted)]">{{ copy.measurementLineWidth }}</div>
                          <input v-model.number="measurementStylePreference.lineWidth" type="range" min="1.5" max="6" step="0.5" class="w-full accent-[var(--theme-accent)]" />
                          <div class="mt-2 flex items-center justify-between text-xs text-[var(--theme-text-secondary)]">
                            <span>1.5 px</span>
                            <span class="font-semibold text-[var(--theme-text-primary)]">{{ measurementStylePreference.lineWidth }} px</span>
                            <span>6 px</span>
                          </div>
                        </div>
                      </div>

                      <div class="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,0.85fr)_minmax(260px,1fr)]">
                        <div class="rounded-[18px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-panel-strong)] p-4">
                          <div class="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--theme-text-muted)]">{{ copy.measurementEditingLineStyle }}</div>
                          <div class="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              class="rounded-[16px] border px-3 py-2 text-sm font-semibold transition"
                              :class="measurementStylePreference.editingLineStyle === 'solid' ? 'border-[var(--theme-border-strong)] bg-[var(--theme-active-pill-bg)] text-[var(--theme-text-primary)]' : 'border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] text-[var(--theme-text-secondary)] hover:border-[var(--theme-border-strong)]'"
                              @click="measurementStylePreference.editingLineStyle = 'solid'"
                            >
                              {{ copy.measurementSolidLine }}
                            </button>
                            <button
                              type="button"
                              class="rounded-[16px] border px-3 py-2 text-sm font-semibold transition"
                              :class="measurementStylePreference.editingLineStyle === 'dash' ? 'border-[var(--theme-border-strong)] bg-[var(--theme-active-pill-bg)] text-[var(--theme-text-primary)]' : 'border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] text-[var(--theme-text-secondary)] hover:border-[var(--theme-border-strong)]'"
                              @click="measurementStylePreference.editingLineStyle = 'dash'"
                            >
                              {{ copy.measurementDashedLine }}
                            </button>
                          </div>
                        </div>

                        <div class="rounded-[18px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-panel-strong)] p-4">
                          <div class="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--theme-text-muted)]">{{ copy.measurementCompletedLineStyle }}</div>
                          <div class="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              class="rounded-[16px] border px-3 py-2 text-sm font-semibold transition"
                              :class="measurementStylePreference.completedLineStyle === 'solid' ? 'border-[var(--theme-border-strong)] bg-[var(--theme-active-pill-bg)] text-[var(--theme-text-primary)]' : 'border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] text-[var(--theme-text-secondary)] hover:border-[var(--theme-border-strong)]'"
                              @click="measurementStylePreference.completedLineStyle = 'solid'"
                            >
                              {{ copy.measurementSolidLine }}
                            </button>
                            <button
                              type="button"
                              class="rounded-[16px] border px-3 py-2 text-sm font-semibold transition"
                              :class="measurementStylePreference.completedLineStyle === 'dash' ? 'border-[var(--theme-border-strong)] bg-[var(--theme-active-pill-bg)] text-[var(--theme-text-primary)]' : 'border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] text-[var(--theme-text-secondary)] hover:border-[var(--theme-border-strong)]'"
                              @click="measurementStylePreference.completedLineStyle = 'dash'"
                            >
                              {{ copy.measurementDashedLine }}
                            </button>
                          </div>
                        </div>

                        <div class="rounded-[18px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-panel-strong)] p-4">
                          <svg class="h-20 w-full" viewBox="0 0 280 72" aria-hidden="true">
                            <line x1="20" y1="22" x2="260" y2="22" :stroke="measurementStylePreference.editingColor" :stroke-width="measurementStylePreference.lineWidth" stroke-linecap="round" :stroke-dasharray="measurementStylePreference.editingLineStyle === 'dash' ? '12 8' : undefined" />
                            <line x1="20" y1="52" x2="260" y2="52" :stroke="measurementStylePreference.completedColor" :stroke-width="measurementStylePreference.lineWidth" stroke-linecap="round" :stroke-dasharray="measurementStylePreference.completedLineStyle === 'dash' ? '12 8' : undefined" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    <div v-if="activeSection === 'displayPseudocolor' || activeSection === 'displayRoi'" class="grid gap-5">
                      <div v-if="activeSection === 'displayPseudocolor'" class="theme-card-soft rounded-[24px] p-4">
                        <div class="mb-4 flex items-center justify-between gap-3">
                          <div class="flex items-center gap-2 text-[var(--theme-text-primary)]">
                            <AppIcon name="pseudocolor" :size="18" />
                            <span class="text-sm font-semibold">{{ copy.pseudocolor }}</span>
                          </div>
                          <span class="rounded-full border border-[var(--theme-border-soft)] bg-[var(--theme-surface-panel)] px-2.5 py-1 text-[10px] font-semibold text-[var(--theme-text-secondary)]">
                            {{ PSEUDOCOLOR_PRESET_OPTIONS.length }}
                          </span>
                        </div>
                        <div class="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                          <button
                            v-for="option in PSEUDOCOLOR_PRESET_OPTIONS"
                            :key="option.key"
                            type="button"
                            class="relative rounded-[18px] border px-3 py-3 text-left transition duration-150"
                            :class="selectedPseudocolorKey === option.key ? 'border-[var(--theme-accent)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--theme-accent)_20%,var(--theme-surface-card)),color-mix(in_srgb,var(--theme-accent-warm)_10%,var(--theme-surface-card)))] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--theme-accent)_60%,transparent),0_0_0_3px_color-mix(in_srgb,var(--theme-accent)_18%,transparent)]' : 'border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] opacity-80 hover:border-[var(--theme-border-strong)] hover:bg-[var(--theme-surface-card-soft)] hover:opacity-100'"
                            @click="selectedPseudocolorKey = option.key"
                          >
                            <span class="block h-8 rounded-[12px] border shadow-inner" :class="selectedPseudocolorKey === option.key ? 'border-[color:color-mix(in_srgb,var(--theme-accent)_64%,white_16%)]' : 'border-[var(--theme-border-soft)]'" :style="{ background: option.gradient }"></span>
                            <span class="mt-3 flex items-center justify-between gap-3">
                              <span class="truncate text-sm font-semibold" :class="selectedPseudocolorKey === option.key ? 'text-[var(--theme-text-primary)]' : 'text-[var(--theme-text-secondary)]'">{{ option.label }}</span>
                              <span
                                class="grid h-6 w-6 shrink-0 place-items-center rounded-[8px] border transition"
                                :class="selectedPseudocolorKey === option.key ? 'border-[var(--theme-accent)] bg-[var(--theme-accent)] text-white shadow-[0_0_12px_color-mix(in_srgb,var(--theme-accent)_38%,transparent)]' : 'border-[var(--theme-border-soft)] bg-[var(--theme-surface-panel-strong)] text-transparent'"
                              >
                                <AppIcon name="check" :size="13" />
                              </span>
                            </span>
                          </button>
                        </div>
                      </div>

                      <div v-if="activeSection === 'displayRoi'" class="theme-card-soft rounded-[24px] p-4">
                        <div class="mb-2 text-sm font-semibold text-[var(--theme-text-primary)]">{{ copy.roiStatsTitle }}</div>
                        <div class="mb-4 text-xs leading-6 text-[var(--theme-text-secondary)]">{{ copy.roiStatsDesc }}</div>
                        <div class="grid gap-3 sm:grid-cols-2">
                          <label
                            v-for="option in roiStatOptions"
                            :key="option.key"
                            class="flex items-center gap-3 rounded-[18px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] px-3 py-3 transition hover:bg-[var(--theme-surface-card-soft)]"
                          >
                            <input v-model="option.enabled" type="checkbox" class="h-4 w-4 rounded border-[var(--theme-border-soft)] accent-[var(--theme-accent)]" />
                            <span class="text-sm font-medium text-[var(--theme-text-primary)]">{{ option.label }}</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </template>
              </div>
            </div>
          </section>
        </div>

        <div class="relative flex justify-end border-t border-[var(--theme-border-soft)] px-6 py-4 md:hidden">
          <div class="flex items-center gap-2">
            <button type="button" class="theme-button-secondary rounded-2xl px-4 py-2 text-sm font-medium" @click="resetCurrentSection">{{ copy.reset }}</button>
            <button type="button" class="theme-button-primary rounded-2xl px-4 py-2 text-sm font-semibold">{{ copy.applyDraft }}</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.settings-nav-scroll,
.settings-content-scroll {
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, var(--theme-accent) 45%, transparent) var(--theme-surface-card-soft);
}

.settings-nav-scroll::-webkit-scrollbar,
.settings-content-scroll::-webkit-scrollbar {
  width: 9px;
}

.settings-nav-scroll::-webkit-scrollbar-track,
.settings-content-scroll::-webkit-scrollbar-track {
  background: var(--theme-surface-card-soft);
  border-radius: 999px;
}

.settings-nav-scroll::-webkit-scrollbar-thumb,
.settings-content-scroll::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, color-mix(in srgb, var(--theme-accent) 52%, transparent), color-mix(in srgb, var(--theme-accent-warm) 28%, transparent));
  border-radius: 999px;
}

.settings-nav-search {
  border-color: color-mix(in srgb, var(--theme-border-soft) 88%, transparent);
  background: color-mix(in srgb, var(--theme-surface-card) 72%, transparent);
  color: var(--theme-text-secondary);
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--theme-text-primary) 5%, transparent);
}

.settings-nav-search:focus-within {
  border-color: color-mix(in srgb, var(--theme-accent) 48%, var(--theme-border-strong));
  background: color-mix(in srgb, var(--theme-surface-card-soft) 86%, transparent);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--theme-text-primary) 7%, transparent),
    0 0 0 3px color-mix(in srgb, var(--theme-accent) 10%, transparent);
}

.settings-nav-search__input {
  appearance: none;
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  min-height: 0 !important;
  padding: 0 !important;
}

.settings-nav-search__input:focus {
  border: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}

.settings-nav-item {
  position: relative;
  overflow: hidden;
  border-radius: var(--industrial-radius-control, 4px) !important;
  box-shadow: var(
    --industrial-control-shadow,
    inset 0 1px 0 color-mix(in srgb, var(--theme-text-primary) 4%, transparent),
    0 4px 10px rgba(0, 0, 0, 0.16)
  ) !important;
}

.settings-nav-item::before {
  position: absolute;
  inset: 8px auto 8px 0;
  width: 3px;
  border-radius: 0 2px 2px 0;
  background: transparent;
  content: "";
}

.settings-nav-item--active {
  border-color: var(--industrial-active-border, color-mix(in srgb, var(--theme-accent) 34%, transparent)) !important;
  background: var(
    --industrial-active-surface,
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--theme-accent) 9%, var(--theme-surface-card) 91%),
      color-mix(in srgb, var(--theme-accent-strong) 7%, var(--theme-surface-card-soft) 93%)
    )
  ) !important;
  color: var(--theme-active-foreground) !important;
  box-shadow: var(
    --industrial-active-shadow,
    inset 0 0 0 1px color-mix(in srgb, var(--theme-accent) 12%, transparent),
    0 0 0 1px rgba(0, 0, 0, 0.2),
    0 6px 14px rgba(0, 0, 0, 0.18)
  ) !important;
}

.settings-nav-item--inactive {
  border-color: color-mix(in srgb, var(--theme-text-muted) 10%, transparent) !important;
  background: color-mix(in srgb, var(--theme-surface-panel-strong-solid) 72%, transparent) !important;
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--theme-text-primary) 2%, transparent),
    inset 0 -1px 0 rgba(0, 0, 0, 0.28) !important;
  opacity: 0.68;
}

.settings-nav-item--inactive:hover {
  border-color: color-mix(in srgb, var(--theme-accent) 20%, transparent) !important;
  background: color-mix(in srgb, var(--theme-surface-card) 76%, var(--theme-accent) 4%) !important;
  opacity: 0.92;
}

.settings-nav-item--active::before {
  background: var(--theme-accent);
  box-shadow: 0 0 10px color-mix(in srgb, var(--theme-accent) 42%, transparent);
}

.settings-nav-icon {
  border-radius: var(--industrial-radius-chip, 4px) !important;
  background: color-mix(in srgb, var(--theme-surface-panel-strong-solid) 82%, transparent) !important;
  box-shadow: none !important;
}

.settings-nav-item--active .settings-nav-icon {
  border-color: color-mix(in srgb, var(--theme-accent) 34%, transparent) !important;
  background: color-mix(in srgb, var(--theme-accent) 8%, var(--theme-surface-panel-strong-solid)) !important;
  color: var(--theme-active-foreground) !important;
}

.settings-nav-item--inactive .settings-nav-icon {
  border-color: color-mix(in srgb, var(--theme-text-muted) 12%, transparent) !important;
  background: color-mix(in srgb, var(--theme-surface-panel-strong-solid) 86%, transparent) !important;
  color: color-mix(in srgb, var(--theme-text-muted) 76%, transparent) !important;
}

.settings-nav-chevron {
  border-color: color-mix(in srgb, var(--theme-border-soft) 76%, transparent);
  color: var(--theme-text-secondary);
}

.settings-nav-chevron--open {
  background: color-mix(in srgb, var(--theme-accent) 10%, transparent);
  color: var(--theme-text-primary);
  transform: rotate(0deg);
}

.settings-nav-chevron--closed {
  background: color-mix(in srgb, var(--theme-surface-card) 68%, transparent);
  transform: rotate(-90deg);
}

.settings-nav-sublist {
  border-left: 1px solid color-mix(in srgb, var(--theme-border-soft) 78%, transparent);
}

.settings-nav-subitem {
  border-color: transparent;
  background: transparent;
}

.settings-nav-subitem:hover {
  border-color: color-mix(in srgb, var(--theme-border-soft) 82%, transparent);
  background: color-mix(in srgb, var(--theme-surface-card) 70%, transparent);
}

.settings-nav-subitem--active,
.settings-nav-subitem--active:hover,
.settings-nav-subitem--active:focus-visible {
  border-color: color-mix(in srgb, var(--theme-accent) 42%, var(--theme-border-soft));
  background: color-mix(in srgb, var(--theme-accent) 9%, var(--theme-surface-card));
}

.settings-nav-subitem__dot {
  background: color-mix(in srgb, var(--theme-text-muted) 62%, transparent);
}

.settings-nav-subitem--active .settings-nav-subitem__dot {
  background: var(--theme-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--theme-accent) 14%, transparent);
}

.settings-choice-card {
  border-color: color-mix(in srgb, var(--theme-border-soft) 88%, transparent);
  background: color-mix(in srgb, var(--theme-surface-card) 76%, transparent);
  box-shadow: none;
  outline: none;
}

.settings-choice-card:hover {
  border-color: color-mix(in srgb, var(--theme-border-strong) 82%, var(--theme-border-soft));
  background: color-mix(in srgb, var(--theme-surface-card-soft) 88%, transparent);
}

.settings-choice-card:focus {
  outline: none;
}

.settings-choice-card:focus-visible {
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--theme-accent) 34%, transparent);
}

.settings-choice-card--active,
.settings-choice-card--active:hover,
.settings-choice-card--active:focus-visible {
  border-color: color-mix(in srgb, var(--theme-accent) 58%, var(--theme-border-strong));
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--theme-accent) 9%, var(--theme-surface-card)),
      color-mix(in srgb, var(--theme-accent-strong) 8%, var(--theme-surface-panel-solid))
    );
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--theme-accent) 18%, transparent),
    0 0 0 1px color-mix(in srgb, var(--theme-accent) 10%, transparent);
}

.settings-choice-card__check {
  border-color: color-mix(in srgb, var(--theme-text-muted) 68%, transparent);
  background: transparent;
  color: transparent;
}

.settings-choice-card--active .settings-choice-card__check {
  border-color: color-mix(in srgb, var(--theme-accent) 84%, white 8%);
  background: var(--theme-accent);
  color: var(--theme-accent-contrast);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--theme-accent) 12%, transparent);
}

.settings-mpr-layout-panel {
  width: max-content;
  max-width: 100%;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 92%, transparent);
  border-radius: 16px;
  background: color-mix(in srgb, var(--theme-surface-panel-strong-solid) 84%, transparent);
}
</style>
