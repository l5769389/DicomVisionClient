import { mount } from '@vue/test-utils'
import { computed, defineComponent, h, nextTick, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { useUiPreferences } from '../../ui/useUiPreferences'
import type { ViewerTabItem } from '../../../types/viewer'
import { createVolumeOrientationQuaternion } from '../volume/volumeOrientation'
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
  const emitViewportWheel = vi.fn()
  const exportCurrentView = vi.fn()
  const cleanupPointerInteractions = vi.fn()
  const stopViewportDrag = vi.fn()
  let toolbar!: ReturnType<typeof useViewerWorkspaceToolbar>

  const wrapper = mount(
    defineComponent({
      setup() {
        toolbar = useViewerWorkspaceToolbar({
          activeOperation: computed(() => activeOperation.value),
          activeTab: computed(() => activeTab.value),
          activeViewportKey,
          cleanupPointerInteractions,
          emitCompareSyncChange: vi.fn(),
          emitOpenLayoutView,
          emitOpenSeriesView: vi.fn(),
          emitSetActiveOperation,
          emitTriggerViewAction,
          emitViewportWheel,
          exportCurrentView,
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
    cleanupPointerInteractions,
    emitOpenLayoutView,
    emitSetActiveOperation,
    emitTriggerViewAction,
    emitViewportWheel,
    exportCurrentView,
    stopViewportDrag,
    toolbar,
    wrapper
  }
}

describe('useViewerWorkspaceToolbar surface mode', () => {
  it('offers alignment angle only for ordinary 2D stack-like views', async () => {
    const preferences = useUiPreferences()
    const previousLocale = preferences.locale.value
    preferences.setLocale('en-US')
    const harness = mountToolbarHarness(create3dTab({ viewType: 'Stack', viewId: 'stack-view' }))
    await nextTick()

    const stackMeasure = harness.toolbar.activeTools.value.find((tool) => tool.key === 'measure')!
    expect(stackMeasure.options?.map((option) => option.value)).toContain('measure:alignment-horizontal')
    expect(stackMeasure.options?.map((option) => option.value)).toContain('measure:alignment-vertical')
    const horizontal = stackMeasure.options?.find((option) => option.value === 'measure:alignment-horizontal')
    const vertical = stackMeasure.options?.find((option) => option.value === 'measure:alignment-vertical')
    expect(horizontal?.description).toBe('Draw along a real edge and compare it with the physical DICOM horizontal axis.')
    expect(vertical?.description).toBe('Draw along a real edge and compare it with the physical DICOM vertical axis.')

    preferences.setLocale('zh-CN')
    await nextTick()
    const localizedMeasure = harness.toolbar.activeTools.value.find((tool) => tool.key === 'measure')!
    expect(localizedMeasure.options?.find((option) => option.value === 'measure:alignment-horizontal')?.description).toBe(
      '沿真实边缘绘线，测量它相对 DICOM 物理水平方向的偏角'
    )
    expect(localizedMeasure.options?.find((option) => option.value === 'measure:alignment-vertical')?.description).toBe(
      '沿真实边缘绘线，测量它相对 DICOM 物理垂直方向的偏角'
    )

    harness.activeTab.value = create3dTab({ viewType: 'MPR', viewId: 'mpr-view' })
    await nextTick()
    const mprMeasure = harness.toolbar.activeTools.value.find((tool) => tool.key === 'measure')!
    expect(mprMeasure.options?.map((option) => option.value)).not.toContain('measure:alignment-horizontal')
    expect(mprMeasure.options?.map((option) => option.value)).not.toContain('measure:alignment-vertical')
    preferences.setLocale(previousLocale)
    harness.wrapper.unmount()
  })

  it('preserves raw wheel deltas so the core can distinguish trackpads from mouse wheels', async () => {
    const harness = mountToolbarHarness({
      ...create3dTab(),
      key: 'series-1::stack',
      title: 'Series 1 / Stack',
      viewType: 'Stack'
    })
    await nextTick()

    harness.toolbar.handleViewportWheel({ viewportKey: 'single', deltaY: 120 })
    expect(harness.emitViewportWheel).toHaveBeenLastCalledWith({ viewportKey: 'single', deltaY: 120 })

    harness.toolbar.handleViewportWheel({ viewportKey: 'single', deltaY: -240 })
    expect(harness.emitViewportWheel).toHaveBeenLastCalledWith({ viewportKey: 'single', deltaY: -240 })

    harness.toolbar.handleViewportWheel({ viewportKey: 'single', deltaY: 5, exact: true })
    expect(harness.emitViewportWheel).toHaveBeenLastCalledWith({ viewportKey: 'single', deltaY: 5, exact: true })

    harness.wrapper.unmount()
  })

  it('navigates ten slices or directly to the first and last slice from the page panel', async () => {
    vi.useFakeTimers()
    const harness = mountToolbarHarness({
      ...create3dTab(),
      key: 'series-1::stack',
      title: 'Series 1 / Stack',
      viewType: 'Stack',
      sliceLabel: '3 / 9'
    })
    await nextTick()
    const pageTool = harness.toolbar.activeTools.value.find((tool) => tool.key === 'page')!

    const cases = [
      ['page:previous10', -10],
      ['page:next10', 10],
      ['page:first', -2],
      ['page:last', 6]
    ] as const
    for (const [option, deltaY] of cases) {
      harness.emitViewportWheel.mockClear()
      harness.toolbar.selectToolOption(pageTool, option, { keepMenuOpen: true })
      vi.advanceTimersByTime(260)
      await nextTick()
      expect(harness.emitViewportWheel).toHaveBeenLastCalledWith({ viewportKey: 'single', deltaY, exact: true })
    }

    harness.wrapper.unmount()
    vi.useRealTimers()
  })

  it('resets pseudocolor to the default selected in settings', async () => {
    vi.useFakeTimers()
    const preferences = useUiPreferences()
    const previousPreset = preferences.selectedPseudocolorKey.value
    preferences.selectedPseudocolorKey.value = 'hotiron'
    const harness = mountToolbarHarness({
      ...create3dTab(),
      key: 'series-1::stack',
      title: 'Series 1 / Stack',
      viewType: 'Stack'
    })
    await nextTick()
    const pseudocolorTool = harness.toolbar.activeTools.value.find((tool) => tool.key === 'pseudocolor')!

    harness.toolbar.selectToolOption(pseudocolorTool, 'pseudocolor:reset', { keepMenuOpen: true })
    vi.advanceTimersByTime(260)
    await nextTick()

    expect(harness.toolbar.stackToolSelections.value.pseudocolor).toBe('pseudocolor:hotiron')
    expect(harness.emitTriggerViewAction).toHaveBeenCalledWith({ action: 'pseudocolor', value: 'pseudocolor:hotiron' })
    harness.wrapper.unmount()
    preferences.selectedPseudocolorKey.value = previousPreset
    vi.useRealTimers()
  })

  it('cleans stale pointer interactions before activating annotation mode', async () => {
    const harness = mountToolbarHarness({
      ...create3dTab(),
      key: 'series-1::stack',
      title: 'Series 1 / Stack',
      viewType: 'Stack'
    })
    await nextTick()

    const annotateTool = harness.toolbar.activeTools.value.find((tool) => tool.key === 'annotate')!
    harness.activeOperation.value = 'stack:window'
    harness.cleanupPointerInteractions.mockClear()
    harness.toolbar.applyTool(annotateTool)

    expect(harness.cleanupPointerInteractions).toHaveBeenCalled()
    expect(harness.emitSetActiveOperation).toHaveBeenCalledWith('stack:annotate:arrow')
    harness.wrapper.unmount()
  })

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

  it('shows surface controls while hiding volume/window-only tools', async () => {
    const harness = mountToolbarHarness()
    await nextTick()

    const toolKeys = harness.toolbar.activeTools.value.map((tool) => tool.key)
    expect(toolKeys).toContain('rotate3d')
    expect(toolKeys).toContain('zoom')
    expect(toolKeys).toContain('render3dMode')
    expect(toolKeys).toContain('surfaceParams')
    expect(toolKeys).toContain('surfacePreset')
    expect(toolKeys).not.toContain('window')
    expect(toolKeys).not.toContain('volumeParams')
    expect(toolKeys).not.toContain('volumePreset')
    expect(toolKeys).toEqual([
      'layout',
      'rotate3d',
      'volumeOrientation',
      'pan',
      'zoom',
      'render3dMode',
      'volumeRemoveBed',
      'volumeClip',
      'surfaceParams',
      'surfacePreset',
      'export',
      'display',
      'tag',
      'reset'
    ])
    const surfacePreset = harness.toolbar.activeTools.value.find((tool) => tool.key === 'surfacePreset')!
    expect(surfacePreset.icon).toBe('surface-preset')
    expect(surfacePreset.showSelectedOptionIcon).toBe(false)
    expect(harness.toolbar.activeVolumeRenderConfig.value).toBeNull()
    expect(harness.toolbar.activeSurfaceRenderConfig.value?.preset).toBe('bone')
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
    expect(toolKeys).not.toContain('window')
    expect(toolKeys).toContain('volumeParams')
    expect(toolKeys).toContain('volumePreset')
    expect(toolKeys).not.toContain('surfaceParams')
    expect(toolKeys).not.toContain('surfacePreset')
    expect(toolKeys).toEqual([
      'layout',
      'rotate3d',
      'volumeOrientation',
      'pan',
      'zoom',
      'render3dMode',
      'volumeRemoveBed',
      'volumeClip',
      'volumeParams',
      'volumePreset',
      'export',
      'display',
      'tag',
      'reset'
    ])
    expect(harness.toolbar.stackToolSelections.value.render3dMode).toBe('render3dMode:volume')
    const volumePresetTool = harness.toolbar.activeTools.value.find((tool) => tool.key === 'volumePreset')!
    expect(volumePresetTool.options?.map((option) => option.value)).toEqual(expect.arrayContaining([
      'volumePreset:aaa',
      'volumePreset:bonePlusPlate',
      'volumePreset:coronaryCta',
      'volumePreset:mrAngio',
      'volumePreset:cbctBone2'
    ]))
    expect(volumePresetTool.options?.find((option) => option.value === 'volumePreset:coronaryCta')?.group).toBe('CTA')

    harness.wrapper.unmount()
  })

  it('updates the remove-bed tool icon and label from server metadata', async () => {
    const harness = mountToolbarHarness({
      ...create3dTab(),
      render3dMode: 'volume',
      volumeRenderOptions: {
        removeBed: false,
        clip: null
      }
    })
    await nextTick()

    const getRemoveBedTool = () => harness.toolbar.activeTools.value.find((tool) => tool.key === 'volumeRemoveBed')!

    expect(getRemoveBedTool().icon).toBe('bed-visible')
    expect(getRemoveBedTool().label).toBe('去床板')
    expect(getRemoveBedTool().title).toBe('隐藏床板')
    expect(getRemoveBedTool().pressed).toBeUndefined()
    expect(getRemoveBedTool().stateControl).toBe(true)
    expect(getRemoveBedTool().stateActive).toBe(false)

    harness.activeTab.value = {
      ...harness.activeTab.value!,
      volumeRenderOptions: {
        removeBed: true,
        clip: null
      }
    }
    await nextTick()

    expect(getRemoveBedTool().icon).toBe('bed-hidden')
    expect(getRemoveBedTool().label).toBe('已去床板')
    expect(getRemoveBedTool().title).toBe('恢复床板显示')
    expect(getRemoveBedTool().pressed).toBeUndefined()
    expect(getRemoveBedTool().stateControl).toBe(true)
    expect(getRemoveBedTool().stateActive).toBe(true)

    harness.wrapper.unmount()
  })

  it('opens the layout menu from the 3D layout main button and applies a template', async () => {
    const harness = mountToolbarHarness({
      ...create3dTab(),
      render3dMode: 'volume'
    })
    await nextTick()

    const layoutTool = harness.toolbar.activeTools.value.find((tool) => tool.key === 'layout')!
    harness.toolbar.applyTool(layoutTool)
    expect(harness.toolbar.openMenuKey.value).toBe('layout')

    const layoutOption = layoutTool.options!.find((option) => option.layoutRows === 2 && option.layoutColumns === 2)!
    harness.toolbar.selectToolOption(layoutTool, layoutOption.value)

    expect(harness.emitOpenLayoutView).toHaveBeenCalledWith(expect.objectContaining({
      rows: 2,
      columns: 2
    }))

    harness.wrapper.unmount()
  })

  it('keeps the 3D toolset when the active Layout slot is a volume view', async () => {
    const volumeTab = create3dTab({ render3dMode: 'volume' })
    const harness = mountToolbarHarness({
      ...volumeTab,
      key: 'series-1::layout',
      viewType: 'Layout',
      viewId: '',
      layoutSlots: [
        {
          id: 'slot-1-1',
          row: 0,
          column: 0,
          rowSpan: 1,
          columnSpan: 1,
          seriesId: volumeTab.seriesId,
          viewType: '3D',
          sourceViewType: '3D',
          viewportKey: 'volume',
          viewId: 'layout-volume-view',
          imageSrc: 'blob:layout-volume'
        }
      ]
    })
    await nextTick()

    const toolKeys = harness.toolbar.activeTools.value.map((tool) => tool.key)
    expect(harness.activeViewportKey.value).toBe('slot-1-1')
    expect(toolKeys).toContain('rotate3d')
    expect(toolKeys).toContain('volumeRemoveBed')
    expect(toolKeys).toContain('volumeClip')
    expect(toolKeys).toContain('volumePreset')

    harness.wrapper.unmount()
  })

  it('starts 3D clipping in inside mode from the main clip button', async () => {
    const harness = mountToolbarHarness({
      ...create3dTab(),
      render3dMode: 'volume'
    })
    await nextTick()

    const clipTool = harness.toolbar.activeTools.value.find((tool) => tool.key === 'volumeClip')!
    harness.toolbar.selectToolOption(clipTool, 'volumeClip:outside')
    expect(harness.emitSetActiveOperation).toHaveBeenLastCalledWith('stack:volumeClip:outside')

    harness.emitSetActiveOperation.mockClear()
    harness.toolbar.applyTool(clipTool)

    expect(harness.emitSetActiveOperation).toHaveBeenCalledWith('stack:volumeClip:inside')
    expect(harness.toolbar.stackToolSelections.value.volumeClip).toBe('volumeClip:inside')

    harness.wrapper.unmount()
  })

  it('emits surfacePreset when selecting a surface preset option', async () => {
    vi.useFakeTimers()
    const harness = mountToolbarHarness()
    await nextTick()

    const surfacePresetTool = harness.toolbar.activeTools.value.find((tool) => tool.key === 'surfacePreset')!
    harness.toolbar.selectToolOption(surfacePresetTool, 'surfacePreset:softTissue')
    vi.advanceTimersByTime(260)
    await nextTick()

    expect(harness.emitTriggerViewAction).toHaveBeenCalledWith({
      action: 'surfacePreset',
      value: 'surfacePreset:softTissue'
    })
    harness.wrapper.unmount()
    vi.useRealTimers()
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

  it('places the MPR layout before all MPR tools, and maps MPR reset actions', async () => {
    const harness = mountToolbarHarness({
      ...create3dTab(),
      key: 'series-1::mpr',
      title: 'Series 1 / MPR',
      viewType: 'MPR',
      mprCrosshairMode: 'orthogonal'
    })
    await nextTick()

    const toolKeys = harness.toolbar.activeTools.value.map((tool) => tool.key)
    expect(toolKeys.slice(0, 6)).toEqual(['mprLayout', 'pan', 'zoom', 'window', 'crosshair', 'rotate3d'])

    const crosshairTool = harness.toolbar.activeTools.value.find((tool) => tool.key === 'crosshair')!
    harness.toolbar.selectToolOption(crosshairTool, 'mprCrosshair:reset', { keepMenuOpen: true })
    expect(harness.emitTriggerViewAction).toHaveBeenCalledWith({ action: 'mprCrosshairReset' })

    harness.emitTriggerViewAction.mockClear()
    const rotate3dTool = harness.toolbar.activeTools.value.find((tool) => tool.key === 'rotate3d')!
    expect(rotate3dTool.dockOptions?.map((option) => option.value)).toEqual(['rotate3d:reset'])
    harness.toolbar.selectToolOption(rotate3dTool, 'rotate3d:reset', { keepMenuOpen: true })
    expect(harness.emitTriggerViewAction).toHaveBeenCalledWith({ action: 'rotate3dReset' })

    harness.wrapper.unmount()
  })

  it('plays MPR slices from the current slice in the active viewport', async () => {
    vi.useFakeTimers()
    try {
      const harness = mountToolbarHarness({
        ...create3dTab(),
        key: 'series-1::mpr',
        title: 'Series 1 / MPR',
        viewType: 'MPR',
        viewportViewIds: {
          'mpr-ax': 'view-ax',
          'mpr-cor': 'view-cor',
          'mpr-sag': 'view-sag'
        },
        viewportSliceLabels: {
          'mpr-ax': '2 / 8',
          'mpr-cor': '4 / 12',
          'mpr-sag': '1 / 10'
        }
      })
      harness.activeViewportKey.value = 'mpr-cor'
      await nextTick()

      const toolKeys = harness.toolbar.activeTools.value.map((tool) => tool.key)
      expect(toolKeys).toContain('play')

      harness.toolbar.applyTool(harness.toolbar.activeTools.value.find((tool) => tool.key === 'play')!)
      expect(harness.emitViewportWheel).not.toHaveBeenCalled()

      vi.advanceTimersByTime(210)
      expect(harness.emitViewportWheel).toHaveBeenLastCalledWith({ viewportKey: 'mpr-cor', deltaY: 1, exact: true })

      harness.wrapper.unmount()
    } finally {
      vi.useRealTimers()
    }
  })

  it('loops slice playback from the last slice back to the first slice', async () => {
    vi.useFakeTimers()
    try {
      const harness = mountToolbarHarness({
        ...create3dTab(),
        viewType: 'MPR',
        viewportViewIds: {
          'mpr-ax': 'view-ax',
          'mpr-cor': 'view-cor',
          'mpr-sag': 'view-sag'
        },
        viewportSliceLabels: {
          'mpr-ax': '10 / 10',
          'mpr-cor': '4 / 12',
          'mpr-sag': '1 / 10'
        }
      })
      harness.activeViewportKey.value = 'mpr-ax'
      await nextTick()

      harness.toolbar.applyTool(harness.toolbar.activeTools.value.find((tool) => tool.key === 'play')!)
      vi.advanceTimersByTime(210)

      expect(harness.emitViewportWheel).toHaveBeenLastCalledWith({ viewportKey: 'mpr-ax', deltaY: -9, exact: true })
      harness.wrapper.unmount()
    } finally {
      vi.useRealTimers()
    }
  })

  it('plays 4D MPR slices independently from phase playback', async () => {
    vi.useFakeTimers()
    try {
      const harness = mountToolbarHarness({
        ...create3dTab(),
        key: 'series-1::4d',
        title: 'Series 1 / 4D',
        viewType: '4D',
        fourDIsPlaying: false,
        viewportViewIds: {
          'mpr-ax': 'view-ax',
          'mpr-cor': 'view-cor',
          'mpr-sag': 'view-sag'
        },
        viewportSliceLabels: {
          'mpr-ax': '2 / 8',
          'mpr-cor': '1 / 12',
          'mpr-sag': '3 / 10'
        }
      })
      harness.activeViewportKey.value = 'mpr-sag'
      await nextTick()

      harness.toolbar.applyTool(harness.toolbar.activeTools.value.find((tool) => tool.key === 'play')!)
      expect(harness.emitViewportWheel).not.toHaveBeenCalled()

      vi.advanceTimersByTime(210)
      expect(harness.emitViewportWheel).toHaveBeenLastCalledWith({ viewportKey: 'mpr-sag', deltaY: 1, exact: true })

      harness.activeTab.value = {
        ...harness.activeTab.value!,
        fourDIsPlaying: true
      }
      await nextTick()
      expect(harness.toolbar.areToolbarActionsDisabled.value).toBe(true)

      harness.wrapper.unmount()
    } finally {
      vi.useRealTimers()
    }
  })

  it('adds display overlay toggles for 2D, MPR, 4D, and 3D views', async () => {
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

    expect(getDisplayTool()?.options?.map((option) => option.value)).toEqual([
      'display:cornerInfo',
      'display:scaleBar',
      'display:pseudocolorBar'
    ])
    expect(getDisplayTool()?.options?.map((option) => option.checked)).toEqual([true, true, true])
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
    expect(getDisplayTool()?.options?.map((option) => option.checked)).toEqual([false, true, true])

    harness.activeTab.value = {
      ...harness.activeTab.value!,
      showCornerInfo: false
    }
    await nextTick()
    expect(getDisplayTool()?.options?.map((option) => option.checked)).toEqual([false, true, true])

    harness.activeTab.value = {
      ...harness.activeTab.value!,
      key: 'series-1::mpr',
      title: 'Series 1 / MPR',
      viewType: 'MPR'
    }
    await nextTick()
    expect(getDisplayTool()).toBeTruthy()
    expect(getDisplayTool()?.options?.map((option) => option.value)).toEqual([
      'display:cornerInfo',
      'display:scaleBar',
      'display:pseudocolorBar',
      'display:crosshair'
    ])
    expect(getDisplayTool()?.options?.find((option) => option.value === 'display:crosshair')?.checked).toBe(true)

    harness.emitTriggerViewAction.mockClear()
    harness.toolbar.selectToolOption(getDisplayTool()!, 'display:crosshair')
    expect(harness.emitTriggerViewAction).toHaveBeenCalledWith({
      action: 'displayOverlay',
      overlay: 'crosshair',
      enabled: false
    })

    harness.activeTab.value = {
      ...harness.activeTab.value!,
      key: 'series-1::4d',
      title: 'Series 1 / 4D',
      viewType: '4D'
    }
    await nextTick()
    expect(getDisplayTool()).toBeTruthy()

    harness.activeTab.value = {
      ...harness.activeTab.value!,
      key: 'series-1::fusion',
      title: 'Series 1 / PETCTFusion',
      viewType: 'PETCTFusion'
    }
    await nextTick()
    expect(getDisplayTool()).toBeTruthy()
    expect(getDisplayTool()?.options?.map((option) => option.value)).toEqual(['display:cornerInfo', 'display:scaleBar'])

    harness.activeTab.value = create3dTab()
    await nextTick()
    expect(getDisplayTool()?.options?.map((option) => option.value)).toEqual([
      'display:cornerInfo',
      'display:volumeOrientationCube'
    ])
    expect(getDisplayTool()?.options?.find((option) => option.value === 'display:volumeOrientationCube')?.checked).toBe(true)

    harness.emitTriggerViewAction.mockClear()
    harness.toolbar.selectToolOption(getDisplayTool()!, 'display:volumeOrientationCube')
    expect(harness.emitTriggerViewAction).toHaveBeenCalledWith({
      action: 'displayOverlay',
      overlay: 'volumeOrientationCube',
      enabled: false
    })

    harness.wrapper.unmount()
  })

  it('shows the currently selected VR or Surface icon on the render-mode tool', async () => {
    const harness = mountToolbarHarness()
    await nextTick()

    const renderTool = harness.toolbar.activeTools.value.find((tool) => tool.key === 'render3dMode')!
    expect(renderTool.icon).toBe('render-volume')
    expect(renderTool.showSelectedOptionIcon).toBe(true)
    expect(renderTool.options?.map((option) => option.icon)).toEqual(['render-volume', 'render-surface'])

    harness.activeTab.value = {
      ...harness.activeTab.value!,
      render3dMode: 'volume'
    }
    await nextTick()
    expect(harness.toolbar.stackToolSelections.value.render3dMode).toBe('render3dMode:volume')

    harness.activeTab.value = {
      ...harness.activeTab.value!,
      render3dMode: 'surface'
    }
    await nextTick()
    expect(harness.toolbar.stackToolSelections.value.render3dMode).toBe('render3dMode:surface')

    harness.wrapper.unmount()
  })

  it('changes the 3D render mode without replacing the active interaction tool', async () => {
    const harness = mountToolbarHarness(create3dTab({ render3dMode: 'volume' }))
    await nextTick()

    const rotateTool = harness.toolbar.activeTools.value.find((tool) => tool.key === 'rotate3d')!
    harness.toolbar.applyTool(rotateTool)
    expect(harness.activeOperation.value).toBe('stack:rotate3d')
    expect(harness.toolbar.activeToolbarToolKey.value).toBe('rotate3d')
    harness.emitSetActiveOperation.mockClear()

    const renderTool = harness.toolbar.activeTools.value.find((tool) => tool.key === 'render3dMode')!
    harness.toolbar.selectToolOption(renderTool, 'render3dMode:surface')

    expect(harness.emitTriggerViewAction).toHaveBeenCalledWith({
      action: 'render3dMode',
      value: 'render3dMode:surface'
    })
    expect(harness.emitSetActiveOperation).not.toHaveBeenCalled()
    expect(harness.activeOperation.value).toBe('stack:rotate3d')
    expect(harness.toolbar.activeToolbarToolKey.value).toBe('rotate3d')
    harness.wrapper.unmount()
  })

  it('binds the 3D orientation tool to the current volume quaternion', async () => {
    const harness = mountToolbarHarness(create3dTab({
      render3dMode: 'volume',
      orientation: {
        top: null,
        right: null,
        bottom: null,
        left: null,
        volumeQuaternion: createVolumeOrientationQuaternion('L')
      }
    }))
    await nextTick()

    const orientationTool = harness.toolbar.activeTools.value.find((tool) => tool.key === 'volumeOrientation')!
    expect(orientationTool.label).toBe('朝向 · L')
    expect(orientationTool.icon).toBe('orientation-face-L')
    const leftOption = orientationTool.options?.find((option) => option.value === 'volumeOrientation:L')
    expect(leftOption?.checked).toBe(true)
    expect(leftOption?.icon).toBeUndefined()
    expect(leftOption?.label).toBe('Left')
    expect(leftOption?.description).toBe('左侧')

    harness.toolbar.selectToolOption(orientationTool, 'volumeOrientation:S')
    expect(harness.emitTriggerViewAction).toHaveBeenCalledWith({
      action: 'volumeOrientation',
      value: 'S'
    })

    harness.emitTriggerViewAction.mockClear()
    harness.toolbar.selectToolOption(orientationTool, 'volumeOrientation:reset')
    expect(harness.emitTriggerViewAction).toHaveBeenCalledWith({
      action: 'volumeOrientation',
      value: 'A'
    })
    expect(orientationTool.footerOptions?.[0]).toMatchObject({
      value: 'volumeOrientation:reset',
      label: '重置朝向'
    })

    harness.wrapper.unmount()
  })

  it('does not keep a stale selected orientation while the 3D model is oblique', async () => {
    const harness = mountToolbarHarness(create3dTab({
      render3dMode: 'volume',
      orientation: {
        top: null,
        right: null,
        bottom: null,
        left: null,
        volumeQuaternion: [0.3826834, 0, 0, 0.9238795]
      }
    }))
    await nextTick()

    const orientationTool = harness.toolbar.activeTools.value.find((tool) => tool.key === 'volumeOrientation')!
    expect(orientationTool.label).toBe('朝向 · 自由')
    expect(orientationTool.icon).toBe('orientation-face-oblique')
    expect(orientationTool.options?.filter((option) => option.checked)).toHaveLength(0)

    harness.wrapper.unmount()
  })

  it('shows A as the default 3D orientation when no quaternion has arrived yet', async () => {
    const harness = mountToolbarHarness(create3dTab({ render3dMode: 'volume' }))
    await nextTick()

    const orientationTool = harness.toolbar.activeTools.value.find((tool) => tool.key === 'volumeOrientation')!
    expect(orientationTool.label).toBe('朝向 · A')
    expect(orientationTool.icon).toBe('orientation-face-A')
    expect(orientationTool.options?.find((option) => option.value === 'volumeOrientation:A')?.checked).toBe(true)
    harness.wrapper.unmount()
  })

  it('only offers scale-bar settings when the active MPR or Layout viewport is 2D', async () => {
    const harness = mountToolbarHarness({
      ...create3dTab(),
      key: 'series-1::mpr',
      title: 'Series 1 / MPR',
      viewType: 'MPR'
    })
    await nextTick()

    const getDisplayValues = () =>
      harness.toolbar.activeTools.value.find((tool) => tool.key === 'display')?.options?.map((option) => option.value) ?? []
    const mprLayoutTool = harness.toolbar.activeTools.value.find((tool) => tool.key === 'mprLayout')!
    const mpr3dOption = mprLayoutTool.options!.find((option) => option.mprLayoutKey === 'mpr-3d')!
    harness.toolbar.selectToolOption(mprLayoutTool, mpr3dOption.value)
    harness.activeViewportKey.value = 'volume'
    await nextTick()
    expect(getDisplayValues()).not.toContain('display:scaleBar')

    harness.activeViewportKey.value = 'mpr-ax'
    await nextTick()
    expect(getDisplayValues()).toContain('display:scaleBar')

    const volumeTab = create3dTab({ render3dMode: 'volume' })
    harness.activeTab.value = {
      ...volumeTab,
      key: 'series-1::layout',
      viewType: 'Layout',
      viewId: '',
      layoutSlots: [
        {
          id: 'slot-volume',
          row: 0,
          column: 0,
          rowSpan: 1,
          columnSpan: 1,
          seriesId: volumeTab.seriesId,
          viewType: '3D',
          sourceViewType: '3D',
          viewportKey: 'volume',
          viewId: 'layout-volume-view'
        },
        {
          id: 'slot-stack',
          row: 0,
          column: 1,
          rowSpan: 1,
          columnSpan: 1,
          seriesId: volumeTab.seriesId,
          viewType: 'Stack',
          sourceViewType: 'Stack',
          viewportKey: 'single',
          viewId: 'layout-stack-view'
        }
      ]
    }
    harness.activeViewportKey.value = 'slot-volume'
    await nextTick()
    expect(getDisplayValues()).not.toContain('display:scaleBar')

    harness.activeViewportKey.value = 'slot-stack'
    await nextTick()
    expect(getDisplayValues()).toContain('display:scaleBar')

    harness.wrapper.unmount()
  })

  it('uses fusion-specific toolbar actions without layout for PET/CT fusion', async () => {
    const harness = mountToolbarHarness({
      ...create3dTab(),
      key: 'fusion:ct:pet',
      title: 'CT + PET / PETCTFusion',
      viewType: 'PETCTFusion',
      fusionViewIds: {
        'fusion-ct-ax': 'ct-view',
        'fusion-pet-ax': 'pet-view',
        'fusion-overlay-ax': 'overlay-view',
        'fusion-pet-cor-mip': 'mip-view'
      },
      fusionManualRegistration: false,
      fusionInfo: {
        paneRole: 'fusion-overlay-ax',
        ctSeriesId: 'ct',
        petSeriesId: 'pet',
        petPseudocolorPreset: 'petct-rainbow',
        alpha: 0.52,
        revision: 0,
        registration: {
          translateRowMm: 0,
          translateColMm: 0,
          rotationDegrees: 0,
          saved: false
        }
      }
    })
    await nextTick()

    const toolKeys = harness.toolbar.activeTools.value.map((tool) => tool.key)
    expect(toolKeys).not.toContain('layout')
    expect(toolKeys).not.toContain('play')
    expect(toolKeys).not.toContain('qa')
    expect(toolKeys).toContain('fusionRegistration')
    expect(toolKeys).toContain('fusionPetDisplay')
    expect(toolKeys.at(-2)).toBe('fusionPetDisplay')
    expect(toolKeys.at(-1)).toBe('fusionRegistration')

    const exportTool = harness.toolbar.activeTools.value.find((tool) => tool.key === 'export')!
    expect(exportTool.options?.map((option) => option.value)).toEqual([
      'exportTarget:fusion-ct-ax',
      'exportTarget:fusion-pet-ax',
      'exportTarget:fusion-overlay-ax',
      'exportTarget:fusion-pet-cor-mip',
      'png',
      'dicom',
      'dicom-sr',
      'dicom-gsps'
    ])
    expect(exportTool.options?.find((option) => option.value === 'exportTarget:fusion-overlay-ax')?.checked).toBe(true)
    harness.toolbar.applyTool(exportTool)
    expect(harness.toolbar.openMenuKey.value).toBe('export')
    expect(harness.exportCurrentView).not.toHaveBeenCalled()
    harness.toolbar.selectToolOption(exportTool, 'exportTarget:fusion-pet-ax')
    expect(harness.exportCurrentView).not.toHaveBeenCalled()
    await nextTick()
    expect(harness.toolbar.activeTools.value.find((tool) => tool.key === 'export')?.options?.find((option) => option.value === 'exportTarget:fusion-pet-ax')?.checked).toBe(true)
    harness.toolbar.selectToolOption(exportTool, 'png')
    expect(harness.exportCurrentView).toHaveBeenCalledWith('png', 'fusion-pet-ax')

    const manualTool = harness.toolbar.activeTools.value.find((tool) => tool.key === 'fusionRegistration')!
    expect(harness.toolbar.isToolSelected(manualTool)).toBe(false)
    harness.toolbar.selectToolOption(manualTool, 'fusionRegistration:toggle')
    expect(harness.emitTriggerViewAction).toHaveBeenCalledWith({
      action: 'fusionManualRegistration',
      enabled: true
    })

    harness.activeTab.value = {
      ...harness.activeTab.value!,
      fusionManualRegistration: true
    }
    await nextTick()
    expect(harness.toolbar.isToolSelected(manualTool)).toBe(true)

    harness.emitTriggerViewAction.mockClear()
    const petDisplayTool = harness.toolbar.activeTools.value.find((tool) => tool.key === 'fusionPetDisplay')!
    expect(petDisplayTool.inlineKind).toBe('fusionPetDisplay')

    harness.emitTriggerViewAction.mockClear()
    harness.toolbar.selectToolOption(petDisplayTool, 'fusionPetPseudocolor:petct-hot')
    expect(harness.emitTriggerViewAction).toHaveBeenCalledWith({
      action: 'fusionPseudocolor',
      value: 'fusionPseudocolor:petct-hot'
    })

    harness.emitTriggerViewAction.mockClear()
    harness.toolbar.selectToolOption(petDisplayTool, 'fusionPetUnit:SUVbw')
    expect(harness.emitTriggerViewAction).toHaveBeenCalledWith({
      action: 'fusionPetUnit',
      value: 'fusionPetUnit:SUVbw'
    })

    harness.emitTriggerViewAction.mockClear()
    harness.toolbar.selectToolOption(petDisplayTool, 'fusionPetWindow:0:12.5')
    expect(harness.emitTriggerViewAction).toHaveBeenCalledWith({
      action: 'fusionPetWindow',
      value: 'fusionPetWindow:0:12.5'
    })

    harness.emitTriggerViewAction.mockClear()
    harness.toolbar.selectToolOption(petDisplayTool, 'fusionPetDisplay:reset')
    expect(harness.emitTriggerViewAction).toHaveBeenCalledWith({
      action: 'fusionPetDisplayReset'
    })

    harness.emitTriggerViewAction.mockClear()
    harness.toolbar.selectToolOption(manualTool, 'fusionRegistration:reset')
    expect(harness.emitTriggerViewAction).toHaveBeenCalledWith({ action: 'fusionRegistrationReset' })

    harness.emitTriggerViewAction.mockClear()
    harness.toolbar.selectToolOption(manualTool, 'fusionRegistration:load')
    expect(harness.emitTriggerViewAction).toHaveBeenCalledWith({ action: 'fusionRegistrationLoad' })

    harness.emitTriggerViewAction.mockClear()
    harness.toolbar.selectToolOption(manualTool, 'fusionRegistration:save')
    expect(harness.emitTriggerViewAction).toHaveBeenCalledWith({ action: 'fusionRegistrationSave' })

    harness.emitTriggerViewAction.mockClear()
    harness.toolbar.selectToolOption(manualTool, 'fusionRegistration:exit')
    expect(harness.emitTriggerViewAction).toHaveBeenCalledWith({
      action: 'fusionManualRegistration',
      enabled: false
    })

    harness.emitTriggerViewAction.mockClear()
    harness.toolbar.selectToolOption(manualTool, 'fusionRegistration:help')
    expect(harness.emitTriggerViewAction).not.toHaveBeenCalled()
    harness.wrapper.unmount()
  })

  it('uses standalone PET toolbar actions without fusion registration', async () => {
    const harness = mountToolbarHarness({
      ...create3dTab(),
      key: 'pet::PET',
      seriesId: 'pet',
      seriesTitle: 'PET FDG SUV',
      title: 'PET FDG SUV · PET',
      viewType: 'PET',
      viewId: 'pet-view',
      activeViewportKey: 'single',
      pseudocolorPreset: 'bwinverse',
      petInfo: {
        seriesId: 'pet',
        petUnit: 'SUVbw',
        petUnitLabel: 'g/ml (SUVbw)',
        petWindowMin: 0,
        petWindowMax: 8,
        pseudocolorPreset: 'bwinverse'
      }
    } as Partial<ViewerTabItem> as ViewerTabItem)
    harness.activeViewportKey.value = 'single'
    await nextTick()

    const toolKeys = harness.toolbar.activeTools.value.map((tool) => tool.key)
    expect(toolKeys).not.toContain('layout')
    expect(toolKeys).not.toContain('play')
    expect(toolKeys).not.toContain('qa')
    expect(toolKeys).not.toContain('fusionRegistration')
    expect(toolKeys).not.toContain('window')
    expect(toolKeys).not.toContain('pseudocolor')
    expect(toolKeys).toContain('fusionPetDisplay')

    const petDisplayTool = harness.toolbar.activeTools.value.find((tool) => tool.key === 'fusionPetDisplay')!
    harness.toolbar.selectToolOption(petDisplayTool, 'petUnit:kBqml')
    expect(harness.emitTriggerViewAction).toHaveBeenCalledWith({
      action: 'petUnit',
      value: 'petUnit:kBqml'
    })

    harness.emitTriggerViewAction.mockClear()
    harness.toolbar.selectToolOption(petDisplayTool, 'petWindow:0:12.5')
    expect(harness.emitTriggerViewAction).toHaveBeenCalledWith({
      action: 'petWindow',
      value: 'petWindow:0:12.5'
    })

    harness.emitTriggerViewAction.mockClear()
    harness.toolbar.selectToolOption(petDisplayTool, 'petDisplay:reset')
    expect(harness.emitTriggerViewAction).toHaveBeenCalledWith({
      action: 'petDisplayReset'
    })

    harness.wrapper.unmount()
  })

  it('shows segmentation only for regular MPR views', async () => {
    const harness = mountToolbarHarness({
      ...create3dTab(),
      key: 'series-1::mpr',
      title: 'Series 1 / MPR',
      viewType: 'MPR'
    })
    await nextTick()

    const getToolKeys = () => harness.toolbar.activeTools.value.map((tool) => tool.key)
    expect(getToolKeys()).toContain('segmentation')
    expect(getToolKeys().indexOf('segmentation')).toBe(getToolKeys().indexOf('mprMip') + 1)

    harness.activeTab.value = {
      ...harness.activeTab.value!,
      key: 'series-1::4d',
      title: 'Series 1 / 4D',
      viewType: '4D'
    }
    await nextTick()
    expect(getToolKeys()).not.toContain('segmentation')

    harness.activeTab.value = {
      ...harness.activeTab.value!,
      key: 'series-1::stack',
      title: 'Series 1 / Stack',
      viewType: 'Stack'
    }
    await nextTick()
    expect(getToolKeys()).not.toContain('segmentation')

    harness.activeTab.value = create3dTab()
    await nextTick()
    expect(getToolKeys()).not.toContain('segmentation')

    harness.wrapper.unmount()
  })

  it('asks for an export target before exporting multi-pane compare tabs', async () => {
    const harness = mountToolbarHarness({
      ...create3dTab(),
      key: 'compare:one:two',
      title: 'Compare',
      viewType: 'CompareStack',
      compareViewIds: {
        'compare-a': 'source-view',
        'compare-b': 'target-view'
      },
      compareSeriesTitles: {
        'compare-a': 'Source CT',
        'compare-b': 'Prior CT'
      }
    })
    harness.activeViewportKey.value = 'compare-b'
    await nextTick()

    const exportTool = harness.toolbar.activeTools.value.find((tool) => tool.key === 'export')!
    expect(exportTool.options?.slice(0, 2).map((option) => option.value)).toEqual([
      'exportTarget:compare-a',
      'exportTarget:compare-b'
    ])
    expect(exportTool.options?.find((option) => option.value === 'exportTarget:compare-b')?.checked).toBe(true)

    harness.toolbar.applyTool(exportTool)
    expect(harness.exportCurrentView).not.toHaveBeenCalled()
    expect(harness.toolbar.openMenuKey.value).toBe('export')

    harness.toolbar.selectToolOption(exportTool, 'exportTarget:compare-a')
    await nextTick()
    harness.toolbar.selectToolOption(exportTool, 'dicom')
    expect(harness.exportCurrentView).toHaveBeenCalledWith('dicom', 'compare-a')
    harness.wrapper.unmount()
  })

  it('selects MPR segmentation threshold and VOI operations', async () => {
    const harness = mountToolbarHarness({
      ...create3dTab(),
      key: 'series-1::mpr',
      title: 'Series 1 / MPR',
      viewType: 'MPR'
    })
    await nextTick()

    const segmentationTool = harness.toolbar.activeTools.value.find((tool) => tool.key === 'segmentation')!
    expect(segmentationTool.icon).toBe('segmentation')
    expect(segmentationTool.options?.map((option) => option.value)).toEqual(['segmentation:threshold', 'segmentation:voi'])
    expect(segmentationTool.options?.map((option) => option.icon)).toEqual(['segmentation-threshold', 'segmentation-voi'])

    harness.toolbar.selectToolOption(segmentationTool, 'segmentation:threshold')
    expect(harness.emitSetActiveOperation).toHaveBeenLastCalledWith('stack:segmentation:threshold')
    expect(harness.emitTriggerViewAction).toHaveBeenLastCalledWith({
      action: 'mprSegmentation',
      actionType: 'end',
      segmentationConfig: {
        enabled: true,
        clientRevision: 0,
        selectedRegionId: null,
        selectedVoi: false,
        selectedVoiId: null,
        thresholdRegions: [],
        voiSpheres: [],
        voiSphere: null
      }
    })
    expect(harness.toolbar.isMprSegmentationPanelOpen.value).toBe(true)

    harness.emitTriggerViewAction.mockClear()
    harness.toolbar.selectToolOption(segmentationTool, 'segmentation:voi')
    expect(harness.emitSetActiveOperation).toHaveBeenLastCalledWith('stack:segmentation:voi')
    expect(harness.emitTriggerViewAction).toHaveBeenLastCalledWith({
      action: 'mprSegmentation',
      actionType: 'end',
      segmentationConfig: {
        enabled: false,
        clientRevision: 0,
        selectedRegionId: null,
        selectedVoi: false,
        selectedVoiId: null,
        thresholdRegions: [],
        voiSpheres: [],
        voiSphere: null
      }
    })

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
    harness.activeOperation.value = 'stack:zoom'
    harness.toolbar.selectToolOption(windowTool, optionValue)

    expect(harness.toolbar.openMenuKey.value).toBeNull()
    expect(harness.activeOperation.value).toBe('stack:window')
    expect(harness.emitTriggerViewAction).toHaveBeenCalledWith({ action: 'windowPreset', value: optionValue })
    harness.wrapper.unmount()
  })

  it('keeps the window panel open while applying window mode from the right dock', async () => {
    const harness = mountToolbarHarness({
      ...create3dTab(),
      key: 'series-1::stack',
      title: 'Series 1 / Stack',
      viewType: 'Stack'
    })
    await nextTick()

    const windowTool = harness.toolbar.activeTools.value.find((tool) => tool.key === 'window')!
    harness.activeOperation.value = 'stack:zoom'
    harness.toolbar.setMenuOpen('window')
    harness.emitSetActiveOperation.mockClear()
    harness.toolbar.applyTool(windowTool, { keepMenuOpen: true })

    expect(harness.activeOperation.value).toBe('stack:window')
    expect(harness.emitSetActiveOperation).toHaveBeenCalledWith('stack:window')
    expect(harness.toolbar.openMenuKey.value).toBe('window')
    harness.wrapper.unmount()
  })

  it('maps right-dock pan and zoom reset actions to transform reset', async () => {
    const harness = mountToolbarHarness({
      ...create3dTab(),
      key: 'series-1::stack',
      title: 'Series 1 / Stack',
      viewType: 'Stack'
    })
    await nextTick()

    const panTool = harness.toolbar.activeTools.value.find((tool) => tool.key === 'pan')!
    harness.activeOperation.value = 'stack:pan'
    harness.toolbar.selectToolOption(panTool, 'transform:reset', { keepMenuOpen: true })

    expect(harness.emitTriggerViewAction).toHaveBeenCalledWith({ action: 'transformReset', transformScope: 'pan' })
    expect(harness.activeOperation.value).toBe('stack:pan')
    harness.emitTriggerViewAction.mockClear()

    const zoomTool = harness.toolbar.activeTools.value.find((tool) => tool.key === 'zoom')!
    harness.activeOperation.value = 'stack:zoom'
    harness.toolbar.selectToolOption(zoomTool, 'transform:reset', { keepMenuOpen: true })

    expect(harness.emitTriggerViewAction).toHaveBeenCalledWith({ action: 'transformReset', transformScope: 'zoom' })
    expect(harness.activeOperation.value).toBe('stack:zoom')
    harness.wrapper.unmount()
  })

  it('maps right-dock zoom range actions to absolute zoom transforms', async () => {
    const harness = mountToolbarHarness({
      ...create3dTab(),
      key: 'series-1::stack',
      title: 'Series 1 / Stack',
      viewType: 'Stack'
    })
    await nextTick()

    let zoomTool = harness.toolbar.activeTools.value.find((tool) => tool.key === 'zoom')!
    expect(zoomTool.dockOptions?.map((option) => option.value)).toEqual(['transform:reset'])
    expect(zoomTool.rangeControl).toMatchObject({
      kind: 'zoom',
      value: 1,
      min: 0.25,
      max: 10,
      resetValue: 1
    })
    expect(zoomTool.rangeControl?.ticks.map((tick) => tick.value)).toEqual([1, 2, 5, 10])

    harness.activeTab.value = {
      ...harness.activeTab.value!,
      transformState: {
        ...harness.activeTab.value!.transformState,
        zoom: 5
      }
    }
    await nextTick()
    zoomTool = harness.toolbar.activeTools.value.find((tool) => tool.key === 'zoom')!
    expect(zoomTool.rangeControl?.value).toBe(5)

    harness.activeTab.value = {
      ...harness.activeTab.value!,
      transformState: {
        ...harness.activeTab.value!.transformState,
        zoom: 1
      }
    }
    await nextTick()
    zoomTool = harness.toolbar.activeTools.value.find((tool) => tool.key === 'zoom')!
    expect(zoomTool.rangeControl?.value).toBe(1)

    harness.activeOperation.value = 'stack:zoom'
    harness.toolbar.selectToolOption(zoomTool, 'transform:zoom:5', { keepMenuOpen: true })

    expect(harness.emitTriggerViewAction).toHaveBeenCalledWith({ action: 'transformZoomPreset', transformZoom: 5 })
    expect(harness.activeOperation.value).toBe('stack:zoom')
    harness.wrapper.unmount()
  })

  it('resets window to the last explicitly applied window value for the active target', async () => {
    const harness = mountToolbarHarness({
      ...create3dTab(),
      key: 'series-1::stack',
      title: 'Series 1 / Stack',
      viewType: 'Stack',
      initialWindowInfo: { ww: 350, wl: 30 }
    })
    await nextTick()

    const windowTool = harness.toolbar.activeTools.value.find((tool) => tool.key === 'window')!
    harness.toolbar.selectToolOption(windowTool, '1500|-600', { keepMenuOpen: true })
    harness.emitTriggerViewAction.mockClear()

    harness.toolbar.selectToolOption(windowTool, 'window:reset', { keepMenuOpen: true })

    expect(harness.emitTriggerViewAction).toHaveBeenCalledWith({ action: 'windowPreset', value: '1500|-600' })
    expect(harness.toolbar.stackToolSelections.value.window).toBe('1500|-600')
    harness.wrapper.unmount()
  })

  it('resets window to the first image window when no explicit value was applied', async () => {
    const harness = mountToolbarHarness({
      ...create3dTab(),
      key: 'series-1::stack',
      title: 'Series 1 / Stack',
      viewType: 'Stack',
      initialWindowInfo: { ww: 350, wl: 30 }
    })
    await nextTick()

    const windowTool = harness.toolbar.activeTools.value.find((tool) => tool.key === 'window')!
    harness.emitTriggerViewAction.mockClear()
    harness.toolbar.selectToolOption(windowTool, 'window:reset', { keepMenuOpen: true })

    expect(harness.emitTriggerViewAction).toHaveBeenCalledWith({ action: 'windowPreset', value: '350|30' })
    expect(harness.toolbar.stackToolSelections.value.window).toBe('350|30')
    harness.wrapper.unmount()
  })

  it('leaves window reset as a no-op when no explicit or image window exists', async () => {
    const harness = mountToolbarHarness({
      ...create3dTab(),
      key: 'series-1::stack',
      title: 'Series 1 / Stack',
      viewType: 'Stack',
      initialWindowInfo: null
    })
    await nextTick()

    const windowTool = harness.toolbar.activeTools.value.find((tool) => tool.key === 'window')!
    harness.emitTriggerViewAction.mockClear()
    harness.toolbar.selectToolOption(windowTool, 'window:reset', { keepMenuOpen: true })

    expect(harness.emitTriggerViewAction).not.toHaveBeenCalled()
    harness.wrapper.unmount()
  })

  it('reapplies a selected mode tool when the active operation is stale', async () => {
    const harness = mountToolbarHarness({
      ...create3dTab(),
      key: 'series-1::stack',
      title: 'Series 1 / Stack',
      viewType: 'Stack'
    })
    await nextTick()

    const measureTool = harness.toolbar.activeTools.value.find((tool) => tool.key === 'measure')!
    harness.toolbar.selectToolOption(measureTool, 'measure:line')
    harness.activeOperation.value = 'stack:zoom'
    harness.toolbar.setMenuOpen('measure')
    harness.emitSetActiveOperation.mockClear()
    harness.toolbar.applyTool(measureTool, { keepMenuOpen: true })

    expect(harness.activeOperation.value).toBe('stack:measure:line')
    expect(harness.emitSetActiveOperation).toHaveBeenCalledWith('stack:measure:line')
    expect(harness.toolbar.openMenuKey.value).toBe('measure')
    harness.wrapper.unmount()
  })

  it('switches from window adjustment to page scroll when page is applied', async () => {
    const harness = mountToolbarHarness({
      ...create3dTab(),
      key: 'series-1::stack',
      title: 'Series 1 / Stack',
      viewType: 'Stack'
    })
    await nextTick()

    const pageTool = harness.toolbar.activeTools.value.find((tool) => tool.key === 'page')!
    harness.activeOperation.value = 'stack:window'
    harness.emitSetActiveOperation.mockClear()
    harness.toolbar.applyTool(pageTool)

    expect(harness.activeOperation.value).toBe('stack:scroll')
    expect(harness.emitSetActiveOperation).toHaveBeenCalledWith('stack:scroll')
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

  it('does not reopen the current Layout template when selecting the same layout', async () => {
    const harness = mountToolbarHarness({
      ...create3dTab(),
      key: 'layout::2x2',
      title: '2 x 2 Layout',
      viewType: 'Layout',
      layoutTemplate: {
        key: 'preset:2x2',
        label: '2 x 2',
        rows: 2,
        columns: 2,
        slots: [],
        source: 'preset'
      }
    })
    await nextTick()

    const layoutTool = harness.toolbar.activeTools.value.find((tool) => tool.key === 'layout')!
    const currentLayoutOption = layoutTool.options!.find((option) => option.layoutRows === 2 && option.layoutColumns === 2)!
    const previousSelections = harness.toolbar.stackToolSelections.value

    harness.toolbar.setMenuOpen('layout')
    harness.toolbar.selectToolOption(layoutTool, currentLayoutOption.value, { keepMenuOpen: true })

    expect(harness.emitOpenLayoutView).not.toHaveBeenCalled()
    expect(harness.toolbar.openMenuKey.value).toBe('layout')
    expect(harness.toolbar.stackToolSelections.value).toBe(previousSelections)
    harness.wrapper.unmount()
  })

  it('does not rewrite MPR layout state when selecting the active MPR layout', async () => {
    const harness = mountToolbarHarness({
      ...create3dTab(),
      key: 'series-1::mpr',
      title: 'Series 1 / MPR',
      viewType: 'MPR'
    })
    await nextTick()

    const mprLayoutTool = harness.toolbar.activeTools.value.find((tool) => tool.key === 'mprLayout')!
    const currentValue = harness.toolbar.stackToolSelections.value.mprLayout!
    const previousSelections = harness.toolbar.stackToolSelections.value

    harness.toolbar.setMenuOpen('mprLayout')
    harness.toolbar.selectToolOption(mprLayoutTool, currentValue, { keepMenuOpen: true })

    expect(harness.toolbar.openMenuKey.value).toBe('mprLayout')
    expect(harness.toolbar.stackToolSelections.value).toBe(previousSelections)
    harness.wrapper.unmount()
  })

  it('keeps segmentation, MIP, and 3D utility panels mutually exclusive', async () => {
    const harness = mountToolbarHarness({
      ...create3dTab(),
      key: 'series-1::mpr',
      title: 'Series 1 / MPR',
      viewType: 'MPR'
    })
    await nextTick()

    const getTool = (key: string) => harness.toolbar.activeTools.value.find((tool) => tool.key === key)!
    const segmentationTool = getTool('segmentation')
    const mprMipTool = getTool('mprMip')

    harness.toolbar.selectToolOption(segmentationTool, 'segmentation:threshold', { keepMenuOpen: true })
    expect(harness.toolbar.isMprSegmentationPanelOpen.value).toBe(true)
    expect(harness.toolbar.isMprMipPanelOpen.value).toBe(false)
    expect(harness.toolbar.isVolumeConfigPanelOpen.value).toBe(false)

    harness.toolbar.applyTool(mprMipTool)
    expect(harness.toolbar.isMprSegmentationPanelOpen.value).toBe(false)
    expect(harness.toolbar.isMprMipPanelOpen.value).toBe(true)
    expect(harness.toolbar.isVolumeConfigPanelOpen.value).toBe(false)

    const mprLayoutTool = getTool('mprLayout')
    const mpr3dOption = mprLayoutTool.options!.find((option) => option.mprLayoutKey === 'mpr-3d')!
    harness.toolbar.selectToolOption(mprLayoutTool, mpr3dOption.value, { keepMenuOpen: true })
    await nextTick()

    harness.toolbar.selectToolOption(segmentationTool, 'segmentation:voi', { keepMenuOpen: true })
    expect(harness.toolbar.isMprSegmentationPanelOpen.value).toBe(true)
    expect(harness.toolbar.isMprMipPanelOpen.value).toBe(false)

    harness.toolbar.applyTool(getTool('volumeParams'))
    expect(harness.toolbar.isMprSegmentationPanelOpen.value).toBe(false)
    expect(harness.toolbar.isMprMipPanelOpen.value).toBe(false)
    expect(harness.toolbar.isVolumeConfigPanelOpen.value).toBe(true)
    harness.wrapper.unmount()
  })

  it('opens segmentation with the default threshold operation from the main tool', async () => {
    const harness = mountToolbarHarness({
      ...create3dTab(),
      key: 'series-1::mpr',
      title: 'Series 1 / MPR',
      viewType: 'MPR'
    })
    await nextTick()

    const segmentationTool = harness.toolbar.activeTools.value.find((tool) => tool.key === 'segmentation')!
    harness.emitSetActiveOperation.mockClear()
    harness.toolbar.applyTool(segmentationTool)

    expect(harness.toolbar.isMprSegmentationPanelOpen.value).toBe(true)
    expect(harness.toolbar.stackToolSelections.value.segmentation).toBe('segmentation:threshold')
    expect(harness.activeOperation.value).toBe('stack:segmentation:threshold')
    expect(harness.emitSetActiveOperation).toHaveBeenCalledWith('stack:segmentation:threshold')

    harness.emitSetActiveOperation.mockClear()
    harness.toolbar.applyTool(segmentationTool)
    expect(harness.toolbar.isMprSegmentationPanelOpen.value).toBe(true)
    expect(harness.activeOperation.value).toBe('stack:segmentation:threshold')
    expect(harness.emitSetActiveOperation).toHaveBeenCalledWith('stack:segmentation:threshold')
    harness.wrapper.unmount()
  })

  it('emits rotate reset without closing a right-dock rotate panel', async () => {
    vi.useFakeTimers()
    const harness = mountToolbarHarness({
      ...create3dTab(),
      key: 'series-1::stack',
      title: 'Series 1 / Stack',
      viewType: 'Stack'
    })
    await nextTick()

    const rotateTool = harness.toolbar.activeTools.value.find((tool) => tool.key === 'rotate')!
    expect(rotateTool.options?.some((option) => option.value === 'rotate:reset')).toBe(true)

    harness.toolbar.setMenuOpen('rotate')
    harness.toolbar.selectToolOption(rotateTool, 'rotate:reset', { keepMenuOpen: true })

    expect(harness.toolbar.openMenuKey.value).toBe('rotate')
    vi.advanceTimersByTime(270)
    await nextTick()
    expect(harness.emitTriggerViewAction).toHaveBeenCalledWith({ action: 'rotate', value: 'rotate:reset' })
    harness.wrapper.unmount()
    vi.useRealTimers()
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
