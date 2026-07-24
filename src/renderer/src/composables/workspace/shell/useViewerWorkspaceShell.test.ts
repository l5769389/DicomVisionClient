import { computed, defineComponent, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import type { ViewerTabItem, WorkspaceReadyPayload } from '../../../types/viewer'
import { useViewerWorkspaceShell } from './useViewerWorkspaceShell'

function createFusionTab(): ViewerTabItem {
  return {
    key: 'fusion-tab',
    title: 'PET/CT',
    viewType: 'PETCTFusion',
    seriesId: 'ct-series',
    seriesTitle: 'CT',
    viewId: '',
    imageSrc: '',
    sliceLabel: '',
    windowLabel: '',
    cornerInfo: { topLeft: [], topRight: [], bottomLeft: [], bottomRight: [] },
    orientation: { top: null, right: null, bottom: null, left: null },
    pseudocolorPreset: 'gray',
    transformState: {
      rotationDegrees: 0,
      horFlip: false,
      verFlip: false,
      zoom: 1,
      offsetX: 0,
      offsetY: 0
    },
    fusionViewIds: {
      'fusion-ct-ax': 'ct-view',
      'fusion-pet-ax': 'pet-view',
      'fusion-overlay-ax': 'overlay-view',
      'fusion-pet-cor-mip': 'mip-view'
    },
    fusionImages: {
      'fusion-ct-ax': '',
      'fusion-pet-ax': '',
      'fusion-overlay-ax': '',
      'fusion-pet-cor-mip': ''
    }
  } as ViewerTabItem
}

describe('useViewerWorkspaceShell', () => {
  it('reports PET/CT fusion as a multi-viewport host', async () => {
    const readyPayloads: WorkspaceReadyPayload[] = []
    const activeTab = ref<ViewerTabItem | null>(createFusionTab())
    const activeViewportKey = ref('fusion-overlay-ax')

    const Harness = defineComponent({
      setup() {
        const viewportHostRef = ref<HTMLElement | null>(null)
        useViewerWorkspaceShell({
          activeTab: computed(() => activeTab.value),
          activeTabKey: computed(() => activeTab.value?.key ?? ''),
          activeViewportKey,
          cleanupPointerInteractions: vi.fn(),
          closeMenus: vi.fn(),
          emitWorkspaceReady: (payload) => readyPayloads.push(payload),
          isViewLoading: computed(() => false),
          updateDraftMeasurementLabelLines: vi.fn(),
          viewerTabs: computed(() => activeTab.value ? [activeTab.value] : []),
          viewportHostRef
        })
        return { viewportHostRef }
      },
      template: `
        <div ref="viewportHostRef">
          <div data-active-render-surface="true" data-viewport-key="fusion-ct-ax"></div>
          <div data-active-render-surface="true" data-viewport-key="fusion-pet-ax"></div>
          <div data-active-render-surface="true" data-viewport-key="fusion-overlay-ax"></div>
          <div data-active-render-surface="true" data-viewport-key="fusion-pet-cor-mip"></div>
        </div>
      `
    })

    const wrapper = mount(Harness)
    await nextTick()

    const latestPayload = readyPayloads.at(-1)
    expect(latestPayload?.element).toBe(wrapper.element)
    expect(Object.keys(latestPayload?.viewportElements ?? {}).sort()).toEqual([
      'fusion-ct-ax',
      'fusion-overlay-ax',
      'fusion-pet-ax',
      'fusion-pet-cor-mip'
    ])

    wrapper.unmount()
  })

  it('reports a dedicated imaging stage instead of 4D peripheral controls', async () => {
    const readyPayloads: WorkspaceReadyPayload[] = []
    const activeTab = ref<ViewerTabItem | null>({
      ...createFusionTab(),
      key: 'four-d-tab',
      viewType: '4D'
    } as ViewerTabItem)
    const activeViewportKey = ref('mpr-ax')

    const Harness = defineComponent({
      setup() {
        const viewportHostRef = ref<HTMLElement | null>(null)
        useViewerWorkspaceShell({
          activeTab: computed(() => activeTab.value),
          activeTabKey: computed(() => activeTab.value?.key ?? ''),
          activeViewportKey,
          cleanupPointerInteractions: vi.fn(),
          closeMenus: vi.fn(),
          emitWorkspaceReady: (payload) => readyPayloads.push(payload),
          isViewLoading: computed(() => false),
          updateDraftMeasurementLabelLines: vi.fn(),
          viewerTabs: computed(() => activeTab.value ? [activeTab.value] : []),
          viewportHostRef
        })
        return { viewportHostRef }
      },
      template: `
        <div ref="viewportHostRef">
          <div data-imaging-stage="true">
            <div data-active-render-surface="true" data-viewport-key="mpr-ax"></div>
          </div>
          <div data-testid="timeline"></div>
        </div>
      `
    })

    const wrapper = mount(Harness)
    await nextTick()

    expect(readyPayloads.at(-1)?.element).toBe(wrapper.find('[data-imaging-stage="true"]').element)
    expect(readyPayloads.at(-1)?.viewportElements?.['mpr-ax']).toBeDefined()
    wrapper.unmount()
  })
})
