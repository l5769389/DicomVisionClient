<script setup lang="ts">
defineProps<{
  name: string
  size?: number
  strokeWidth?: number
}>()
</script>

<template>
  <svg
    :width="size ?? 22"
    :height="size ?? 22"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <template v-if="name === 'pan'">
      <path d="M8 11V5a1 1 0 0 1 2 0v4" :stroke-width="strokeWidth ?? 1.8" stroke="currentColor" stroke-linecap="round" />
      <path d="M11 10V4a1 1 0 0 1 2 0v6" :stroke-width="strokeWidth ?? 1.8" stroke="currentColor" stroke-linecap="round" />
      <path d="M14 11V6a1 1 0 0 1 2 0v7" :stroke-width="strokeWidth ?? 1.8" stroke="currentColor" stroke-linecap="round" />
      <path d="M8 11L6.5 9.5a1.2 1.2 0 1 0-1.7 1.7l3.9 3.9A4 4 0 0 0 11.5 16H16a3 3 0 0 0 3-3v-1.2a2.8 2.8 0 0 0-.8-2l-.4-.4" :stroke-width="strokeWidth ?? 1.8" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" />
    </template>
    <template v-else-if="name === 'zoom'">
      <circle cx="10.5" cy="10.5" r="5.5" :stroke-width="strokeWidth ?? 1.8" stroke="currentColor" />
      <path d="M15 15L20 20" :stroke-width="strokeWidth ?? 1.8" stroke="currentColor" stroke-linecap="round" />
      <path d="M10.5 8V13" :stroke-width="strokeWidth ?? 1.8" stroke="currentColor" stroke-linecap="round" />
      <path d="M8 10.5H13" :stroke-width="strokeWidth ?? 1.8" stroke="currentColor" stroke-linecap="round" />
    </template>
    <template v-else-if="name === 'window'">
      <circle cx="12" cy="12" r="7" :stroke-width="strokeWidth ?? 1.8" stroke="currentColor" />
      <path d="M12 5a7 7 0 0 1 0 14Z" fill="currentColor" fill-opacity="0.35" />
    </template>
    <template v-else-if="name === 'crosshair'">
      <circle cx="12" cy="12" r="5.5" :stroke-width="strokeWidth ?? 1.8" stroke="currentColor" />
      <path d="M12 3.5V7" :stroke-width="strokeWidth ?? 1.8" stroke="currentColor" stroke-linecap="round" />
      <path d="M12 17v3.5" :stroke-width="strokeWidth ?? 1.8" stroke="currentColor" stroke-linecap="round" />
      <path d="M3.5 12H7" :stroke-width="strokeWidth ?? 1.8" stroke="currentColor" stroke-linecap="round" />
      <path d="M17 12h3.5" :stroke-width="strokeWidth ?? 1.8" stroke="currentColor" stroke-linecap="round" />
      <circle cx="12" cy="12" r="1.35" fill="currentColor" />
    </template>
    <template v-else-if="name === 'rotate'">
      <path d="M8 6H4V2" :stroke-width="strokeWidth ?? 1.8" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M4 6a8 8 0 1 1-1 9" :stroke-width="strokeWidth ?? 1.8" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" />
    </template>
    <template v-else-if="name === 'rotate-cw90'">
      <path d="M8 6H4V2" :stroke-width="strokeWidth ?? 1.8" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M4 6a8 8 0 0 1 13 2" :stroke-width="strokeWidth ?? 1.8" stroke="currentColor" stroke-linecap="round" />
      <path d="M17 8v4h-4" :stroke-width="strokeWidth ?? 1.8" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" />
    </template>
    <template v-else-if="name === 'rotate-ccw90'">
      <path d="M16 6h4V2" :stroke-width="strokeWidth ?? 1.8" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M20 6A8 8 0 0 0 7 8" :stroke-width="strokeWidth ?? 1.8" stroke="currentColor" stroke-linecap="round" />
      <path d="M7 8v4h4" :stroke-width="strokeWidth ?? 1.8" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" />
    </template>
    <template v-else-if="name === 'mirror-h'">
      <path d="M12 4V20" :stroke-width="strokeWidth ?? 1.8" stroke="currentColor" stroke-dasharray="2 2" />
      <path d="M10 7L6 12L10 17" :stroke-width="strokeWidth ?? 1.8" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M14 7L18 12L14 17" :stroke-width="strokeWidth ?? 1.8" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" />
    </template>
    <template v-else-if="name === 'mirror-v'">
      <path d="M4 12H20" :stroke-width="strokeWidth ?? 1.8" stroke="currentColor" stroke-dasharray="2 2" />
      <path d="M7 10L12 6L17 10" :stroke-width="strokeWidth ?? 1.8" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M7 14L12 18L17 14" :stroke-width="strokeWidth ?? 1.8" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" />
    </template>
    <template v-else-if="name === 'reset'">
      <path d="M7 7H3V3" :stroke-width="strokeWidth ?? 1.8" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M3 7a9 9 0 1 1 2.5 10.2" :stroke-width="strokeWidth ?? 1.8" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" />
    </template>
    <template v-else-if="name === 'page'">
      <path d="M7 5v14" :stroke-width="strokeWidth ?? 1.8" stroke="currentColor" stroke-linecap="round" />
      <path d="M17 5v14" :stroke-width="strokeWidth ?? 1.8" stroke="currentColor" stroke-linecap="round" />
      <path d="M10 9l2-2 2 2" :stroke-width="strokeWidth ?? 1.8" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M10 15l2 2 2-2" :stroke-width="strokeWidth ?? 1.8" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" />
    </template>
    <template v-else-if="name === 'annotate'">
      <path d="M5 19l3.5-.8L18 8.7a1.8 1.8 0 0 0-2.6-2.5l-9.4 9.4L5 19Z" :stroke-width="strokeWidth ?? 1.8" stroke="currentColor" stroke-linejoin="round" />
      <path d="M13.5 7.5l3 3" :stroke-width="strokeWidth ?? 1.8" stroke="currentColor" stroke-linecap="round" />
    </template>
    <template v-else-if="name === 'measure'">
      <path d="M5 17L17 5" :stroke-width="strokeWidth ?? 1.8" stroke="currentColor" stroke-linecap="round" />
      <path d="M7 19l-2-2M11 15l-2-2M15 11l-2-2M19 7l-2-2" :stroke-width="strokeWidth ?? 1.8" stroke="currentColor" stroke-linecap="round" />
    </template>
    <template v-else-if="name === 'measure-line'">
      <path d="M6 17L18 7" :stroke-width="strokeWidth ?? 1.8" stroke="currentColor" stroke-linecap="round" />
      <circle cx="6" cy="17" r="1.5" fill="currentColor" />
      <circle cx="18" cy="7" r="1.5" fill="currentColor" />
    </template>
    <template v-else-if="name === 'measure-rect'">
      <rect x="5.5" y="7" width="13" height="10" rx="1.5" :stroke-width="strokeWidth ?? 1.8" stroke="currentColor" />
    </template>
    <template v-else-if="name === 'measure-ellipse'">
      <ellipse cx="12" cy="12" rx="6.5" ry="4.5" :stroke-width="strokeWidth ?? 1.8" stroke="currentColor" />
    </template>
    <template v-else-if="name === 'measure-angle'">
      <path d="M6 17L12 7L18 13" :stroke-width="strokeWidth ?? 1.8" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M10.7 10.4A4.4 4.4 0 0 1 15 12" :stroke-width="strokeWidth ?? 1.8" stroke="currentColor" stroke-linecap="round" />
    </template>
    <template v-else-if="name === 'play'">
      <path d="M9 7.5v9l7-4.5-7-4.5Z" fill="currentColor" />
    </template>
    <template v-else-if="name === 'pause'">
      <rect x="7" y="6.5" width="3.5" height="11" rx="1" fill="currentColor" />
      <rect x="13.5" y="6.5" width="3.5" height="11" rx="1" fill="currentColor" />
    </template>
    <template v-else-if="name === 'stop'">
      <rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" />
    </template>
    <template v-else-if="name === 'export'">
      <path d="M12 4v10" :stroke-width="strokeWidth ?? 1.8" stroke="currentColor" stroke-linecap="round" />
      <path d="M8.5 7.5L12 4l3.5 3.5" :stroke-width="strokeWidth ?? 1.8" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M6 14.5V18h12v-3.5" :stroke-width="strokeWidth ?? 1.8" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" />
    </template>
    <template v-else-if="name === 'pseudocolor'">
      <circle cx="12" cy="12" r="6.5" :stroke-width="strokeWidth ?? 1.8" stroke="currentColor" />
      <path d="M12 5.5A6.5 6.5 0 0 1 18.5 12H12Z" fill="currentColor" fill-opacity="0.55" />
      <path d="M12 12h6.5A6.5 6.5 0 0 1 12 18.5Z" fill="currentColor" fill-opacity="0.35" />
    </template>
    <template v-else-if="name === 'pseudocolor-gray'">
      <circle cx="12" cy="12" r="6.5" :stroke-width="strokeWidth ?? 1.8" stroke="currentColor" />
      <path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h7" :stroke-width="strokeWidth ?? 1.6" stroke="currentColor" stroke-linecap="round" />
    </template>
    <template v-else-if="name === 'pseudocolor-hot'">
      <path d="M12 4c2.2 2.3 4.5 4.9 4.5 8.1A4.5 4.5 0 1 1 7.5 12c0-1.8.9-3.6 2.2-5" :stroke-width="strokeWidth ?? 1.8" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M12 10c1.2 1.1 2 2.1 2 3.2A2 2 0 0 1 10 13c0-.8.4-1.7 1.1-2.5" fill="currentColor" fill-opacity="0.5" />
    </template>
    <template v-else-if="name === 'pseudocolor-pet'">
      <circle cx="12" cy="12" r="6.5" :stroke-width="strokeWidth ?? 1.8" stroke="currentColor" />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" fill-opacity="0.75" />
      <circle cx="12" cy="12" r="4.5" :stroke-width="strokeWidth ?? 1.4" stroke="currentColor" stroke-dasharray="2 2" />
    </template>
    <template v-else-if="name === 'pseudocolor-rainbow'">
      <path d="M5.5 15a6.5 6.5 0 0 1 13 0" :stroke-width="strokeWidth ?? 1.8" stroke="currentColor" stroke-linecap="round" />
      <path d="M7.5 15a4.5 4.5 0 0 1 9 0" :stroke-width="strokeWidth ?? 1.6" stroke="currentColor" stroke-linecap="round" opacity="0.75" />
      <path d="M9.5 15a2.5 2.5 0 0 1 5 0" :stroke-width="strokeWidth ?? 1.4" stroke="currentColor" stroke-linecap="round" opacity="0.5" />
    </template>
    <template v-else-if="name === 'chevron-down'">
      <path d="M7 10l5 5 5-5" :stroke-width="strokeWidth ?? 2" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" />
    </template>
    <template v-else-if="name === 'close'">
      <path d="M7 7l10 10M17 7L7 17" :stroke-width="strokeWidth ?? 2" stroke="currentColor" stroke-linecap="round" />
    </template>
    <template v-else>
      <circle cx="12" cy="12" r="6" :stroke-width="strokeWidth ?? 1.8" stroke="currentColor" />
    </template>
  </svg>
</template>
