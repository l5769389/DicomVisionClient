import { nextTick, onBeforeUnmount, onMounted, ref, watch, type ComputedRef, type Ref } from 'vue'
import { offMeasurementDraft, onMeasurementDraft } from '../../../services/socket'
import type { MeasurementDraftPayload, ViewerTabItem, WorkspaceReadyPayload } from '../../../types/viewer'

interface ViewerWorkspaceShellOptions {
  activeTab: ComputedRef<ViewerTabItem | null>
  activeTabKey: ComputedRef<string>
  activeViewportKey: Ref<string>
  isViewLoading: ComputedRef<boolean>
  viewerTabs: ComputedRef<ViewerTabItem[]>
  viewportHostRef: Ref<HTMLElement | null>
  closeMenus: () => void
  cleanupPointerInteractions: () => void
  emitWorkspaceReady: (payload: WorkspaceReadyPayload) => void
  updateDraftMeasurementLabelLines: (viewportKey: string, labelLines: string[]) => void
}

export function useViewerWorkspaceShell(options: ViewerWorkspaceShellOptions) {
  const tabStripRef = ref<HTMLElement | null>(null)
  const canScrollTabsLeft = ref(false)
  const canScrollTabsRight = ref(false)

  function notifyWorkspaceReady(): void {
    const activeViewport = options.viewportHostRef.value?.querySelector<HTMLElement>('[data-active-render-surface="true"]')
    const stageElement =
      options.activeTab.value?.viewType === 'MPR' ? options.viewportHostRef.value ?? null : activeViewport ?? null
    const viewportElements = Object.fromEntries(
      Array.from(options.viewportHostRef.value?.querySelectorAll<HTMLElement>('[data-viewport-key]') ?? []).map((element) => [
        element.dataset.viewportKey ?? '',
        element
      ])
    )

    options.emitWorkspaceReady({
      element: stageElement,
      viewportKey: options.activeViewportKey.value,
      viewportElements
    })
  }

  function updateTabScrollState(): void {
    const element = tabStripRef.value
    if (!element || !options.viewerTabs.value.length) {
      canScrollTabsLeft.value = false
      canScrollTabsRight.value = false
      return
    }

    const maxScrollLeft = Math.max(0, element.scrollWidth - element.clientWidth)
    canScrollTabsLeft.value = element.scrollLeft > 4
    canScrollTabsRight.value = element.scrollLeft < maxScrollLeft - 4
  }

  function scrollTabs(direction: 'left' | 'right'): void {
    const element = tabStripRef.value
    if (!element) {
      return
    }

    const offset = Math.max(220, Math.floor(element.clientWidth * 0.55))
    element.scrollBy({
      left: direction === 'left' ? -offset : offset,
      behavior: 'smooth'
    })
  }

  function scrollActiveTabIntoView(): void {
    const element = tabStripRef.value
    const activeTabKey = options.activeTabKey.value
    if (!element || !activeTabKey) {
      return
    }

    const activeElement = Array.from(element.children).find(
      (child): child is HTMLElement => child instanceof HTMLElement && child.dataset.tabKey === activeTabKey
    )
    if (!activeElement) {
      return
    }

    activeElement.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center'
    })
  }

  function handleTabStripWheel(event: WheelEvent): void {
    const element = tabStripRef.value
    if (!element || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
      return
    }

    event.preventDefault()
    element.scrollLeft += event.deltaY
    updateTabScrollState()
  }

  function handleDocumentPointerDown(event: PointerEvent): void {
    const target = event.target
    if (!(target instanceof HTMLElement)) {
      options.closeMenus()
      return
    }

    if (target.closest('[data-tool-menu-root]')) {
      return
    }

    options.closeMenus()
  }

  function handleMeasurementDraftUpdate(payload: MeasurementDraftPayload | undefined): void {
    if (!payload?.viewportKey) {
      return
    }
    options.updateDraftMeasurementLabelLines(payload.viewportKey, payload.labelLines ?? [])
  }

  onMounted(() => {
    notifyWorkspaceReady()
    document.addEventListener('pointerdown', handleDocumentPointerDown)
    window.addEventListener('resize', updateTabScrollState)
    onMeasurementDraft(handleMeasurementDraftUpdate)
    void nextTick().then(updateTabScrollState)
  })

  watch(
    () => [options.activeTabKey.value, options.activeTab.value?.viewType, options.isViewLoading.value] as const,
    async () => {
      await nextTick()
      notifyWorkspaceReady()
      scrollActiveTabIntoView()
      updateTabScrollState()
    }
  )

  watch(
    () => options.viewerTabs.value.length,
    async () => {
      await nextTick()
      scrollActiveTabIntoView()
      updateTabScrollState()
    },
    { immediate: true }
  )

  onBeforeUnmount(() => {
    document.removeEventListener('pointerdown', handleDocumentPointerDown)
    window.removeEventListener('resize', updateTabScrollState)
    offMeasurementDraft(handleMeasurementDraftUpdate)
    options.cleanupPointerInteractions()
  })

  return {
    canScrollTabsLeft,
    canScrollTabsRight,
    handleTabStripWheel,
    notifyWorkspaceReady,
    scrollTabs,
    tabStripRef,
    updateTabScrollState
  }
}
