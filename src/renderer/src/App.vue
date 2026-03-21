<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { connectSocket, getSocket } from './services/socket'
import { api, setApiBaseURL } from './services/api'

interface FolderSeriesItem {
  seriesId: string
  seriesInstanceUid?: string | null
  studyInstanceUid?: string | null
  patientId?: string | null
  modality?: string | null
  seriesDescription?: string | null
  instanceCount: number
  width?: number | null
  height?: number | null
  folderPath: string
}

interface LoadFolderResponse {
  seriesId?: string | null
  seriesList?: FolderSeriesItem[]
}

interface ViewCreateResponse {
  viewId: string
}

interface ViewImageResponse {
  image: string
  viewId: string
  slice_info: {
    current: number
    total: number
  }
  window_info: {
    ww?: number | null
    wl?: number | null
  }
}

type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected'
type ViewType = 'Stack' | 'MPR' | '3D'

const backendOrigin = ref('http://127.0.0.1:8000')
const message = ref('')
const isSidebarCollapsed = ref(false)
const isLoadingFolder = ref(false)
const isViewLoading = ref(false)
const connectionState = ref<ConnectionState>('connecting')
const seriesList = ref<FolderSeriesItem[]>([])
const selectedSeriesId = ref('')
const activeViewType = ref<ViewType | null>(null)
const activeViewId = ref('')
const activeImageSrc = ref('')
const activeSliceLabel = ref('')
const activeWindowLabel = ref('')
const viewerStage = ref<HTMLElement | null>(null)

let resizeObserver: ResizeObserver | null = null

function toggleSidebar(): void {
  isSidebarCollapsed.value = !isSidebarCollapsed.value
}

function updateConnectionState(state: ConnectionState): void {
  connectionState.value = state
}

function handleSocketConnect(): void {
  updateConnectionState('connected')
}

function handleSocketDisconnect(): void {
  updateConnectionState('disconnected')
}

function handleSocketReconnectAttempt(): void {
  updateConnectionState('reconnecting')
}

function handleSocketReconnect(): void {
  updateConnectionState('connected')
}

function handleSocketReconnectError(): void {
  updateConnectionState('reconnecting')
}

function handleSocketReconnectFailed(): void {
  updateConnectionState('disconnected')
}

function cleanupSocketListeners(): void {
  const socket = getSocket()
  if (!socket) {
    return
  }

  socket.off('connect', handleSocketConnect)
  socket.off('disconnect', handleSocketDisconnect)
  socket.io.off('reconnect_attempt', handleSocketReconnectAttempt)
  socket.io.off('reconnect', handleSocketReconnect)
  socket.io.off('reconnect_error', handleSocketReconnectError)
  socket.io.off('reconnect_failed', handleSocketReconnectFailed)
}

function connectBackend(): void {
  cleanupSocketListeners()
  updateConnectionState('connecting')
  setApiBaseURL(`${backendOrigin.value}/api/v1`)

  const socket = connectSocket(backendOrigin.value)
  socket.on('connect', handleSocketConnect)
  socket.on('disconnect', handleSocketDisconnect)
  socket.io.on('reconnect_attempt', handleSocketReconnectAttempt)
  socket.io.on('reconnect', handleSocketReconnect)
  socket.io.on('reconnect_error', handleSocketReconnectError)
  socket.io.on('reconnect_failed', handleSocketReconnectFailed)
}

async function chooseFolder(): Promise<void> {
  const picked = await window.viewerApi?.chooseFolder?.()
  if (!picked) {
    return
  }

  await loadFolderSeries(picked)
}

async function loadFolderSeries(path: string): Promise<void> {
  isLoadingFolder.value = true

  try {
    const { data } = await api.post<LoadFolderResponse>('/dicom/loadFolder', {
      folderPath: path
    })

    const incomingSeries = data.seriesList ?? []
    if (!incomingSeries.length) {
      message.value = 'No series found in the selected folder.'
      return
    }

    const existingIds = new Set(seriesList.value.map((item) => item.seriesId))
    const appendedSeries = incomingSeries.filter((item) => !existingIds.has(item.seriesId))

    if (appendedSeries.length) {
      seriesList.value = [...seriesList.value, ...appendedSeries]
    }

    selectedSeriesId.value = data.seriesId ?? incomingSeries[0]?.seriesId ?? selectedSeriesId.value
    message.value = ''
  } catch (error) {
    message.value = 'Failed to load folder.'
    console.error(error)
  } finally {
    isLoadingFolder.value = false
  }
}

function selectSeries(seriesId: string): void {
  selectedSeriesId.value = seriesId
}

function removeSeries(seriesId: string): void {
  const nextSeries = seriesList.value.filter((item) => item.seriesId !== seriesId)
  seriesList.value = nextSeries

  if (selectedSeriesId.value === seriesId) {
    selectedSeriesId.value = nextSeries[0]?.seriesId ?? ''
  }

  if (!nextSeries.length) {
    clearActiveView()
  }
}

function clearActiveView(): void {
  activeViewType.value = null
  activeViewId.value = ''
  activeImageSrc.value = ''
  activeSliceLabel.value = ''
  activeWindowLabel.value = ''
}

function getViewportSize(): { width: number; height: number } {
  const element = viewerStage.value
  if (!element) {
    return { width: 960, height: 720 }
  }

  const rect = element.getBoundingClientRect()
  return {
    width: Math.max(320, Math.floor(rect.width - 32)),
    height: Math.max(320, Math.floor(rect.height - 32))
  }
}

function applyViewImage(data: ViewImageResponse): void {
  activeViewId.value = data.viewId
  activeImageSrc.value = `data:image/png;base64,${data.image}`
  activeSliceLabel.value = `${data.slice_info.current + 1} / ${data.slice_info.total}`

  const ww = data.window_info.ww
  const wl = data.window_info.wl
  activeWindowLabel.value = ww != null || wl != null ? `WW ${ww ?? '-'}  WL ${wl ?? '-'}` : ''
}

async function renderActiveView(): Promise<void> {
  if (!activeViewId.value) {
    return
  }

  const { data } = await api.post<ViewImageResponse>('/view/setSize', {
    opType: 'setSize',
    size: getViewportSize(),
    viewId: activeViewId.value
  })

  applyViewImage(data)
}

async function openView(viewType: ViewType): Promise<void> {
  if (!selectedSeriesId.value) {
    return
  }

  isViewLoading.value = true
  activeViewType.value = viewType

  try {
    const { data } = await api.post<ViewCreateResponse>('/view/create', {
      seriesId: selectedSeriesId.value,
      viewType
    })

    activeViewId.value = data.viewId
    await nextTick()
    await renderActiveView()
    message.value = ''
  } catch (error) {
    clearActiveView()
    message.value = `Failed to open ${viewType} view.`
    console.error(error)
  } finally {
    isViewLoading.value = false
  }
}

function setupResizeObserver(): void {
  if (!viewerStage.value || typeof ResizeObserver === 'undefined') {
    return
  }

  resizeObserver = new ResizeObserver(() => {
    if (activeViewId.value && !isViewLoading.value) {
      void renderActiveView()
    }
  })

  resizeObserver.observe(viewerStage.value)
}

onMounted(() => {
  connectBackend()
  setupResizeObserver()
})

onBeforeUnmount(() => {
  cleanupSocketListeners()
  resizeObserver?.disconnect()
})
</script>

<template>
  <v-app class="app-root">
    <div class="app-shell" :class="{ 'app-shell--collapsed': isSidebarCollapsed }">
      <aside class="sidebar">
        <span class="sidebar-status-dot" :class="`sidebar-status-dot--${connectionState}`"></span>

        <div class="sidebar-content">
          <div class="sidebar-header">
            <div class="brand">
              <div class="brand-mark">DV</div>
              <div v-show="!isSidebarCollapsed" class="brand-copy">
                <h1>DICOM Vision</h1>
              </div>
            </div>

            <v-btn
              class="sidebar-toggle"
              variant="text"
              color="primary"
              :text="isSidebarCollapsed ? '>>' : '<<'"
              @click="toggleSidebar"
            />
          </div>

          <template v-if="!isSidebarCollapsed">
            <div class="tool-group">
            <v-btn class="tool-button tool-button--accent" variant="tonal" @click="chooseFolder">加载文件夹</v-btn>
            <v-btn class="tool-button" variant="tonal" :disabled="!selectedSeriesId" @click="openView('Stack')">
              快速浏览
            </v-btn>
            <v-btn class="tool-button" variant="tonal" :disabled="!selectedSeriesId" @click="openView('3D')">3D</v-btn>
            <v-btn class="tool-button" variant="tonal" :disabled="!selectedSeriesId" @click="openView('MPR')">MPR</v-btn>
            </div>

            <v-card class="panel series-panel" color="transparent">
              <div v-if="isLoadingFolder" class="series-loading">
                <v-progress-circular indeterminate color="primary" size="20" width="2" />
                <span>Loading series...</span>
              </div>

              <div v-else-if="seriesList.length" class="series-list">
                <div
                  v-for="series in seriesList"
                  :key="series.seriesId"
                  class="series-item"
                  :class="{ 'series-item--selected': series.seriesId === selectedSeriesId }"
                >
                  <button class="series-select" type="button" @click="selectSeries(series.seriesId)">
                    <span class="series-name">{{ series.seriesDescription || 'Unnamed Series' }}</span>
                    <span class="series-meta">
                      {{ series.modality || 'N/A' }} · {{ series.instanceCount }} images
                      <template v-if="series.width && series.height"> · {{ series.width }}x{{ series.height }}</template>
                    </span>
                    <span class="series-id">{{ series.seriesId }}</span>
                  </button>

                  <v-btn
                    class="series-delete"
                    size="small"
                    variant="text"
                    color="error"
                    text="Delete"
                    @click="removeSeries(series.seriesId)"
                  />
                </div>
              </div>

              <div v-else class="panel-empty">加载文件夹后在这里显示 series 列表</div>
            </v-card>
          </template>
        </div>
      </aside>

      <main ref="viewerStage" class="workspace">
        <div v-if="activeImageSrc" class="viewer-canvas-wrap">
          <div class="viewer-overlay">
            <span v-if="activeViewType" class="viewer-badge">{{ activeViewType }}</span>
            <span v-if="activeSliceLabel" class="viewer-badge">{{ activeSliceLabel }}</span>
            <span v-if="activeWindowLabel" class="viewer-badge">{{ activeWindowLabel }}</span>
          </div>

          <img class="viewer-image" :src="activeImageSrc" :alt="activeViewType || 'viewer image'" />
        </div>

        <div v-else-if="isViewLoading" class="viewer-empty">
          <v-progress-circular indeterminate color="primary" size="28" width="3" />
          <span>Loading view...</span>
        </div>

        <div v-else class="viewer-empty">
          <span v-if="message">{{ message }}</span>
          <span v-else>选择一条 series，然后点击左侧的 快速浏览 / 3D / MPR</span>
        </div>
      </main>
    </div>
  </v-app>
</template>
