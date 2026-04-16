<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { VBtn, VCard, VChip, VDivider, VList, VListItem, VMenu, VPagination, VTextField } from 'vuetify/components'
import type { DicomTagItem, ViewerTabItem } from '../../../types/viewer'

const props = defineProps<{
  activeTab: ViewerTabItem
}>()

const emit = defineEmits<{
  indexChange: [payload: { tabKey: string; index: number }]
}>()

type ContextAction = 'row' | 'tag' | 'name' | 'value'

const currentDisplayIndex = computed(() => (props.activeTab.tagIndex ?? 0) + 1)
const totalDisplayCount = computed(() => Math.max(1, props.activeTab.tagTotal ?? 1))
const searchQuery = ref('')
const pageInput = ref('1')
const isContextMenuOpen = ref(false)
const contextMenuPosition = ref({
  x: 0,
  y: 0
})
const contextMenuItem = ref<DicomTagItem | null>(null)

const filteredTagItems = computed(() => {
  const items = props.activeTab.tagItems ?? []
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) {
    return items
  }

  return items.filter((item) => {
    const fields = [item.tag, item.name, item.value, item.keyword]
    return fields.some((field) => (field ?? '').toLowerCase().includes(query))
  })
})

const contextMenuAnchorStyle = computed(() => ({
  left: `${contextMenuPosition.value.x}px`,
  top: `${contextMenuPosition.value.y}px`
}))

const contextMenuPreview = computed(() => {
  if (!contextMenuItem.value) {
    return { tag: '', name: '', value: '' }
  }

  const value = contextMenuItem.value.value || '--'
  return {
    tag: contextMenuItem.value.tag || '--',
    name: resolveTagName(contextMenuItem.value),
    value: value.length > 96 ? `${value.slice(0, 96)}...` : value
  }
})

const contextMenuActions = computed(() => [
  {
    key: 'row' as const,
    title: '复制本行',
    subtitle: 'Tag / Name / VR / Value',
    badge: 'ROW'
  },
  {
    key: 'tag' as const,
    title: '复制 Tag ID',
    subtitle: contextMenuPreview.value.tag,
    badge: 'TAG'
  },
  {
    key: 'name' as const,
    title: '复制 Name',
    subtitle: contextMenuPreview.value.name,
    badge: 'NAME'
  },
  {
    key: 'value' as const,
    title: '复制 Value',
    subtitle: contextMenuPreview.value.value,
    badge: 'VAL'
  }
])

watch(
  () => [props.activeTab.key, props.activeTab.tagIndex, props.activeTab.tagTotal] as const,
  () => {
    pageInput.value = String(currentDisplayIndex.value)
  },
  { immediate: true }
)

watch(
  () => props.activeTab.key,
  () => {
    closeContextMenu()
    contextMenuItem.value = null
  }
)

function goToPage(page: number): void {
  const nextPage = Math.max(1, Math.min(page, totalDisplayCount.value))
  pageInput.value = String(nextPage)
  const nextIndex = nextPage - 1
  if (nextIndex === (props.activeTab.tagIndex ?? 0)) {
    return
  }

  emit('indexChange', {
    tabKey: props.activeTab.key,
    index: nextIndex
  })
}

function submitPageInput(): void {
  const parsed = Number.parseInt(pageInput.value.trim(), 10)
  if (!Number.isFinite(parsed)) {
    pageInput.value = String(currentDisplayIndex.value)
    return
  }

  goToPage(parsed)
}

function closeContextMenu(): void {
  isContextMenuOpen.value = false
}

function handleRowContextMenu(event: MouseEvent, item: DicomTagItem): void {
  event.preventDefault()
  contextMenuItem.value = item
  contextMenuPosition.value = {
    x: event.clientX,
    y: event.clientY
  }
  isContextMenuOpen.value = true
}

function resolveTagName(item: DicomTagItem): string {
  return item.name || item.keyword || '--'
}

function buildRowText(item: DicomTagItem): string {
  return [item.tag || '--', resolveTagName(item), item.vr || '--', item.value || '--'].join('\t')
}

async function writeClipboardText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textArea = document.createElement('textarea')
  textArea.value = text
  textArea.setAttribute('readonly', 'true')
  textArea.style.position = 'fixed'
  textArea.style.opacity = '0'
  textArea.style.pointerEvents = 'none'
  document.body.appendChild(textArea)
  textArea.select()
  document.execCommand('copy')
  document.body.removeChild(textArea)
}

async function handleContextAction(action: ContextAction): Promise<void> {
  if (!contextMenuItem.value) {
    return
  }

  if (action === 'row') {
    await writeClipboardText(buildRowText(contextMenuItem.value))
  } else if (action === 'tag') {
    await writeClipboardText(contextMenuItem.value.tag || '--')
  } else if (action === 'name') {
    await writeClipboardText(resolveTagName(contextMenuItem.value))
  } else {
    await writeClipboardText(contextMenuItem.value.value || '--')
  }

  closeContextMenu()
}
</script>

<template>
  <section class="flex h-full min-h-0 flex-col overflow-hidden rounded-[22px] border border-white/8 bg-[radial-gradient(circle_at_top,rgba(42,88,141,0.14),transparent_26%),linear-gradient(180deg,rgba(9,18,31,0.96),rgba(6,12,22,0.99))]">
    <header class="border-b border-white/8 px-5 py-5">
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <h2 class="truncate text-[22px] font-semibold tracking-[0.01em] text-white">{{ activeTab.seriesTitle }}</h2>
          <VChip size="small" variant="flat" class="rounded-full! border! border-sky-300/18! bg-sky-300/10! px-3! text-[11px]! font-semibold! uppercase! tracking-[0.18em]! text-sky-100!">
            DICOM Tags
          </VChip>
        </div>

        <div class="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-300">
          <span class="rounded-full border border-white/8 bg-white/5 px-3 py-1.5">实例 {{ currentDisplayIndex }} / {{ totalDisplayCount }}</span>
          <span v-if="activeTab.tagInstanceNumber != null" class="rounded-full border border-white/8 bg-white/5 px-3 py-1.5">Instance {{ activeTab.tagInstanceNumber }}</span>
          <span v-if="activeTab.tagSopInstanceUid" class="max-w-full truncate rounded-full border border-white/8 bg-white/5 px-3 py-1.5">SOP {{ activeTab.tagSopInstanceUid }}</span>
          <span
            v-if="activeTab.tagFilePath"
            class="min-w-0 max-w-full truncate rounded-full border border-slate-700/80 bg-slate-950/88 px-3 py-1.5 font-mono text-[12px] text-slate-400"
          >
            {{ activeTab.tagFilePath }}
          </span>
        </div>
      </div>
    </header>

    <div class="border-b border-white/8 px-5 py-4">
      <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div class="rounded-[18px] border border-white/8 bg-white/4 p-3">
          <div class="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Instance Navigation</div>
          <div class="flex flex-wrap items-center gap-3">
            <VPagination
              :model-value="currentDisplayIndex"
              :length="totalDisplayCount"
              :total-visible="7"
              active-color="sky-lighten-2"
              class="min-w-0 flex-1"
              density="comfortable"
              :disabled="activeTab.tagIsLoading"
              @update:model-value="goToPage"
            />
            <div class="flex items-center gap-2">
              <VTextField
                v-model="pageInput"
                class="tag-field w-[94px]"
                density="compact"
                hide-details
                label="页码"
                variant="outlined"
                bg-color="rgba(7,12,21,1)"
                color="rgb(125,211,252)"
                :disabled="activeTab.tagIsLoading"
                @keydown.enter.prevent="submitPageInput"
                @blur="submitPageInput"
              />
              <VBtn
                variant="flat"
                class="rounded-full! border! border-white/8! bg-white/7! px-4! text-sm! font-semibold! text-slate-100!"
                :disabled="activeTab.tagIsLoading"
                @click="submitPageInput"
              >
                跳转
              </VBtn>
            </div>
          </div>
        </div>

        <div class="rounded-[18px] border border-white/8 bg-white/4 p-3">
          <div class="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Filter</div>
          <VTextField
            v-model="searchQuery"
            class="tag-field"
            clearable
            density="comfortable"
            hide-details
            label="搜索 Tag / Name / Value"
            variant="outlined"
            bg-color="rgba(7,12,21,1)"
            color="rgb(125,211,252)"
          />
        </div>
      </div>
    </div>

    <div class="min-h-0 flex-1 px-5 py-5">
      <div v-if="activeTab.tagIsLoading" class="grid h-full min-h-[260px] place-items-center rounded-[18px] border border-white/8 bg-white/4 text-sm text-slate-300">
        正在读取 DICOM Tags...
      </div>

      <div v-else-if="activeTab.tagLoadError" class="grid h-full min-h-[260px] place-items-center rounded-[18px] border border-rose-300/18 bg-rose-400/8 px-6 text-center text-sm text-rose-100">
        {{ activeTab.tagLoadError }}
      </div>

      <div v-else-if="activeTab.tagItems?.length" class="flex h-full min-h-0 flex-col overflow-hidden rounded-[18px] border border-white/8 bg-[linear-gradient(180deg,rgba(6,14,25,0.86),rgba(4,10,19,0.94))] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <div class="grid grid-cols-[150px_240px_90px_minmax(260px,1fr)] gap-4 border-b border-white/8 bg-white/6 px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300">
          <span>Tag</span>
          <span>Name</span>
          <span>VR</span>
          <span>Value</span>
        </div>

        <div class="min-h-0 flex-1 overflow-auto">
          <div
            v-for="(item, index) in filteredTagItems"
            :key="`${item.tag}-${item.keyword}-${index}`"
            class="grid grid-cols-[150px_240px_90px_minmax(260px,1fr)] gap-4 border-b border-white/6 px-6 py-4 text-sm text-slate-200 transition-colors duration-150 hover:bg-white/3 last:border-b-0"
            :class="{ 'tag-row--menu-open': isContextMenuOpen && contextMenuItem === item }"
            @contextmenu="handleRowContextMenu($event, item)"
          >
            <span class="font-mono text-[13px] text-sky-200/85">{{ item.tag || '--' }}</span>
            <div class="min-w-0" :style="{ paddingLeft: `${item.depth * 14}px` }">
              <div class="truncate text-[15px] font-medium text-white">{{ item.name || item.keyword || '--' }}</div>
              <div v-if="item.keyword" class="mt-1 truncate font-mono text-[11px] text-slate-500">{{ item.keyword }}</div>
            </div>
            <span class="font-mono text-[13px] font-semibold text-amber-200/85">{{ item.vr || '--' }}</span>
            <span class="whitespace-pre-wrap break-all font-mono text-[13px] leading-6 text-slate-300">{{ item.value || '--' }}</span>
          </div>

          <div v-if="!filteredTagItems.length" class="grid h-full min-h-[260px] place-items-center px-6 text-center text-sm text-slate-400">
            没有匹配的 Tag 结果。
          </div>
        </div>

        <div v-if="contextMenuItem" class="fixed z-[2000] h-0 w-0" :style="contextMenuAnchorStyle">
          <VMenu
            v-model="isContextMenuOpen"
            activator="parent"
            location="bottom start"
            :offset="8"
            scroll-strategy="reposition"
            :close-on-content-click="true"
          >
            <VCard class="tag-context-menu min-w-[260px] overflow-hidden rounded-[22px]! border! border-cyan-200/14! bg-[linear-gradient(180deg,rgba(8,18,31,0.99),rgba(5,11,20,0.995))]! text-slate-100! shadow-[0_24px_52px_rgba(0,0,0,0.46)]!">
              <div class="tag-context-menu__chrome"></div>
              <div class="relative px-2.5 pb-2.5 pt-2.5">
                <div class="rounded-[16px] border border-white/8 bg-white/[0.04] px-3.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <div class="text-[9px] font-semibold uppercase tracking-[0.22em] text-cyan-200/70">Tag Actions</div>
                      <div class="mt-1 truncate font-mono text-[12px] text-cyan-100">{{ contextMenuPreview.tag }}</div>
                      <div class="mt-0.5 truncate text-[12px] font-medium text-white">{{ contextMenuPreview.name }}</div>
                    </div>
                    <div class="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-[5px] text-[9px] font-semibold uppercase tracking-[0.16em] text-cyan-100">
                      Copy
                    </div>
                  </div>
                </div>

                <VDivider class="my-2.5 border-white/8 opacity-100" />

                <VList class="bg-transparent! py-0!">
                  <VListItem
                    v-for="action in contextMenuActions"
                    :key="action.key"
                    class="tag-context-menu__item rounded-[16px]! px-2.5! py-1.5! text-slate-100!"
                    @click="void handleContextAction(action.key)"
                  >
                    <div class="flex items-center gap-2.5">
                      <div class="tag-context-menu__badge">{{ action.badge }}</div>
                      <div class="min-w-0 flex-1">
                        <div class="truncate text-[12px] font-medium text-white">{{ action.title }}</div>
                        <div class="truncate text-[11px] text-slate-400">{{ action.subtitle }}</div>
                      </div>
                    </div>
                  </VListItem>
                </VList>
              </div>
            </VCard>
          </VMenu>
        </div>
      </div>

      <div v-else class="grid h-full min-h-[260px] place-items-center rounded-[18px] border border-dashed border-white/10 bg-white/3 text-sm text-slate-400">
        当前实例没有可展示的 DICOM Tags。
      </div>
    </div>
  </section>
</template>

<style scoped>
:deep(.tag-field .v-field) {
  border-radius: 14px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.04),
    0 0 0 1px rgba(148, 163, 184, 0.18);
}

:deep(.tag-field .v-field--variant-outlined) {
  background: rgba(7, 12, 21, 1);
}

:deep(.tag-field .v-field--variant-outlined .v-field__outline) {
  --v-field-border-opacity: 1;
  color: rgba(148, 163, 184, 0.62);
}

:deep(.tag-field .v-field__input) {
  color: rgba(241, 245, 249, 0.96);
  padding-left: 12px;
  padding-right: 12px;
}

:deep(.tag-field .v-label) {
  color: rgba(148, 163, 184, 0.88);
  padding-left: 4px;
}

:deep(.tag-field .v-field--focused) {
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.05),
    0 0 0 1px rgba(125, 211, 252, 0.34),
    0 0 0 4px rgba(56, 189, 248, 0.08);
}

:deep(.tag-field .v-field--focused .v-field__outline) {
  color: rgba(125, 211, 252, 0.86);
}

.tag-row--menu-open {
  background:
    linear-gradient(90deg, rgba(34, 211, 238, 0.06), rgba(56, 189, 248, 0.03)),
    rgba(125, 211, 252, 0.08);
  box-shadow: inset 2px 0 0 rgba(103, 232, 249, 0.65);
}

.tag-context-menu {
  position: relative;
  backdrop-filter: blur(16px);
}

.tag-context-menu__chrome {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at top right, rgba(125, 211, 252, 0.18), transparent 30%),
    radial-gradient(circle at bottom left, rgba(56, 189, 248, 0.14), transparent 32%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent 34%);
  pointer-events: none;
}

.tag-context-menu__item {
  min-height: 50px;
  transition:
    background-color 160ms ease,
    transform 160ms ease,
    box-shadow 160ms ease;
}

.tag-context-menu__item:hover {
  background: linear-gradient(180deg, rgba(56, 189, 248, 0.12), rgba(34, 211, 238, 0.08));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.04),
    0 10px 22px rgba(0, 0, 0, 0.18);
  transform: translateY(-1px);
}

.tag-context-menu__badge {
  display: inline-flex;
  height: 24px;
  min-width: 36px;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(103, 232, 249, 0.2);
  border-radius: 9999px;
  background: linear-gradient(180deg, rgba(34, 211, 238, 0.14), rgba(14, 116, 144, 0.16));
  color: rgba(207, 250, 254, 0.95);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.14em;
}
</style>
