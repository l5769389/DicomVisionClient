<script setup lang="ts">
import {
  mdiAlertCircleOutline,
  mdiAlertOutline,
  mdiAngleAcute,
  mdiArrowExpandHorizontal,
  mdiArmFlexOutline,
  mdiBellOutline,
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
  mdiContentCopy,
  mdiContentSaveOutline,
  mdiContrastCircle,
  mdiCrosshairsGps,
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
  mdiSelectMultipleMarker,
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
  segmentation: mdiSelectMultipleMarker,
  'segmentation-threshold': mdiDotsSquare,
  'segmentation-voi': mdiSphere,
  'dots-horizontal': mdiDotsHorizontal,
  'dots-vertical': mdiDotsVertical,
  rotate: mdiRotateRight,
  rotate3d: mdiRotate3dVariant,
  'render-volume': mdiLayersTriple,
  'render-surface': mdiShapePolygonPlus,
  'volume-clip': mdiShapePolygonPlus,
  volumePreset: mdiTuneVariant,
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
const iconPath = computed(() => bedIconName.value ? '' : (mdiIconMap[props.name] ?? mdiHelpCircleOutline))
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
      <path class="app-icon-svg__bed-eye" :d="mdiEyeOutline" transform="matrix(0.78 0 0 0.58 2.64 2.08)" />
      <path class="app-icon-svg__bed-board" d="M4.05 16.98C8.68 16.48 15.36 16.32 19.88 16.62c0.6 0.04 1.02 0.58 0.9 1.17l-0.22 1.08c-0.1 0.48-0.54 0.82-1.03 0.79C15.12 19.44 8.78 19.6 4.4 20.12c-0.58 0.07-1.09-0.36-1.12-0.94l-0.07-1.08c-0.04-0.55 0.3-1.06 0.84-1.12Z" />
      <path v-if="bedIconName === 'bed-hidden'" class="app-icon-svg__bed-slash" d="M5.45 4.05a0.95 0.95 0 0 1 1.34 0l11.12 11.12a0.95 0.95 0 1 1-1.34 1.34L5.45 5.39a0.95 0.95 0 0 1 0-1.34Z" />
    </g>
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

.app-icon-svg__bed-board {
  opacity: 0.9;
}

.app-icon-svg__bed-eye {
  opacity: 0.96;
}

.app-icon-svg__bed-slash {
  opacity: 0.98;
}
</style>
