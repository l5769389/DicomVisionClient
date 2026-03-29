<script setup lang="ts">
import { computed, ref } from 'vue'
import { VBtn, VCard, VCardText, VChip, VDialog } from 'vuetify/components'
import AppIcon from './AppIcon.vue'
import type { ConnectionState, FolderSeriesItem, ViewType } from '../types/viewer'

const props = defineProps<{
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
  openSeriesView: [seriesId: string, viewType: ViewType]
  removeSeries: [seriesId: string]
  selectSeries: [seriesId: string]
  toggleSidebar: []
}>()

const isMenuOpen = ref(false)
const hoveredSeries = ref<(FolderSeriesItem & { index: number }) | null>(null)
const hoveredSeriesCardStyle = ref<Record<string, string>>({})

const connectionIcon = computed(() => {
  if (props.connectionState === 'connected') return 'connected'
  if (props.connectionState === 'connecting' || props.connectionState === 'reconnecting') return 'connecting'
  return 'disconnected'
})

const connectionToneClass = computed(() => {
  if (props.connectionState === 'connected') return 'border-emerald-300/18 bg-emerald-400/10 text-emerald-100'
  if (props.connectionState === 'connecting' || props.connectionState === 'reconnecting') return 'border-amber-300/18 bg-amber-400/10 text-amber-50'
  return 'border-rose-300/18 bg-rose-400/10 text-rose-100'
})

const connectionDotClass = computed(() => {
  if (props.connectionState === 'connected') return 'bg-emerald-400 shadow-[0_0_0_5px_rgba(74,222,128,0.14)]'
  if (props.connectionState === 'connecting' || props.connectionState === 'reconnecting') return 'bg-amber-400 shadow-[0_0_0_5px_rgba(251,191,36,0.14)]'
  return 'bg-rose-400 shadow-[0_0_0_5px_rgba(248,113,113,0.14)]'
})

function openMenu(): void {
  isMenuOpen.value = true
}

function closeMenu(): void {
  isMenuOpen.value = false
}

function showSeriesHoverCard(event: MouseEvent | FocusEvent, series: FolderSeriesItem, index: number): void {
  const target = event.currentTarget
  if (!(target instanceof HTMLElement)) return
  const rect = target.getBoundingClientRect()
  hoveredSeries.value = { ...series, index }
  hoveredSeriesCardStyle.value = {
    left: `${rect.right + 14}px`,
    top: `${rect.top + rect.height / 2}px`
  }
}

function hideSeriesHoverCard(): void {
  hoveredSeries.value = null
}
</script>

<template>
  <aside
    class="min-h-0 min-w-0 rounded-[26px] border border-sky-100/10 bg-[linear-gradient(180deg,rgba(6,16,29,0.96),rgba(8,18,32,0.98))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_24px_48px_rgba(0,0,0,0.28)] backdrop-blur max-[900px]:max-h-[460px]"
  >
    <div class="flex h-full flex-col gap-3">
      <template v-if="!props.isSidebarCollapsed">
        <VCard class="relative grid min-h-[92px] overflow-hidden !rounded-2xl !border !border-sky-300/30 !bg-[radial-gradient(circle_at_top_right,rgba(78,169,255,0.22),transparent_34%),linear-gradient(180deg,rgba(10,22,38,0.98),rgba(8,16,29,0.96))] !p-4">
          <div class="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(120,143,166,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(120,143,166,0.12)_1px,transparent_1px)] bg-[size:18px_18px,18px_18px]"></div>
          <span class="text-[11px] font-semibold uppercase tracking-[0.32em] text-sky-100/55">Diagnostic Workspace</span>
          <span class="mt-2 text-[26px] font-semibold tracking-[0.08em] text-slate-50">DICOM Vision</span>
          <span class="mt-3 max-w-[14rem] text-xs leading-5 text-slate-300/80">Series routing, quick review, MPR and 3D in one focused workspace.</span>
        </VCard>

        <VCard class="!rounded-2xl !border !border-white/8 !bg-slate-900/55 !p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <div class="mb-3 flex items-center justify-between">
            <span class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300/60">Quick Actions</span>
            <VChip size="x-small" class="!rounded-full !border !border-sky-200/10 !bg-sky-300/8 !px-2 !py-1 !text-[11px] !text-sky-100/70" variant="flat">Ready</VChip>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <VBtn variant="flat" class="!rounded-full !border !border-sky-200/20 !bg-[linear-gradient(135deg,rgba(75,173,255,0.18),rgba(255,149,92,0.18))] !px-4 !py-3 !text-sm !font-semibold !text-slate-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_12px_24px_rgba(9,18,32,0.24)]" @click="emit('chooseFolder')">加载文件夹</VBtn>
            <VBtn variant="flat" class="!rounded-full !border !border-white/8 !bg-white/7 !px-4 !py-3 !text-sm !font-semibold !text-slate-100" :disabled="!props.hasSelectedSeries" @click="emit('openView', 'Stack')">快速浏览</VBtn>
            <VBtn variant="flat" class="!rounded-full !border !border-white/8 !bg-white/7 !px-4 !py-3 !text-sm !font-semibold !text-slate-100" :disabled="!props.hasSelectedSeries" @click="emit('openView', '3D')">3D</VBtn>
            <VBtn variant="flat" class="!rounded-full !border !border-white/8 !bg-white/7 !px-4 !py-3 !text-sm !font-semibold !text-slate-100" :disabled="!props.hasSelectedSeries" @click="emit('openView', 'MPR')">MPR</VBtn>
          </div>
        </VCard>

        <div class="min-h-0 flex flex-1 flex-col overflow-hidden rounded-2xl border border-white/8 bg-[linear-gradient(180deg,rgba(11,23,38,0.96),rgba(9,17,31,0.98))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <div class="shrink-0">
            <div class="mb-4 flex items-center justify-between gap-2">
              <div>
                <div class="text-sm font-semibold text-slate-50">序列列表</div>
                <div class="mt-1 text-xs text-slate-400">当前已加载的可用 DICOM 序列</div>
              </div>
              <VChip v-if="props.seriesList.length" size="small" class="!rounded-full !border !border-sky-300/15 !bg-sky-300/10 !px-2.5 !py-1 !text-xs !font-semibold !text-sky-100/80" variant="flat">{{ props.seriesList.length }}</VChip>
            </div>
            <div v-if="props.isLoadingFolder && props.seriesList.length" class="mb-4 flex items-center gap-3 rounded-2xl border border-sky-300/10 bg-sky-300/6 px-4 py-2.5 text-xs text-sky-100/75">
              <span class="h-2 w-2 animate-pulse rounded-full bg-sky-300 shadow-[0_0_0_5px_rgba(125,211,252,0.12)]" aria-hidden="true"></span>
              <span>正在加载新序列...</span>
            </div>
          </div>

          <div class="series-list-scroll min-h-0 flex-1 overflow-auto pr-1">
            <div v-if="props.isLoadingFolder && !props.seriesList.length" class="flex items-center gap-3 rounded-2xl border border-white/6 bg-white/4 px-4 py-3 text-sm text-slate-300">
              <span class="h-2.5 w-2.5 animate-pulse rounded-full bg-sky-300 shadow-[0_0_0_6px_rgba(125,211,252,0.12)]" aria-hidden="true"></span>
              <span>正在加载序列...</span>
            </div>
            <div v-else-if="props.seriesList.length" class="flex flex-col gap-3">
              <VCard v-for="series in props.seriesList" :key="series.seriesId" class="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 !rounded-2xl !border !px-3 !py-3 transition duration-150" :class="series.seriesId === props.selectedSeriesId ? '!border-sky-300/45 !bg-[linear-gradient(135deg,rgba(36,110,177,0.34),rgba(217,112,54,0.18))] shadow-[inset_0_1px_0_rgba(255,255,255,0.09),inset_0_-1px_0_rgba(255,255,255,0.03),0_14px_28px_rgba(17,76,130,0.18)]' : '!border-white/8 !bg-[linear-gradient(180deg,rgba(17,28,42,0.74),rgba(10,18,30,0.88))] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_8px_18px_rgba(0,0,0,0.16)] hover:!border-sky-300/22 hover:!bg-[linear-gradient(180deg,rgba(21,34,49,0.82),rgba(12,21,34,0.92))] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_12px_24px_rgba(0,0,0,0.18)]'">
                <button class="grid min-w-0 grid-cols-[18px_minmax(0,1fr)] items-start gap-x-3 gap-y-1 text-left" type="button" @click="emit('selectSeries', series.seriesId)" @dblclick="emit('openSeriesView', series.seriesId, 'Stack')">
                  <span class="mt-0.5 inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border transition" :class="series.seriesId === props.selectedSeriesId ? 'border-sky-300 bg-[linear-gradient(180deg,rgba(82,172,241,0.22),rgba(235,106,42,0.12))] shadow-[0_0_0_4px_rgba(125,211,252,0.14)]' : 'border-slate-300/45 bg-white/5'"><span class="h-2 w-2 rounded-full" :class="series.seriesId === props.selectedSeriesId ? 'bg-sky-200' : 'bg-transparent'"></span></span>
                  <span class="col-start-2 truncate text-sm font-semibold" :class="series.seriesId === props.selectedSeriesId ? 'text-white' : 'text-slate-100'">{{ series.seriesDescription || '未命名序列' }}</span>
                  <span class="col-start-2 text-xs leading-5" :class="series.seriesId === props.selectedSeriesId ? 'text-sky-50/85' : 'text-slate-400'">{{ series.modality || 'N/A' }} · {{ series.instanceCount }} 帧<template v-if="series.width && series.height"> · {{ series.width }}×{{ series.height }}</template></span>
                  <span class="col-start-2 break-all text-[11px] leading-5" :class="series.seriesId === props.selectedSeriesId ? 'text-sky-100/80' : 'text-slate-500'">{{ series.seriesId }}</span>
                </button>
                <VBtn variant="flat" class="self-center !h-10 !w-10 !min-w-0 !rounded-xl !border !border-rose-300/14 !bg-rose-400/8 !text-rose-100" aria-label="删除序列" title="删除序列" @click="emit('removeSeries', series.seriesId)">
                  <AppIcon name="trash" :size="17" />
                </VBtn>
              </VCard>
            </div>
            <div v-else class="rounded-2xl border border-dashed border-white/10 bg-white/3 px-4 py-5 text-sm leading-6 text-slate-400">加载文件夹后，这里会显示 DICOM 序列列表。</div>
          </div>
        </div>

        <div class="mt-auto flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-sky-100/10 bg-[linear-gradient(180deg,rgba(8,17,31,0.92),rgba(7,14,27,0.98))] px-3 py-2.5">
          <div class="min-w-0 flex items-center gap-3">
            <div class="flex h-10 w-10 items-center justify-center rounded-2xl border" :class="connectionToneClass"><AppIcon :name="connectionIcon" :size="18" /></div>
            <div class="min-w-0">
              <div class="mb-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400/70">Connection</div>
              <div class="flex min-w-0 items-center gap-2 text-xs text-slate-200"><span class="h-2.5 w-2.5 shrink-0 rounded-full" :class="connectionDotClass"></span><span class="truncate capitalize">{{ props.connectionState }}</span></div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <VBtn variant="flat" class="!h-11 !w-11 !min-w-0 !rounded-2xl !border !border-white/8 !bg-white/6 !text-slate-100" aria-label="打开设置" @click="openMenu"><AppIcon name="menu" :size="19" /></VBtn>
            <VBtn variant="flat" class="!h-11 !w-11 !min-w-0 !rounded-2xl !border !border-white/8 !bg-white/6 !text-slate-100" aria-label="收起侧栏" @click="emit('toggleSidebar')"><AppIcon name="chevron-left" :size="20" /></VBtn>
          </div>
        </div>
      </template>

      <template v-else>
        <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-visible">
          <div class="flex items-start justify-center pt-2">
            <div class="relative flex h-18 w-18 items-center justify-center overflow-hidden rounded-[28px] border border-sky-300/20 bg-[radial-gradient(circle_at_30%_20%,rgba(103,205,255,0.34),transparent_35%),linear-gradient(180deg,rgba(10,24,40,0.98),rgba(8,16,29,0.96))] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_28px_rgba(0,0,0,0.26)]">
              <div class="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(120,143,166,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(120,143,166,0.12)_1px,transparent_1px)] bg-[size:14px_14px,14px_14px]"></div>
              <div class="absolute inset-[10px] rounded-[20px] border border-white/8 bg-[linear-gradient(145deg,rgba(255,255,255,0.05),rgba(255,255,255,0.01))]"></div>
              <div class="relative flex items-center justify-center"><span class="text-[24px] font-black tracking-[0.18em] text-white">DV</span></div>
            </div>
          </div>

          <div class="min-h-0 flex flex-1 flex-col overflow-visible rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(10,20,34,0.94),rgba(8,15,27,0.98))] px-2 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div class="mb-3 flex items-center justify-center"><VChip size="x-small" class="!rounded-full !border !border-sky-300/12 !bg-sky-300/8 !px-2 !py-1 !text-[9px] !font-semibold !uppercase !tracking-[0.18em] !text-sky-100/70" variant="flat">{{ props.seriesList.length || 0 }}</VChip></div>
            <div class="min-h-0 flex-1 overflow-y-auto overflow-x-visible">
              <div v-if="props.seriesList.length" class="flex flex-col items-center gap-2 pb-1">
                <button v-for="(series, index) in props.seriesList" :key="series.seriesId" type="button" class="flex w-full justify-center" :aria-label="series.seriesDescription || '未命名序列'" :title="`${series.seriesDescription || '未命名序列'} | ${series.modality || 'N/A'} | ${series.instanceCount} 帧`" @mouseenter="showSeriesHoverCard($event, series, index)" @mouseleave="hideSeriesHoverCard" @focus="showSeriesHoverCard($event, series, index)" @blur="hideSeriesHoverCard" @click="emit('selectSeries', series.seriesId)" @dblclick="emit('openSeriesView', series.seriesId, 'Stack')">
                  <span class="flex h-11 w-11 items-center justify-center rounded-2xl border text-[11px] font-bold uppercase transition duration-150" :class="series.seriesId === props.selectedSeriesId ? 'border-sky-300/45 bg-[linear-gradient(180deg,rgba(67,158,229,0.32),rgba(235,106,42,0.16))] text-white shadow-[0_0_0_4px_rgba(125,211,252,0.12)]' : 'border-white/8 bg-white/5 text-slate-300 hover:border-sky-300/22 hover:bg-white/8 hover:text-white'">{{ String(index + 1).padStart(2, '0') }}</span>
                </button>
              </div>
              <div v-else class="flex flex-col items-center gap-2 px-1 py-2 text-center text-[10px] text-slate-500"><div class="flex h-11 w-11 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/3">+</div><span class="leading-4">暂无序列</span></div>
            </div>
          </div>
        </div>

        <div class="mt-auto pt-2">
          <div class="flex flex-col items-center gap-2 rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(8,17,31,0.92),rgba(7,14,27,0.98))] px-2 py-2.5">
            <div class="flex w-full flex-col items-center gap-1 rounded-[18px] border px-2 py-2" :class="connectionToneClass">
              <AppIcon :name="connectionIcon" :size="18" />
              <span class="h-2.5 w-2.5 rounded-full" :class="connectionDotClass"></span>
            </div>
            <VBtn variant="flat" class="!h-10 !w-10 !min-w-0 !rounded-2xl !border !border-white/8 !bg-white/6 !text-slate-100" aria-label="打开设置" @click="openMenu"><AppIcon name="menu" :size="18" /></VBtn>
            <VBtn variant="flat" class="!h-10 !w-10 !min-w-0 !rounded-2xl !border !border-white/8 !bg-white/6 !text-slate-100" aria-label="展开侧栏" @click="emit('toggleSidebar')"><AppIcon name="chevron-right" :size="19" /></VBtn>
          </div>
        </div>
      </template>
    </div>
  </aside>

  <Teleport to="body">
    <div v-if="hoveredSeries && props.isSidebarCollapsed" class="pointer-events-none fixed z-[1200] w-60 -translate-y-1/2 rounded-2xl border border-sky-200/14 bg-[linear-gradient(180deg,rgba(9,19,33,0.98),rgba(8,15,27,0.98))] p-3 text-left shadow-[0_18px_40px_rgba(0,0,0,0.4)]" :style="hoveredSeriesCardStyle">
      <div class="mb-2 flex items-center justify-between gap-2"><span class="truncate text-sm font-semibold text-white">{{ hoveredSeries.seriesDescription || '未命名序列' }}</span><span class="shrink-0 rounded-full border border-sky-300/14 bg-sky-300/8 px-2 py-0.5 text-[10px] font-semibold text-sky-100/80">#{{ hoveredSeries.index + 1 }}</span></div>
      <div class="text-[11px] leading-5 text-slate-300"><div>{{ hoveredSeries.modality || 'N/A' }} · {{ hoveredSeries.instanceCount }} 帧</div><div v-if="hoveredSeries.width && hoveredSeries.height">{{ hoveredSeries.width }}×{{ hoveredSeries.height }}</div><div class="mt-1 break-all text-slate-400">{{ hoveredSeries.seriesId }}</div></div>
    </div>
  </Teleport>

  <Teleport to="body">
    <div v-if="isMenuOpen" class="fixed inset-0 z-[1300] flex items-center justify-center bg-[radial-gradient(circle_at_top,rgba(68,153,224,0.16),transparent_38%),rgba(3,8,15,0.32)] px-4 backdrop-blur-[6px]" @click.self="closeMenu">
      <div class="relative w-full max-w-[760px] overflow-hidden rounded-[30px] border border-sky-200/18 bg-[linear-gradient(180deg,rgba(9,19,33,0.94),rgba(8,15,27,0.97))] shadow-[0_34px_90px_rgba(0,0,0,0.42)]">
        <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(102,204,255,0.16),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(255,148,89,0.12),transparent_24%)]"></div>
        <div class="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent"></div>
        <div class="border-b border-white/8 px-6 py-5">
          <div class="flex items-start justify-between gap-4">
            <div>
              <div class="text-lg font-semibold text-white">Workspace Settings</div>
              <div class="mt-1 text-sm text-slate-400">统一的应用配置对话框，后续可以继续扩展更多设置项。</div>
            </div>
            <button type="button" class="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/8 bg-white/6 text-slate-200 transition hover:bg-white/12" aria-label="关闭设置" @click="closeMenu"><AppIcon name="close" :size="16" /></button>
          </div>
        </div>
        <div class="grid gap-4 px-6 py-6 md:grid-cols-2">
          <div class="rounded-[24px] border border-white/8 bg-white/4 p-4">
            <div class="mb-3 flex items-center gap-2 text-slate-100"><AppIcon name="palette" :size="17" /><span class="text-sm font-semibold">Interface Tone</span></div>
            <div class="rounded-2xl border border-sky-300/12 bg-sky-300/6 p-3">
              <div class="text-sm font-medium text-white">Focused Diagnostic Contrast</div>
              <div class="mt-1 text-xs leading-5 text-slate-400">保持当前深色高对比主题，适合长时间阅片和高亮状态提示。</div>
            </div>
          </div>
          <div class="rounded-[24px] border border-white/8 bg-white/4 p-4">
            <div class="mb-3 flex items-center gap-2 text-slate-100"><AppIcon name="bell" :size="17" /><span class="text-sm font-semibold">Notifications</span></div>
            <div class="space-y-3">
              <div class="flex items-center justify-between rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
                <div>
                  <div class="text-sm font-medium text-white">Load Feedback</div>
                  <div class="mt-1 text-xs text-slate-400">Folder loading and series append feedback</div>
                </div>
                <span class="inline-flex h-6 w-11 items-center rounded-full bg-sky-300/14 p-1"><span class="ml-auto h-4 w-4 rounded-full bg-sky-200"></span></span>
              </div>
              <div class="flex items-center justify-between rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
                <div>
                  <div class="text-sm font-medium text-white">Reconnect Notice</div>
                  <div class="mt-1 text-xs text-slate-400">Socket reconnect and backend state prompts</div>
                </div>
                <span class="rounded-full border border-amber-300/16 bg-amber-400/10 px-2 py-1 text-[10px] font-semibold text-amber-50">Enabled</span>
              </div>
            </div>
          </div>
          <div class="rounded-[24px] border border-white/8 bg-white/4 p-4">
            <div class="mb-3 flex items-center gap-2 text-slate-100"><AppIcon name="shield" :size="17" /><span class="text-sm font-semibold">Session Guard</span></div>
            <div class="flex items-center justify-between rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
              <div>
                <div class="text-sm font-medium text-white">Viewport Sync</div>
                <div class="mt-1 text-xs text-slate-400">Keep render and interaction state aligned</div>
              </div>
              <span class="rounded-full border border-emerald-300/14 bg-emerald-400/10 px-2 py-1 text-[10px] font-semibold text-emerald-100">Active</span>
            </div>
          </div>
          <div class="rounded-[24px] border border-white/8 bg-white/4 p-4">
            <div class="mb-3 flex items-center gap-2 text-slate-100"><AppIcon name="settings" :size="17" /><span class="text-sm font-semibold">Scaffold</span></div>
            <div class="rounded-2xl border border-dashed border-white/10 bg-white/3 px-3 py-4 text-xs leading-5 text-slate-400">这里预留给后续更多 app 配置项，例如渲染偏好、快捷键、后端地址与缓存策略。</div>
          </div>
        </div>
        <div class="border-t border-white/8 px-6 py-4 text-[11px] text-slate-500">当前为设计稿式 dialog，后续可直接接入真实设置状态。</div>
      </div>
    </div>
  </Teleport>
</template>

