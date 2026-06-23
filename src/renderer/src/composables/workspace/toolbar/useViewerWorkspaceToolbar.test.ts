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
  const emitViewportWheel = vi.fn()
  const exportCurrentView = vi.fn()
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
  it('normalizes mouse wheel scroll to one slice while preserving exact scroll requests', async () => {
    const harness = mountToolbarHarness({
      ...create3dTab(),
      key: 'series-1::stack',
      title: 'Series 1 / Stack',
      viewType: 'Stack'
    })
    await nextTick()

    harness.toolbar.handleViewportWheel({ viewportKey: 'single', deltaY: 120 })
    expect(harness.emitViewportWheel).toHaveBeenLastCalledWith({ viewportKey: 'single', deltaY: 1 })

    harness.toolbar.handleViewportWheel({ viewportKey: 'single', deltaY: -240 })
    expect(harness.emitViewportWheel).toHaveBeenLastCalledWith({ viewportKey: 'single', deltaY: -1 })

    harness.toolbar.handleViewportWheel({ viewportKey: 'single', deltaY: 5, exact: true })
    expect(harness.emitViewportWheel).toHaveBeenLastCalledWith({ viewportKey: 'single', deltaY: 5 })

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
      expect(harness.emitViewportWheel).toHaveBeenLastCalledWith({ viewportKey: 'mpr-cor', deltaY: 1 })

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
      expect(harness.emitViewportWheel).toHaveBeenLastCalledWith({ viewportKey: 'mpr-sag', deltaY: 1 })

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

    harness.activeTab.value = {
      ...harness.activeTab.value!,
      key: 'series-1::fusion',
      title: 'Series 1 / PETCTFusion',
      viewType: 'PETCTFusion'
    }
    await nextTick()
    expect(getDisplayTool()).toBeTruthy()

    harness.activeTab.value = create3dTab()
    await nextTick()
    expect(getDisplayTool()).toBeUndefined()

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

    expect(harness.emitTriggerViewAction).toHaveBeenCalledWith({ action: 'transformReset' })
    expect(harness.activeOperation.value).toBe('stack:pan')
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
