<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  name: string
  size?: number
  strokeWidth?: number
}>()

const mdiIconMap: Record<string, string> = {
  pan: 'mdi-cursor-move',
  zoom: 'mdi-loupe',
  window: 'mdi-circle-half-full',
  crosshair: 'mdi-crosshairs-gps',
  mip: 'mdi-layers-triple-outline',
  rotate: 'mdi-rotate-right',
  rotate3d: 'mdi-axis-arrow',
  volumePreset: 'mdi-tune-variant',
  'volume-preset-aaa': 'mdi-rocket-launch-outline',
  'volume-preset-red': 'mdi-water-outline',
  'volume-preset-cardiac': 'mdi-heart-pulse',
  'volume-preset-muscle': 'mdi-arm-flex-outline',
  'volume-preset-mip': 'mdi-bone',
  'rotate-cw90': 'mdi-rotate-right-variant',
  'rotate-ccw90': 'mdi-rotate-left-variant',
  'mirror-h': 'mdi-flip-horizontal',
  'mirror-v': 'mdi-flip-vertical',
  reset: 'mdi-restore',
  page: 'mdi-swap-vertical',
  annotate: 'mdi-pencil',
  measure: 'mdi-ruler',
  'measure-line': 'mdi-ruler',
  'measure-rect': 'mdi-rectangle-outline',
  'measure-ellipse': 'mdi-ellipse-outline',
  'measure-angle': 'mdi-angle-acute',
  qa: 'mdi-clipboard-pulse-outline',
  mtf: 'mdi-chart-bell-curve-cumulative',
  'water-phantom': 'mdi-water-circle',
  play: 'mdi-play',
  pause: 'mdi-pause',
  stop: 'mdi-stop',
  tag: 'mdi-tag-text-outline',
  export: 'mdi-export-variant',
  pseudocolor: 'mdi-palette-outline',
  'pseudocolor-gray': 'mdi-invert-colors',
  'pseudocolor-hot': 'mdi-fire',
  'pseudocolor-pet': 'mdi-molecule',
  'pseudocolor-rainbow': 'mdi-format-color-fill',
  'chevron-down': 'mdi-chevron-down',
  'chevron-left': 'mdi-chevron-left',
  'chevron-right': 'mdi-chevron-right',
  connected: 'mdi-lan-connect',
  connecting: 'mdi-lan-pending',
  disconnected: 'mdi-lan-disconnect',
  menu: 'mdi-tune-variant',
  settings: 'mdi-cog-outline',
  keyboard: 'mdi-keyboard-outline',
  language: 'mdi-translate',
  contrast: 'mdi-contrast-circle',
  palette: 'mdi-palette-swatch-outline',
  bell: 'mdi-bell-outline',
  shield: 'mdi-shield-check-outline',
  copy: 'mdi-content-copy',
  trash: 'mdi-trash-can-outline',
  close: 'mdi-close'
}

const mdiClassName = computed(() => mdiIconMap[props.name] ?? 'mdi-help-circle-outline')
</script>

<template>
  <i
    class="mdi app-icon-font"
    :class="mdiClassName"
    :style="{ fontSize: `${size ?? 24}px` }"
    aria-hidden="true"
  ></i>
</template>

<style scoped>
.app-icon-font {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}
</style>
