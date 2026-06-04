import { mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { useWorkspaceHotkeys, type WorkspaceHotkeyOptions } from './useWorkspaceHotkeys'
import type { ViewerTabItem } from '../../../types/viewer'

function mountHotkeys(overrides: Partial<WorkspaceHotkeyOptions> = {}) {
  const exportCurrentView = vi.fn()
  const options: WorkspaceHotkeyOptions = {
    activeOperation: ref('stack:window'),
    activeTab: ref({ key: 'tab-1', viewType: 'Stack', sliceLabel: '1 / 10' } as ViewerTabItem),
    activeTabKey: ref('tab-1'),
    activeViewportKey: ref('single'),
    closeActiveTab: vi.fn(),
    copySelectedAnnotation: vi.fn(() => false),
    copySelectedMeasurement: vi.fn(() => false),
    copySelectedMtf: vi.fn(() => false),
    deleteSelectedAnnotation: vi.fn(() => false),
    deleteSelectedMeasurement: vi.fn(() => false),
    deleteSelectedMtf: vi.fn(() => false),
    exportCurrentView,
    finishPointSequenceMeasurement: vi.fn(() => false),
    quickPreviewSelectedSeries: vi.fn(),
    selectedSeriesId: ref(''),
    tagIndexChange: vi.fn(),
    toggleSidebar: vi.fn(),
    viewportWheel: vi.fn(),
    ...overrides
  }

  const wrapper = mount(defineComponent({
    setup() {
      useWorkspaceHotkeys(options)
      return () => null
    }
  }))

  return { exportCurrentView, options, wrapper }
}

function dispatchKey(key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    key
  })
  window.dispatchEvent(event)
  return event
}

describe('useWorkspaceHotkeys', () => {
  it('uses F9/F10 for screenshot export and leaves F11 to the browser', () => {
    const { exportCurrentView, wrapper } = mountHotkeys()

    const pngEvent = dispatchKey('F9')
    const dicomEvent = dispatchKey('F10')
    const browserFullscreenEvent = dispatchKey('F11')

    expect(exportCurrentView).toHaveBeenNthCalledWith(1, 'png')
    expect(exportCurrentView).toHaveBeenNthCalledWith(2, 'dicom')
    expect(exportCurrentView).toHaveBeenCalledTimes(2)
    expect(pngEvent.defaultPrevented).toBe(true)
    expect(dicomEvent.defaultPrevented).toBe(true)
    expect(browserFullscreenEvent.defaultPrevented).toBe(false)

    wrapper.unmount()
  })
})
