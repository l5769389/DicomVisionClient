<script setup lang="ts">
import {
  mdiAlertCircleOutline,
  mdiAlertOutline,
  mdiAngleAcute,
  mdiArrowExpandHorizontal,
  mdiArmFlexOutline,
  mdiBellOutline,
  mdiBedEmpty,
  mdiBone,
  mdiChartBellCurveCumulative,
  mdiCheckBold,
  mdiCheckCircleOutline,
  mdiChevronDown,
  mdiChevronLeft,
  mdiChevronRight,
  mdiChevronUp,
  mdiClipboardPulseOutline,
  mdiClose,
  mdiCloseCircleMultipleOutline,
  mdiCogOutline,
  mdiConnection,
  mdiContentCut,
  mdiContentCopy,
  mdiContentSaveOutline,
  mdiContrastCircle,
  mdiCrosshairsGps,
  mdiCubeOutline,
  mdiCubeScan,
  mdiCursorMove,
  mdiDotsHorizontal,
  mdiDotsVertical,
  mdiDotsSquare,
  mdiMenu,
  mdiEllipseOutline,
  mdiExportVariant,
  mdiEyeOutline,
  mdiEyeOffOutline,
  mdiFire,
  mdiFileUploadOutline,
  mdiFlipHorizontal,
  mdiFlipVertical,
  mdiFolderDownloadOutline,
  mdiFolderUploadOutline,
  mdiFormatColorFill,
  mdiGithub,
  mdiHeartPulse,
  mdiHelpCircleOutline,
  mdiImport,
  mdiInformationOutline,
  mdiInvertColors,
  mdiImageMultipleOutline,
  mdiKeyboardOutline,
  mdiLanConnect,
  mdiLanDisconnect,
  mdiLanPending,
  mdiLayersTriple,
  mdiLoading,
  mdiLockOpenOutline,
  mdiLockReset,
  mdiLoupe,
  mdiMagnify,
  mdiMolecule,
  mdiMonitorArrowDown,
  mdiMinus,
  mdiPaletteOutline,
  mdiPaletteSwatchOutline,
  mdiPause,
  mdiPhoneRotateLandscape,
  mdiPhoneRotatePortrait,
  mdiPencil,
  mdiPlay,
  mdiPlus,
  mdiRectangleOutline,
  mdiRestore,
  mdiRocketLaunchOutline,
  mdiRotate3dVariant,
  mdiRotateLeftVariant,
  mdiRotateRight,
  mdiRotateRightVariant,
  mdiRuler,
  mdiSegment,
  mdiShapePolygonPlus,
  mdiShieldCheckOutline,
  mdiSphere,
  mdiStar,
  mdiStarOutline,
  mdiStop,
  mdiSwapVertical,
  mdiSync,
  mdiTagTextOutline,
  mdiTimelineClockOutline,
  mdiTranslate,
  mdiTrashCanOutline,
  mdiTuneVariant,
  mdiVectorPolyline,
  mdiViewDashboardOutline,
  mdiWaterCircle,
  mdiWaterOutline
} from '@mdi/js'
import { computed } from 'vue'

const props = defineProps<{
  name: string
  size?: number
}>()

const mdiIconMap: Record<string, string> = {
  pan: mdiCursorMove,
  zoom: mdiLoupe,
  window: mdiContrastCircle,
  crosshair: mdiCrosshairsGps,
  mip: mdiLayersTriple,
  segmentation: mdiSegment,
  'segmentation-threshold': mdiDotsSquare,
  'segmentation-voi': mdiSphere,
  'dots-horizontal': mdiDotsHorizontal,
  'dots-vertical': mdiDotsVertical,
  rotate: mdiRotateRight,
  rotate3d: mdiRotate3dVariant,
  'render-volume': mdiLayersTriple,
  'render-surface': mdiShapePolygonPlus,
  'render-mode': mdiLayersTriple,
  'orientation-3d': mdiCubeScan,
  'orientation-face-oblique': mdiCubeScan,
  'surface-preset': mdiShapePolygonPlus,
  'volume-clip': mdiContentCut,
  volumePreset: mdiCubeOutline,
  'volume-preset-aaa': mdiRocketLaunchOutline,
  'volume-preset-red': mdiWaterOutline,
  'volume-preset-cardiac': mdiHeartPulse,
  'volume-preset-muscle': mdiArmFlexOutline,
  'volume-preset-mip': mdiBone,
  'rotate-cw90': mdiRotateRightVariant,
  'rotate-ccw90': mdiRotateLeftVariant,
  'mirror-h': mdiFlipHorizontal,
  'mirror-v': mdiFlipVertical,
  reset: mdiRestore,
  sync: mdiSync,
  page: mdiSwapVertical,
  annotate: mdiPencil,
  measure: mdiRuler,
  'measure-line': mdiRuler,
  'measure-rect': mdiRectangleOutline,
  'measure-ellipse': mdiEllipseOutline,
  'measure-angle': mdiAngleAcute,
  'measure-curve': mdiVectorPolyline,
  'measure-freeform': mdiShapePolygonPlus,
  qa: mdiClipboardPulseOutline,
  mtf: mdiChartBellCurveCumulative,
  'water-phantom': mdiWaterCircle,
  history: mdiTimelineClockOutline,
  loading: mdiLoading,
  play: mdiPlay,
  pause: mdiPause,
  stop: mdiStop,
  'four-d': mdiTimelineClockOutline,
  layout: mdiViewDashboardOutline,
  series: mdiImageMultipleOutline,
  tag: mdiTagTextOutline,
  export: mdiExportVariant,
  import: mdiImport,
  'file-upload': mdiFileUploadOutline,
  'folder-upload': mdiFolderUploadOutline,
  pseudocolor: mdiPaletteOutline,
  'pseudocolor-gray': mdiInvertColors,
  'pseudocolor-hot': mdiFire,
  'pseudocolor-pet': mdiMolecule,
  'pseudocolor-rainbow': mdiFormatColorFill,
  'chevron-down': mdiChevronDown,
  'chevron-left': mdiChevronLeft,
  'chevron-right': mdiChevronRight,
  'chevron-up': mdiChevronUp,
  connected: mdiConnection,
  pacs: mdiLanConnect,
  connecting: mdiLanPending,
  disconnected: mdiLanDisconnect,
  display: mdiEyeOutline,
  'display-off': mdiEyeOffOutline,
  menu: mdiTuneVariant,
  'drag-handle': mdiMenu,
  search: mdiMagnify,
  settings: mdiCogOutline,
  keyboard: mdiKeyboardOutline,
  language: mdiTranslate,
  contrast: mdiContrastCircle,
  palette: mdiPaletteSwatchOutline,
  bell: mdiBellOutline,
  shield: mdiShieldCheckOutline,
  star: mdiStar,
  'star-outline': mdiStarOutline,
  copy: mdiContentCopy,
  save: mdiContentSaveOutline,
  error: mdiAlertCircleOutline,
  explanation: mdiAlertCircleOutline,
  info: mdiInformationOutline,
  trash: mdiTrashCanOutline,
  check: mdiCheckBold,
  close: mdiClose,
  'close-all': mdiCloseCircleMultipleOutline,
  'folder-import': mdiFolderDownloadOutline,
  'install-app': mdiMonitorArrowDown,
  github: mdiGithub,
  fullscreen: mdiArrowExpandHorizontal,
  'orientation-landscape': mdiPhoneRotateLandscape,
  'orientation-portrait': mdiPhoneRotatePortrait,
  'orientation-unlocked': mdiLockOpenOutline,
  'orientation-reset': mdiLockReset,
  plus: mdiPlus,
  minimize: mdiMinus,
  success: mdiCheckCircleOutline,
  warning: mdiAlertOutline
}

const bedIconName = computed(() => (props.name === 'bed-visible' || props.name === 'remove-bed' || props.name === 'bed-hidden' ? props.name : null))
const isPseudocolorIcon = computed(() => props.name === 'pseudocolor')
const renderModeLetter = computed(() => (props.name === 'render-volume' ? 'V' : props.name === 'render-surface' ? 'S' : null))
const orientationFaceLetter = computed(() => {
  const match = props.name.match(/^orientation-face-([APLRSI])$/)
  if (match) {
    return match[1] ?? null
  }
  return null
})
const iconPath = computed(() => (bedIconName.value || isPseudocolorIcon.value || renderModeLetter.value || orientationFaceLetter.value) ? '' : (mdiIconMap[props.name] ?? mdiHelpCircleOutline))
const iconSize = computed(() => props.size ?? 24)
</script>

<template>
  <svg
    class="app-icon-svg"
    :width="iconSize"
    :height="iconSize"
    viewBox="0 0 24 24"
    focusable="false"
    aria-hidden="true"
  >
    <g
      v-if="bedIconName"
      class="app-icon-svg__line-icon"
      :data-bed-icon="bedIconName === 'remove-bed' ? 'bed-visible' : bedIconName"
    >
      <path
        class="app-icon-svg__bed-eye"
        :d="bedIconName === 'bed-hidden' ? mdiEyeOffOutline : mdiEyeOutline"
        transform="matrix(0.66 0 0 0.66 4.08 -0.72)"
      />
      <path class="app-icon-svg__bed-board" :d="mdiBedEmpty" transform="matrix(0.78 0 0 0.52 2.64 10.55)" />
    </g>
    <template v-else-if="isPseudocolorIcon">
      <defs>
        <radialGradient id="app-icon-pseudocolor-gradient" cx="34%" cy="28%" r="72%">
          <stop offset="0%" stop-color="#ffffff" />
          <stop offset="28%" stop-color="#e7ebef" />
          <stop offset="58%" stop-color="#9fa8b2" />
          <stop offset="100%" stop-color="#4f5b66" />
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r="8.25" fill="url(#app-icon-pseudocolor-gradient)" />
      <circle cx="12" cy="12" r="8.25" fill="none" stroke="currentColor" stroke-opacity="0.5" stroke-width="1.1" />
    </template>
    <text
      v-else-if="renderModeLetter"
      class="app-icon-svg__render-letter"
      x="12"
      y="16.4"
      text-anchor="middle"
      :data-render-mode-icon="props.name"
    >{{ renderModeLetter }}</text>
    <text
      v-else-if="orientationFaceLetter"
      class="app-icon-svg__orientation-letter"
      x="12"
      y="16.4"
      text-anchor="middle"
      :data-orientation-face-icon="orientationFaceLetter"
    >{{ orientationFaceLetter }}</text>
    <path v-else :d="iconPath" />
  </svg>
</template>

<style scoped>
.app-icon-svg {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  fill: currentColor;
  line-height: 1;
}

.app-icon-svg__line-icon {
  fill: currentColor;
}

.app-icon-svg__bed-board,
.app-icon-svg__bed-eye {
  opacity: 0.96;
}

.app-icon-svg__render-letter {
  fill: currentColor;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 16px;
  font-weight: 800;
  letter-spacing: 0;
}

.app-icon-svg__orientation-letter {
  fill: currentColor;
  stroke: none;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 18px;
  font-weight: 900;
  letter-spacing: 0;
}
</style>
