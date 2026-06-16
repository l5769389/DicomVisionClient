import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUiPreferences } from '../../../composables/ui/useUiPreferences'
import type { ViewerTabItem } from '../../../types/viewer'
import type { StackTool } from './toolbarTypes'
import ViewerToolbarDock from './ViewerToolbarDock.vue'

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
      status: '<div data-testid="dock-status">4D status</div>'
    }
  })
}

describe('ViewerToolbarDock', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useUiPreferences().setLocale('en-US')
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

  it('renders option tools as single buttons and opens panels without applying the tool', async () => {
    const wrapper = mountDock()

    expect(wrapper.findAll('.viewer-toolbar-dock__button')).toHaveLength(2)
    expect(wrapper.find('.viewer-toolbar-dock__menu-button').exists()).toBe(false)
    expect(wrapper.find('.viewer-toolbar-dock__tab-button').exists()).toBe(false)

    await wrapper.findAll('.viewer-toolbar-dock__button')[1]!.trigger('click')
    expect(wrapper.emitted('setMenuOpen')).toEqual([['window']])
    expect(wrapper.emitted('applyTool')).toBeUndefined()

    await wrapper.setProps({ openMenuKey: 'window' })

    expect(wrapper.find('.viewer-toolbar-dock').classes()).not.toContain('viewer-toolbar-dock--wide')
    expect(wrapper.find('.viewer-toolbar-dock__active-tool-panel').exists()).toBe(false)
    expect(wrapper.find('.viewer-toolbar-dock__panel-title').text()).toContain('Window')
    expect(wrapper.find('.viewer-toolbar-dock-panel-content').exists()).toBe(true)
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

  it('emits applyTool for tools without options', async () => {
    const wrapper = mountDock()

    await wrapper.findAll('.viewer-toolbar-dock__button')[0]!.trigger('click')

    expect(wrapper.emitted('applyTool')?.[0]).toEqual([tools[0]])
    expect(wrapper.emitted('setMenuOpen')).toEqual([[null]])
    expect(wrapper.emitted('closeUtilityPanel')).toEqual([[]])
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

  it('does not show an option tool as an empty active panel before its panel opens', async () => {
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
    expect(wrapper.find('.viewer-toolbar-dock__active-tool-label').text()).toBe('Pan')

    await wrapper.setProps({ openMenuKey: 'reset' })
    expect(wrapper.find('.viewer-toolbar-dock__active-tool-panel').exists()).toBe(false)
    expect(wrapper.find('.viewer-toolbar-dock__panel-title').text()).toContain('Reset')
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
