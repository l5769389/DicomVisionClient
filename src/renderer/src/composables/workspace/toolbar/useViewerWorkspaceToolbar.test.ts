import { mount } from '@vue/test-utils'
import { computed, defineComponent, h, nextTick, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import type { ViewerTabItem } from '../../../types/viewer'
import { useViewerWorkspaceToolbar } from './useViewerWorkspaceToolbar'

function create3dTab(overrides: Partial<ViewerTabItem> = {}): ViewerTabItem {
  return {
    key: 'series-1::3d',
    seriesId: 'series-1',
    seriesTitle: 'Series 1',
    title: 'Series 1 / 3D',
    viewType: '3D',
    viewId: 'view-3d',
    imageSrc: '',
    sliceLabel: '3 / 9',
    windowLabel: 'WW 400 / WL 40',
    cornerInfo: {
      topLeft: [],
      topRight: [],
      bottomLeft: [],
      bottomRight: []
    },
    orientation: {
      top: null,
      right: null,
      bottom: null,
      left: null,
      volumeQuaternion: null
    },
    transformState: {
      rotationDegrees: 0,
      horFlip: false,
      verFlip: false
    },
    pseudocolorPreset: 'bw',
    volumePreset: 'volumePreset:bone',
    render3dMode: 'surface',
    surfaceRenderConfig: {
      preset: 'bone',
      isoValue: 300,
      smoothing: 0.28,
      decimation: 0.12,
      color: '#f0eadc',
      ambient: 0.18,
      diffuse: 0.78,
      specular: 0.28,
      roughness: 0.42
    },
    ...overrides
  } as ViewerTabItem
}

function mountToolbarHarness(initialTab: ViewerTabItem = create3dTab()) {
  const activeOperation = ref('stack:window')
  const activeTab = ref<ViewerTabItem | null>(initialTab)
  const activeViewportKey = ref('volume')
  const emitSetActiveOperation = vi.fn((value: string) => {
    activeOperation.value = value
  })
  const emitTriggerViewAction = vi.fn()
  let toolbar!: ReturnType<typeof useViewerWorkspaceToolbar>

  const wrapper = mount(
    defineComponent({
      setup() {
        toolbar = useViewerWorkspaceToolbar({
          activeOperation: computed(() => activeOperation.value),
          activeTab: computed(() => activeTab.value),
          activeViewportKey,
          cleanupPointerInteractions: vi.fn(),
          emitCompareSyncChange: vi.fn(),
          emitOpenLayoutView: vi.fn(),
          emitOpenSeriesView: vi.fn(),
          emitSetActiveOperation,
          emitTriggerViewAction,
          emitViewportWheel: vi.fn(),
          exportCurrentView: vi.fn(),
          setActiveViewport: vi.fn((viewportKey: string) => {
            activeViewportKey.value = viewportKey
          }),
          stopViewportDrag: vi.fn()
        })
        return () => h('div')
      }
    })
  )

  return {
    activeOperation,
    activeTab,
    activeViewportKey,
    emitSetActiveOperation,
    emitTriggerViewAction,
    toolbar,
    wrapper
  }
}

describe('useViewerWorkspaceToolbar surface mode', () => {
  it('hides DICOM SR and GSPS export options for 3D and MPR views', async () => {
    const harness = mountToolbarHarness({
      ...create3dTab(),
      render3dMode: 'volume'
    })
    await nextTick()

    const getExportValues = () =>
      harness.toolbar.activeTools.value.find((tool) => tool.key === 'export')?.options?.map((option) => option.value) ?? []

    expect(getExportValues()).toEqual(['png', 'dicom'])

    harness.activeTab.value = {
      ...create3dTab(),
      key: 'series-1::mpr',
      title: 'Series 1 / MPR',
      viewType: 'MPR'
    }
    await nextTick()
    expect(getExportValues()).toEqual(['png', 'dicom'])

    harness.activeTab.value = {
      ...create3dTab(),
      key: 'series-1::stack',
      title: 'Series 1 / Stack',
      viewType: 'Stack'
    }
    await nextTick()
    expect(getExportValues()).toEqual(['png', 'dicom', 'dicom-sr', 'dicom-gsps'])

    harness.wrapper.unmount()
  })

  it('hides volume/window-only tools while keeping rotate and zoom available', async () => {
    const harness = mountToolbarHarness()
    await nextTick()

    const toolKeys = harness.toolbar.activeTools.value.map((tool) => tool.key)
    expect(toolKeys).toContain('rotate3d')
    expect(toolKeys).toContain('zoom')
    expect(toolKeys).toContain('render3dMode')
    expect(toolKeys).not.toContain('window')
    expect(toolKeys).not.toContain('volumeParams')
    expect(toolKeys).not.toContain('volumePreset')
    expect(harness.toolbar.activeVolumeRenderConfig.value).toBeNull()
    expect(harness.emitSetActiveOperation).toHaveBeenCalledWith('stack:rotate3d')

    harness.emitSetActiveOperation.mockClear()
    harness.toolbar.applyTool(harness.toolbar.activeTools.value.find((tool) => tool.key === 'rotate3d')!)
    expect(harness.emitSetActiveOperation).toHaveBeenCalledWith('stack:rotate3d')

    harness.emitSetActiveOperation.mockClear()
    harness.toolbar.applyTool(harness.toolbar.activeTools.value.find((tool) => tool.key === 'zoom')!)
    expect(harness.emitSetActiveOperation).toHaveBeenCalledWith('stack:zoom')

    harness.wrapper.unmount()
  })

  it('restores volume-specific tools after switching back to volume mode', async () => {
    const harness = mountToolbarHarness()
    await nextTick()

    harness.activeTab.value = {
      ...harness.activeTab.value!,
      render3dMode: 'volume'
    }
    await nextTick()

    const toolKeys = harness.toolbar.activeTools.value.map((tool) => tool.key)
    expect(toolKeys).toContain('window')
    expect(toolKeys).toContain('volumeParams')
    expect(toolKeys).toContain('volumePreset')
    expect(harness.toolbar.stackToolSelections.value.render3dMode).toBe('render3dMode:volume')

    harness.wrapper.unmount()
  })

  it('adds MPR crosshair mode options for MPR and 4D views', async () => {
    const harness = mountToolbarHarness({
      ...create3dTab(),
      key: 'series-1::mpr',
      title: 'Series 1 / MPR',
      viewType: 'MPR',
      mprCrosshairMode: 'orthogonal'
    })
    await nextTick()

    const getCrosshairTool = () => harness.toolbar.activeTools.value.find((tool) => tool.key === 'crosshair')

    expect(getCrosshairTool()?.options?.map((option) => option.value)).toEqual([
      'mprCrosshairMode:orthogonal',
      'mprCrosshairMode:double-oblique'
    ])
    expect(getCrosshairTool()?.options?.find((option) => option.value === 'mprCrosshairMode:orthogonal')?.checked).toBe(true)

    harness.toolbar.selectToolOption(getCrosshairTool()!, 'mprCrosshairMode:double-oblique')
    expect(harness.emitTriggerViewAction).toHaveBeenCalledWith({
      action: 'mprCrosshairMode',
      mode: 'double-oblique'
    })

    harness.activeTab.value = {
      ...harness.activeTab.value!,
      mprCrosshairMode: 'double-oblique'
    }
    await nextTick()
    expect(getCrosshairTool()?.options?.find((option) => option.value === 'mprCrosshairMode:double-oblique')?.checked).toBe(true)

    harness.emitTriggerViewAction.mockClear()
    harness.activeTab.value = {
      ...harness.activeTab.value!,
      key: 'series-1::4d',
      title: 'Series 1 / 4D',
      viewType: '4D',
      mprCrosshairMode: 'double-oblique'
    }
    await nextTick()
    expect(getCrosshairTool()?.options?.map((option) => option.value)).toEqual([
      'mprCrosshairMode:orthogonal',
      'mprCrosshairMode:double-oblique'
    ])
    expect(getCrosshairTool()?.options?.find((option) => option.value === 'mprCrosshairMode:double-oblique')?.checked).toBe(true)

    harness.toolbar.selectToolOption(getCrosshairTool()!, 'mprCrosshairMode:orthogonal')
    expect(harness.emitTriggerViewAction).toHaveBeenCalledWith({
      action: 'mprCrosshairMode',
      mode: 'orthogonal'
    })

    harness.activeTab.value = {
      ...harness.activeTab.value!,
      fourDIsPlaying: true
    }
    await nextTick()
    expect(harness.toolbar.areToolbarActionsDisabled.value).toBe(true)

    harness.wrapper.unmount()
  })
})
