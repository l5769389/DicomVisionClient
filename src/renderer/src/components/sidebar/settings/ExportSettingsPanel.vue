<script setup lang="ts">
import AppIcon from '../../AppIcon.vue'
import { useExportSettings } from '../../../composables/settings/useExportSettings'
import { useUiLocale } from '../../../composables/ui/useUiLocale'

const { settingsCopy: copy } = useUiLocale()
const {
  canOpenDefaultExportLocation,
  canPickCustomExportLocation,
  customExportLocationLabel,
  exportCustomLocationHint,
  exportLocationDescription,
  exportLocationError,
  exportLocationLabel,
  exportPreference,
  handleChooseExportLocation,
  handleClearExportLocation,
  handleOpenDefaultExportLocation,
  handleSelectCustomExportMode,
  handleSelectDefaultExportMode,
  isChoosingExportLocation,
  updateExportOverlayPreference,
  updateUseDefaultFileName
} = useExportSettings(copy)
</script>

<template>
  <div class="space-y-5">
    <section class="overflow-hidden rounded-[28px] border border-[var(--theme-border-soft)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--theme-surface-panel-strong)_88%,black),color-mix(in_srgb,var(--theme-surface-card)_82%,black))]">
      <div class="flex flex-col gap-5 border-b border-[var(--theme-border-soft)] px-5 py-5 md:flex-row md:items-start md:justify-between">
        <div class="min-w-0">
          <div class="flex items-center gap-2 text-[var(--theme-text-primary)]">
            <span class="grid h-10 w-10 place-items-center rounded-2xl border border-[color:color-mix(in_srgb,var(--theme-accent)_28%,var(--theme-border-soft))] bg-[color:color-mix(in_srgb,var(--theme-accent)_13%,transparent)] text-[var(--theme-accent)]">
              <AppIcon name="export" :size="20" />
            </span>
            <div>
              <div class="text-lg font-semibold">{{ copy.exportTitle }}</div>
              <div class="mt-1 text-xs leading-5 text-[var(--theme-text-secondary)]">{{ copy.exportDesc }}</div>
            </div>
          </div>
        </div>

        <div class="flex shrink-0 rounded-2xl border border-[var(--theme-border-soft)] bg-[var(--theme-surface-panel)] p-1">
          <button
            type="button"
            class="min-w-24 rounded-xl px-3 py-2 text-xs font-semibold transition"
            :class="exportPreference.locationMode === 'default' ? 'bg-[var(--theme-surface-card-soft)] text-[var(--theme-text-primary)] shadow-[0_8px_18px_rgba(0,0,0,0.18)]' : 'text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)]'"
            @click="handleSelectDefaultExportMode"
          >
            {{ copy.exportDefaultBadge }}
          </button>
          <button
            type="button"
            class="min-w-24 rounded-xl px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!canPickCustomExportLocation"
            :class="exportPreference.locationMode === 'custom' ? 'bg-[var(--theme-surface-card-soft)] text-[var(--theme-text-primary)] shadow-[0_8px_18px_rgba(0,0,0,0.18)]' : 'text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)]'"
            @click="handleSelectCustomExportMode"
          >
            {{ copy.exportCustomBadge }}
          </button>
        </div>
      </div>

      <div class="grid gap-0 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div class="space-y-4 border-b border-[var(--theme-border-soft)] p-5 xl:border-b-0 xl:border-r">
          <div class="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              class="group min-h-[138px] rounded-[22px] border px-4 py-4 text-left transition duration-150"
              :class="exportPreference.locationMode === 'default' ? 'border-[color:color-mix(in_srgb,var(--theme-accent)_58%,var(--theme-border-strong))] bg-[color:color-mix(in_srgb,var(--theme-accent)_12%,var(--theme-surface-card))]' : 'border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] hover:border-[var(--theme-border-strong)] hover:bg-[var(--theme-surface-card-soft)]'"
              @click="handleSelectDefaultExportMode"
            >
              <div class="flex h-full flex-col justify-between gap-4">
                <div>
                  <div class="flex items-center justify-between gap-3">
                    <div class="text-sm font-semibold text-[var(--theme-text-primary)]">{{ copy.exportDefault }}</div>
                    <span
                      class="h-3 w-3 rounded-full border"
                      :class="exportPreference.locationMode === 'default' ? 'border-[var(--theme-accent)] bg-[var(--theme-accent)] shadow-[0_0_0_4px_color-mix(in_srgb,var(--theme-accent)_18%,transparent)]' : 'border-[var(--theme-border-strong)] bg-transparent'"
                    ></span>
                  </div>
                  <div class="mt-2 text-xs leading-5 text-[var(--theme-text-secondary)]">{{ copy.exportDefaultHint }}</div>
                </div>
                <div v-if="exportLocationLabel" class="line-clamp-2 break-all text-[11px] font-medium text-[var(--theme-text-muted)]">
                  {{ exportLocationLabel }}
                </div>
              </div>
            </button>

            <button
              type="button"
              class="group min-h-[138px] rounded-[22px] border px-4 py-4 text-left transition duration-150 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="!canPickCustomExportLocation"
              :class="exportPreference.locationMode === 'custom' ? 'border-[color:color-mix(in_srgb,var(--theme-accent)_58%,var(--theme-border-strong))] bg-[color:color-mix(in_srgb,var(--theme-accent)_12%,var(--theme-surface-card))]' : 'border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] hover:border-[var(--theme-border-strong)] hover:bg-[var(--theme-surface-card-soft)]'"
              @click="handleSelectCustomExportMode"
            >
              <div class="flex h-full flex-col justify-between gap-4">
                <div>
                  <div class="flex items-center justify-between gap-3">
                    <div class="text-sm font-semibold text-[var(--theme-text-primary)]">{{ copy.exportCustom }}</div>
                    <span
                      class="h-3 w-3 rounded-full border"
                      :class="exportPreference.locationMode === 'custom' ? 'border-[var(--theme-accent)] bg-[var(--theme-accent)] shadow-[0_0_0_4px_color-mix(in_srgb,var(--theme-accent)_18%,transparent)]' : 'border-[var(--theme-border-strong)] bg-transparent'"
                    ></span>
                  </div>
                  <div class="mt-2 text-xs leading-5 text-[var(--theme-text-secondary)]">{{ exportCustomLocationHint }}</div>
                </div>
                <div class="line-clamp-2 break-all text-[11px] font-medium text-[var(--theme-text-muted)]">
                  {{ customExportLocationLabel }}
                </div>
              </div>
            </button>
          </div>

          <div class="rounded-[22px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-panel)] px-4 py-4">
            <div class="flex flex-col gap-4">
              <div class="min-w-0">
                <div class="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--theme-text-muted)]">{{ copy.exportCurrentLocation }}</div>
                <div class="mt-2 max-w-full break-words text-sm font-medium leading-6 text-[var(--theme-text-primary)] [overflow-wrap:anywhere]">{{ exportLocationLabel }}</div>
                <div class="mt-2 text-xs leading-6 text-[var(--theme-text-secondary)]">{{ exportLocationDescription }}</div>
              </div>
              <div class="flex flex-wrap gap-2">
                <button
                  v-if="canOpenDefaultExportLocation"
                  type="button"
                  class="theme-button-primary min-w-[150px] rounded-2xl px-4 py-2 text-sm font-semibold"
                  @click="handleOpenDefaultExportLocation"
                >
                  {{ copy.exportOpenLocation }}
                </button>
                <template v-if="exportPreference.locationMode === 'custom'">
                  <button
                    type="button"
                    class="theme-button-primary min-w-[150px] rounded-2xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                    :disabled="!canPickCustomExportLocation || isChoosingExportLocation"
                    @click="handleChooseExportLocation"
                  >
                    {{ isChoosingExportLocation ? '...' : copy.exportChooseLocation }}
                  </button>
                  <button
                    type="button"
                    class="theme-button-secondary min-w-[170px] rounded-2xl px-4 py-2 text-sm font-medium"
                    @click="handleClearExportLocation"
                  >
                    {{ copy.exportClearLocation }}
                  </button>
                </template>
              </div>
            </div>
            <div
              v-if="exportLocationError"
              class="mt-3 rounded-[16px] border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs leading-6 text-red-100"
            >
              {{ exportLocationError }}
            </div>
          </div>

          <label class="flex cursor-pointer items-center justify-between gap-4 rounded-[22px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] px-4 py-4 transition hover:border-[var(--theme-border-strong)]">
            <span class="min-w-0">
              <span class="block text-sm font-semibold text-[var(--theme-text-primary)]">{{ copy.exportFileNameTitle }}</span>
              <span class="mt-1 block text-xs leading-5 text-[var(--theme-text-secondary)]">{{ copy.exportUseDefaultFileNameHint }}</span>
            </span>
            <span class="relative h-7 w-12 shrink-0 rounded-full border border-[var(--theme-border-soft)] transition" :class="exportPreference.useDefaultFileName ? 'bg-[var(--theme-accent)]' : 'bg-[var(--theme-surface-panel-strong)]'">
              <input
                type="checkbox"
                class="peer sr-only"
                :checked="exportPreference.useDefaultFileName"
                @change="updateUseDefaultFileName(($event.target as HTMLInputElement).checked)"
              />
              <span class="absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5"></span>
            </span>
          </label>
        </div>

        <div class="p-5">
          <div class="mb-4 flex items-center justify-between gap-3">
            <div>
              <div class="text-sm font-semibold text-[var(--theme-text-primary)]">{{ copy.exportFormats }}</div>
              <div class="mt-1 text-xs leading-5 text-[var(--theme-text-secondary)]">{{ copy.exportIncludeOverlaysHint }}</div>
            </div>
          </div>

          <div class="grid gap-4 md:grid-cols-2">
            <div class="rounded-[24px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] p-4">
              <div class="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div class="text-base font-semibold text-[var(--theme-text-primary)]">PNG</div>
                  <div class="mt-1 text-xs text-[var(--theme-text-muted)]">F10</div>
                </div>
                <span class="rounded-full border border-[color:color-mix(in_srgb,var(--theme-accent)_26%,var(--theme-border-soft))] bg-[color:color-mix(in_srgb,var(--theme-accent)_10%,transparent)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--theme-text-secondary)]">image</span>
              </div>
              <div class="space-y-2">
                <label class="flex cursor-pointer items-center justify-between gap-3 rounded-[16px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-panel)] px-3 py-3 transition hover:border-[var(--theme-border-strong)]">
                  <span class="text-xs font-semibold text-[var(--theme-text-primary)]">{{ copy.exportIncludePngMeasurements }}</span>
                  <input
                    type="checkbox"
                    class="h-4 w-4 rounded border-[var(--theme-border-soft)] accent-[var(--theme-accent)]"
                    :checked="exportPreference.includePngMeasurements"
                    @change="updateExportOverlayPreference('png', 'measurements', ($event.target as HTMLInputElement).checked)"
                  />
                </label>
                <label class="flex cursor-pointer items-center justify-between gap-3 rounded-[16px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-panel)] px-3 py-3 transition hover:border-[var(--theme-border-strong)]">
                  <span class="text-xs font-semibold text-[var(--theme-text-primary)]">{{ copy.exportIncludePngAnnotations }}</span>
                  <input
                    type="checkbox"
                    class="h-4 w-4 rounded border-[var(--theme-border-soft)] accent-[var(--theme-accent)]"
                    :checked="exportPreference.includePngAnnotations"
                    @change="updateExportOverlayPreference('png', 'annotations', ($event.target as HTMLInputElement).checked)"
                  />
                </label>
                <label class="flex cursor-pointer items-center justify-between gap-3 rounded-[16px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-panel)] px-3 py-3 transition hover:border-[var(--theme-border-strong)]">
                  <span class="text-xs font-semibold text-[var(--theme-text-primary)]">{{ copy.exportIncludePngCornerInfo }}</span>
                  <input
                    type="checkbox"
                    class="h-4 w-4 rounded border-[var(--theme-border-soft)] accent-[var(--theme-accent)]"
                    :checked="exportPreference.includePngCornerInfo"
                    @change="updateExportOverlayPreference('png', 'cornerInfo', ($event.target as HTMLInputElement).checked)"
                  />
                </label>
              </div>
            </div>

            <div class="rounded-[24px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-card)] p-4">
              <div class="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div class="text-base font-semibold text-[var(--theme-text-primary)]">DICOM</div>
                  <div class="mt-1 text-xs text-[var(--theme-text-muted)]">F11</div>
                </div>
                <span class="rounded-full border border-[color:color-mix(in_srgb,var(--theme-accent-warm)_28%,var(--theme-border-soft))] bg-[color:color-mix(in_srgb,var(--theme-accent-warm)_10%,transparent)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--theme-text-secondary)]">dataset</span>
              </div>
              <div class="space-y-2">
                <label class="flex cursor-pointer items-center justify-between gap-3 rounded-[16px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-panel)] px-3 py-3 transition hover:border-[var(--theme-border-strong)]">
                  <span class="text-xs font-semibold text-[var(--theme-text-primary)]">{{ copy.exportIncludeDicomMeasurements }}</span>
                  <input
                    type="checkbox"
                    class="h-4 w-4 rounded border-[var(--theme-border-soft)] accent-[var(--theme-accent)]"
                    :checked="exportPreference.includeDicomMeasurements"
                    @change="updateExportOverlayPreference('dicom', 'measurements', ($event.target as HTMLInputElement).checked)"
                  />
                </label>
                <label class="flex cursor-pointer items-center justify-between gap-3 rounded-[16px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-panel)] px-3 py-3 transition hover:border-[var(--theme-border-strong)]">
                  <span class="text-xs font-semibold text-[var(--theme-text-primary)]">{{ copy.exportIncludeDicomAnnotations }}</span>
                  <input
                    type="checkbox"
                    class="h-4 w-4 rounded border-[var(--theme-border-soft)] accent-[var(--theme-accent)]"
                    :checked="exportPreference.includeDicomAnnotations"
                    @change="updateExportOverlayPreference('dicom', 'annotations', ($event.target as HTMLInputElement).checked)"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
