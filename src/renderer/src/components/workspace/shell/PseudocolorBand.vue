<script setup lang="ts">
import { computed } from 'vue'
import { getPseudocolorGradient } from '../../../constants/pseudocolor'

const props = defineProps<{
  preset: string
  compact?: boolean
}>()

const gradient = computed(() => getPseudocolorGradient(props.preset))
</script>

<template>
  <span
    class="inline-flex shrink-0 overflow-hidden rounded-full border border-white/14 bg-slate-950/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
    :class="compact ? 'h-[14px] w-[30px]' : 'h-[14px] w-[70px]'"
  >
    <span class="h-full w-full rounded-full" :style="{ background: gradient }"></span>
  </span>
</template>
