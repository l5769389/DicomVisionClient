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
  <aside class="sidebar">
    <div class="sidebar-content">
      <div class="sidebar-header">
        <div class="brand">
          <div class="brand-mark">Dicom Vision</div>
        </div>
      </div>

      <template v-if="!isSidebarCollapsed">
        <div class="tool-card">
          <div class="tool-group">
            <v-btn class="tool-button tool-button--primary" variant="flat" @click="emit('chooseFolder')">
              加载文件夹
            </v-btn>
            <v-btn class="tool-button" variant="flat" :disabled="!hasSelectedSeries" @click="emit('openView', 'Stack')">
              快速浏览
            </v-btn>
            <v-btn class="tool-button" variant="flat" :disabled="!hasSelectedSeries" @click="emit('openView', '3D')">
              3D
            </v-btn>
            <v-btn class="tool-button" variant="flat" :disabled="!hasSelectedSeries" @click="emit('openView', 'MPR')">
              MPR
            </v-btn>
          </div>
        </div>

        <v-card class="panel series-panel" color="transparent">
          <div class="panel-header">
            <span>序列列表</span>
          </div>

          <div v-if="isLoadingFolder" class="series-loading">
            <v-progress-circular indeterminate color="primary" size="20" width="2" />
            <span>正在加载序列...</span>
          </div>

          <div v-else-if="seriesList.length" class="series-list">
            <div
              v-for="series in seriesList"
              :key="series.seriesId"
              class="series-item"
              :class="{ 'series-item--selected': series.seriesId === selectedSeriesId }"
            >
              <button class="series-select" type="button" @click="emit('selectSeries', series.seriesId)">
                <span class="series-radio" :class="{ 'series-radio--selected': series.seriesId === selectedSeriesId }">
                  <span class="series-radio-dot"></span>
                </span>
                <span class="series-name">{{ series.seriesDescription || '未命名序列' }}</span>
                <span class="series-meta">
                  {{ series.modality || 'N/A' }} · {{ series.instanceCount }} 张
                  <template v-if="series.width && series.height"> · {{ series.width }}x{{ series.height }}</template>
                </span>
                <span class="series-id">{{ series.seriesId }}</span>
              </button>

              <v-btn
                class="series-delete"
                size="small"
                variant="text"
                color="error"
                text="删除"
                @click="emit('removeSeries', series.seriesId)"
              />
            </div>
          </div>

          <div v-else class="panel-empty">加载文件夹后，这里会显示 DICOM 序列列表。</div>
        </v-card>
      </template>

      <div class="sidebar-footer">
        <div class="sidebar-status">
          <span class="sidebar-status-dot" :class="`sidebar-status-dot--${connectionState}`"></span>
          <span class="sidebar-status-text">{{ connectionState }}</span>
        </div>

        <v-btn class="sidebar-toggle" variant="text" :text="isSidebarCollapsed ? '>>' : '<<'" @click="emit('toggleSidebar')" />
      </div>
    </div>
  </aside>
</template>
