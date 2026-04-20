import { computed, ref, type ComputedRef } from 'vue'

const SERIES_DRAG_TYPE = 'application/x-dicomvision-series-id'

export interface UseQuickPreviewDropOptions {
  canAcceptDrop: ComputedRef<boolean>
  onDropSeries: (seriesId: string) => void
}

function resolveDraggedSeriesId(event: DragEvent): string {
  const transfer = event.dataTransfer
  if (!transfer) {
    return ''
  }

  return transfer.getData(SERIES_DRAG_TYPE) || transfer.getData('text/plain') || ''
}

function isSeriesDragEvent(event: DragEvent): boolean {
  const transfer = event.dataTransfer
  if (!transfer) {
    return false
  }

  const types = Array.from(transfer.types ?? [])
  return types.includes(SERIES_DRAG_TYPE) || types.includes('text/plain')
}

export function useQuickPreviewDrop(options: UseQuickPreviewDropOptions) {
  const isQuickPreviewDropActive = ref(false)
  const quickPreviewDropClass = computed(() =>
    isQuickPreviewDropActive.value ? 'theme-drop-active' : 'theme-shell-panel-soft'
  )

  function handleQuickPreviewDragEnter(event: DragEvent): void {
    if (!options.canAcceptDrop.value || !isSeriesDragEvent(event)) {
      return
    }

    event.preventDefault()
    isQuickPreviewDropActive.value = true
  }

  function handleQuickPreviewDragOver(event: DragEvent): void {
    if (!options.canAcceptDrop.value || !isSeriesDragEvent(event)) {
      return
    }

    event.preventDefault()
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy'
    }
    isQuickPreviewDropActive.value = true
  }

  function handleQuickPreviewDragLeave(event: DragEvent): void {
    const relatedTarget = event.relatedTarget
    if (relatedTarget instanceof Node && event.currentTarget instanceof Node && event.currentTarget.contains(relatedTarget)) {
      return
    }

    isQuickPreviewDropActive.value = false
  }

  function handleQuickPreviewDrop(event: DragEvent): void {
    if (!options.canAcceptDrop.value || !isSeriesDragEvent(event)) {
      isQuickPreviewDropActive.value = false
      return
    }

    event.preventDefault()
    const seriesId = resolveDraggedSeriesId(event).trim()
    isQuickPreviewDropActive.value = false
    if (!seriesId) {
      return
    }

    options.onDropSeries(seriesId)
  }

  function clearQuickPreviewDropState(): void {
    isQuickPreviewDropActive.value = false
  }

  return {
    clearQuickPreviewDropState,
    handleQuickPreviewDragEnter,
    handleQuickPreviewDragLeave,
    handleQuickPreviewDragOver,
    handleQuickPreviewDrop,
    isQuickPreviewDropActive,
    quickPreviewDropClass
  }
}
