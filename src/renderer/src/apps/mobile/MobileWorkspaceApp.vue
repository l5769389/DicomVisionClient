<script setup lang="ts">
import { VApp, VMain } from 'vuetify/components'
import MobileWorkspaceShell from './MobileWorkspaceShell.vue'
</script>

<template>
  <VApp class="mobile-workspace-app bg-transparent text-[var(--theme-text-primary)]">
    <VMain class="h-[100dvh] overflow-hidden bg-transparent">
      <MobileWorkspaceShell />
    </VMain>
  </VApp>
</template>

<style scoped>
.mobile-workspace-app {
  min-height: 100dvh;
  overscroll-behavior: none;
  touch-action: none;
}
</style>
