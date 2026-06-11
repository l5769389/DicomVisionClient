<script setup lang="ts">
import {
  mdiAlertCircleOutline,
  mdiAlertOutline,
  mdiAngleAcute,
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
  mdiMenu,
  mdiEllipseOutline,
  mdiExportVariant,
  mdiEyeOutline,
  mdiFire,
  mdiFileUploadOutline,
  mdiFlipHorizontal,
  mdiFlipVertical,
  mdiFolderDownloadOutline,
  mdiFolderUploadOutline,
  mdiFormatColorFill,
  mdiFullscreen,
  mdiGithub,
  mdiHeartPulse,
  mdiHelpCircleOutline,
  mdiInformationOutline,
  mdiInvertColors,
  mdiImageMultipleOutline,
  mdiKeyboardOutline,
  mdiLanConnect,
  mdiLanDisconnect,
  mdiLanPending,
  mdiLayersTriple,
  mdiLoupe,
  mdiMagnify,
  mdiMolecule,
  mdiPaletteOutline,
  mdiPaletteSwatchOutline,
  mdiPause,
  mdiPencil,
  mdiPlay,
  mdiRectangleOutline,
  mdiRestore,
  mdiRocketLaunchOutline,
  mdiRotate3dVariant,
  mdiRotateLeftVariant,
  mdiRotateRight,
  mdiRotateRightVariant,
  mdiRuler,
  mdiShapePolygonPlus,
  mdiShieldCheckOutline,
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
  mdiWaterOutline,
  mdiWindowMinimize
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
  segmentation: mdiChartBellCurveCumulative,
  'segmentation-threshold': mdiContrastCircle,
  'segmentation-voi': mdiRectangleOutline,
  rotate: mdiRotateRight,
  rotate3d: mdiRotate3dVariant,
  'render-volume': mdiLayersTriple,
  'render-surface': mdiShapePolygonPlus,
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
  play: mdiPlay,
  pause: mdiPause,
  stop: mdiStop,
  'four-d': mdiTimelineClockOutline,
  layout: mdiViewDashboardOutline,
  series: mdiImageMultipleOutline,
  tag: mdiTagTextOutline,
  export: mdiExportVariant,
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
  github: mdiGithub,
  fullscreen: mdiFullscreen,
  minimize: mdiWindowMinimize,
  success: mdiCheckCircleOutline,
  warning: mdiAlertOutline
}

const iconPath = computed(() => mdiIconMap[props.name] ?? mdiHelpCircleOutline)
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
    <path :d="iconPath" />
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
</style>
