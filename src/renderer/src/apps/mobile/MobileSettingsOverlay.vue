<script setup lang="ts">
import { computed, ref } from 'vue'
import AppIcon from '../../components/AppIcon.vue'
import { PSEUDOCOLOR_PRESET_OPTIONS, getPseudocolorGradient } from '../../constants/pseudocolor'
import {
  useUiPreferences,
  type AppLocale,
  type CrosshairViewportPreference,
  type DicomTagDisplayMode,
  type ExportPreference,
  type MeasurementLineStyle,
  type MeasurementStylePreference,
  type RoiStatPreference,
  type ScaleBarPreference
} from '../../composables/ui/useUiPreferences'
import type { MprViewportKey } from '../../types/viewer'
import {
  MOBILE_GESTURE_SENSITIVITY_OPTIONS,
  MOBILE_ORIENTATION_LOCK_OPTIONS,
  MOBILE_STACK_PLAYBACK_FPS_OPTIONS,
  type MobileGestureSensitivity,
  type MobileMprDefaultTool,
  type MobileOrientationLock,
  type MobileStackDefaultTool,
  useMobileViewerPreferences
} from './useMobileViewerPreferences'

defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const {
  crosshairConfigs,
  dicomTagDisplayMode,
  exportPreference,
  getWindowPresetLabel,
  locale,
  measurementStylePreference,
  roiStatOptions,
  scaleBarPreference,
  selectedPseudocolorKey,
  selectedWindowPresetId,
  setCrosshairConfigs,
  setExportPreference,
  setLocale,
  setMeasurementStylePreference,
  setRoiStatOptions,
  setScaleBarPreference,
  themeId,
  windowPresets
} = useUiPreferences()
const {
  defaultShowCornerInfo,
  defaultShowScaleBar,
  gestureSensitivity,
  mprDefaultTool,
  mprDefaultViewport,
  mprShowReferenceThumbnails,
  orientationLock,
  stackDefaultTool,
  stackPlaybackFps,
  setDefaultShowCornerInfo,
  setDefaultShowScaleBar,
  setGestureSensitivity,
  setMprDefaultTool,
  setMprDefaultViewport,
  setMprShowReferenceThumbnails,
  setOrientationLock,
  setStackDefaultTool,
  setStackPlaybackFps
} = useMobileViewerPreferences()

type MobileSettingsPanelKey =
  | 'interface'
  | 'reading'
  | 'windowColor'
  | 'mpr'
  | 'display'
  | 'overlays'
  | 'measurements'
  | 'dicomExport'
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

const isZh = computed(() => locale.value === 'zh-CN')
const activePanel = ref<MobileSettingsPanelKey | null>(null)

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

const stackToolOptions: Array<{ key: MobileStackDefaultTool; zh: string; en: string }> = [
  { key: 'scroll', zh: '滚片', en: 'Scroll' },
  { key: 'window', zh: '调窗', en: 'Window' },
  { key: 'pan', zh: '平移', en: 'Pan' }
]

const mprToolOptions: Array<{ key: MobileMprDefaultTool; zh: string; en: string }> = [
  { key: 'crosshair', zh: '十字线', en: 'Crosshair' },
  ...stackToolOptions
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

const lineStyleOptions: Array<{ value: MeasurementLineStyle; zh: string; en: string }> = [
  { value: 'solid', zh: '实线', en: 'Solid' },
  { value: 'dash', zh: '虚线', en: 'Dashed' }
]

const dicomTagDisplayModeOptions = computed<Array<{ value: DicomTagDisplayMode; title: string; badge: string }>>(() => [
  {
    value: 'tree',
    title: isZh.value ? '树形缩进' : 'Tree indent',
    badge: 'TREE'
  },
  {
    value: 'flat',
    title: isZh.value ? '平铺列表' : 'Flat list',
    badge: 'LIST'
  }
])

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
const displayDefaultsLabel = computed(() => {
  const enabledCount = [defaultShowCornerInfo.value, defaultShowScaleBar.value].filter(Boolean).length
  return isZh.value ? `${enabledCount} 项开启` : `${enabledCount} on`
})
const overlayStyleLabel = computed(() => {
  const scaleBarLabel = scaleBarPreference.value.enabled ? (isZh.value ? '比例尺开' : 'Scale on') : (isZh.value ? '比例尺关' : 'Scale off')
  const averageThickness = crosshairConfigs.value.length
    ? Math.round(crosshairConfigs.value.reduce((sum, item) => sum + item.thickness, 0) / crosshairConfigs.value.length)
    : 2
  return isZh.value ? `${scaleBarLabel} · 十字线 ${averageThickness}px` : `${scaleBarLabel} · Crosshair ${averageThickness}px`
})
const measurementStyleLabel = computed(() => {
  const enabledCount = roiStatOptions.value.filter((item) => item.enabled).length
  return isZh.value ? `${measurementStylePreference.value.lineWidth}px · ROI ${enabledCount} 项` : `${measurementStylePreference.value.lineWidth}px · ${enabledCount} ROI`
})
const dicomExportLabel = computed(() => {
  const tagLabel = dicomTagDisplayModeOptions.value.find((item) => item.value === dicomTagDisplayMode.value)?.title ?? dicomTagDisplayMode.value
  const enabledExportCount = [
    exportPreference.value.includePngMeasurements,
    exportPreference.value.includePngAnnotations,
    exportPreference.value.includePngCornerInfo,
    exportPreference.value.includeDicomMeasurements,
    exportPreference.value.includeDicomAnnotations
  ].filter(Boolean).length
  return isZh.value ? `${tagLabel} · 导出 ${enabledExportCount} 项` : `${tagLabel} · ${enabledExportCount} export`
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

function updateScaleBarPreference(patch: Partial<ScaleBarPreference>): void {
  setScaleBarPreference({ ...scaleBarPreference.value, ...patch })
}

function updateMeasurementStylePreference(patch: Partial<MeasurementStylePreference>): void {
  setMeasurementStylePreference({ ...measurementStylePreference.value, ...patch })
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

function setDicomTagMode(value: DicomTagDisplayMode): void {
  dicomTagDisplayMode.value = value
}

function updateExportPreference(patch: Partial<ExportPreference>): void {
  setExportPreference({ ...exportPreference.value, ...patch })
}
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" class="mobile-settings" role="dialog" aria-modal="true" aria-label="Mobile settings">
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
          <div v-if="!activePanel" class="mobile-settings__eyebrow">{{ isZh ? '移动端' : 'Mobile' }}</div>
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
                <small>Stack {{ selectedStackToolLabel }} · MPR {{ selectedMprToolLabel }}</small>
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
            <button type="button" class="mobile-settings__nav-row" data-testid="mobile-settings-nav-playback" @click="openPanel('playback')">
              <AppIcon name="play" :size="20" />
              <span>
                <strong>{{ isZh ? '播放与手势' : 'Playback & Gestures' }}</strong>
                <small>{{ stackPlaybackFps }} FPS · {{ isZh ? gestureSensitivityLabels[gestureSensitivity].zh : gestureSensitivityLabels[gestureSensitivity].en }}</small>
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
          <div class="mobile-settings__subhead">{{ isZh ? 'Stack 默认工具' : 'Stack Default Tool' }}</div>
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
              <span class="mobile-settings__swatch" :style="{ background: getPseudocolorGradient(preset.key) }"></span>
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
        </section>

        <section v-else-if="activePanel === 'overlays'" class="mobile-settings__section">
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
            <div class="mobile-settings__subhead">{{ isZh ? 'MPR 十字线' : 'MPR Crosshair' }}</div>
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
                <div class="mobile-settings__mini-segmented">
                  <button
                    v-for="thickness in [1, 2, 3, 4]"
                    :key="`${config.key}-${thickness}`"
                    type="button"
                    :class="{ active: Math.round(config.thickness) === thickness }"
                    data-testid="mobile-settings-crosshair-thickness"
                    @click="updateCrosshairConfig(config.key, { thickness })"
                  >
                    {{ thickness }}
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
          <div class="mobile-settings__subhead">{{ isZh ? 'DICOM Tag 显示' : 'DICOM Tag Display' }}</div>
          <div class="mobile-settings__option-grid">
            <button
              v-for="option in dicomTagDisplayModeOptions"
              :key="option.value"
              type="button"
              class="mobile-settings__option"
              :class="{ active: dicomTagDisplayMode === option.value }"
              data-testid="mobile-settings-dicom-tag-mode"
              @click="setDicomTagMode(option.value)"
            >
              <strong>{{ option.badge }}</strong>
              <span>{{ option.title }}</span>
            </button>
          </div>

          <button
            type="button"
            class="mobile-settings__switch-row"
            data-testid="mobile-settings-export-default-name"
            @click="updateExportPreference({ useDefaultFileName: !exportPreference.useDefaultFileName })"
          >
            <span>
              <strong>{{ isZh ? '使用默认文件名' : 'Use Default File Name' }}</strong>
              <small>{{ exportPreference.useDefaultFileName ? (isZh ? '已开启' : 'Enabled') : (isZh ? '已关闭' : 'Disabled') }}</small>
            </span>
            <span class="mobile-settings__switch" :class="{ 'mobile-settings__switch--on': exportPreference.useDefaultFileName }" aria-hidden="true">
              <span></span>
            </span>
          </button>

          <div class="mobile-settings__subhead">PNG</div>
          <button
            type="button"
            class="mobile-settings__switch-row"
            data-testid="mobile-settings-export-png-measurements"
            @click="updateExportPreference({ includePngMeasurements: !exportPreference.includePngMeasurements })"
          >
            <span><strong>{{ isZh ? '包含测量' : 'Measurements' }}</strong></span>
            <span class="mobile-settings__switch" :class="{ 'mobile-settings__switch--on': exportPreference.includePngMeasurements }" aria-hidden="true"><span></span></span>
          </button>
          <button
            type="button"
            class="mobile-settings__switch-row"
            data-testid="mobile-settings-export-png-annotations"
            @click="updateExportPreference({ includePngAnnotations: !exportPreference.includePngAnnotations })"
          >
            <span><strong>{{ isZh ? '包含标注' : 'Annotations' }}</strong></span>
            <span class="mobile-settings__switch" :class="{ 'mobile-settings__switch--on': exportPreference.includePngAnnotations }" aria-hidden="true"><span></span></span>
          </button>
          <button
            type="button"
            class="mobile-settings__switch-row"
            data-testid="mobile-settings-export-png-corner"
            @click="updateExportPreference({ includePngCornerInfo: !exportPreference.includePngCornerInfo })"
          >
            <span><strong>{{ isZh ? '包含四角信息' : 'Corner Info' }}</strong></span>
            <span class="mobile-settings__switch" :class="{ 'mobile-settings__switch--on': exportPreference.includePngCornerInfo }" aria-hidden="true"><span></span></span>
          </button>

          <div class="mobile-settings__subhead">DICOM</div>
          <button
            type="button"
            class="mobile-settings__switch-row"
            data-testid="mobile-settings-export-dicom-measurements"
            @click="updateExportPreference({ includeDicomMeasurements: !exportPreference.includeDicomMeasurements })"
          >
            <span><strong>{{ isZh ? '包含测量' : 'Measurements' }}</strong></span>
            <span class="mobile-settings__switch" :class="{ 'mobile-settings__switch--on': exportPreference.includeDicomMeasurements }" aria-hidden="true"><span></span></span>
          </button>
          <button
            type="button"
            class="mobile-settings__switch-row"
            data-testid="mobile-settings-export-dicom-annotations"
            @click="updateExportPreference({ includeDicomAnnotations: !exportPreference.includeDicomAnnotations })"
          >
            <span><strong>{{ isZh ? '包含标注' : 'Annotations' }}</strong></span>
            <span class="mobile-settings__switch" :class="{ 'mobile-settings__switch--on': exportPreference.includeDicomAnnotations }" aria-hidden="true"><span></span></span>
          </button>
        </section>

        <section v-else-if="activePanel === 'playback'" class="mobile-settings__section">
          <div class="mobile-settings__subhead">{{ isZh ? 'Stack / MPR 播放 FPS' : 'Stack / MPR Playback FPS' }}</div>
          <div class="mobile-settings__option-grid mobile-settings__fps-grid">
            <button
              v-for="fps in MOBILE_STACK_PLAYBACK_FPS_OPTIONS"
              :key="fps"
              type="button"
              class="mobile-settings__option"
              :class="{ active: stackPlaybackFps === fps }"
              data-testid="mobile-settings-playback-fps"
              @click="setStackPlaybackFps(fps)"
            >
              <span>{{ fps }} FPS</span>
            </button>
          </div>
          <div class="mobile-settings__subhead">{{ isZh ? '滚片灵敏度' : 'Scroll Sensitivity' }}</div>
          <div class="mobile-settings__option-grid mobile-settings__sensitivity-grid">
            <button
              v-for="item in MOBILE_GESTURE_SENSITIVITY_OPTIONS"
              :key="item"
              type="button"
              class="mobile-settings__option"
              :class="{ active: gestureSensitivity === item }"
              data-testid="mobile-settings-gesture-sensitivity"
              @click="setGestureSensitivity(item)"
            >
              <span>{{ isZh ? gestureSensitivityLabels[item].zh : gestureSensitivityLabels[item].en }}</span>
            </button>
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
              @click="setOrientationLock(item)"
            >
              <AppIcon :name="item === 'unlocked' ? 'fullscreen' : 'rotate'" :size="16" />
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
  grid-template-columns: 42px minmax(0, 1fr) 42px;
  align-items: center;
  gap: 8px;
  min-height: 62px;
  padding: calc(env(safe-area-inset-top, 0px) + 10px) 14px 10px;
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
  width: 42px;
  height: 42px;
}

.mobile-settings__eyebrow {
  color: var(--theme-text-muted);
  font-size: 11px;
  font-weight: 800;
}

.mobile-settings__title {
  overflow: hidden;
  font-size: 19px;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-settings__icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
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
  padding: 12px 12px calc(env(safe-area-inset-bottom, 0px) + 18px);
}

.mobile-settings__content--detail {
  padding-top: 14px;
}

.mobile-settings__nav-group {
  display: grid;
  gap: 1px;
  overflow: hidden;
  margin-bottom: 14px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 70%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-surface-card) 82%, transparent);
}

.mobile-settings__nav-row {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) 22px;
  align-items: center;
  gap: 10px;
  min-height: 58px;
  border: 0;
  border-bottom: 1px solid color-mix(in srgb, var(--theme-border-soft) 54%, transparent);
  background: transparent;
  color: var(--theme-text-primary);
  padding: 9px 10px;
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
  font-size: 15px;
  font-weight: 900;
}

.mobile-settings__nav-row small {
  margin-top: 2px;
  color: var(--theme-text-muted);
  font-size: 12px;
  font-weight: 800;
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
.mobile-settings__control-block {
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 72%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-surface-card) 82%, transparent);
  color: var(--theme-text-secondary);
}

.mobile-settings__segmented button,
.mobile-settings__option,
.mobile-settings__row,
.mobile-settings__switch-row {
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

.mobile-settings__switch-row strong,
.mobile-settings__switch-row small {
  display: block;
}

.mobile-settings__switch-row small {
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

.mobile-settings__crosshair-list {
  display: grid;
  gap: 10px;
}

.mobile-settings__crosshair-row {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) minmax(112px, auto);
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

.mobile-settings__range {
  width: 100%;
  min-width: 0;
  accent-color: var(--theme-accent);
  touch-action: pan-x;
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

@media (orientation: landscape) and (max-height: 520px) {
  .mobile-settings__header {
    min-height: 48px;
    padding: calc(env(safe-area-inset-top, 0px) + 6px) 10px 6px;
  }

  .mobile-settings__eyebrow {
    display: none;
  }

  .mobile-settings__title {
    font-size: 16px;
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
