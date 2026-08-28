<script setup lang="ts">
import { computed } from 'vue'
import { VBtn, VCard, VDialog } from 'vuetify/components'
import { useUiLocale } from '../../composables/ui/useUiLocale'
import type { ViewUnavailableNotice } from '../../types/viewer'
import AppIcon from '../AppIcon.vue'

const props = defineProps<{
  notice: ViewUnavailableNotice | null
}>()

const emit = defineEmits<{
  close: []
}>()

const { locale } = useUiLocale()
const isZh = computed(() => locale.value === 'zh-CN')
const isOpen = computed({
  get: () => Boolean(props.notice),
  set: (value: boolean) => {
    if (!value) {
      emit('close')
    }
  }
})

const title = computed(() => {
  const viewType = props.notice?.viewType ?? ''
  return isZh.value ? `无法打开 ${viewType} 视图` : `Unable to open ${viewType}`
})

const reasonByCode = computed<Record<string, string>>(() =>
  isZh.value
    ? {
        'availability-check-failed': '无法完成视图兼容性检查，请确认后端服务可用后重试。',
        'duplicate-slice-positions': '序列包含重复的切片位置，无法可靠构建三维体数据。',
        'dynamic-pet-unsupported': '当前版本暂不支持动态 PET 的 4D 分析。',
        'image-pixels-unavailable': '序列不包含可用于体数据显示的影像像素。',
        'initial-render-failed': '视图在首次构建或渲染时失败，未完成的视图已关闭。',
        'insufficient-slices': '序列切片数量不足，无法构建体数据。',
        'invalid-spatial-geometry': '序列包含无效的空间坐标或方向信息。',
        'invalid-slice-orientation': '序列的切片方向信息无效。',
        'irregular-slice-spacing': '切片层间距不规则，当前版本需要先完成重采样。',
        'missing-image-size': '部分切片缺少有效的行列尺寸。',
        'missing-pixel-spacing': '部分切片缺少有效的 PixelSpacing。',
        'missing-spatial-geometry': '序列缺少必要的空间坐标信息。',
        'mixed-image-size': '序列中的切片行列尺寸不一致，需要先完成重采样。',
        'mixed-pixel-spacing': '序列中的 PixelSpacing 不一致，需要先完成重采样。',
        'mixed-slice-orientations': '序列中存在不一致的切片方向。',
        'multiframe-unsupported': '当前版本暂不支持该多帧 DICOM 体数据。',
        'non-volume-dicom-object': '该 DICOM 对象类型不能用于 MPR、3D 或 4D 显示。',
        'not-four-d-series': '该序列没有至少两个可识别的有效时间相位。',
        'phase-mpr-unavailable': '4D 要求每个相位都能构建 MPR，其中至少一个相位不满足条件。',
        'report-like-series': '报告或二次采集序列不能用于体数据显示。',
        'series-not-found': '所选序列已不存在，请重新选择序列。',
        'series-not-selected': '请先选择一个 DICOM 序列。',
        'view-open-failed': '创建视图失败，未完成的资源已清理。'
      }
    : {
        'availability-check-failed': 'The compatibility check could not be completed. Check the backend service and try again.',
        'duplicate-slice-positions': 'The series contains duplicate slice positions and cannot form a reliable volume.',
        'dynamic-pet-unsupported': 'Dynamic PET 4D analysis is not supported yet.',
        'image-pixels-unavailable': 'The series does not contain image pixels suitable for volume display.',
        'initial-render-failed': 'The view failed during its initial build or render and has been closed.',
        'insufficient-slices': 'The series does not contain enough slices to build a volume.',
        'invalid-spatial-geometry': 'The series contains invalid spatial position or orientation metadata.',
        'invalid-slice-orientation': 'The series contains invalid slice orientation metadata.',
        'irregular-slice-spacing': 'Slice spacing is irregular and must be resampled before volume display.',
        'missing-image-size': 'One or more slices are missing valid Rows or Columns values.',
        'missing-pixel-spacing': 'One or more slices are missing valid PixelSpacing.',
        'missing-spatial-geometry': 'The series is missing required spatial geometry metadata.',
        'mixed-image-size': 'Slice dimensions differ within the series and require resampling.',
        'mixed-pixel-spacing': 'PixelSpacing differs within the series and requires resampling.',
        'mixed-slice-orientations': 'The series contains inconsistent slice orientations.',
        'multiframe-unsupported': 'This multi-frame DICOM volume is not supported yet.',
        'non-volume-dicom-object': 'This DICOM object type cannot be used for MPR, 3D, or 4D display.',
        'not-four-d-series': 'The series does not contain at least two detectable time phases.',
        'phase-mpr-unavailable': 'Every 4D phase must support MPR, and at least one phase does not.',
        'report-like-series': 'Report and secondary-capture series cannot be used for volume display.',
        'series-not-found': 'The selected series no longer exists. Select it again.',
        'series-not-selected': 'Select a DICOM series first.',
        'view-open-failed': 'The view could not be created. Incomplete resources were cleaned up.'
      }
)

const summary = computed(() => {
  const code = props.notice?.blockedCode ?? ''
  return reasonByCode.value[code] ?? (
    isZh.value
      ? '该序列当前无法安全构建所选视图。'
      : 'The selected view cannot be safely built from this series.'
  )
})

const closeLabel = computed(() => (isZh.value ? '关闭' : 'Close'))
const acknowledgeLabel = computed(() => (isZh.value ? '知道了' : 'Got it'))
const detailLabel = computed(() => (isZh.value ? '技术详情' : 'Technical details'))
</script>

<template>
  <VDialog v-model="isOpen" max-width="560">
    <VCard data-testid="view-unavailable-dialog" class="view-unavailable-dialog theme-shell-panel overflow-hidden border! p-0! text-[var(--theme-text-primary)]! shadow-[0_24px_58px_rgba(0,0,0,0.48)]!">
      <div class="view-unavailable-dialog__header">
        <span class="view-unavailable-dialog__icon" aria-hidden="true">
          <AppIcon name="warning" :size="20" />
        </span>
        <h2 class="view-unavailable-dialog__title">{{ title }}</h2>
        <VBtn
          class="view-unavailable-dialog__close"
          variant="flat"
          :aria-label="closeLabel"
          :title="closeLabel"
          data-testid="view-unavailable-close"
          @click="emit('close')"
        >
          <AppIcon name="close" :size="16" />
        </VBtn>
      </div>

      <div class="view-unavailable-dialog__body">
        <p class="view-unavailable-dialog__summary">{{ summary }}</p>
        <div v-if="notice?.detail" class="view-unavailable-dialog__detail">
          <span class="view-unavailable-dialog__detail-label">{{ detailLabel }}</span>
          <span class="view-unavailable-dialog__detail-text">{{ notice.detail }}</span>
        </div>
      </div>

      <div class="view-unavailable-dialog__actions">
        <VBtn data-testid="view-unavailable-acknowledge" class="view-unavailable-dialog__acknowledge" variant="flat" @click="emit('close')">
          {{ acknowledgeLabel }}
        </VBtn>
      </div>
    </VCard>
  </VDialog>
</template>

<style scoped>
.view-unavailable-dialog {
  border-radius: 8px !important;
}

.view-unavailable-dialog__header {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) 36px;
  align-items: center;
  gap: 10px;
  padding: 16px 18px;
  border-bottom: 1px solid var(--theme-border-soft);
}

.view-unavailable-dialog__icon {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border: 1px solid color-mix(in srgb, #f59e0b 42%, var(--theme-border-soft));
  border-radius: 50%;
  background: color-mix(in srgb, #f59e0b 13%, var(--theme-surface-card));
  color: #fbbf24;
}

.view-unavailable-dialog__title {
  min-width: 0;
  margin: 0;
  color: var(--theme-text-primary);
  font-size: 17px;
  font-weight: 800;
  letter-spacing: 0;
  line-height: 1.35;
}

.view-unavailable-dialog__close {
  width: 36px !important;
  min-width: 36px !important;
  height: 36px !important;
  padding: 0 !important;
  border: 1px solid var(--theme-border-soft) !important;
  border-radius: 8px !important;
  background: var(--theme-surface-muted) !important;
  color: var(--theme-text-secondary) !important;
}

.view-unavailable-dialog__body {
  display: grid;
  gap: 14px;
  padding: 20px;
}

.view-unavailable-dialog__summary {
  margin: 0;
  color: var(--theme-text-primary);
  font-size: 14px;
  line-height: 1.7;
}

.view-unavailable-dialog__detail {
  display: grid;
  gap: 7px;
  max-height: 180px;
  overflow: auto;
  padding: 12px 14px;
  border: 1px solid var(--theme-border-soft);
  border-radius: 6px;
  background: var(--theme-surface-muted);
}

.view-unavailable-dialog__detail-label {
  color: var(--theme-text-muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0;
}

.view-unavailable-dialog__detail-text {
  overflow-wrap: anywhere;
  color: var(--theme-text-secondary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
}

.view-unavailable-dialog__actions {
  display: flex;
  justify-content: flex-end;
  padding: 0 20px 18px;
}

.view-unavailable-dialog__acknowledge {
  min-width: 96px !important;
  border: 1px solid color-mix(in srgb, var(--theme-accent) 52%, var(--theme-border-soft)) !important;
  border-radius: 8px !important;
  background: color-mix(in srgb, var(--theme-accent) 20%, var(--theme-surface-card)) !important;
  color: var(--theme-text-primary) !important;
  font-weight: 800 !important;
  text-transform: none !important;
}
</style>
