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
    class="pseudocolor-band relative isolate inline-flex shrink-0 overflow-hidden rounded-full border border-white/14 bg-slate-950/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
    :class="compact ? 'h-[14px] w-[30px]' : 'h-[14px] w-[70px]'"
    :style="{ '--pseudocolor-band-gradient': gradient }"
  >
    <span class="pseudocolor-band__fill" aria-hidden="true"></span>
  </span>
</template>

<style scoped>
.pseudocolor-band__fill {
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  background: var(--pseudocolor-band-gradient);
  transform: translateZ(0);
}
</style>
