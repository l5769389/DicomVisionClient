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
  const emitOpenLayoutView = vi.fn()
  const emitTriggerViewAction = vi.fn()
  const stopViewportDrag = vi.fn()
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
          emitOpenLayoutView,
          emitOpenSeriesView: vi.fn(),
          emitSetActiveOperation,
          emitTriggerViewAction,
          emitViewportWheel: vi.fn(),
          exportCurrentView: vi.fn(),
          setActiveViewport: vi.fn((viewportKey: string) => {
            activeViewportKey.value = viewportKey
          }),
          stopViewportDrag
        })
        return () => h('div')
      }
    })
  )

  return {
    activeOperation,
    activeTab,
    activeViewportKey,
    emitOpenLayoutView,
    emitSetActiveOperation,
    emitTriggerViewAction,
    stopViewportDrag,
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

  it('adds display overlay toggles for Stack, MPR, and 4D views', async () => {
    const harness = mountToolbarHarness({
      ...create3dTab(),
      key: 'series-1::stack',
      title: 'Series 1 / Stack',
      viewType: 'Stack',
      showCornerInfo: true,
      showScaleBar: true
    })
    await nextTick()

    const getDisplayTool = () => harness.toolbar.activeTools.value.find((tool) => tool.key === 'display')

    expect(getDisplayTool()?.options?.map((option) => option.value)).toEqual(['display:cornerInfo', 'display:scaleBar'])
    expect(getDisplayTool()?.options?.map((option) => option.checked)).toEqual([true, true])
    const toolKeys = harness.toolbar.activeTools.value.map((tool) => tool.key)
    expect(toolKeys.indexOf('display')).toBe(toolKeys.indexOf('export') + 1)
    expect(toolKeys.indexOf('tag')).toBe(toolKeys.indexOf('display') + 1)

    harness.toolbar.selectToolOption(getDisplayTool()!, 'display:cornerInfo')
    expect(harness.emitTriggerViewAction).toHaveBeenCalledWith({
      action: 'displayOverlay',
      overlay: 'cornerInfo',
      enabled: false
    })
    await nextTick()
    expect(getDisplayTool()?.options?.map((option) => option.checked)).toEqual([false, true])

    harness.activeTab.value = {
      ...harness.activeTab.value!,
      showCornerInfo: false
    }
    await nextTick()
    expect(getDisplayTool()?.options?.map((option) => option.checked)).toEqual([false, true])

    harness.activeTab.value = {
      ...harness.activeTab.value!,
      key: 'series-1::mpr',
      title: 'Series 1 / MPR',
      viewType: 'MPR'
    }
    await nextTick()
    expect(getDisplayTool()).toBeTruthy()

    harness.activeTab.value = {
      ...harness.activeTab.value!,
      key: 'series-1::4d',
      title: 'Series 1 / 4D',
      viewType: '4D'
    }
    await nextTick()
    expect(getDisplayTool()).toBeTruthy()

    harness.activeTab.value = create3dTab()
    await nextTick()
    expect(getDisplayTool()).toBeUndefined()

    harness.wrapper.unmount()
  })

  it('closes option menus by default after a single-select option is chosen', async () => {
    const harness = mountToolbarHarness({
      ...create3dTab(),
      key: 'series-1::stack',
      title: 'Series 1 / Stack',
      viewType: 'Stack'
    })
    await nextTick()

    const windowTool = harness.toolbar.activeTools.value.find((tool) => tool.key === 'window')!
    const optionValue = windowTool.options![0]!.value

    harness.toolbar.setMenuOpen('window')
    expect(harness.toolbar.openMenuKey.value).toBe('window')
    harness.toolbar.selectToolOption(windowTool, optionValue)

    expect(harness.toolbar.openMenuKey.value).toBeNull()
    harness.wrapper.unmount()
  })

  it('keeps right-dock option panels open when requested', async () => {
    const harness = mountToolbarHarness({
      ...create3dTab(),
      key: 'series-1::stack',
      title: 'Series 1 / Stack',
      viewType: 'Stack'
    })
    await nextTick()

    const getTool = (key: string) => harness.toolbar.activeTools.value.find((tool) => tool.key === key)!
    const stackSelections = [
      ['layout', getTool('layout').options![0]!.value],
      ['window', getTool('window').options![0]!.value],
      ['rotate', getTool('rotate').options![0]!.value],
      ['play', getTool('play').options![0]!.value],
      ['pseudocolor', getTool('pseudocolor').options![0]!.value],
      ['measure', getTool('measure').options![0]!.value],
      ['qa', getTool('qa').options![0]!.value]
    ] as const

    for (const [toolKey, optionValue] of stackSelections) {
      const tool = getTool(toolKey)
      harness.toolbar.setMenuOpen(toolKey)
      harness.toolbar.selectToolOption(tool, optionValue, { keepMenuOpen: true })
      expect(harness.toolbar.openMenuKey.value).toBe(toolKey)
    }

    harness.activeTab.value = {
      ...create3dTab(),
      key: 'series-1::mpr',
      title: 'Series 1 / MPR',
      viewType: 'MPR'
    }
    await nextTick()

    const mprLayoutTool = getTool('mprLayout')
    harness.toolbar.setMenuOpen('mprLayout')
    harness.toolbar.selectToolOption(mprLayoutTool, mprLayoutTool.options![0]!.value, { keepMenuOpen: true })
    expect(harness.toolbar.openMenuKey.value).toBe('mprLayout')

    harness.wrapper.unmount()
  })

  it('clears measurements from the right-dock measure panel without changing active operation', async () => {
    const harness = mountToolbarHarness({
      ...create3dTab(),
      key: 'series-1::stack',
      title: 'Series 1 / Stack',
      viewType: 'Stack'
    })
    await nextTick()

    const measureTool = harness.toolbar.activeTools.value.find((tool) => tool.key === 'measure')!
    harness.toolbar.setMenuOpen('measure')
    harness.toolbar.selectToolOption(measureTool, 'reset:measurements', { keepMenuOpen: true })

    expect(harness.emitTriggerViewAction).toHaveBeenCalledWith({ action: 'clearMeasurements' })
    expect(harness.activeOperation.value).toBe('stack:window')
    expect(harness.toolbar.openMenuKey.value).toBe('measure')
    harness.wrapper.unmount()
  })

  it('clears annotations from the right-dock annotation panel without changing active operation', async () => {
    const harness = mountToolbarHarness({
      ...create3dTab(),
      key: 'series-1::stack',
      title: 'Series 1 / Stack',
      viewType: 'Stack'
    })
    await nextTick()

    const annotateTool = harness.toolbar.activeTools.value.find((tool) => tool.key === 'annotate')!
    harness.toolbar.selectToolOption(annotateTool, 'reset:annotations', { keepMenuOpen: true })

    expect(harness.emitTriggerViewAction).toHaveBeenCalledWith({ action: 'clearAnnotations' })
    expect(harness.activeOperation.value).toBe('stack:window')
    harness.wrapper.unmount()
  })
})
