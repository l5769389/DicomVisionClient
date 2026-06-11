<script setup lang="ts">
import { computed } from 'vue'
import AppIcon from '../../components/AppIcon.vue'
import { PSEUDOCOLOR_PRESET_OPTIONS, getPseudocolorGradient } from '../../constants/pseudocolor'
import { useUiPreferences } from '../../composables/ui/useUiPreferences'
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
  getWindowPresetLabel,
  locale,
  selectedPseudocolorKey,
  selectedWindowPresetId,
  setLocale,
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

const isZh = computed(() => locale.value === 'zh-CN')

/*
const legacyThemeOptions = [
  { id: 'industrial-utility', zh: '工业实用风', en: 'Industrial', swatch: 'linear-gradient(135deg,#05080b,#202a32,#6fa9c4)' },
  { id: 'aurora', zh: '冷蓝深色', en: 'Aurora', swatch: 'linear-gradient(135deg,#07111d,#16324d,#66d0ff)' },
  { id: 'clinical-light', zh: '临床浅色', en: 'Clinical', swatch: 'linear-gradient(135deg,#f7fbff,#d7e5f2,#6aaed6)' }
]
*/

const themeOptions = [
  {
    accent: '#6fa9c4',
    id: 'industrial-utility',
    panel: '#111923',
    rail: 'linear-gradient(90deg,#101820,#263746,#6fa9c4)',
    surface: '#17222d',
    text: '#f5f9fc',
    zh: '\u5de5\u4e1a\u5b9e\u7528\u98ce',
    en: 'Industrial'
  },
  {
    accent: '#66d0ff',
    id: 'aurora',
    panel: '#07111d',
    rail: 'linear-gradient(90deg,#07111d,#12345a,#66d0ff)',
    surface: '#10243b',
    text: '#e6f6ff',
    zh: '\u51b7\u84dd\u6df1\u8272',
    en: 'Aurora'
  },
  {
    accent: '#2f84c6',
    id: 'clinical-light',
    panel: '#f7fbff',
    rail: 'linear-gradient(90deg,#edf7ff,#cfe3f2,#2f84c6)',
    surface: '#dcecf8',
    text: '#24384d',
    zh: '\u4e34\u5e8a\u6d45\u8272',
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
  landscape: { zh: '\u9501\u5b9a\u6a2a\u5c4f', en: 'Landscape' },
  portrait: { zh: '\u9501\u5b9a\u7ad6\u5c4f', en: 'Portrait' },
  unlocked: { zh: '\u4e0d\u9501\u5b9a', en: 'Unlocked' }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" class="mobile-settings" role="dialog" aria-modal="true" aria-label="Mobile settings">
      <header class="mobile-settings__header">
        <div>
          <div class="mobile-settings__eyebrow">{{ isZh ? '移动端' : 'Mobile' }}</div>
          <div class="mobile-settings__title">{{ isZh ? '设置' : 'Settings' }}</div>
        </div>
        <button type="button" class="mobile-settings__icon-button" data-testid="mobile-settings-close" @click="emit('close')">
          <AppIcon name="close" :size="18" />
        </button>
      </header>

      <main class="mobile-settings__content">
        <section class="mobile-settings__section">
          <h2>{{ isZh ? '界面' : 'Interface' }}</h2>
          <div class="mobile-settings__segmented" data-testid="mobile-settings-locale">
            <button type="button" :class="{ active: locale === 'zh-CN' }" @click="setLocale('zh-CN')">中文</button>
            <button type="button" :class="{ active: locale === 'en-US' }" @click="setLocale('en-US')">English</button>
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

        <section class="mobile-settings__section">
          <h2>{{ isZh ? '阅片默认' : 'Reading Defaults' }}</h2>
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

        <section class="mobile-settings__section">
          <h2>{{ isZh ? '窗模板与伪彩' : 'Window & Color' }}</h2>
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

        <section class="mobile-settings__section">
          <h2>MPR</h2>
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

        <section class="mobile-settings__section">
          <h2>{{ isZh ? '显示默认' : 'Display Defaults' }}</h2>
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

        <section class="mobile-settings__section">
          <h2>{{ isZh ? '播放与手势' : 'Playback & Gestures' }}</h2>
          <div class="mobile-settings__subhead">{{ isZh ? 'Stack 播放 FPS' : 'Stack Playback FPS' }}</div>
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
  background: color-mix(in srgb, var(--theme-surface-panel-solid) 98%, black);
  color: var(--theme-text-primary);
}

.mobile-settings__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 62px;
  padding: calc(env(safe-area-inset-top, 0px) + 10px) 14px 10px;
  border-bottom: 1px solid color-mix(in srgb, var(--theme-border-soft) 70%, transparent);
}

.mobile-settings__eyebrow {
  color: var(--theme-text-muted);
  font-size: 11px;
  font-weight: 800;
}

.mobile-settings__title {
  font-size: 19px;
  font-weight: 900;
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

.mobile-settings__content {
  min-height: 0;
  overflow: auto;
  padding: 12px 12px calc(env(safe-area-inset-bottom, 0px) + 18px);
}

.mobile-settings__section {
  padding: 12px 0 16px;
  border-bottom: 1px solid color-mix(in srgb, var(--theme-border-soft) 62%, transparent);
}

.mobile-settings__section h2 {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 900;
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

.mobile-settings__fps-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.mobile-settings__segmented button,
.mobile-settings__option,
.mobile-settings__row,
.mobile-settings__switch-row {
  min-height: 44px;
  border: 1px solid color-mix(in srgb, var(--theme-border-soft) 72%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--theme-surface-card) 82%, transparent);
  color: var(--theme-text-secondary);
  font-weight: 800;
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
  background: color-mix(in srgb, var(--theme-surface-panel-solid) 88%, black);
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

  .mobile-settings__section {
    padding: 8px 0 10px;
  }

  .mobile-settings__section h2 {
    margin-bottom: 7px;
    font-size: 13px;
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
