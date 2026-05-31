<script setup lang="ts">
defineProps<{
  viewerPlatform: 'desktop' | 'web'
}>()
</script>

<template>
  <div class="sidebar-brand-card relative overflow-hidden rounded-2xl border px-3.5 py-2.5">
    <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,color-mix(in_srgb,var(--theme-accent)_18%,transparent),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_60%)]"></div>
    <div class="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[color:color-mix(in_srgb,var(--theme-accent)_28%,transparent)] to-transparent"></div>

    <div class="relative z-[1] flex items-center gap-2.5">
      <div class="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[color:color-mix(in_srgb,var(--theme-accent)_28%,transparent)] bg-[color:color-mix(in_srgb,var(--theme-accent)_10%,transparent)] text-[var(--theme-accent)]">
        <span class="text-[14px] font-black tracking-[0.06em]">DV</span>
      </div>
      <div class="min-w-0 flex-1">
        <div class="whitespace-nowrap text-[9px] font-semibold uppercase tracking-[0.16em] text-[color:color-mix(in_srgb,var(--theme-text-secondary)_78%,var(--theme-accent)_22%)]">Diagnostic Workspace</div>
        <div class="mt-0.5 flex min-w-0 items-baseline gap-2">
          <div class="min-w-0 truncate text-lg font-semibold leading-none tracking-[0.02em] text-[var(--theme-text-primary)]">DICOM Vision</div>
          <div class="sidebar-brand-platform shrink-0 rounded-full border px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.1em] text-[var(--theme-text-secondary)]">
            {{ viewerPlatform === 'web' ? 'Web' : 'Desktop' }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sidebar-brand-card {
  border-color: var(--theme-border-soft);
  background: var(--theme-surface-panel);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 10px 20px color-mix(in srgb, black 14%, transparent);
}

:global(:root[data-theme="clinical-light"]) .sidebar-brand-card {
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.78),
    0 10px 22px color-mix(in srgb, var(--theme-accent-strong) 10%, transparent);
}

.sidebar-brand-platform {
  border-color: color-mix(in srgb, var(--theme-accent) 22%, transparent);
  background: color-mix(in srgb, var(--theme-accent) 7%, var(--theme-surface-card-soft));
}
</style>
