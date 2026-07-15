import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUiPreferences } from '../../../composables/ui/useUiPreferences'
import type { ViewerTabItem } from '../../../types/viewer'
import type { StackTool } from './toolbarTypes'
import ViewerToolbarDock from './ViewerToolbarDock.vue'

function ensureLocalStorage(): void {
  const store = new Map<string, string>()
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      clear: () => store.clear(),
      getItem: (key: string) => store.get(key) ?? null,
      removeItem: (key: string) => store.delete(key),
      setItem: (key: string, value: string) => store.set(key, value)
    }
  })
}

const activeTab = {
  key: 'series-1::stack',
  seriesId: 'series-1',
  seriesTitle: 'Series 1',
  title: 'Series 1',
  viewType: 'Stack'
} as ViewerTabItem

const tools: StackTool[] = [
  { key: 'pan', label: 'Pan', icon: 'pan', kind: 'mode' },
  {
    key: 'window',
    label: 'Window',
    icon: 'window',
    kind: 'mode',
    options: [{ value: '400|40', label: 'Soft', icon: 'contrast', description: 'WW 400 / WL 40' }]
  }
]

function mountDock(overrides: Partial<InstanceType<typeof ViewerToolbarDock>['$props']> = {}) {
  return mount(ViewerToolbarDock, {
    props: {
      activeTab,
      activeTools: tools,
      areToolbarActionsDisabled: false,
      isPlaying: false,
      isPlaybackPaused: false,
      isToolSelected: vi.fn((tool: StackTool) => tool.key === 'pan'),
      menuIconSize: 15,
      openMenuKey: null,
      stackToolSelections: {},
      toolbarIconSize: 18,
      ...overrides
    },
    slots: {
      panel: '<div data-testid="utility-panel">Utility panel</div>',
      result: '<div data-testid="result-panel">Result panel</div>',
      status: '<div data-testid="dock-status">4D status</div>'
    }
  })
}

describe('ViewerToolbarDock', () => {
  beforeEach(() => {
    ensureLocalStorage()
    window.localStorage.clear()
    const preferences = useUiPreferences()
    preferences.setLocale('en-US')
    preferences.setDrawingScopePreference({
      measurement: 'image',
      annotation: 'image',
      qaWater: 'image',
      mtf: 'image'
    })
  })

  it('renders a fixed dock shell with reserved panel space', () => {
    const wrapper = mountDock()

    expect(wrapper.find('.viewer-toolbar-dock').attributes('data-tool-menu-root')).toBeDefined()
    expect(wrapper.find('.viewer-toolbar-dock').classes()).not.toContain('viewer-toolbar-dock--wide')
    expect(wrapper.find('.viewer-toolbar-dock__tools-region').exists()).toBe(true)
    expect(wrapper.find('.viewer-toolbar-dock__panel').exists()).toBe(true)
    expect(wrapper.find('.viewer-toolbar-dock__panel-content-shell').exists()).toBe(true)
    expect(wrapper.find('.viewer-toolbar-dock__active-tool-panel').exists()).toBe(true)
    expect(wrapper.find('.viewer-toolbar-dock__active-tool-label').text()).toBe('Pan')
    expect(wrapper.find('.viewer-toolbar-dock__active-tool-description').text()).toBe('No additional settings for this tool.')
    expect(wrapper.text()).not.toContain('Active tool')
  })

  it('localizes dock helper labels', () => {
    useUiPreferences().setLocale('zh-CN')
    const wrapper = mountDock()

    expect(wrapper.find('.viewer-toolbar-dock__active-tool-description').text()).toBe('该工具没有额外设置。')
    expect(wrapper.find('.viewer-toolbar-dock__collapse-button').attributes('title')).toBe('收起右侧操作区')
  })

  it('renders option tools as single buttons and applies mode tools while opening panels', async () => {
    const wrapper = mountDock()

    expect(wrapper.findAll('.viewer-toolbar-dock__button')).toHaveLength(2)
    expect(wrapper.find('.viewer-toolbar-dock__menu-button').exists()).toBe(false)
    expect(wrapper.find('.viewer-toolbar-dock__tab-button').exists()).toBe(false)

    await wrapper.findAll('.viewer-toolbar-dock__button')[1]!.trigger('click')
    expect(wrapper.emitted('setMenuOpen')).toEqual([['window']])
    expect(wrapper.emitted('applyTool')?.[0]).toEqual([tools[1], { keepMenuOpen: true }])

    await wrapper.setProps({ openMenuKey: 'window' })

    expect(wrapper.find('.viewer-toolbar-dock').classes()).not.toContain('viewer-toolbar-dock--wide')
    expect(wrapper.find('.viewer-toolbar-dock__active-tool-panel').exists()).toBe(false)
    expect(wrapper.find('.viewer-toolbar-dock__panel-title').text()).toContain('Window')
    expect(wrapper.find('.viewer-toolbar-dock-panel-content').exists()).toBe(true)
    expect(wrapper.find('.viewer-toolbar-dock-panel-content__tool-guide').text()).toContain('Drag to adjust window width and level')
    expect(wrapper.find('.viewer-toolbar-dock__panel-close').exists()).toBe(false)
    expect(wrapper.find('.toolbar-menu-option').exists()).toBe(false)
  })

  it('keeps only one toolbar button active after a tool is clicked', async () => {
    const wrapper = mountDock()

    expect(wrapper.findAll('.viewer-toolbar-dock__button--active')).toHaveLength(1)
    expect(wrapper.findAll('.viewer-toolbar-dock__button')[0]!.classes()).toContain('viewer-toolbar-dock__button--active')

    await wrapper.findAll('.viewer-toolbar-dock__button')[1]!.trigger('click')
    await wrapper.setProps({ openMenuKey: 'window' })

    const activeButtons = wrapper.findAll('.viewer-toolbar-dock__button--active')
    expect(activeButtons).toHaveLength(1)
    expect(wrapper.findAll('.viewer-toolbar-dock__button')[0]!.classes()).not.toContain('viewer-toolbar-dock__button--active')
    expect(wrapper.findAll('.viewer-toolbar-dock__button')[1]!.classes()).toContain('viewer-toolbar-dock__button--active')
  })

  it('keeps a clicked option tool active if the menu key is cleared externally', async () => {
    const layoutTool: StackTool = {
      key: 'mprLayout',
      label: 'MPR Layout',
      icon: 'layout',
      kind: 'action',
      options: [{ value: 'mpr:quad', label: 'Quad', icon: 'layout' }]
    }
    const rotateTool: StackTool = { key: 'rotate3d', label: '3D Rotate', icon: 'rotate-3d', kind: 'mode' }
    const wrapper = mountDock({
      activeTools: [layoutTool, rotateTool],
      isToolSelected: vi.fn((tool: StackTool) => tool.key === 'rotate3d')
    })

    await wrapper.findAll('.viewer-toolbar-dock__button')[0]!.trigger('click')
    await wrapper.setProps({ openMenuKey: 'mprLayout' })

    expect(wrapper.findAll('.viewer-toolbar-dock__button--active')).toHaveLength(1)
    expect(wrapper.findAll('.viewer-toolbar-dock__button')[0]!.classes()).toContain('viewer-toolbar-dock__button--active')

    await wrapper.setProps({ openMenuKey: null })

    expect(wrapper.findAll('.viewer-toolbar-dock__button--active')).toHaveLength(1)
    expect(wrapper.findAll('.viewer-toolbar-dock__button')[0]!.classes()).toContain('viewer-toolbar-dock__button--active')
    expect(wrapper.findAll('.viewer-toolbar-dock__button')[1]!.classes()).not.toContain('viewer-toolbar-dock__button--active')
    expect(wrapper.find('.viewer-toolbar-dock__panel-title').text()).toContain('MPR Layout')
    expect(wrapper.find('.viewer-toolbar-dock-panel-content').exists()).toBe(true)
  })

  it('shows the selected option tool panel on initial render without requiring a click', () => {
    const wrapper = mountDock({
      isToolSelected: vi.fn((tool: StackTool) => tool.key === 'window'),
      stackToolSelections: { window: '400|40' }
    })

    expect(wrapper.find('.viewer-toolbar-dock__active-tool-panel').exists()).toBe(false)
    expect(wrapper.find('.viewer-toolbar-dock__panel-title').text()).toContain('Window')
    expect(wrapper.find('.viewer-toolbar-dock-panel-content').exists()).toBe(true)
    expect(wrapper.find('.viewer-toolbar-dock-panel-content__option--active').exists()).toBe(true)
    expect(wrapper.findAll('.viewer-toolbar-dock__button--active')).toHaveLength(1)
    expect(wrapper.findAll('.viewer-toolbar-dock__button')[1]!.classes()).toContain('viewer-toolbar-dock__button--active')
  })

  it('emits selected option values from the dock panel content and keeps the panel open', async () => {
    const wrapper = mountDock({
      openMenuKey: 'window',
      stackToolSelections: { window: '400|40' }
    })

    expect(wrapper.find('.viewer-toolbar-dock__panel').exists()).toBe(true)
    await wrapper.find('.viewer-toolbar-dock-panel-content__option').trigger('click')

    expect(wrapper.emitted('selectToolOption')?.[0]).toEqual([tools[1], '400|40', { keepMenuOpen: true }])
  })

  it('applies a temporary custom window value from the right dock window panel', async () => {
    const wrapper = mountDock({
      openMenuKey: 'window'
    })

    const fields = wrapper.findAll('.viewer-toolbar-dock-panel-content__custom-window-field input')
    expect(fields).toHaveLength(2)

    await fields[0]!.setValue('1500')
    await fields[1]!.setValue('-600')
    await wrapper.find('.viewer-toolbar-dock-panel-content__custom-window').trigger('submit')

    expect(wrapper.emitted('selectToolOption')?.[0]).toEqual([tools[1], '1500|-600', { keepMenuOpen: true }])
  })

  it('renders the window reset action at the bottom of the right dock panel', async () => {
    const wrapper = mountDock({
      openMenuKey: 'window',
      stackToolSelections: { window: '400|40' }
    })

    const actionZone = wrapper.find('.viewer-toolbar-dock-panel-content__action-zone')
    expect(actionZone.exists()).toBe(true)
    expect(wrapper.find('.viewer-toolbar-dock-panel-content__options-scroll--window').exists()).toBe(true)

    await wrapper.find('[data-testid="viewer-toolbar-dock-window-window-reset"]').trigger('click')

    expect(wrapper.emitted('selectToolOption')?.at(-1)).toEqual([tools[1], 'window:reset', { keepMenuOpen: true }])
  })

  it('applies pan mode while showing a bottom transform reset action', async () => {
    const panTool: StackTool = {
      key: 'pan',
      label: 'Pan',
      icon: 'pan',
      kind: 'mode',
      dockOptions: [{ value: 'transform:reset', label: 'Reset Transform', icon: 'reset' }]
    }
    const wrapper = mountDock({
      activeTools: [panTool],
      isToolSelected: vi.fn(() => false)
    })

    await wrapper.find('.viewer-toolbar-dock__button').trigger('click')

    expect(wrapper.emitted('setMenuOpen')).toEqual([['pan']])
    expect(wrapper.emitted('applyTool')?.[0]).toEqual([panTool, { keepMenuOpen: true }])
    expect(wrapper.find('.viewer-toolbar-dock-panel-content__tool-guide').text()).toContain('Drag the image to adjust position')

    await wrapper.find('[data-testid="viewer-toolbar-dock-pan-transform-reset"]').trigger('click')

    const selectEvent = wrapper.emitted('selectToolOption')?.[0]
    expect(selectEvent?.[0]).toMatchObject({ key: 'pan', options: [{ value: 'transform:reset' }] })
    expect(selectEvent?.[1]).toBe('transform:reset')
    expect(selectEvent?.[2]).toEqual({ keepMenuOpen: true })
  })

  it('shows zoom tool guidance in the right dock panel', async () => {
    const zoomTool: StackTool = {
      key: 'zoom',
      label: 'Zoom',
      icon: 'zoom',
      kind: 'mode',
      rangeControl: {
        kind: 'zoom',
        value: 5,
        min: 0.25,
        max: 10,
        step: 0.05,
        resetValue: 1,
        ticks: [
          { value: 1, label: '1x' },
          { value: 2, label: '2x' },
          { value: 5, label: '5x' },
          { value: 10, label: '10x' }
        ]
      },
      dockOptions: [
        { value: 'transform:reset', label: 'Reset Transform', icon: 'reset' }
      ]
    }
    const wrapper = mountDock({
      activeTools: [zoomTool],
      isToolSelected: vi.fn(() => false)
    })

    await wrapper.find('.viewer-toolbar-dock__button').trigger('click')

    expect(wrapper.find('.viewer-toolbar-dock-panel-content__tool-guide').text()).toContain('Drag to adjust zoom')
    expect(wrapper.find('.viewer-toolbar-dock-panel-content').text()).toContain('1x')
    expect(wrapper.find('.viewer-toolbar-dock-panel-content').text()).toContain('10x')
    expect(wrapper.find('.viewer-toolbar-dock-panel-content__zoom-header').text()).toContain('5x')
    expect(wrapper.find('.viewer-toolbar-dock-panel-content__zoom-tick--active').text()).toContain('5x')

    await wrapper.findAll('.viewer-toolbar-dock-panel-content__zoom-tick')[2]!.trigger('click')
    const selectEvent = wrapper.emitted('selectToolOption')?.[0]
    expect(selectEvent?.[0]).toMatchObject({ key: 'zoom', options: zoomTool.dockOptions })
    expect(selectEvent?.[1]).toBe('transform:zoom:5')
    expect(selectEvent?.[2]).toEqual({ keepMenuOpen: true })
  })

  it('shows reset footer actions for MPR crosshair and 3D rotate tools', async () => {
    const crosshairTool: StackTool = {
      key: 'crosshair',
      label: 'Crosshair',
      icon: 'crosshair',
      kind: 'mode',
      options: [{ value: 'mprCrosshairMode:orthogonal', label: 'Orthogonal', icon: 'crosshair' }]
    }
    const rotate3dTool: StackTool = {
      key: 'rotate3d',
      label: '3D Rotate',
      icon: 'rotate3d',
      kind: 'mode',
      dockOptions: [{ value: 'rotate3d:reset', label: 'Reset 3D Rotation', icon: 'reset' }]
    }
    const wrapper = mountDock({
      activeTools: [crosshairTool, rotate3dTool],
      isToolSelected: vi.fn((tool: StackTool) => tool.key === 'crosshair')
    })

    expect(wrapper.find('[data-testid="viewer-toolbar-dock-crosshair-mprCrosshair-reset"]').exists()).toBe(true)
    await wrapper.find('[data-testid="viewer-toolbar-dock-crosshair-mprCrosshair-reset"]').trigger('click')
    expect(wrapper.emitted('selectToolOption')?.[0]).toEqual([crosshairTool, 'mprCrosshair:reset', { keepMenuOpen: true }])

    await wrapper.setProps({
      isToolSelected: (tool: StackTool) => tool.key === 'rotate3d'
    })
    await wrapper.findAll('.viewer-toolbar-dock__button')[1]!.trigger('click')
    expect(wrapper.emitted('applyTool')?.at(-1)).toEqual([rotate3dTool, { keepMenuOpen: true }])

    await wrapper.find('[data-testid="viewer-toolbar-dock-rotate3d-rotate3d-reset"]').trigger('click')
    const rotateEvent = wrapper.emitted('selectToolOption')?.[1]
    expect(rotateEvent?.[0]).toMatchObject({ key: 'rotate3d', options: rotate3dTool.dockOptions })
    expect(rotateEvent?.[1]).toBe('rotate3d:reset')
    expect(rotateEvent?.[2]).toEqual({ keepMenuOpen: true })
  })

  it('keeps reset clip as a fixed footer action in the 3D clip panel', async () => {
    const volumeClipTool: StackTool = {
      key: 'volumeClip',
      label: 'Clip',
      icon: 'volume-clip',
      kind: 'mode',
      options: [
        { value: 'volumeClip:inside', label: 'Clip Inside', icon: 'volume-clip' },
        { value: 'volumeClip:outside', label: 'Clip Outside', icon: 'volume-clip' },
        { value: 'volumeClip:reset', label: 'Reset Clip', icon: 'reset' }
      ]
    }
    const wrapper = mountDock({
      activeTools: [volumeClipTool],
      isToolSelected: vi.fn(() => true)
    })

    expect(wrapper.find('[data-testid="viewer-toolbar-dock-volumeClip-volumeClip-inside"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="viewer-toolbar-dock-volumeClip-volumeClip-reset"]').exists()).toBe(true)

    await wrapper.find('[data-testid="viewer-toolbar-dock-volumeClip-volumeClip-reset"]').trigger('click')
    expect(wrapper.emitted('selectToolOption')?.[0]).toEqual([volumeClipTool, 'volumeClip:reset', { keepMenuOpen: true }])
  })

  it('applies the selected measurement mode when opening the right dock measure panel', async () => {
    const measureTool: StackTool = {
      key: 'measure',
      label: 'Measure',
      icon: 'measure',
      kind: 'mode',
      options: [
        { value: 'measure:line', label: 'Line', icon: 'measure-line' },
        { value: 'measure:rect', label: 'Rect', icon: 'measure-rect' }
      ]
    }
    const wrapper = mountDock({
      activeTools: [tools[0]!, measureTool],
      isToolSelected: vi.fn((tool: StackTool) => tool.key === 'zoom'),
      stackToolSelections: { measure: 'measure:line' }
    })

    await wrapper.findAll('.viewer-toolbar-dock__button')[1]!.trigger('click')

    expect(wrapper.emitted('setMenuOpen')).toEqual([['measure']])
    expect(wrapper.emitted('selectToolOption')?.[0]).toEqual([measureTool, 'measure:line', { keepMenuOpen: true }])
    expect(wrapper.emitted('applyTool')).toBeUndefined()
  })

  it('applies the selected QA mode when opening the right dock QA panel', async () => {
    const qaTool: StackTool = {
      key: 'qa',
      label: 'QA',
      icon: 'qa',
      kind: 'mode',
      options: [
        { value: 'qa:mtf', label: 'MTF', icon: 'mtf' },
        { value: 'qa:water-phantom', label: 'Water Phantom QA', icon: 'water-phantom' }
      ]
    }
    const wrapper = mountDock({
      activeTools: [tools[0]!, qaTool],
      isToolSelected: vi.fn((tool: StackTool) => tool.key === 'zoom'),
      stackToolSelections: { qa: 'qa:water-phantom' }
    })

    await wrapper.findAll('.viewer-toolbar-dock__button')[1]!.trigger('click')

    expect(wrapper.emitted('setMenuOpen')).toEqual([['qa']])
    expect(wrapper.emitted('selectToolOption')?.[0]).toEqual([qaTool, 'qa:water-phantom', { keepMenuOpen: true }])
    expect(wrapper.emitted('applyTool')).toBeUndefined()
    expect(wrapper.find('.viewer-toolbar-dock-panel-content__scope-card').text()).toContain('Switching clears existing QA results')
  })

  it('opens segmentation and selects threshold by default from the right dock button', async () => {
    const segmentationTool: StackTool = {
      key: 'segmentation',
      label: 'Segmentation',
      icon: 'segmentation',
      kind: 'action',
      options: [
        { value: 'segmentation:threshold', label: 'Threshold', icon: 'segmentation-threshold' },
        { value: 'segmentation:voi', label: 'VOI', icon: 'segmentation-voi' }
      ]
    }
    const wrapper = mountDock({
      activeTools: [tools[0]!, segmentationTool],
      isToolSelected: vi.fn((tool: StackTool) => tool.key === 'pan')
    })

    await wrapper.findAll('.viewer-toolbar-dock__button')[1]!.trigger('click')

    expect(wrapper.emitted('setMenuOpen')).toEqual([['segmentation']])
    expect(wrapper.emitted('selectToolOption')?.[0]).toEqual([
      segmentationTool,
      'segmentation:threshold',
      { keepMenuOpen: true }
    ])
    expect(wrapper.emitted('applyTool')).toBeUndefined()
  })

  it('keeps an already open segmentation utility panel stable when clicked again', async () => {
    const segmentationTool: StackTool = {
      key: 'segmentation',
      label: 'Segmentation',
      icon: 'segmentation',
      kind: 'action',
      options: [{ value: 'segmentation:threshold', label: 'Threshold', icon: 'segmentation-threshold' }]
    }
    const wrapper = mountDock({
      activeTools: [segmentationTool],
      isToolSelected: vi.fn(() => false),
      openMenuKey: 'segmentation',
      utilityPanelOpen: true,
      utilityPanelTitle: 'Segmentation',
      utilityPanelToolKey: 'segmentation'
    })

    await wrapper.find('.viewer-toolbar-dock__button').trigger('click')

    expect(wrapper.emitted('closeUtilityPanel')).toBeUndefined()
    expect(wrapper.emitted('selectToolOption')).toBeUndefined()
    expect(wrapper.emitted('applyTool')).toBeUndefined()
  })

  it('keeps an already open layout panel stable when the layout button is clicked again', async () => {
    const layoutTool: StackTool = {
      key: 'layout',
      label: 'Layout',
      icon: 'layout',
      kind: 'action',
      menuKind: 'layout',
      options: [{ value: 'layout:1x1', label: '1x1', icon: 'layout', layoutRows: 1, layoutColumns: 1 }]
    }
    const wrapper = mountDock({
      activeTools: [layoutTool],
      isToolSelected: vi.fn(() => false),
      openMenuKey: 'layout'
    })

    await wrapper.find('.viewer-toolbar-dock__button').trigger('click')

    expect(wrapper.emitted('setMenuOpen')).toBeUndefined()
    expect(wrapper.find('.viewer-toolbar-dock__panel-title').text()).toContain('Layout')
  })

  it('does not preselect action-style secondary menu options in the right dock', () => {
    const actionTools: StackTool[] = [
      {
        key: 'rotate',
        label: 'Rotate',
        icon: 'rotate',
        kind: 'action',
        options: [{ value: 'rotate:cw90', label: 'CW 90', icon: 'rotate-cw90' }]
      },
      {
        key: 'export',
        label: 'Export',
        icon: 'export',
        kind: 'action',
        options: [{ value: 'png', label: 'PNG', icon: 'export' }]
      },
      {
        key: 'reset',
        label: 'Reset',
        icon: 'reset',
        kind: 'action',
        options: [{ value: 'reset:view', label: 'Reset View', icon: 'reset' }]
      }
    ]

    for (const tool of actionTools) {
      const wrapper = mountDock({
        activeTools: [tool],
        isToolSelected: vi.fn(() => false),
        openMenuKey: tool.key,
        stackToolSelections: { [tool.key]: tool.options![0]!.value }
      })

      expect(wrapper.findAll('.viewer-toolbar-dock-panel-content__option')).toHaveLength(tool.key === 'reset' ? 0 : 1)
      if (tool.key === 'reset') {
        expect(wrapper.find('.viewer-toolbar-dock-panel-content__action-zone').exists()).toBe(true)
        expect(wrapper.find('.viewer-toolbar-dock-panel-content__danger-action').exists()).toBe(true)
      }
      expect(wrapper.find('.viewer-toolbar-dock-panel-content__option--active').exists()).toBe(false)
      expect(wrapper.find('.viewer-toolbar-dock-panel-content__selected-icon').exists()).toBe(false)
      wrapper.unmount()
    }
  })

  it('shows the selected QA option while keeping the QA button icon semantic', () => {
    const qaTool: StackTool = {
      key: 'qa',
      label: 'QA',
      icon: 'qa',
      kind: 'mode',
      showSelectedOptionIcon: false,
      options: [
        { value: 'qa:mtf', label: 'MTF', icon: 'mtf', badge: 'MTF' },
        { value: 'qa:water-phantom', label: 'Water Phantom QA', icon: 'water-phantom' }
      ]
    }
    const wrapper = mountDock({
      activeTools: [qaTool],
      isToolSelected: vi.fn(() => true),
      openMenuKey: 'qa',
      stackToolSelections: { qa: 'qa:mtf' }
    })

    expect(wrapper.find('.viewer-toolbar-dock-panel-content__option--active').text()).toContain('MTF')
    expect(wrapper.find('.viewer-toolbar-dock-panel-content__selected-icon').exists()).toBe(true)
    expect(wrapper.find('.viewer-toolbar-dock-panel-content__group-label').exists()).toBe(false)
    expect(wrapper.find('.viewer-toolbar-dock-panel-content__badge').exists()).toBe(false)
    expect(wrapper.find('.viewer-toolbar-dock__button svg').exists()).toBe(true)
  })

  it('does not highlight stale 3D orientation selections while the model is oblique', () => {
    const orientationTool: StackTool = {
      key: 'volumeOrientation',
      label: 'Orientation',
      icon: 'orientation-face-oblique',
      kind: 'action',
      showSelectedOptionIcon: false,
      options: [
        { value: 'volumeOrientation:A', label: 'Anterior' },
        { value: 'volumeOrientation:P', label: 'Posterior' }
      ]
    }
    const wrapper = mountDock({
      activeTools: [orientationTool],
      isToolSelected: vi.fn(() => false),
      openMenuKey: 'volumeOrientation',
      stackToolSelections: { volumeOrientation: 'volumeOrientation:A' }
    })

    expect(wrapper.findAll('.viewer-toolbar-dock-panel-content__option')).toHaveLength(2)
    expect(wrapper.find('.viewer-toolbar-dock-panel-content__option--active').exists()).toBe(false)
    expect(wrapper.find('.viewer-toolbar-dock-panel-content__selected-icon').exists()).toBe(false)
    expect(wrapper.find('.volume-orientation-option-label__initial').text()).toBe('A')
    expect(wrapper.find('.volume-orientation-option-label__suffix').text()).toBe('nterior')
  })

  it('shows reset rotation in the rotate panel without preselecting it', () => {
    const rotateTool: StackTool = {
      key: 'rotate',
      label: 'Rotate',
      icon: 'rotate',
      kind: 'action',
      options: [
        { value: 'rotate:cw90', label: 'CW 90', icon: 'rotate-cw90' },
        { value: 'rotate:reset', label: 'Reset Rotation', icon: 'reset' }
      ]
    }
    const wrapper = mountDock({
      activeTools: [rotateTool],
      isToolSelected: vi.fn(() => false),
      openMenuKey: 'rotate',
      stackToolSelections: { rotate: 'rotate:reset' }
    })

    expect(wrapper.findAll('.viewer-toolbar-dock-panel-content__option')).toHaveLength(1)
    expect(wrapper.find('[data-testid="viewer-toolbar-dock-rotate-reset"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="viewer-toolbar-dock-rotate-reset"]').text()).toContain('Reset Rotation')
    expect(wrapper.find('[data-testid="viewer-toolbar-dock-rotate-reset"]').classes()).toContain('viewer-toolbar-dock-panel-content__danger-action')
    expect(wrapper.find('.viewer-toolbar-dock-panel-content__option--active').exists()).toBe(false)
  })

  it('emits applyTool for tools without options', async () => {
    const wrapper = mountDock()

    await wrapper.findAll('.viewer-toolbar-dock__button')[0]!.trigger('click')

    expect(wrapper.emitted('applyTool')?.[0]).toEqual([tools[0]])
    expect(wrapper.emitted('setMenuOpen')).toEqual([[null]])
    expect(wrapper.emitted('closeUtilityPanel')).toEqual([[]])
  })

  it('renders measure reset as a dock-only action', async () => {
    const measureTool: StackTool = {
      key: 'measure',
      label: 'Measure',
      icon: 'measure',
      kind: 'mode',
      options: [{ value: 'measure:line', label: 'Line', icon: 'measure-line' }]
    }
    const wrapper = mountDock({
      activeTools: [measureTool],
      isToolSelected: vi.fn(() => false),
      openMenuKey: 'measure',
      stackToolSelections: { measure: 'measure:line' }
    })

    expect(wrapper.find('.viewer-toolbar-dock-panel-content__measure-reset').exists()).toBe(true)
    expect(wrapper.find('.viewer-toolbar-dock-panel-content__options-scroll--measure').exists()).toBe(true)
    await wrapper.find('.viewer-toolbar-dock-panel-content__measure-reset').trigger('click')

    expect(wrapper.emitted('selectToolOption')?.[0]).toEqual([measureTool, 'reset:measurements', { keepMenuOpen: true }])
  })

  it('renders scope copy without the settings jump button and clears measurements when scope changes', async () => {
    const measureTool: StackTool = {
      key: 'measure',
      label: 'Measure',
      icon: 'measure',
      kind: 'mode',
      options: [{ value: 'measure:line', label: 'Line', icon: 'measure-line' }]
    }
    const wrapper = mountDock({
      activeTools: [measureTool],
      isToolSelected: vi.fn(() => false),
      openMenuKey: 'measure',
      stackToolSelections: { measure: 'measure:line' }
    })

    expect(wrapper.find('.viewer-toolbar-dock-panel-content__scope-card').text()).toContain('Switching clears existing measurements')
    expect(wrapper.text()).not.toContain('Measurement & Annotation Settings')

    await wrapper.findAll('.viewer-toolbar-dock-panel-content__scope-choice')[1]!.trigger('click')

    expect(wrapper.emitted('selectToolOption')?.at(-1)).toEqual([measureTool, 'reset:measurements', { keepMenuOpen: true }])
  })

  it('renders annotation clear as a right dock detail action', async () => {
    const annotateTool: StackTool = {
      key: 'annotate',
      label: 'Annotate',
      icon: 'annotate',
      kind: 'mode',
      dockOptions: [
        {
          value: 'reset:annotations',
          label: 'Clear Annotations',
          icon: 'reset',
          description: 'Remove annotations from the current target view.'
        }
      ]
    }
    const wrapper = mountDock({
      activeTools: [annotateTool],
      isToolSelected: vi.fn(() => true)
    })

    expect(wrapper.find('.viewer-toolbar-dock__active-tool-panel').exists()).toBe(false)
    expect(wrapper.find('.viewer-toolbar-dock__panel-title').text()).toContain('Annotate')
    expect(wrapper.find('.viewer-toolbar-dock-panel-content__action-zone').exists()).toBe(true)
    expect(wrapper.find('.viewer-toolbar-dock-panel-content__option').exists()).toBe(false)

    await wrapper.find('[data-testid="viewer-toolbar-dock-annotate-reset-annotations"]').trigger('click')

    expect(wrapper.emitted('selectToolOption')?.[0]).toEqual([
      expect.objectContaining({
        key: 'annotate',
        options: [
          {
            value: 'reset:annotations',
            label: 'Clear Annotations',
            icon: 'reset',
            description: 'Remove annotations from the current target view.'
          }
        ]
      }),
      'reset:annotations',
      { keepMenuOpen: true }
    ])
  })

  it('shows PET display controls instead of CT window templates for standalone PET tabs', async () => {
    const petDisplayTool: StackTool = {
      key: 'fusionPetDisplay',
      label: 'PET',
      icon: 'pseudocolor',
      kind: 'action',
      inlineKind: 'fusionPetDisplay',
      dockOptions: [
        {
          value: 'petDisplay:reset',
          label: 'Reset PET Display',
          icon: 'reset',
          description: 'Restore PET display range and unit.'
        }
      ]
    }
    const petTab = {
      ...activeTab,
      key: 'pet::PET',
      title: 'PET FDG SUV / PET',
      viewType: 'PET',
      petInfo: {
        seriesId: 'pet',
        petUnit: 'SUVbw',
        petUnitLabel: 'g/ml (SUVbw)',
        petWindowMin: 0,
        petWindowMax: 8,
        pseudocolorPreset: 'bwinverse'
      }
    } as ViewerTabItem
    const wrapper = mountDock({
      activeTab: petTab,
      activeTools: [petDisplayTool],
      isToolSelected: vi.fn(() => false),
      openMenuKey: 'fusionPetDisplay'
    })

    expect(wrapper.find('.viewer-toolbar-dock-panel-content--fusionPetDisplay').exists()).toBe(true)
    expect(wrapper.find('.viewer-toolbar-dock-panel-content__custom-window').exists()).toBe(false)
    expect(wrapper.find('.viewer-toolbar-dock-panel-content__options-scroll--window').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Pseudocolor')
    expect(wrapper.find('.viewer-toolbar-dock-panel-content__pet-pseudocolor-option').exists()).toBe(false)
    expect(wrapper.text()).toContain('Intensity Range')
    expect(wrapper.text()).toContain('Unit')

    await wrapper.find('.viewer-toolbar-dock-panel-content__pet-range-track input').setValue('12.5')
    expect(wrapper.emitted('selectToolOption')?.at(-1)).toEqual([
      expect.objectContaining({ key: 'fusionPetDisplay' }),
      'petWindow:0:12.5',
      { keepMenuOpen: true }
    ])

    const rangeMaxInput = wrapper.find<HTMLInputElement>('.viewer-toolbar-dock-panel-content__pet-range-max-input')
    await rangeMaxInput.setValue('40')
    await rangeMaxInput.trigger('change')
    expect(wrapper.find<HTMLInputElement>('.viewer-toolbar-dock-panel-content__pet-range-max-input').element.value).toBe('40')
    expect(wrapper.find<HTMLInputElement>('.viewer-toolbar-dock-panel-content__pet-range-track input').element.max).toBe('40')
    expect(wrapper.emitted('selectToolOption')?.at(-1)).toEqual([
      expect.objectContaining({ key: 'fusionPetDisplay' }),
      'petWindow:0:12.5',
      { keepMenuOpen: true }
    ])

    const updatedRangeMaxInput = wrapper.find<HTMLInputElement>('.viewer-toolbar-dock-panel-content__pet-range-max-input')
    await updatedRangeMaxInput.setValue('1000')
    await updatedRangeMaxInput.trigger('change')
    expect(wrapper.find<HTMLInputElement>('.viewer-toolbar-dock-panel-content__pet-range-max-input').element.value).toBe('30')
    expect(wrapper.find<HTMLInputElement>('.viewer-toolbar-dock-panel-content__pet-range-track input').element.max).toBe('30')

    const unitButtons = wrapper.findAll('.viewer-toolbar-dock-panel-content__chip')
    const kbqButton = unitButtons.find((button) => button.text().includes('kBq/ml'))
    expect(kbqButton).toBeDefined()
    await kbqButton!.trigger('click')
    expect(wrapper.emitted('selectToolOption')?.at(-1)).toEqual([
      expect.objectContaining({ key: 'fusionPetDisplay' }),
      'petUnit:kBqml',
      { keepMenuOpen: true }
    ])

    await wrapper.find('[data-testid="viewer-toolbar-dock-pet-display-reset"]').trigger('click')
    expect(wrapper.emitted('selectToolOption')?.at(-1)).toEqual([
      expect.objectContaining({ key: 'fusionPetDisplay' }),
      'petDisplay:reset',
      { keepMenuOpen: true }
    ])
  })

  it('uses a discrete slider for playback FPS in the right dock panel', async () => {
    const playTool: StackTool = {
      key: 'play',
      label: 'Play',
      icon: 'play',
      kind: 'action',
      options: [1, 2, 5, 10, 15, 30].map((fps) => ({
        value: `playbackFps:${fps}`,
        label: `FPS ${fps}`,
        icon: 'play'
      }))
    }
    const wrapper = mountDock({
      activeTools: [playTool],
      isToolSelected: vi.fn(() => false),
      openMenuKey: 'play',
      stackToolSelections: { play: 'playbackFps:5' }
    })

    expect(wrapper.find('.viewer-toolbar-dock-panel-content__fps-grid').exists()).toBe(false)
    expect(wrapper.find('.viewer-toolbar-dock-panel-content__fps-slider input[type="range"]').exists()).toBe(true)

    await wrapper.find('.viewer-toolbar-dock-panel-content__fps-slider input[type="range"]').setValue('4')

    expect(wrapper.emitted('selectToolOption')?.[0]).toEqual([playTool, 'playbackFps:15', { keepMenuOpen: true }])
  })

  it('shows the last clicked tool name when the tool has no detail panel', async () => {
    const resetTool: StackTool = { key: 'reset', label: 'Reset', icon: 'reset', kind: 'action' }
    const wrapper = mountDock({
      activeTools: [...tools, resetTool],
      isToolSelected: vi.fn(() => false)
    })

    await wrapper.findAll('.viewer-toolbar-dock__button')[2]!.trigger('click')

    expect(wrapper.emitted('applyTool')?.[0]).toEqual([resetTool])
    expect(wrapper.find('.viewer-toolbar-dock__active-tool-label').text()).toBe('Reset')
  })

  it('shows a clicked option tool panel immediately while parent menu state catches up', async () => {
    const resetTool: StackTool = {
      key: 'reset',
      label: 'Reset',
      icon: 'reset',
      kind: 'action',
      options: [{ value: 'reset:view', label: 'Reset View', icon: 'reset' }]
    }
    const wrapper = mountDock({
      activeTools: [tools[0]!, resetTool],
      isToolSelected: vi.fn((tool: StackTool) => tool.key === 'pan')
    })

    await wrapper.findAll('.viewer-toolbar-dock__button')[1]!.trigger('click')

    expect(wrapper.emitted('setMenuOpen')).toEqual([['reset']])
    expect(wrapper.find('.viewer-toolbar-dock__active-tool-panel').exists()).toBe(false)
    expect(wrapper.find('.viewer-toolbar-dock__panel-title').text()).toContain('Reset')
    expect(wrapper.find('.viewer-toolbar-dock-panel-content').exists()).toBe(true)

    await wrapper.setProps({ openMenuKey: 'reset' })
    expect(wrapper.find('.viewer-toolbar-dock__active-tool-panel').exists()).toBe(false)
    expect(wrapper.find('.viewer-toolbar-dock__panel-title').text()).toContain('Reset')
  })

  it('applies page directly without opening a secondary menu', async () => {
    const pageTool: StackTool = { key: 'page', label: 'Page', icon: 'page', kind: 'action' }
    const wrapper = mountDock({
      activeTools: [tools[0]!, pageTool],
      isToolSelected: vi.fn(() => false)
    })

    await wrapper.findAll('.viewer-toolbar-dock__button')[1]!.trigger('click')

    expect(wrapper.emitted('setMenuOpen')).toEqual([[null]])
    expect(wrapper.emitted('applyTool')?.[0]).toEqual([pageTool])
  })

  it('keeps the measure panel visible after measurement interactions clear the menu key', () => {
    const measureTool: StackTool = {
      key: 'measure',
      label: 'Measure',
      icon: 'measure',
      kind: 'mode',
      options: [
        { value: 'measure:line', label: 'Line', icon: 'measure-line' },
        { value: 'measure:rect', label: 'Rect', icon: 'measure-rect' }
      ]
    }
    const wrapper = mountDock({
      activeTools: [tools[0]!, measureTool],
      isToolSelected: vi.fn((tool: StackTool) => tool.key === 'measure'),
      openMenuKey: null,
      stackToolSelections: { measure: 'measure:line' }
    })

    expect(wrapper.find('.viewer-toolbar-dock__active-tool-panel').exists()).toBe(false)
    expect(wrapper.find('.viewer-toolbar-dock__panel-title').text()).toContain('Measure')
    expect(wrapper.find('.viewer-toolbar-dock-panel-content__measure-reset').exists()).toBe(true)
    expect(wrapper.find('.viewer-toolbar-dock-panel-content__option--active').exists()).toBe(true)
    expect(wrapper.findAll('.viewer-toolbar-dock__button--active')).toHaveLength(1)
    expect(wrapper.findAll('.viewer-toolbar-dock__button')[1]!.classes()).toContain('viewer-toolbar-dock__button--active')
  })

  it('uses the utility panel tool as the single active button while a utility panel is open', () => {
    const mprMipTool: StackTool = { key: 'mprMip', label: 'MIP', icon: 'mip', kind: 'action' }
    const wrapper = mountDock({
      activeTools: [tools[0]!, mprMipTool],
      isToolSelected: vi.fn((tool: StackTool) => tool.key === 'pan'),
      utilityPanelOpen: true,
      utilityPanelTitle: 'MIP Params',
      utilityPanelToolKey: 'mprMip'
    })

    const buttons = wrapper.findAll('.viewer-toolbar-dock__button')
    expect(wrapper.findAll('.viewer-toolbar-dock__button--active')).toHaveLength(1)
    expect(buttons[0]!.classes()).not.toContain('viewer-toolbar-dock__button--active')
    expect(buttons[1]!.classes()).toContain('viewer-toolbar-dock__button--active')
    expect(wrapper.find('.viewer-toolbar-dock__panel-title').text()).toContain('MIP Params')
    expect(wrapper.find('[data-testid="utility-panel"]').exists()).toBe(true)
    expect(wrapper.find('.viewer-toolbar-dock__panel-close').exists()).toBe(false)
  })

  it('shows the MIP utility panel over the selected rotate3d mode panel', () => {
    const rotate3dTool: StackTool = {
      key: 'rotate3d',
      label: '3D Rotate',
      icon: 'rotate3d',
      kind: 'mode',
      dockOptions: [{ value: 'rotate3d:reset', label: 'Reset 3D Rotation', icon: 'reset' }]
    }
    const mprMipTool: StackTool = { key: 'mprMip', label: 'MIP', icon: 'mip', kind: 'action' }
    const wrapper = mountDock({
      activeTools: [rotate3dTool, mprMipTool],
      isToolSelected: vi.fn((tool: StackTool) => tool.key === 'rotate3d'),
      utilityPanelOpen: true,
      utilityPanelTitle: 'MIP Params',
      utilityPanelToolKey: 'mprMip'
    })

    const buttons = wrapper.findAll('.viewer-toolbar-dock__button')
    expect(wrapper.find('[data-testid="utility-panel"]').exists()).toBe(true)
    expect(wrapper.find('.viewer-toolbar-dock-panel-content').exists()).toBe(false)
    expect(wrapper.findAll('.viewer-toolbar-dock__button--active')).toHaveLength(1)
    expect(buttons[0]!.classes()).not.toContain('viewer-toolbar-dock__button--active')
    expect(buttons[1]!.classes()).toContain('viewer-toolbar-dock__button--active')
  })

  it('uses the segmentation utility panel as the single active button', () => {
    const segmentationTool: StackTool = {
      key: 'segmentation',
      label: 'Segmentation',
      icon: 'segmentation',
      kind: 'action',
      options: [
        { value: 'segmentation:threshold', label: 'Threshold', icon: 'segmentation-threshold' },
        { value: 'segmentation:voi', label: 'VOI', icon: 'segmentation-voi' }
      ]
    }
    const wrapper = mountDock({
      activeTools: [tools[0]!, segmentationTool],
      isToolSelected: vi.fn((tool: StackTool) => tool.key === 'pan'),
      openMenuKey: 'segmentation',
      utilityPanelOpen: true,
      utilityPanelTitle: 'Segmentation',
      utilityPanelToolKey: 'segmentation'
    })

    const buttons = wrapper.findAll('.viewer-toolbar-dock__button')
    expect(wrapper.findAll('.viewer-toolbar-dock__button--active')).toHaveLength(1)
    expect(buttons[0]!.classes()).not.toContain('viewer-toolbar-dock__button--active')
    expect(buttons[1]!.classes()).toContain('viewer-toolbar-dock__button--active')
    expect(wrapper.find('.viewer-toolbar-dock__panel-title').text()).toContain('Segmentation')
    expect(wrapper.find('[data-testid="utility-panel"]').exists()).toBe(true)
    expect(wrapper.find('.viewer-toolbar-dock-panel-content').exists()).toBe(false)
  })

  it('opens the PET/CT registration dock panel from dock-only options', async () => {
    const registrationTool: StackTool = {
      key: 'fusionRegistration',
      label: 'Registration',
      icon: 'crosshair',
      kind: 'action',
      inlineKind: 'fusionRegistration',
      dockOptions: [
        { value: 'fusionRegistration:toggle', label: 'Manual Registration', icon: 'crosshair' },
        { value: 'fusionRegistration:reset', label: 'Reset Registration', icon: 'reset' },
        { value: 'fusionRegistration:load', label: 'Load Registration', icon: 'folder-import' },
        { value: 'fusionRegistration:save', label: 'Save Registration', icon: 'save' },
        { value: 'fusionRegistration:exit', label: 'Exit Registration', icon: 'close' }
      ]
    }
    const fusionTab = {
      ...activeTab,
      key: 'fusion::ct::pet',
      title: 'CT + PET',
      viewType: 'PETCTFusion',
      fusionManualRegistration: true
    } as ViewerTabItem
    const wrapper = mountDock({
      activeTab: fusionTab,
      activeTools: [registrationTool],
      isToolSelected: vi.fn(() => false)
    })

    await wrapper.find('.viewer-toolbar-dock__button').trigger('click')

    expect(wrapper.emitted('setMenuOpen')).toEqual([['fusionRegistration']])
    expect(wrapper.emitted('applyTool')).toBeUndefined()

    await wrapper.setProps({ openMenuKey: 'fusionRegistration' })

    expect(wrapper.find('.viewer-toolbar-dock__panel-title').text()).toContain('Registration')
    expect(wrapper.find('[data-testid="fusion-registration-dock-toggle"]').exists()).toBe(true)
    expect(wrapper.find('.toolbar-menu-option').exists()).toBe(false)

    await wrapper.find('[data-testid="fusion-registration-dock-action-save"]').trigger('click')
    expect(wrapper.emitted('selectToolOption')?.at(-1)).toEqual([
      expect.objectContaining({ key: 'fusionRegistration' }),
      'fusionRegistration:save',
      { keepMenuOpen: true }
    ])
  })

  it('embeds QA result content below QA options and keeps the selected QA option visible', () => {
    const qaTool: StackTool = {
      key: 'qa',
      label: 'QA',
      icon: 'qa',
      kind: 'mode',
      showSelectedOptionIcon: false,
      options: [
        { value: 'qa:mtf', label: 'MTF', icon: 'mtf', badge: 'MTF' },
        { value: 'qa:water-phantom', label: 'Water Phantom QA', icon: 'water-phantom' }
      ]
    }
    const wrapper = mountDock({
      activeTools: [qaTool, tools[1]!, tools[0]!],
      isToolSelected: vi.fn((tool: StackTool) => tool.key === 'pan'),
      openMenuKey: 'qa',
      resultPanelIcon: 'water-phantom',
      resultPanelOpen: true,
      resultPanelTitle: 'Water Phantom QA',
      resultPanelToolKey: 'qa',
      stackToolSelections: { qa: 'qa:water-phantom' },
      utilityPanelOpen: true,
      utilityPanelTitle: 'MIP Params',
      utilityPanelToolKey: 'pan'
    })

    const buttons = wrapper.findAll('.viewer-toolbar-dock__button')
    expect(wrapper.find('.viewer-toolbar-dock__panel-title').text()).toContain('QA')
    expect(wrapper.find('.viewer-toolbar-dock-panel-content').exists()).toBe(true)
    expect(wrapper.find('.viewer-toolbar-dock-panel-content__option--active').text()).toContain('Water Phantom QA')
    expect(wrapper.find('.viewer-toolbar-dock-panel-content__selected-icon').exists()).toBe(true)
    expect(wrapper.find('.viewer-toolbar-dock__embedded-result-panel').exists()).toBe(true)
    expect(wrapper.find('[data-testid="result-panel"]').exists()).toBe(true)
    expect(wrapper.find('.viewer-toolbar-dock__result-panel').exists()).toBe(false)
    expect(wrapper.find('[data-testid="utility-panel"]').exists()).toBe(false)
    expect(wrapper.findAll('.viewer-toolbar-dock__button--active')).toHaveLength(1)
    expect(buttons[0]!.classes()).toContain('viewer-toolbar-dock__button--active')
    expect(buttons[1]!.classes()).not.toContain('viewer-toolbar-dock__button--active')
    expect(buttons[2]!.classes()).not.toContain('viewer-toolbar-dock__button--active')
  })

  it('does not let a non-current result panel override the current tool panel', () => {
    const qaTool: StackTool = { key: 'qa', label: 'QA', icon: 'qa', kind: 'mode' }
    const wrapper = mountDock({
      activeTools: [qaTool, tools[1]!, tools[0]!],
      isToolSelected: vi.fn((tool: StackTool) => tool.key === 'pan'),
      openMenuKey: 'window',
      resultPanelIcon: 'mtf',
      resultPanelOpen: true,
      resultPanelTitle: 'MTF Curve',
      resultPanelToolKey: 'qa'
    })

    const buttons = wrapper.findAll('.viewer-toolbar-dock__button')
    expect(wrapper.find('.viewer-toolbar-dock__panel-title').text()).toContain('Window')
    expect(wrapper.find('.viewer-toolbar-dock-panel-content').exists()).toBe(true)
    expect(wrapper.find('[data-testid="result-panel"]').exists()).toBe(false)
    expect(wrapper.findAll('.viewer-toolbar-dock__button--active')).toHaveLength(1)
    expect(buttons[1]!.classes()).toContain('viewer-toolbar-dock__button--active')
  })

  it('emits closeResultPanel when a dock tool is clicked', async () => {
    const wrapper = mountDock({
      resultPanelIcon: 'mtf',
      resultPanelOpen: true,
      resultPanelTitle: 'MTF Curve',
      resultPanelToolKey: 'window'
    })

    await wrapper.findAll('.viewer-toolbar-dock__button')[0]!.trigger('click')

    expect(wrapper.emitted('closeResultPanel')).toEqual([[]])
    expect(wrapper.emitted('applyTool')?.[0]).toEqual([tools[0]])
  })

  it('keeps a water QA result open when the QA tool is clicked again', async () => {
    const qaTool: StackTool = {
      key: 'qa',
      label: 'QA',
      icon: 'qa',
      kind: 'mode',
      options: [{ value: 'qa:water-phantom', label: 'Water Phantom QA', icon: 'water-phantom' }]
    }
    const wrapper = mountDock({
      activeTools: [qaTool],
      isToolSelected: vi.fn(() => true),
      resultPanelIcon: 'water-phantom',
      resultPanelOpen: true,
      resultPanelTitle: 'Water Phantom QA',
      resultPanelToolKey: 'qa',
      stackToolSelections: { qa: 'qa:water-phantom' }
    })

    await wrapper.find('.viewer-toolbar-dock__button').trigger('click')

    expect(wrapper.emitted('closeResultPanel')).toBeUndefined()
    expect(wrapper.emitted('selectToolOption')?.[0]).toEqual([qaTool, 'qa:water-phantom', { keepMenuOpen: true }])
  })

  it('switches from a utility panel to an option panel when an option tool is clicked', async () => {
    const mprMipTool: StackTool = { key: 'mprMip', label: 'MIP', icon: 'mip', kind: 'action' }
    const displayTool: StackTool = {
      key: 'display',
      label: 'Display',
      icon: 'eye',
      kind: 'action',
      options: [{ value: 'display:cornerInfo', label: 'Corner info', icon: 'info', checked: true }]
    }
    const wrapper = mountDock({
      activeTools: [mprMipTool, displayTool, tools[0]!],
      isToolSelected: vi.fn((tool: StackTool) => tool.key === 'pan'),
      utilityPanelOpen: true,
      utilityPanelTitle: 'MIP Params',
      utilityPanelToolKey: 'mprMip'
    })

    await wrapper.findAll('.viewer-toolbar-dock__button')[1]!.trigger('click')
    expect(wrapper.emitted('closeUtilityPanel')).toEqual([[]])
    expect(wrapper.emitted('setMenuOpen')).toEqual([['display']])
    expect(wrapper.emitted('applyTool')).toBeUndefined()

    await wrapper.setProps({ openMenuKey: 'display', utilityPanelOpen: false })
    expect(wrapper.find('.viewer-toolbar-dock__panel-title').text()).toContain('Display')
    expect(wrapper.find('[data-testid="utility-panel"]').exists()).toBe(false)
    expect(wrapper.find('.viewer-toolbar-dock-panel-content').exists()).toBe(true)
  })

  it('clears a utility panel when a plain tool is clicked', async () => {
    const mprMipTool: StackTool = { key: 'mprMip', label: 'MIP', icon: 'mip', kind: 'action' }
    const wrapper = mountDock({
      activeTools: [mprMipTool, tools[0]!],
      isToolSelected: vi.fn(() => false),
      utilityPanelOpen: true,
      utilityPanelTitle: 'MIP Params',
      utilityPanelToolKey: 'mprMip'
    })

    await wrapper.findAll('.viewer-toolbar-dock__button')[1]!.trigger('click')
    expect(wrapper.emitted('setMenuOpen')).toEqual([[null]])
    expect(wrapper.emitted('closeUtilityPanel')).toEqual([[]])
    expect(wrapper.emitted('applyTool')?.[0]).toEqual([tools[0]])

    await wrapper.setProps({ utilityPanelOpen: false })
    expect(wrapper.find('[data-testid="utility-panel"]').exists()).toBe(false)
    expect(wrapper.find('.viewer-toolbar-dock__active-tool-label').text()).toBe('Pan')
  })

  it('renders status content below the operation buttons', () => {
    const wrapper = mountDock()
    const bodyChildren = wrapper.find('.viewer-toolbar-dock__body').element.children

    expect(wrapper.find('.viewer-toolbar-dock__status [data-testid="dock-status"]').text()).toBe('4D status')
    expect(bodyChildren[0]?.classList.contains('viewer-toolbar-dock__tools-region')).toBe(true)
    expect(bodyChildren[1]?.classList.contains('viewer-toolbar-dock__status')).toBe(true)
    expect(bodyChildren[2]?.classList.contains('viewer-toolbar-dock__panel')).toBe(true)
    expect(bodyChildren[3]?.classList.contains('viewer-toolbar-dock__footer')).toBe(true)
  })

  it('collapses to a narrow icon rail and emits a dock resize event', async () => {
    const wrapper = mountDock()

    await wrapper.find('.viewer-toolbar-dock__collapse-button').trigger('click')

    expect(wrapper.find('.viewer-toolbar-dock').classes()).toContain('viewer-toolbar-dock--collapsed')
    expect(wrapper.find('.viewer-toolbar-dock__status').exists()).toBe(false)
    expect(wrapper.find('.viewer-toolbar-dock__panel').exists()).toBe(false)
    expect(wrapper.findAll('.viewer-toolbar-dock__button')).toHaveLength(2)
    expect(wrapper.emitted('dockResize')).toHaveLength(1)

    await wrapper.find('.viewer-toolbar-dock__collapse-button').trigger('click')
    expect(wrapper.find('.viewer-toolbar-dock').classes()).not.toContain('viewer-toolbar-dock--collapsed')
    expect(wrapper.emitted('dockResize')).toHaveLength(2)
  })

  it('collapses immediately while a utility panel is visible', async () => {
    const mprMipTool: StackTool = { key: 'mprMip', label: 'MIP', icon: 'mip', kind: 'action' }
    const wrapper = mountDock({
      activeTools: [mprMipTool],
      isToolSelected: vi.fn(() => false),
      utilityPanelOpen: true,
      utilityPanelTitle: 'MIP Params',
      utilityPanelToolKey: 'mprMip'
    })

    await wrapper.find('.viewer-toolbar-dock__collapse-button').trigger('click')

    expect(wrapper.find('.viewer-toolbar-dock').classes()).toContain('viewer-toolbar-dock--collapsed')
    expect(wrapper.find('.viewer-toolbar-dock__panel').exists()).toBe(false)
    expect(wrapper.find('.viewer-toolbar-dock__status').exists()).toBe(false)
    expect(wrapper.find('.viewer-toolbar-dock__footer').element).toBe(wrapper.find('.viewer-toolbar-dock__body').element.lastElementChild)
  })

  it('expands the dock when a collapsed option tool is clicked', async () => {
    const wrapper = mountDock()

    await wrapper.find('.viewer-toolbar-dock__collapse-button').trigger('click')
    await wrapper.findAll('.viewer-toolbar-dock__button')[1]!.trigger('click')

    expect(wrapper.find('.viewer-toolbar-dock').classes()).not.toContain('viewer-toolbar-dock--collapsed')
    expect(wrapper.emitted('dockResize')).toHaveLength(2)
    expect(wrapper.emitted('setMenuOpen')).toEqual([['window']])
  })

  it('expands the dock when a collapsed utility panel tool is clicked', async () => {
    const mprMipTool: StackTool = { key: 'mprMip', label: 'MIP', icon: 'mip', kind: 'action' }
    const wrapper = mountDock({
      activeTools: [mprMipTool],
      isToolSelected: vi.fn(() => false)
    })

    await wrapper.find('.viewer-toolbar-dock__collapse-button').trigger('click')
    await wrapper.find('.viewer-toolbar-dock__button').trigger('click')

    expect(wrapper.find('.viewer-toolbar-dock').classes()).not.toContain('viewer-toolbar-dock--collapsed')
    expect(wrapper.emitted('dockResize')).toHaveLength(2)
    expect(wrapper.emitted('applyTool')?.[0]).toEqual([mprMipTool])
  })

  it('keeps disabled tools from opening their option panels', async () => {
    const wrapper = mountDock({
      areToolbarActionsDisabled: true
    })

    const optionToolButton = wrapper.findAll('.viewer-toolbar-dock__button')[1]!
    expect(optionToolButton.attributes('disabled')).toBeDefined()

    await optionToolButton.trigger('click')
    expect(wrapper.emitted('setMenuOpen')).toBeUndefined()
  })
})
