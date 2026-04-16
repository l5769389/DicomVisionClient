<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { VBtn, VChip, VPagination, VTextField } from 'vuetify/components'
import type { ViewerTabItem } from '../../../types/viewer'

const props = defineProps<{
  activeTab: ViewerTabItem
}>()

const emit = defineEmits<{
  indexChange: [payload: { tabKey: string; index: number }]
}>()

const currentDisplayIndex = computed(() => (props.activeTab.tagIndex ?? 0) + 1)
const totalDisplayCount = computed(() => Math.max(1, props.activeTab.tagTotal ?? 1))
const searchQuery = ref('')
const pageInput = ref('1')

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

watch(
  () => [props.activeTab.key, props.activeTab.tagIndex, props.activeTab.tagTotal] as const,
  () => {
    pageInput.value = String(currentDisplayIndex.value)
  },
  { immediate: true }
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
</style>
