<script setup lang="ts">
import type { ConnectionState, FolderSeriesItem, ViewType } from '../types/viewer'

defineProps<{
  connectionState: ConnectionState
  hasSelectedSeries: boolean
  isLoadingFolder: boolean
  isSidebarCollapsed: boolean
  selectedSeriesId: string
  seriesList: FolderSeriesItem[]
}>()

const emit = defineEmits<{
  chooseFolder: []
  openView: [viewType: ViewType]
  removeSeries: [seriesId: string]
  selectSeries: [seriesId: string]
  toggleSidebar: []
}>()
</script>

<template>
  <aside
    class="min-h-0 min-w-0 rounded-[26px] border border-sky-100/10 bg-[linear-gradient(180deg,rgba(6,16,29,0.96),rgba(8,18,32,0.98))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_24px_48px_rgba(0,0,0,0.28)] backdrop-blur max-[900px]:max-h-[460px]"
  >
    <div class="flex h-full flex-col gap-3">
      <div
        class="grid min-h-[92px] overflow-hidden rounded-2xl border border-sky-300/30 bg-[radial-gradient(circle_at_top_right,rgba(78,169,255,0.22),transparent_34%),linear-gradient(rgba(120,143,166,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(120,143,166,0.12)_1px,transparent_1px),linear-gradient(180deg,rgba(10,22,38,0.98),rgba(8,16,29,0.96))] bg-[size:auto,18px_18px,18px_18px,auto] p-4"
      >
        <span class="text-[11px] font-semibold uppercase tracking-[0.32em] text-sky-100/55">Diagnostic Workspace</span>
        <span class="mt-2 text-[26px] font-semibold tracking-[0.08em] text-slate-50">DICOM Vision</span>
        <span class="mt-3 max-w-[14rem] text-xs leading-5 text-slate-300/80">Series routing, quick review, MPR and 3D in one focused workspace.</span>
      </div>

      <template v-if="!isSidebarCollapsed">
        <div class="rounded-2xl border border-white/8 bg-slate-900/55 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <div class="mb-3 flex items-center justify-between">
            <span class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300/60">Quick Actions</span>
            <span class="rounded-full border border-sky-200/10 bg-sky-300/8 px-2 py-1 text-[11px] text-sky-100/70">Ready</span>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <button
              type="button"
              class="rounded-full border border-sky-200/20 bg-[linear-gradient(135deg,rgba(75,173,255,0.18),rgba(255,149,92,0.18))] px-4 py-3 text-sm font-semibold text-slate-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_12px_24px_rgba(9,18,32,0.24)] transition hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
              @click="emit('chooseFolder')"
            >
              加载文件夹
            </button>
            <button
              type="button"
              class="rounded-full border border-white/8 bg-white/7 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:bg-white/12 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!hasSelectedSeries"
              @click="emit('openView', 'Stack')"
            >
              快速浏览
            </button>
            <button
              type="button"
              class="rounded-full border border-white/8 bg-white/7 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:bg-white/12 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!hasSelectedSeries"
              @click="emit('openView', '3D')"
            >
              3D
            </button>
            <button
              type="button"
              class="rounded-full border border-white/8 bg-white/7 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:bg-white/12 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!hasSelectedSeries"
              @click="emit('openView', 'MPR')"
            >
              MPR
            </button>
          </div>
        </div>

        <div class="panel-scrollbar min-h-0 flex-1 overflow-auto rounded-2xl border border-white/8 bg-[linear-gradient(180deg,rgba(11,23,38,0.96),rgba(9,17,31,0.98))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <div class="mb-4 flex items-center justify-between gap-2">
            <div>
              <div class="text-sm font-semibold text-slate-50">序列列表</div>
              <div class="mt-1 text-xs text-slate-400">当前文件夹中的可用 DICOM 序列</div>
            </div>
            <span
              v-if="seriesList.length"
              class="rounded-full border border-sky-300/15 bg-sky-300/10 px-2.5 py-1 text-xs font-semibold text-sky-100/80"
            >
              {{ seriesList.length }}
            </span>
          </div>

          <div v-if="isLoadingFolder" class="flex items-center gap-3 rounded-2xl border border-white/6 bg-white/4 px-4 py-3 text-sm text-slate-300">
            <span class="h-2.5 w-2.5 animate-pulse rounded-full bg-sky-300 shadow-[0_0_0_6px_rgba(125,211,252,0.12)]" aria-hidden="true"></span>
            <span>正在加载序列...</span>
          </div>

          <div v-else-if="seriesList.length" class="flex flex-col gap-3">
            <div
              v-for="series in seriesList"
              :key="series.seriesId"
              class="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-2xl border px-3 py-3 transition duration-150"
              :class="
                series.seriesId === selectedSeriesId
                  ? 'border-sky-300/45 bg-[linear-gradient(135deg,rgba(36,110,177,0.32),rgba(217,112,54,0.16))] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_14px_28px_rgba(17,76,130,0.18)]'
                  : 'border-white/6 bg-black/20 hover:border-sky-300/20 hover:bg-white/4'
              "
            >
              <button class="grid min-w-0 grid-cols-[18px_minmax(0,1fr)] items-start gap-x-3 gap-y-1 text-left" type="button" @click="emit('selectSeries', series.seriesId)">
                <span
                  class="mt-0.5 inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border transition"
                  :class="
                    series.seriesId === selectedSeriesId
                      ? 'border-sky-300 bg-[linear-gradient(180deg,rgba(82,172,241,0.22),rgba(235,106,42,0.12))] shadow-[0_0_0_4px_rgba(125,211,252,0.14)]'
                      : 'border-slate-300/45 bg-white/5'
                  "
                >
                  <span class="h-2 w-2 rounded-full" :class="series.seriesId === selectedSeriesId ? 'bg-sky-200' : 'bg-transparent'"></span>
                </span>
                <span class="col-start-2 truncate text-sm font-semibold" :class="series.seriesId === selectedSeriesId ? 'text-white' : 'text-slate-100'">
                  {{ series.seriesDescription || '未命名序列' }}
                </span>
                <span class="col-start-2 text-xs leading-5" :class="series.seriesId === selectedSeriesId ? 'text-sky-50/85' : 'text-slate-400'">
                  {{ series.modality || 'N/A' }} · {{ series.instanceCount }} 帧
                  <template v-if="series.width && series.height"> · {{ series.width }}×{{ series.height }}</template>
                </span>
                <span class="col-start-2 break-all text-[11px] leading-5" :class="series.seriesId === selectedSeriesId ? 'text-sky-100/80' : 'text-slate-500'">
                  {{ series.seriesId }}
                </span>
              </button>

              <button
                type="button"
                class="self-center rounded-xl border border-rose-300/14 bg-rose-400/8 px-3 py-2 text-xs font-medium text-rose-100 transition hover:bg-rose-400/16"
                aria-label="删除序列"
                @click="emit('removeSeries', series.seriesId)"
              >
                删除
              </button>
            </div>
          </div>

          <div v-else class="rounded-2xl border border-dashed border-white/10 bg-white/3 px-4 py-5 text-sm leading-6 text-slate-400">
            加载文件夹后，这里会显示 DICOM 序列列表。
          </div>
        </div>
      </template>

      <div class="mt-auto flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-sky-100/10 bg-[linear-gradient(180deg,rgba(8,17,31,0.92),rgba(7,14,27,0.98))] px-3 py-2.5">
        <div class="min-w-0">
          <div class="mb-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400/70">Connection</div>
          <div class="flex min-w-0 items-center gap-2 text-xs text-slate-200">
            <span
              class="h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_0_5px_rgba(148,163,184,0.1)]"
              :class="{
                'bg-emerald-400 shadow-[0_0_0_5px_rgba(74,222,128,0.14)]': connectionState === 'connected',
                'bg-amber-400 shadow-[0_0_0_5px_rgba(251,191,36,0.14)]': connectionState === 'connecting' || connectionState === 'reconnecting',
                'bg-rose-400 shadow-[0_0_0_5px_rgba(248,113,113,0.14)]': connectionState === 'disconnected',
                'bg-slate-400': !['connected', 'connecting', 'reconnecting', 'disconnected'].includes(connectionState)
              }"
            ></span>
            <span class="truncate capitalize">{{ connectionState }}</span>
          </div>
        </div>

        <button
          type="button"
          class="rounded-xl border border-white/8 bg-white/6 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/12"
          :aria-label="isSidebarCollapsed ? '展开侧栏' : '收起侧栏'"
          @click="emit('toggleSidebar')"
        >
          {{ isSidebarCollapsed ? '>>' : '<<' }}
        </button>
      </div>
    </div>
  </aside>
</template>
