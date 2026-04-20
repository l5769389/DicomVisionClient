<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AppIcon from '../AppIcon.vue'
import { PSEUDOCOLOR_PRESET_OPTIONS } from '../../constants/pseudocolor'
import { useUiLocale } from '../../composables/ui/useUiLocale'
import { type AppLocale, useUiPreferences } from '../../composables/ui/useUiPreferences'
import { clearStoredWebExportDirectory, canChooseCustomExportDirectory, chooseCustomExportDirectory, getDefaultExportLocationLabel, openExportLocation } from '../../platform/exporting'
import { viewerRuntime } from '../../platform/runtime'

defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

type SettingsSection = 'language' | 'shortcuts' | 'windowPresets' | 'export' | 'display'
type MprViewportKey = 'mpr-ax' | 'mpr-cor' | 'mpr-sag'

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

interface SettingsCopy {
  title: string
  sectionLabel: string
  reset: string
  applyDraft: string
  language: string
  languageSub: string
  shortcuts: string
  shortcutsSub: string
  windowPresets: string
  windowPresetsSub: string
  exportSection?: string
  exportSectionSub?: string
  display: string
  displaySub: string
  shortcutsTitle: string
  shortcutsDesc: string
  editable: string
  navGroup: string
  measureGroup: string
  workspaceGroup: string
  items: string
  windowPresetsTitle: string
  windowPresetsDesc: string
  systemPresets: string
  customPresets: string
  builtIn: string
  custom: string
  emptyCustom: string
  emptyCustomDesc: string
  addCustom: string
  zhName: string
  enName: string
  ww: string
  wl: string
  addTemplate: string
  removeTemplate: string
  exportTitle?: string
  exportDesc?: string
  exportMode?: string
  exportDefault?: string
  exportCustom?: string
  exportCurrentLocation?: string
  exportChooseLocation?: string
  exportClearLocation?: string
  exportChooseFailed?: string
  exportOpenLocation?: string
  exportOpenLocationFailed?: string
  exportCustomBadge?: string
  exportDefaultBadge?: string
  exportDefaultHint?: string
  exportCustomMissing?: string
  exportDesktopMode?: string
  exportFileNameTitle?: string
  exportIncludeAnnotations?: string
  exportIncludeDicomAnnotations?: string
  exportIncludeDicomMeasurements?: string
  exportIncludeMeasurements?: string
  exportIncludeOverlaysHint?: string
  exportIncludePngAnnotations?: string
  exportIncludePngCornerInfo?: string
  exportIncludePngMeasurements?: string
  exportUseDefaultFileName?: string
  exportUseDefaultFileNameHint?: string
  exportFormats?: string
  exportCustomHint?: string
  exportUnsupportedHint?: string
  exportWebMode?: string
  displayTitle: string
  displayDesc: string
  scaleBarTitle: string
  scaleBarDesc: string
  scaleBarEnabled: string
  scaleBarColor: string
  enabledLabel: string
  disabledLabel: string
  scaleBarPreviewLabel: string
  roiStatsTitle: string
  roiStatsDesc: string
  themeDesc: string
  pseudocolor: string
  crosshairViewport: string
  crosshairColor: string
  crosshairWidth: string
  thin: string
  bold: string
  crosshairNote: string
  visualPreview: string
  languageTitle: string
  themePresetTitle: string
  zhCn: string
  enUs: string
  crosshairPreviewLabel: string
}

const DEFAULT_THEME_ID = 'aurora'
const DEFAULT_PSEUDOCOLOR_KEY = 'bw'

const themePresets: ThemePreset[] = [
  {
    id: 'aurora',
    labelZh: '默认主题',
    labelEn: 'Default Theme',
    summaryZh: '沿用当前项目的深蓝界面、冷蓝高亮与低亮背景层次',
    summaryEn: 'Current project look with deep navy surfaces and cool blue highlights',
    preview: 'linear-gradient(135deg,#07111d 0%,#0d1b2d 48%,#16324d 78%,#66d0ff 100%)'
  },
  {
    id: 'clinical-light',
    labelZh: 'Clinical Light',
    labelEn: 'Clinical Light',
    summaryZh: '浅灰白底配冷蓝强调，更适合明亮环境和演示场景',
    summaryEn: 'Soft light surfaces with restrained blue accents for bright rooms and demos',
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

function createDefaultCrosshairConfigs(): CrosshairViewportConfig[] {
  return [
    { key: 'mpr-ax', label: 'AX', color: '#22c55e', thickness: 2 },
    { key: 'mpr-cor', label: 'COR', color: '#3b82f6', thickness: 2 },
    { key: 'mpr-sag', label: 'SAG', color: '#ef4444', thickness: 2 }
  ]
}

function createDefaultScaleBarPreference(): ScaleBarConfig {
  return {
    enabled: true,
    color: '#f8fafc'
  }
}

function createCopy(isZh: boolean): SettingsCopy {
  if (isZh) {
    return {
      title: '工作区设置',
      sectionLabel: 'Section',
      reset: '恢复默认',
      applyDraft: '应用',
      language: '语言',
      languageSub: '界面语言与固定主题切换',
      shortcuts: '快捷键',
      shortcutsSub: '图像浏览与工具操作',
      windowPresets: '窗模板',
      windowPresetsSub: '系统预设与自定义模板',
      display: '显示',
      displaySub: '十字线、比例尺、ROI 统计与伪彩',
      shortcutsTitle: '快捷键矩阵',
      shortcutsDesc: '当前展示推荐快捷键布局。',
      editable: 'Editable Layout',
      navGroup: '视图导航',
      measureGroup: '标注测量',
      workspaceGroup: '工作区',
      items: '项',
      windowPresetsTitle: '窗模板',
      windowPresetsDesc: '用于快速应用窗宽窗位，不包含颜色配置。',
      systemPresets: '系统预设',
      customPresets: '我的预设',
      builtIn: '内置',
      custom: '自定义',
      emptyCustom: '还没有自定义窗模板',
      emptyCustomDesc: '在右侧填写名称和 WW/WL 后即可添加。',
      addCustom: '新增自定义窗模板',
      zhName: '中文名称',
      enName: '英文名称',
      ww: '窗宽 WW',
      wl: '窗位 WL',
      addTemplate: '添加模板',
      removeTemplate: '删除选中模板',
      exportSection: '导出',
      exportSectionSub: '格式和默认保存位置',
      exportTitle: '导出设置',
      exportDesc: '设置当前视图导出为 PNG 或 DICOM 时的默认保存位置。',
      exportMode: '导出方式',
      exportDefault: '默认位置',
      exportCustom: '自定义位置',
      exportCurrentLocation: '当前位置',
      exportChooseLocation: '选择位置',
      exportClearLocation: '清除自定义位置',
      exportChooseFailed: '无法打开位置选择器，请检查桌面端权限或重新启动应用后再试。',
      exportOpenLocation: '打开位置',
      exportOpenLocationFailed: '无法打开导出位置，请检查该路径是否存在。',
      exportDefaultBadge: '默认',
      exportCustomBadge: '自定义',
      exportDefaultHint: '使用系统默认下载目录。',
      exportCustomMissing: '尚未选择自定义导出位置。',
      exportCustomHint: '导出文件会保存到选择的文件夹。',
      exportUnsupportedHint: '当前环境不支持选择自定义目录，将使用默认下载方式。',
      exportDesktopMode: '导出的文件会保存到下方显示的位置。',
      exportFileNameTitle: '导出名称',
      exportIncludeAnnotations: '标注',
      exportIncludeDicomAnnotations: '导出标注',
      exportIncludeDicomMeasurements: '导出测量',
      exportIncludeMeasurements: '测量',
      exportIncludeOverlaysHint: '开启后，导出的图像中会携带该内容。',
      exportIncludePngAnnotations: '导出标注',
      exportIncludePngCornerInfo: '导出四角信息',
      exportIncludePngMeasurements: '导出测量',
      exportUseDefaultFileName: '使用默认名称',
      exportUseDefaultFileNameHint: '关闭后，每次导出前都会提示输入文件名。',
      exportFormats: '格式',
      exportWebMode: '导出文件会按照浏览器下载设置保存。',
      displayTitle: '显示样式',
      displayDesc: '在这里统一设置十字线、比例尺、ROI 统计项和默认伪彩。',
      scaleBarTitle: '比例尺',
      scaleBarDesc: '比例尺会跟随当前图像的 spacing、缩放和旋转实时更新。',
      scaleBarEnabled: '启用比例尺',
      scaleBarColor: '比例尺颜色',
      enabledLabel: '已启用',
      disabledLabel: '已关闭',
      scaleBarPreviewLabel: '预览显示的是当前比例尺样式，不影响实际长度计算。',
      roiStatsTitle: 'ROI 统计项',
      roiStatsDesc: '矩形、椭圆和自由选择 ROI 默认显示以下统计值。',
      themeDesc: '当前提供两套预设主题，不支持自由混搭颜色。',
      pseudocolor: '默认伪彩',
      crosshairViewport: 'MPR 视口',
      crosshairColor: '颜色',
      crosshairWidth: '线宽',
      thin: '细',
      bold: '粗',
      crosshairNote: '每个视口设置的是该视口对应截面的位置线颜色。',
      visualPreview: '十字线预览',
      languageTitle: '界面语言',
      themePresetTitle: '固定主题',
      zhCn: '简体中文',
      enUs: 'English',
      crosshairPreviewLabel: '预览中显示的是该视口内实际联动的两条十字线'
    }
  }

  return {
    title: 'Workspace Settings',
    sectionLabel: 'Section',
    reset: 'Reset',
    applyDraft: 'Apply',
    language: 'Language',
    languageSub: 'Language and preset themes',
    shortcuts: 'Shortcuts',
    shortcutsSub: 'Image browsing and tool actions',
    windowPresets: 'Window Templates',
    windowPresetsSub: 'Built-in and custom presets',
    display: 'Display',
    displaySub: 'Crosshair, scale bar, ROI stats, and pseudocolor',
    shortcutsTitle: 'Shortcut Matrix',
    shortcutsDesc: 'Current recommended shortcut layout.',
    editable: 'Editable Layout',
    navGroup: 'Navigation',
    measureGroup: 'Measurement',
    workspaceGroup: 'Workspace',
    items: 'items',
    windowPresetsTitle: 'Window Templates',
    windowPresetsDesc: 'Used for quickly applying WW/WL without extra color settings.',
    systemPresets: 'Built-in Presets',
    customPresets: 'My Presets',
    builtIn: 'Built-in',
    custom: 'Custom',
    emptyCustom: 'No custom window templates yet',
    emptyCustomDesc: 'Add one from the form on the right with name and WW/WL.',
    addCustom: 'Add Custom Window Template',
    zhName: 'Chinese Label',
    enName: 'English Label',
    ww: 'Window Width WW',
    wl: 'Window Level WL',
    addTemplate: 'Add Template',
    removeTemplate: 'Remove Selected',
    exportSection: 'Export',
    exportSectionSub: 'Formats and default save location',
    exportTitle: 'Export Settings',
    exportDesc: 'Set the default save location for exporting the current view as PNG or DICOM.',
    exportMode: 'Export Mode',
    exportDefault: 'Default Location',
    exportCustom: 'Custom Location',
    exportCurrentLocation: 'Current Location',
    exportChooseLocation: 'Choose Location',
    exportClearLocation: 'Clear Custom Location',
    exportChooseFailed: 'Could not open the location picker. Check desktop permissions or restart the app and try again.',
    exportOpenLocation: 'Open Location',
    exportOpenLocationFailed: 'Could not open the export location. Check whether the path exists.',
    exportDefaultBadge: 'Default',
    exportCustomBadge: 'Custom',
    exportDefaultHint: 'Use the system default downloads location.',
    exportCustomMissing: 'No custom export location selected.',
    exportCustomHint: 'Save exported files to a selected folder.',
    exportUnsupportedHint: 'This environment does not support picking a custom directory, so browser downloads will be used.',
    exportDesktopMode: 'Exported files are saved to the location shown below.',
    exportFileNameTitle: 'Export Name',
    exportIncludeAnnotations: 'Annotations',
    exportIncludeDicomAnnotations: 'Export annotations',
    exportIncludeDicomMeasurements: 'Export measurements',
    exportIncludeMeasurements: 'Measurements',
    exportIncludeOverlaysHint: 'When enabled, the exported image includes this content.',
    exportIncludePngAnnotations: 'Export annotations',
    exportIncludePngCornerInfo: 'Export corner info',
    exportIncludePngMeasurements: 'Export measurements',
    exportUseDefaultFileName: 'Use default name',
    exportUseDefaultFileNameHint: 'When disabled, each export prompts for a file name.',
    exportFormats: 'Formats',
    exportWebMode: 'Exported files are saved according to the browser download settings.',
    displayTitle: 'Display Style',
    displayDesc: 'Manage crosshair, scale bar, ROI stats, and pseudocolor in one place.',
    scaleBarTitle: 'Scale Bar',
    scaleBarDesc: 'The scale bar updates from the current spacing, zoom, and rotation.',
    scaleBarEnabled: 'Enable Scale Bar',
    scaleBarColor: 'Scale Bar Color',
    enabledLabel: 'Enabled',
    disabledLabel: 'Disabled',
    scaleBarPreviewLabel: 'The preview only shows the visual style. The real length is computed from the current view.',
    roiStatsTitle: 'ROI Statistics',
    roiStatsDesc: 'Rectangle, ellipse, and freehand ROI will show these statistics by default.',
    themeDesc: 'Choose between two preset themes instead of mixing colors freely.',
    pseudocolor: 'Default Pseudocolor',
    crosshairViewport: 'MPR Viewport',
    crosshairColor: 'Color',
    crosshairWidth: 'Thickness',
    thin: 'Thin',
    bold: 'Bold',
    crosshairNote: 'Each viewport sets the line color for its own plane.',
    visualPreview: 'Crosshair Preview',
    languageTitle: 'Interface Language',
    themePresetTitle: 'Preset Themes',
    zhCn: '简体中文',
    enUs: 'English',
    crosshairPreviewLabel: 'The preview shows the two linked lines that actually appear in this viewport'
  }
}

function createShortcutGroups(copyValue: SettingsCopy, isZh: boolean): Array<{ title: string; items: ShortcutItem[] }> {
  if (isZh) {
    return [
      {
        title: copyValue.navGroup,
        items: [
          { id: 'scroll-slice', action: '翻页', description: '鼠标滚轮上下翻动当前序列。', combo: 'Wheel' },
          { id: 'first-slice', action: '翻到首张图像', description: '直接跳到当前序列第一张图像。', combo: 'Home' },
          { id: 'last-slice', action: '翻到末张图像', description: '直接跳到当前序列最后一张图像。', combo: 'End' },
          { id: 'prev-slice', action: '向前一张', description: '向前移动 1 张图像。', combo: 'ArrowLeft' },
          { id: 'next-slice', action: '向后一张', description: '向后移动 1 张图像。', combo: 'ArrowRight' },
          { id: 'prev-ten-slices', action: '向前十张', description: '向前快速移动 10 张图像。', combo: 'Shift + ArrowLeft' },
          { id: 'next-ten-slices', action: '向后十张', description: '向后快速移动 10 张图像。', combo: 'Shift + ArrowRight' },
          { id: 'window-level', action: '调窗', description: '按下滚轮并滑动以调整窗宽窗位。', combo: 'Wheel + Drag' },
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
        { id: 'scroll-slice', action: 'Scroll Slice', description: 'Use the wheel to move through the current series.', combo: 'Wheel' },
        { id: 'first-slice', action: 'First Image', description: 'Jump to the first image in the current series.', combo: 'Home' },
        { id: 'last-slice', action: 'Last Image', description: 'Jump to the last image in the current series.', combo: 'End' },
        { id: 'prev-slice', action: 'Previous Image', description: 'Move back by one image.', combo: 'ArrowLeft' },
        { id: 'next-slice', action: 'Next Image', description: 'Move forward by one image.', combo: 'ArrowRight' },
        { id: 'prev-ten-slices', action: 'Previous 10 Images', description: 'Move back by ten images quickly.', combo: 'Shift + ArrowLeft' },
        { id: 'next-ten-slices', action: 'Next 10 Images', description: 'Move forward by ten images quickly.', combo: 'Shift + ArrowRight' },
        { id: 'window-level', action: 'Window Level', description: 'Hold the wheel button and drag to adjust WW/WL.', combo: 'Wheel + Drag' },
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

const { locale } = useUiLocale()
const {
  locale: globalLocale,
  setLocale,
  addCustomWindowPreset,
  crosshairConfigs,
  exportPreference,
  getWindowPresetLabel,
  removeCustomWindowPreset,
  roiStatOptions,
  scaleBarPreference,
  selectedPseudocolorKey,
  selectedWindowPresetId,
  setCrosshairConfigs,
  setExportPreference,
  setScaleBarPreference,
  systemWindowPresets,
  setRoiStatOptions,
  themeId,
  windowPresets
} = useUiPreferences()

const activeSection = ref<SettingsSection>('language')
const customPresetZhName = ref('')
const customPresetEnName = ref('')
const customPresetWw = ref('400')
const customPresetWl = ref('40')
const defaultExportLocationLabel = ref('')
const canPickCustomExportLocation = ref(canChooseCustomExportDirectory())
const exportLocationError = ref('')
const isChoosingExportLocation = ref(false)

const isZh = computed(() => locale.value === 'zh-CN')
const copy = computed(() => createCopy(isZh.value))
const sections = computed(() => [
  { key: 'language' as const, title: copy.value.language, subtitle: copy.value.languageSub, icon: 'language' },
  { key: 'shortcuts' as const, title: copy.value.shortcuts, subtitle: copy.value.shortcutsSub, icon: 'keyboard' },
  { key: 'windowPresets' as const, title: copy.value.windowPresets, subtitle: copy.value.windowPresetsSub, icon: 'contrast' },
  { key: 'export' as const, title: copy.value.exportSection ?? 'Export', subtitle: copy.value.exportSectionSub ?? 'Formats and default save location', icon: 'export' },
  { key: 'display' as const, title: copy.value.display, subtitle: copy.value.displaySub, icon: 'crosshair' }
])
const shortcutGroups = computed(() => createShortcutGroups(copy.value, isZh.value))
const currentSectionTitle = computed(() => sections.value.find((item) => item.key === activeSection.value)?.title ?? copy.value.title)
const currentSectionSubtitle = computed(() => sections.value.find((item) => item.key === activeSection.value)?.subtitle ?? '')
const selectedWindowPreset = computed(() => windowPresets.value.find((preset) => preset.id === selectedWindowPresetId.value) ?? windowPresets.value[0] ?? null)
const canRemoveSelectedCustomPreset = computed(() => selectedWindowPreset.value?.source === 'custom')
const displayCustomWindowPresets = computed(() => windowPresets.value.filter((preset) => preset.source === 'custom'))

function getThemeSummary(theme: ThemePreset): string {
  return isZh.value ? theme.summaryZh : theme.summaryEn
}

function getThemeLabel(theme: ThemePreset): string {
  return isZh.value ? theme.labelZh : theme.labelEn
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

function resetLanguageSection(): void {
  setLocale('zh-CN')
  themeId.value = DEFAULT_THEME_ID
}

function resetWindowPresetSection(): void {
  selectedWindowPresetId.value = systemWindowPresets[0]?.id ?? 'lung'
  customPresetZhName.value = ''
  customPresetEnName.value = ''
  customPresetWw.value = '400'
  customPresetWl.value = '40'
}

function resetExportSection(): void {
  setExportPreference({
    ...exportPreference.value,
    locationMode: 'default',
    desktopDirectory: null,
    webDirectoryName: null
  })
  if (viewerRuntime.platform === 'web') {
    void clearStoredWebExportDirectory()
  }
}

function resetDisplaySection(): void {
  selectedPseudocolorKey.value = DEFAULT_PSEUDOCOLOR_KEY
  setRoiStatOptions(createDefaultRoiStatOptions())
  setCrosshairConfigs(createDefaultCrosshairConfigs())
  setScaleBarPreference(createDefaultScaleBarPreference())
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
  if (activeSection.value === 'export') {
    resetExportSection()
    return
  }
  if (activeSection.value === 'display') {
    resetDisplaySection()
  }
}

function handleLocaleChange(nextLocale: AppLocale): void {
  setLocale(nextLocale)
}

function handleAddCustomWindowPreset(): void {
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

function handleRemoveSelectedCustomWindowPreset(): void {
  if (!selectedWindowPreset.value || selectedWindowPreset.value.source !== 'custom') {
    return
  }

  removeCustomWindowPreset(selectedWindowPreset.value.id)
  selectedWindowPresetId.value = systemWindowPresets[0]?.id ?? 'lung'
}

const exportLocationLabel = computed(() => {
  if (exportPreference.value.locationMode === 'custom') {
    return viewerRuntime.platform === 'desktop'
      ? exportPreference.value.desktopDirectory || copy.value.exportCustomMissing || 'No custom export location selected.'
      : exportPreference.value.webDirectoryName || copy.value.exportCustomMissing || 'No custom export location selected.'
  }

  return defaultExportLocationLabel.value || copy.value.exportDefaultHint || 'Default downloads location'
})

const customExportLocationLabel = computed(() =>
  viewerRuntime.platform === 'desktop'
    ? exportPreference.value.desktopDirectory || copy.value.exportCustomMissing || 'No custom export location selected.'
    : exportPreference.value.webDirectoryName || copy.value.exportCustomMissing || 'No custom export location selected.'
)

const exportCustomLocationHint = computed(() => {
  if (!canPickCustomExportLocation.value) {
    return copy.value.exportUnsupportedHint ?? 'This environment does not support picking a custom directory, so browser downloads will be used.'
  }

  return copy.value.exportCustomHint ?? 'Save exported files to a selected folder.'
})

const exportLocationDescription = computed(() =>
  viewerRuntime.platform === 'desktop'
    ? copy.value.exportDesktopMode ?? 'Exported files are saved to the location shown below.'
    : copy.value.exportWebMode ?? 'Exported files are saved according to the browser download settings.'
)
const canOpenDefaultExportLocation = computed(
  () => viewerRuntime.platform === 'desktop' && exportPreference.value.locationMode === 'default' && Boolean(defaultExportLocationLabel.value)
)

function handleSelectCustomExportMode(): void {
  exportLocationError.value = ''
  setExportPreference({
    ...exportPreference.value,
    locationMode: 'custom'
  })
}

async function handleChooseExportLocation(): Promise<void> {
  exportLocationError.value = ''
  isChoosingExportLocation.value = true

  try {
    const selectedDirectory = await chooseCustomExportDirectory()
    if (!selectedDirectory) {
      return
    }

    setExportPreference({
      ...exportPreference.value,
      locationMode: 'custom',
      desktopDirectory: selectedDirectory.desktopDirectory ?? exportPreference.value.desktopDirectory,
      webDirectoryName: selectedDirectory.webDirectoryName ?? exportPreference.value.webDirectoryName
    })
  } catch (error) {
    console.error('Failed to choose export location.', error)
    exportLocationError.value = copy.value.exportChooseFailed ?? 'Could not open the location picker. Check desktop permissions or restart the app and try again.'
  } finally {
    isChoosingExportLocation.value = false
  }
}

async function handleOpenDefaultExportLocation(): Promise<void> {
  if (!defaultExportLocationLabel.value) {
    return
  }

  exportLocationError.value = ''
  const opened = await openExportLocation({
    directoryPath: defaultExportLocationLabel.value
  })
  if (!opened) {
    exportLocationError.value = copy.value.exportOpenLocationFailed ?? 'Could not open the export location. Check whether the path exists.'
  }
}

function updateExportOverlayPreference(
  format: 'png' | 'dicom',
  kind: 'measurements' | 'annotations' | 'cornerInfo',
  enabled: boolean
): void {
  setExportPreference({
    ...exportPreference.value,
    includeDicomAnnotations:
      format === 'dicom' && kind === 'annotations' ? enabled : exportPreference.value.includeDicomAnnotations,
    includeDicomMeasurements:
      format === 'dicom' && kind === 'measurements' ? enabled : exportPreference.value.includeDicomMeasurements,
    includePngAnnotations:
      format === 'png' && kind === 'annotations' ? enabled : exportPreference.value.includePngAnnotations,
    includePngCornerInfo:
      format === 'png' && kind === 'cornerInfo' ? enabled : exportPreference.value.includePngCornerInfo,
    includePngMeasurements:
      format === 'png' && kind === 'measurements' ? enabled : exportPreference.value.includePngMeasurements
  })
}

function updateUseDefaultFileName(enabled: boolean): void {
  setExportPreference({
    ...exportPreference.value,
    useDefaultFileName: enabled
  })
}

async function handleClearExportLocation(): Promise<void> {
  exportLocationError.value = ''
  if (viewerRuntime.platform === 'web') {
    await clearStoredWebExportDirectory()
  }
  resetExportSection()
}

onMounted(async () => {
  try {
    defaultExportLocationLabel.value = await getDefaultExportLocationLabel()
  } catch (error) {
    console.error('Failed to resolve default export location.', error)
    defaultExportLocationLabel.value = ''
  }
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-[1300] flex items-center justify-center bg-[radial-gradient(circle_at_top,color-mix(in_srgb,var(--theme-accent)_16%,transparent),transparent_38%),rgba(3,8,15,0.42)] px-4 py-6 backdrop-blur-[8px]"
      @click.self="emit('close')"
    >
      <div class="theme-shell-panel relative flex h-[min(92vh,860px)] w-full max-w-[1180px] flex-col overflow-hidden rounded-[34px] border shadow-[0_36px_96px_rgba(0,0,0,0.5)]">
        <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,color-mix(in_srgb,var(--theme-accent)_14%,transparent),transparent_26%),radial-gradient(circle_at_bottom_left,color-mix(in_srgb,var(--theme-accent-warm)_12%,transparent),transparent_22%)]"></div>
        <div class="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[color:color-mix(in_srgb,var(--theme-text-primary)_40%,transparent)] to-transparent"></div>

        <div class="relative flex items-start justify-between gap-4 border-b border-[var(--theme-border-soft)] px-7 py-6">
          <div class="min-w-0">
            <div class="flex items-center gap-3">
              <div class="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--theme-border-strong)] bg-[color:color-mix(in_srgb,var(--theme-accent)_10%,transparent)] text-[var(--theme-text-primary)]">
                <AppIcon name="settings" :size="20" />
              </div>
              <div class="text-xl font-semibold tracking-[0.04em] text-[var(--theme-text-primary)]">{{ copy.title }}</div>
            </div>
          </div>
          <button type="button" class="theme-button-secondary flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition hover:brightness-110" :aria-label="copy.title" @click="emit('close')">
            <AppIcon name="close" :size="16" />
          </button>
        </div>

        <div class="relative grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside class="theme-shell-panel-soft settings-nav-scroll min-h-0 overflow-auto border-b px-5 py-5 lg:border-b-0 lg:border-r">
            <div class="space-y-3">
              <button
                v-for="section in sections"
                :key="section.key"
                type="button"
                class="group flex w-full items-start gap-3 rounded-[22px] border px-4 py-4 text-left transition duration-150"
                :class="section.key === activeSection ? 'border-[var(--theme-border-strong)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--theme-accent)_18%,transparent),color-mix(in_srgb,var(--theme-accent-warm)_10%,transparent))] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_16px_28px_rgba(0,0,0,0.16)]' : 'theme-card-soft border hover:border-[var(--theme-border-strong)]'"
                @click="activeSection = section.key"
              >
                <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition" :class="section.key === activeSection ? 'border-[var(--theme-border-strong)] bg-[color:color-mix(in_srgb,var(--theme-accent)_12%,transparent)] text-[var(--theme-text-primary)]' : 'border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] text-[var(--theme-text-secondary)] group-hover:text-[var(--theme-text-primary)]'">
                  <AppIcon :name="section.icon" :size="18" />
                </div>
                <div class="min-w-0">
                  <div class="text-sm font-semibold" :class="section.key === activeSection ? 'text-[var(--theme-text-primary)]' : 'text-[var(--theme-text-primary)]'">{{ section.title }}</div>
                  <div class="mt-1 text-xs leading-5" :class="section.key === activeSection ? 'text-[var(--theme-text-secondary)]' : 'text-[var(--theme-text-muted)]'">{{ section.subtitle }}</div>
                </div>
              </button>
            </div>
          </aside>

          <section class="flex min-h-0 flex-col overflow-hidden px-6 py-5 lg:px-7">
            <div class="mb-5 flex shrink-0 items-end justify-between gap-4">
              <div class="min-w-0">
                <div class="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--theme-text-muted)]">{{ copy.sectionLabel }}</div>
                <div class="mt-2 text-2xl font-semibold tracking-[0.04em] text-[var(--theme-text-primary)]">{{ currentSectionTitle }}</div>
                <div v-if="currentSectionSubtitle" class="mt-1 text-sm text-[var(--theme-text-muted)]">{{ currentSectionSubtitle }}</div>
              </div>
              <div class="hidden items-center gap-2 md:flex">
                <button type="button" class="theme-button-secondary rounded-2xl border px-4 py-2 text-sm font-medium transition hover:brightness-110" @click="resetCurrentSection">{{ copy.reset }}</button>
                <button type="button" class="theme-button-primary rounded-2xl border px-4 py-2 text-sm font-semibold transition hover:brightness-110">{{ copy.applyDraft }}</button>
              </div>
            </div>

            <div class="settings-content-scroll min-h-0 flex-1 overflow-auto pr-2">
              <div class="space-y-5 pb-12">
                <template v-if="activeSection === 'language'">
                  <div class="grid gap-5 xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)]">
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
                      <div class="mb-4 text-sm text-[var(--theme-text-secondary)]">{{ copy.themeDesc }}</div>
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
                        <div class="mt-1 text-sm text-[var(--theme-text-secondary)]">{{ copy.shortcutsDesc }}</div>
                      </div>
                      <span class="rounded-full border border-[var(--theme-border-strong)] bg-[color:color-mix(in_srgb,var(--theme-accent)_10%,transparent)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:color-mix(in_srgb,var(--theme-text-primary)_72%,var(--theme-accent))]">{{ copy.editable }}</span>
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
                              <span class="rounded-full border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--theme-text-secondary)]">{{ displayCustomWindowPresets.length }}</span>
                              <button type="button" class="theme-button-secondary rounded-2xl px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50" :disabled="!canRemoveSelectedCustomPreset" @click="handleRemoveSelectedCustomWindowPreset">{{ copy.removeTemplate }}</button>
                            </div>
                          </div>
                          <div v-if="displayCustomWindowPresets.length" class="space-y-2">
                            <button
                              v-for="preset in displayCustomWindowPresets"
                              :key="preset.id"
                              type="button"
                              class="flex w-full items-center justify-between gap-3 rounded-[18px] border px-4 py-3 text-left transition duration-150"
                              :class="selectedWindowPresetId === preset.id ? 'border-[var(--theme-border-strong)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--theme-accent)_18%,transparent),color-mix(in_srgb,var(--theme-accent-warm)_10%,transparent))]' : 'border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] hover:border-[var(--theme-border-strong)] hover:bg-[var(--theme-surface-card-soft)]'"
                              @click="selectedWindowPresetId = preset.id"
                            >
                              <div class="min-w-0">
                                <div class="truncate text-sm font-semibold text-[var(--theme-text-primary)]">{{ getWindowPresetLabel(preset) }}</div>
                                <div class="mt-1 text-xs text-[var(--theme-text-secondary)]">WW {{ preset.ww }} / WL {{ preset.wl }}</div>
                              </div>
                            </button>
                          </div>
                          <div v-else class="rounded-[20px] border border-dashed border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] px-4 py-4 text-xs leading-6 text-[var(--theme-text-secondary)]">
                            <div class="font-medium text-[var(--theme-text-primary)]">{{ copy.emptyCustom }}</div>
                            <div class="mt-1">{{ copy.emptyCustomDesc }}</div>
                          </div>
                        </div>
                      </div>

                      <div class="theme-card-soft rounded-[24px] p-4">
                        <div class="mb-3 text-sm font-semibold text-[var(--theme-text-primary)]">{{ copy.addCustom }}</div>
                        <div class="grid gap-3 md:grid-cols-2">
                          <label class="block">
                            <span class="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--theme-text-muted)]">{{ copy.zhName }}</span>
                            <input v-model="customPresetZhName" type="text" class="w-full rounded-2xl border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] px-4 py-3 text-sm text-[var(--theme-text-primary)] outline-none transition placeholder:text-[var(--theme-text-muted)] focus:border-[var(--theme-border-strong)]" :placeholder="copy.zhName" />
                          </label>
                          <label class="block">
                            <span class="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--theme-text-muted)]">{{ copy.enName }}</span>
                            <input v-model="customPresetEnName" type="text" class="w-full rounded-2xl border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] px-4 py-3 text-sm text-[var(--theme-text-primary)] outline-none transition placeholder:text-[var(--theme-text-muted)] focus:border-[var(--theme-border-strong)]" :placeholder="copy.enName" />
                          </label>
                          <label class="block">
                            <span class="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--theme-text-muted)]">{{ copy.ww }}</span>
                            <input v-model="customPresetWw" type="number" class="w-full rounded-2xl border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] px-4 py-3 text-sm text-[var(--theme-text-primary)] outline-none transition placeholder:text-[var(--theme-text-muted)] focus:border-[var(--theme-border-strong)]" />
                          </label>
                          <label class="block">
                            <span class="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--theme-text-muted)]">{{ copy.wl }}</span>
                            <input v-model="customPresetWl" type="number" class="w-full rounded-2xl border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] px-4 py-3 text-sm text-[var(--theme-text-primary)] outline-none transition placeholder:text-[var(--theme-text-muted)] focus:border-[var(--theme-border-strong)]" />
                          </label>
                        </div>

                        <div class="mt-4 flex flex-wrap gap-2">
                          <button type="button" class="theme-button-primary rounded-2xl px-4 py-2 text-sm font-semibold" @click="handleAddCustomWindowPreset">{{ copy.addTemplate }}</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </template>

                <template v-else-if="activeSection === 'export'">
                  <div class="space-y-5">
                    <section class="overflow-hidden rounded-[28px] border border-[var(--theme-border-soft)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--theme-surface-panel-strong)_88%,black),color-mix(in_srgb,var(--theme-surface-card)_82%,black))]">
                      <div class="flex flex-col gap-5 border-b border-[var(--theme-border-soft)] px-5 py-5 md:flex-row md:items-start md:justify-between">
                        <div class="min-w-0">
                          <div class="flex items-center gap-2 text-[var(--theme-text-primary)]">
                            <span class="grid h-10 w-10 place-items-center rounded-2xl border border-[color:color-mix(in_srgb,var(--theme-accent)_28%,var(--theme-border-soft))] bg-[color:color-mix(in_srgb,var(--theme-accent)_13%,transparent)] text-[var(--theme-accent)]">
                              <AppIcon name="export" :size="20" />
                            </span>
                            <div>
                              <div class="text-lg font-semibold">{{ copy.exportTitle ?? 'Export Settings' }}</div>
                              <div class="mt-1 text-xs leading-5 text-[var(--theme-text-secondary)]">{{ copy.exportDesc ?? 'Set the default save location for exporting the current view as PNG or DICOM.' }}</div>
                            </div>
                          </div>
                        </div>

                        <div class="flex shrink-0 rounded-2xl border border-[var(--theme-border-soft)] bg-[var(--theme-surface-panel)] p-1">
                          <button
                            type="button"
                            class="min-w-24 rounded-xl px-3 py-2 text-xs font-semibold transition"
                            :class="exportPreference.locationMode === 'default' ? 'bg-[var(--theme-surface-card-soft)] text-[var(--theme-text-primary)] shadow-[0_8px_18px_rgba(0,0,0,0.18)]' : 'text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)]'"
                            @click="setExportPreference({ ...exportPreference, locationMode: 'default' })"
                          >
                            {{ copy.exportDefaultBadge ?? 'Default' }}
                          </button>
                          <button
                            type="button"
                            class="min-w-24 rounded-xl px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
                            :disabled="!canPickCustomExportLocation"
                            :class="exportPreference.locationMode === 'custom' ? 'bg-[var(--theme-surface-card-soft)] text-[var(--theme-text-primary)] shadow-[0_8px_18px_rgba(0,0,0,0.18)]' : 'text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)]'"
                            @click="handleSelectCustomExportMode"
                          >
                            {{ copy.exportCustomBadge ?? 'Custom' }}
                          </button>
                        </div>
                      </div>

                      <div class="grid gap-0 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                        <div class="space-y-4 border-b border-[var(--theme-border-soft)] p-5 xl:border-b-0 xl:border-r">
                          <div class="grid gap-3 sm:grid-cols-2">
                            <button
                              type="button"
                              class="group min-h-[138px] rounded-[22px] border px-4 py-4 text-left transition duration-150"
                              :class="exportPreference.locationMode === 'default' ? 'border-[color:color-mix(in_srgb,var(--theme-accent)_58%,var(--theme-border-strong))] bg-[color:color-mix(in_srgb,var(--theme-accent)_12%,var(--theme-surface-card))]' : 'border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] hover:border-[var(--theme-border-strong)] hover:bg-[var(--theme-surface-card-soft)]'"
                              @click="setExportPreference({ ...exportPreference, locationMode: 'default' })"
                            >
                              <div class="flex h-full flex-col justify-between gap-4">
                                <div>
                                  <div class="flex items-center justify-between gap-3">
                                    <div class="text-sm font-semibold text-[var(--theme-text-primary)]">{{ copy.exportDefault ?? 'Default Location' }}</div>
                                    <span
                                      class="h-3 w-3 rounded-full border"
                                      :class="exportPreference.locationMode === 'default' ? 'border-[var(--theme-accent)] bg-[var(--theme-accent)] shadow-[0_0_0_4px_color-mix(in_srgb,var(--theme-accent)_18%,transparent)]' : 'border-[var(--theme-border-strong)] bg-transparent'"
                                    ></span>
                                  </div>
                                  <div class="mt-2 text-xs leading-5 text-[var(--theme-text-secondary)]">{{ copy.exportDefaultHint ?? 'Use the system default downloads location.' }}</div>
                                </div>
                                <div v-if="defaultExportLocationLabel" class="line-clamp-2 break-all text-[11px] font-medium text-[var(--theme-text-muted)]">
                                  {{ defaultExportLocationLabel }}
                                </div>
                              </div>
                            </button>

                            <button
                              type="button"
                              class="group min-h-[138px] rounded-[22px] border px-4 py-4 text-left transition duration-150 disabled:cursor-not-allowed disabled:opacity-60"
                              :disabled="!canPickCustomExportLocation"
                              :class="exportPreference.locationMode === 'custom' ? 'border-[color:color-mix(in_srgb,var(--theme-accent)_58%,var(--theme-border-strong))] bg-[color:color-mix(in_srgb,var(--theme-accent)_12%,var(--theme-surface-card))]' : 'border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] hover:border-[var(--theme-border-strong)] hover:bg-[var(--theme-surface-card-soft)]'"
                              @click="handleSelectCustomExportMode"
                            >
                              <div class="flex h-full flex-col justify-between gap-4">
                                <div>
                                  <div class="flex items-center justify-between gap-3">
                                    <div class="text-sm font-semibold text-[var(--theme-text-primary)]">{{ copy.exportCustom ?? 'Custom Location' }}</div>
                                    <span
                                      class="h-3 w-3 rounded-full border"
                                      :class="exportPreference.locationMode === 'custom' ? 'border-[var(--theme-accent)] bg-[var(--theme-accent)] shadow-[0_0_0_4px_color-mix(in_srgb,var(--theme-accent)_18%,transparent)]' : 'border-[var(--theme-border-strong)] bg-transparent'"
                                    ></span>
                                  </div>
                                  <div class="mt-2 text-xs leading-5 text-[var(--theme-text-secondary)]">{{ exportCustomLocationHint }}</div>
                                </div>
                                <div class="line-clamp-2 break-all text-[11px] font-medium text-[var(--theme-text-muted)]">
                                  {{ customExportLocationLabel }}
                                </div>
                              </div>
                            </button>
                          </div>

                          <div class="rounded-[22px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-panel)] px-4 py-4">
                            <div class="flex flex-col gap-4">
                              <div class="min-w-0">
                                <div class="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--theme-text-muted)]">{{ copy.exportCurrentLocation ?? 'Current Location' }}</div>
                                <div class="mt-2 max-w-full break-words text-sm font-medium leading-6 text-[var(--theme-text-primary)] [overflow-wrap:anywhere]">{{ exportLocationLabel }}</div>
                                <div class="mt-2 text-xs leading-6 text-[var(--theme-text-secondary)]">{{ exportLocationDescription }}</div>
                              </div>
                              <div class="flex flex-wrap gap-2">
                                <button
                                  v-if="canOpenDefaultExportLocation"
                                  type="button"
                                  class="theme-button-primary min-w-[150px] rounded-2xl px-4 py-2 text-sm font-semibold"
                                  @click="handleOpenDefaultExportLocation"
                                >
                                  {{ copy.exportOpenLocation ?? 'Open Location' }}
                                </button>
                                <template v-if="exportPreference.locationMode === 'custom'">
                                  <button
                                    type="button"
                                    class="theme-button-primary min-w-[150px] rounded-2xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                                    :disabled="!canPickCustomExportLocation || isChoosingExportLocation"
                                    @click="handleChooseExportLocation"
                                  >
                                    {{ isChoosingExportLocation ? (isZh ? '正在选择...' : 'Choosing...') : copy.exportChooseLocation ?? 'Choose Location' }}
                                  </button>
                                  <button
                                    type="button"
                                    class="theme-button-secondary min-w-[170px] rounded-2xl px-4 py-2 text-sm font-medium"
                                    @click="handleClearExportLocation"
                                  >
                                    {{ copy.exportClearLocation ?? 'Clear Custom Location' }}
                                  </button>
                                </template>
                              </div>
                            </div>
                            <div
                              v-if="exportLocationError"
                              class="mt-3 rounded-[16px] border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs leading-6 text-red-100"
                            >
                              {{ exportLocationError }}
                            </div>
                          </div>

                          <label class="flex cursor-pointer items-center justify-between gap-4 rounded-[22px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] px-4 py-4 transition hover:border-[var(--theme-border-strong)]">
                            <span class="min-w-0">
                              <span class="block text-sm font-semibold text-[var(--theme-text-primary)]">{{ copy.exportFileNameTitle ?? 'Export Name' }}</span>
                              <span class="mt-1 block text-xs leading-5 text-[var(--theme-text-secondary)]">{{ copy.exportUseDefaultFileNameHint ?? 'When disabled, each export prompts for a file name.' }}</span>
                            </span>
                            <span class="relative h-7 w-12 shrink-0 rounded-full border border-[var(--theme-border-soft)] transition" :class="exportPreference.useDefaultFileName ? 'bg-[var(--theme-accent)]' : 'bg-[var(--theme-surface-panel-strong)]'">
                              <input
                                type="checkbox"
                                class="peer sr-only"
                                :checked="exportPreference.useDefaultFileName"
                                @change="updateUseDefaultFileName(($event.target as HTMLInputElement).checked)"
                              />
                              <span class="absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5"></span>
                            </span>
                          </label>
                        </div>

                        <div class="p-5">
                          <div class="mb-4 flex items-center justify-between gap-3">
                            <div>
                              <div class="text-sm font-semibold text-[var(--theme-text-primary)]">{{ copy.exportFormats ?? 'Formats' }}</div>
                              <div class="mt-1 text-xs leading-5 text-[var(--theme-text-secondary)]">{{ copy.exportIncludeOverlaysHint ?? 'When enabled, the exported image includes this content.' }}</div>
                            </div>
                          </div>

                          <div class="grid gap-4 md:grid-cols-2">
                            <div class="rounded-[24px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] p-4">
                              <div class="mb-4 flex items-center justify-between gap-3">
                                <div>
                                  <div class="text-base font-semibold text-[var(--theme-text-primary)]">PNG</div>
                                  <div class="mt-1 text-xs text-[var(--theme-text-muted)]">F10</div>
                                </div>
                                <span class="rounded-full border border-[color:color-mix(in_srgb,var(--theme-accent)_26%,var(--theme-border-soft))] bg-[color:color-mix(in_srgb,var(--theme-accent)_10%,transparent)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--theme-text-secondary)]">image</span>
                              </div>
                              <div class="space-y-2">
                                <label class="flex cursor-pointer items-center justify-between gap-3 rounded-[16px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-panel)] px-3 py-3 transition hover:border-[var(--theme-border-strong)]">
                                  <span class="text-xs font-semibold text-[var(--theme-text-primary)]">{{ copy.exportIncludePngMeasurements ?? 'Export measurements' }}</span>
                                  <input
                                    type="checkbox"
                                    class="h-4 w-4 rounded border-[var(--theme-border-soft)] accent-[var(--theme-accent)]"
                                    :checked="exportPreference.includePngMeasurements"
                                    @change="updateExportOverlayPreference('png', 'measurements', ($event.target as HTMLInputElement).checked)"
                                  />
                                </label>
                                <label class="flex cursor-pointer items-center justify-between gap-3 rounded-[16px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-panel)] px-3 py-3 transition hover:border-[var(--theme-border-strong)]">
                                  <span class="text-xs font-semibold text-[var(--theme-text-primary)]">{{ copy.exportIncludePngAnnotations ?? 'Export annotations' }}</span>
                                  <input
                                    type="checkbox"
                                    class="h-4 w-4 rounded border-[var(--theme-border-soft)] accent-[var(--theme-accent)]"
                                    :checked="exportPreference.includePngAnnotations"
                                    @change="updateExportOverlayPreference('png', 'annotations', ($event.target as HTMLInputElement).checked)"
                                  />
                                </label>
                                <label class="flex cursor-pointer items-center justify-between gap-3 rounded-[16px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-panel)] px-3 py-3 transition hover:border-[var(--theme-border-strong)]">
                                  <span class="text-xs font-semibold text-[var(--theme-text-primary)]">{{ copy.exportIncludePngCornerInfo ?? 'Export corner info' }}</span>
                                  <input
                                    type="checkbox"
                                    class="h-4 w-4 rounded border-[var(--theme-border-soft)] accent-[var(--theme-accent)]"
                                    :checked="exportPreference.includePngCornerInfo"
                                    @change="updateExportOverlayPreference('png', 'cornerInfo', ($event.target as HTMLInputElement).checked)"
                                  />
                                </label>
                              </div>
                            </div>

                            <div class="rounded-[24px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] p-4">
                              <div class="mb-4 flex items-center justify-between gap-3">
                                <div>
                                  <div class="text-base font-semibold text-[var(--theme-text-primary)]">DICOM</div>
                                  <div class="mt-1 text-xs text-[var(--theme-text-muted)]">F11</div>
                                </div>
                                <span class="rounded-full border border-[color:color-mix(in_srgb,var(--theme-accent-warm)_28%,var(--theme-border-soft))] bg-[color:color-mix(in_srgb,var(--theme-accent-warm)_10%,transparent)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--theme-text-secondary)]">dataset</span>
                              </div>
                              <div class="space-y-2">
                                <label class="flex cursor-pointer items-center justify-between gap-3 rounded-[16px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-panel)] px-3 py-3 transition hover:border-[var(--theme-border-strong)]">
                                  <span class="text-xs font-semibold text-[var(--theme-text-primary)]">{{ copy.exportIncludeDicomMeasurements ?? 'Export measurements' }}</span>
                                  <input
                                    type="checkbox"
                                    class="h-4 w-4 rounded border-[var(--theme-border-soft)] accent-[var(--theme-accent)]"
                                    :checked="exportPreference.includeDicomMeasurements"
                                    @change="updateExportOverlayPreference('dicom', 'measurements', ($event.target as HTMLInputElement).checked)"
                                  />
                                </label>
                                <label class="flex cursor-pointer items-center justify-between gap-3 rounded-[16px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-panel)] px-3 py-3 transition hover:border-[var(--theme-border-strong)]">
                                  <span class="text-xs font-semibold text-[var(--theme-text-primary)]">{{ copy.exportIncludeDicomAnnotations ?? 'Export annotations' }}</span>
                                  <input
                                    type="checkbox"
                                    class="h-4 w-4 rounded border-[var(--theme-border-soft)] accent-[var(--theme-accent)]"
                                    :checked="exportPreference.includeDicomAnnotations"
                                    @change="updateExportOverlayPreference('dicom', 'annotations', ($event.target as HTMLInputElement).checked)"
                                  />
                                </label>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </section>
                  </div>
                </template>

                <template v-else>
                  <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    <div class="space-y-5">
                      <div class="theme-card-soft rounded-[28px] p-5">
                        <div class="mb-4 flex items-center gap-2 text-[var(--theme-text-primary)]">
                          <AppIcon name="crosshair" :size="18" />
                          <span class="text-lg font-semibold">{{ copy.displayTitle }}</span>
                        </div>
                        <div class="mb-5 text-sm text-[var(--theme-text-secondary)]">{{ copy.displayDesc }}</div>

                        <div class="space-y-4">
                          <div
                            v-for="config in crosshairConfigs"
                            :key="config.key"
                            class="theme-card-soft rounded-[20px] p-4"
                          >
                            <div class="mb-3 flex items-center justify-between gap-3">
                              <div>
                                <div class="text-sm font-semibold text-[var(--theme-text-primary)]">{{ copy.crosshairViewport }} {{ config.label }}</div>
                                <div class="mt-1 text-xs text-[var(--theme-text-secondary)]">{{ copy.crosshairNote }}</div>
                              </div>
                              <span class="rounded-full border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--theme-text-secondary)]">{{ config.label }}</span>
                            </div>

                            <div class="grid gap-4 md:grid-cols-2">
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

                      <div class="theme-card-soft rounded-[24px] p-4">
                        <div class="mb-4 flex items-center gap-2 text-[var(--theme-text-primary)]">
                          <AppIcon name="measure" :size="18" />
                          <span class="text-sm font-semibold">{{ copy.scaleBarTitle }}</span>
                        </div>
                        <div class="mb-4 text-xs leading-6 text-[var(--theme-text-secondary)]">{{ copy.scaleBarDesc }}</div>

                        <div class="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(220px,0.72fr)]">
                          <label class="block">
                            <span class="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--theme-text-muted)]">{{ copy.scaleBarEnabled }}</span>
                            <div class="rounded-[18px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-panel-strong)] px-4 py-4">
                              <label class="flex cursor-pointer items-center justify-between gap-3">
                                <div>
                                  <div class="text-sm font-medium text-[var(--theme-text-primary)]">{{ copy.scaleBarEnabled }}</div>
                                  <div class="mt-1 text-xs text-[var(--theme-text-secondary)]">
                                    {{ scaleBarPreference.enabled ? copy.enabledLabel : copy.disabledLabel }}
                                  </div>
                                </div>
                                <input
                                  v-model="scaleBarPreference.enabled"
                                  type="checkbox"
                                  class="h-4 w-4 rounded border-[var(--theme-border-soft)] accent-[var(--theme-accent)]"
                                />
                              </label>
                            </div>
                          </label>

                          <label class="block">
                            <span class="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--theme-text-muted)]">{{ copy.scaleBarColor }}</span>
                            <div class="rounded-[18px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-panel-strong)] px-3 py-3">
                              <div class="flex items-center gap-3">
                                <input v-model="scaleBarPreference.color" type="color" class="h-10 w-12 cursor-pointer rounded-xl border border-[var(--theme-border-soft)] bg-transparent" />
                                <div class="min-w-0">
                                  <div class="text-sm font-medium text-[var(--theme-text-primary)]">{{ scaleBarPreference.color }}</div>
                                </div>
                              </div>
                              <div class="mt-3 flex flex-wrap gap-2">
                                <button
                                  v-for="preset in scaleBarColorPresets"
                                  :key="preset.value"
                                  type="button"
                                  class="flex h-8 w-8 items-center justify-center rounded-full border transition duration-150"
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
                          </label>
                        </div>

                        <div class="mt-4 rounded-[20px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-panel-strong)] p-4">
                          <div class="mb-3 text-xs leading-6 text-[var(--theme-text-secondary)]">{{ copy.scaleBarPreviewLabel }}</div>
                            <div class="relative h-20 overflow-hidden rounded-[16px] border border-[var(--theme-border-soft)] bg-[radial-gradient(circle_at_top,color-mix(in_srgb,var(--theme-text-primary)_6%,transparent),transparent_36%),linear-gradient(180deg,var(--theme-surface-panel),var(--theme-surface-panel-strong))]">
                            <div
                              v-if="scaleBarPreference.enabled"
                              class="absolute bottom-3 left-1/2 -translate-x-1/2"
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

                      <div class="theme-card-soft rounded-[24px] p-4">
                        <div class="mb-2 text-sm font-semibold text-[var(--theme-text-primary)]">{{ copy.roiStatsTitle }}</div>
                        <div class="mb-4 text-xs leading-6 text-[var(--theme-text-secondary)]">{{ copy.roiStatsDesc }}</div>
                        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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

                    <div class="space-y-5">
                      <div class="theme-card-soft rounded-[24px] p-4">
                        <div class="mb-3 flex items-center gap-2 text-[var(--theme-text-primary)]">
                          <AppIcon name="palette" :size="18" />
                          <span class="text-sm font-semibold">{{ copy.visualPreview }}</span>
                        </div>
                        <div class="mb-4 text-xs leading-6 text-[var(--theme-text-secondary)]">{{ copy.crosshairPreviewLabel }}</div>
                        <div class="grid gap-4 md:grid-cols-3">
                          <div
                            v-for="config in crosshairConfigs"
                            :key="`${config.key}-preview`"
                            class="rounded-[20px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-panel-strong)] p-3"
                          >
                            <div class="mb-2 flex items-center justify-between">
                              <span class="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--theme-text-secondary)]">{{ config.label }}</span>
                            </div>
                            <div class="relative h-[170px] overflow-hidden rounded-[16px] border border-[var(--theme-border-soft)] bg-[radial-gradient(circle_at_top,color-mix(in_srgb,var(--theme-text-primary)_6%,transparent),transparent_36%),linear-gradient(180deg,var(--theme-surface-panel),var(--theme-surface-panel-strong))]">
                              <div class="absolute left-[16%] top-[18%] h-8 w-8 rounded-full border border-[color:color-mix(in_srgb,var(--theme-text-primary)_8%,transparent)] bg-[color:color-mix(in_srgb,var(--theme-text-primary)_3%,transparent)] blur-[1px]"></div>
                              <div class="absolute right-[14%] top-[26%] h-12 w-12 rounded-full border border-[color:color-mix(in_srgb,var(--theme-text-primary)_7%,transparent)] bg-[color:color-mix(in_srgb,var(--theme-text-primary)_2%,transparent)] blur-[2px]"></div>
                              <div class="absolute bottom-[16%] left-[22%] h-10 w-10 rounded-full border border-[color:color-mix(in_srgb,var(--theme-text-primary)_6%,transparent)] bg-[color:color-mix(in_srgb,var(--theme-text-primary)_2%,transparent)] blur-[1px]"></div>
                              <div class="absolute inset-y-0 left-1/2 -translate-x-1/2" :style="{ width: `${getCrosshairPreviewAxes(config.key).vertical.thickness}px`, backgroundColor: getCrosshairPreviewAxes(config.key).vertical.color, boxShadow: `0 0 14px ${getCrosshairPreviewAxes(config.key).vertical.color}88` }"></div>
                              <div class="absolute inset-x-0 top-1/2 -translate-y-1/2" :style="{ height: `${getCrosshairPreviewAxes(config.key).horizontal.thickness}px`, backgroundColor: getCrosshairPreviewAxes(config.key).horizontal.color, boxShadow: `0 0 14px ${getCrosshairPreviewAxes(config.key).horizontal.color}88` }"></div>
                              <div class="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[color:color-mix(in_srgb,var(--theme-text-primary)_12%,transparent)] bg-[color:color-mix(in_srgb,var(--theme-surface-panel-strong)_78%,black)]"></div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div class="theme-card-soft rounded-[24px] p-4">
                        <div class="mb-3 text-sm font-semibold text-[var(--theme-text-primary)]">{{ copy.pseudocolor }}</div>
                        <div class="space-y-3">
                          <button
                            v-for="option in PSEUDOCOLOR_PRESET_OPTIONS"
                            :key="option.key"
                            type="button"
                            class="flex w-full items-center gap-3 rounded-[18px] border px-3 py-3 text-left transition duration-150"
                            :class="selectedPseudocolorKey === option.key ? 'border-[var(--theme-border-strong)] bg-[color:color-mix(in_srgb,var(--theme-accent)_10%,var(--theme-surface-card))]' : 'border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] hover:border-[var(--theme-border-strong)] hover:bg-[var(--theme-surface-card-soft)]'"
                            @click="selectedPseudocolorKey = option.key"
                          >
                            <span class="h-9 flex-1 rounded-2xl border border-[var(--theme-border-soft)]" :style="{ background: option.gradient }"></span>
                            <span class="w-24 shrink-0 text-sm font-medium text-[var(--theme-text-primary)]">{{ option.label }}</span>
                          </button>
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
</style>
