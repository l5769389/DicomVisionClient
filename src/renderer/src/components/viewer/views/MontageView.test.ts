import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MontageView from './MontageView.vue'
import type { ViewerTabItem } from '../../../types/viewer'

let objectUrlSequence = 0
let fetchMock: ReturnType<typeof vi.fn>
const NativeURL = globalThis.URL

class ObjectUrlStub extends NativeURL {
  static createObjectURL(): string {
    objectUrlSequence += 1
    return `blob:montage-tile-${objectUrlSequence}`
  }

  static revokeObjectURL(): void {}
}

vi.mock('../../../composables/ui/useUiLocale', async () => {
  const { ref } = await import('vue')
  return {
    useUiLocale: () => ({
      locale: ref('zh-CN')
    })
  }
})

function createTab(overrides: Partial<ViewerTabItem> = {}): ViewerTabItem {
  return {
    key: 'montage-series-1',
    seriesId: 'series-1',
    seriesTitle: 'Series',
    title: 'Series',
    viewType: 'Montage',
    viewId: 'driver-view',
    imageSrc: '',
    sliceLabel: '1 / 24',
    windowLabel: 'WW 400 / WL 40',
    currentWindowInfo: { ww: 400, wl: 40 },
    pseudocolorPreset: 'rainbow',
    cornerInfo: {
      topLeft: ['SIEMENS / SOMATOM', 'CT01', 'Chest CT', 'Se: 3', 'AXIAL I 0.0mm', 'Im: 1/24'],
      topRight: ['TEST PATIENT', 'P001 / M / 042Y'],
      bottomLeft: ['120kV 30mA', '0.6mm', '2026-07-23 10:00:00', 'W: 400 L: 40'],
      bottomRight: ['Zoom:1.00x'],
      tags: {
        manufacturerModel: ['SIEMENS / SOMATOM'],
        stationName: ['CT01'],
        examDescription: ['Chest CT'],
        seriesNumber: ['Se: 3'],
        patientName: ['TEST PATIENT'],
        patientSummary: ['P001 / M / 042Y'],
        technique: ['120kV 30mA'],
        sliceThickness: ['0.6mm']
      }
    },
    orientation: { top: null, right: null, bottom: null, left: null, volumeQuaternion: null },
    montageColumnCount: 4,
    montageSelectedSliceIndex: 0,
    montageSliceCount: 24,
    ...overrides
  } as ViewerTabItem
}

function mountMontage(activeOperation = 'stack:window', tabOverrides: Partial<ViewerTabItem> = {}) {
  return mount(MontageView, {
    props: {
      activeTab: createTab(tabOverrides),
      activeOperation,
      starredSliceIndexes: []
    },
    global: {
      stubs: {
        AppIcon: {
          template: '<span class="app-icon-stub"></span>'
        },
      }
    }
  })
}

function getTileRequests(): string[] {
  return fetchMock.mock.calls
    .map(([url]) => String(url))
    .filter((url) => url.includes('/api/v1/dicom/montage/tile?'))
}

function getCornerInfoRequests(): string[] {
  return fetchMock.mock.calls
    .map(([url]) => String(url))
    .filter((url) => url.includes('/api/v1/dicom/montage/corner-info?'))
}

function dispatchPointer(
  element: Element,
  type: string,
  options: {
    button?: number
    clientX?: number
    clientY?: number
    isPrimary?: boolean
    pointerId?: number
  } = {}
): void {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: options.button ?? 0,
    clientX: options.clientX ?? 0,
    clientY: options.clientY ?? 0
  })
  Object.defineProperties(event, {
    isPrimary: { configurable: true, value: options.isPrimary ?? true },
    pointerId: { configurable: true, value: options.pointerId ?? 1 }
  })
  element.dispatchEvent(event)
}

function stubPointerCapture(element: Element): void {
  Object.assign(element, {
    setPointerCapture: vi.fn(),
    hasPointerCapture: vi.fn(() => true),
    releasePointerCapture: vi.fn()
  })
}

beforeEach(() => {
  objectUrlSequence = 0
  fetchMock = vi.fn(async (url) => {
    if (String(url).includes('/api/v1/dicom/montage/corner-info?')) {
      const sliceIndex = Number(new URL(String(url)).searchParams.get('sliceIndex') ?? 0)
      return new Response(JSON.stringify({
        cornerInfo: {
          topLeft: ['SIEMENS / SOMATOM', `AXIAL I ${sliceIndex.toFixed(1)}mm`, `Im: ${sliceIndex + 1}/24`],
          topRight: [],
          bottomLeft: ['W: 400 L: 40'],
          bottomRight: [],
          tags: {
            manufacturerModel: ['SIEMENS / SOMATOM'],
            technique: ['120kV 30mA'],
            sliceThickness: ['0.6mm'],
            windowLevel: ['W: 400 L: 40'],
            viewportLocation: [`AXIAL I ${sliceIndex.toFixed(1)}mm`],
            imageIndex: [`Im: ${sliceIndex + 1}/24`],
            sliceLocation: [`Slice Location: ${sliceIndex.toFixed(1)}mm`],
            imagePositionPatient: [`IPP: 0.000\\0.000\\${sliceIndex.toFixed(3)}`]
          }
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    return new Response(new Blob(['tile'], { type: 'image/webp' }), {
      status: 200,
      headers: { 'Content-Type': 'image/webp' }
    })
  })
  vi.stubGlobal('ResizeObserver', undefined)
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('URL', ObjectUrlStub)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('MontageView', () => {
  it('loads only the initial visible rows and includes the shared display state', async () => {
    const wrapper = mountMontage()
    await vi.waitFor(() => {
      expect(wrapper.findAll('img')).toHaveLength(16)
    })
    const requestUrls = getTileRequests()

    expect(wrapper.findAll('.montage-view__tile')).toHaveLength(16)
    expect(wrapper.find('.montage-view__scroller').attributes('data-total-slices')).toBe('24')
    expect(requestUrls).toHaveLength(16)
    expect(getCornerInfoRequests()).toHaveLength(1)
    expect(requestUrls[0]).toContain('/api/v1/dicom/montage/tile?')
    expect(requestUrls[0]).toContain('sliceIndex=0')
    expect(requestUrls[0]).toContain('ww=400')
    expect(requestUrls[0]).toContain('wl=40')
    expect(requestUrls[0]).toContain('pseudocolorPreset=rainbow')
    expect(wrapper.find('[data-slice-index="0"] img').attributes('src')).toMatch(/^blob:montage-tile-/)
  })

  it('renders and loads only the new visible rows after scrolling', async () => {
    const wrapper = mountMontage('stack:window', { montageSliceCount: 120 })
    const scroller = wrapper.find('.montage-view__scroller').element as HTMLElement
    Object.defineProperty(scroller, 'clientWidth', { configurable: true, value: 800 })
    Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 400 })
    Object.defineProperty(scroller, 'scrollTop', { configurable: true, value: 1000, writable: true })
    window.dispatchEvent(new Event('resize'))

    await vi.waitFor(() => {
      expect(wrapper.find('[data-slice-index="20"] img').exists()).toBe(true)
    })
    const renderedTiles = wrapper.findAll('.montage-view__tile')
    expect(renderedTiles.length).toBeLessThan(120)
    expect(renderedTiles[0].attributes('data-slice-index')).toBe('16')
    expect(getTileRequests().some((url) => new URL(url).searchParams.get('sliceIndex') === '20')).toBe(true)
    expect(wrapper.find('[data-slice-index="0"]').exists()).toBe(false)
  })

  it('keeps the DOM bounded for very large series', async () => {
    const wrapper = mountMontage('stack:window', { montageSliceCount: 1200 })
    await vi.waitFor(() => expect(wrapper.findAll('img')).toHaveLength(16))

    expect(wrapper.findAll('.montage-view__tile')).toHaveLength(16)
    expect(wrapper.find('.montage-view__scroller').attributes('data-total-slices')).toBe('1200')
  })

  it('switches columns, selects slices, and opens the exact slice', async () => {
    const wrapper = mountMontage()
    const columnButton = wrapper.findAll('.montage-view__column-button').find((button) => button.text() === '6')
    const tile = wrapper.find('[data-slice-index="3"]')

    await columnButton?.trigger('click')
    expect(wrapper.find('.montage-view__grid').attributes('style')).toContain('repeat(6')

    await tile.trigger('click')
    expect(tile.classes()).toContain('montage-view__tile--selected')

    await tile.trigger('dblclick')
    expect(wrapper.emitted('openSlice')?.at(-1)).toEqual([{ seriesId: 'series-1', sliceIndex: 3 }])

    await tile.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('openSlice')?.at(-1)).toEqual([{ seriesId: 'series-1', sliceIndex: 3 }])
  })

  it('retries one failed tile without affecting other tiles', async () => {
    let failFirstTile = true
    fetchMock.mockImplementation(async (url) => {
      if (String(url).includes('/api/v1/dicom/montage/corner-info?')) {
        return new Response(JSON.stringify({
          cornerInfo: { topLeft: [], topRight: [], bottomLeft: [], bottomRight: [] }
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      if (String(url).includes('sliceIndex=0') && failFirstTile) {
        return new Response(JSON.stringify({ detail: 'Montage slice could not be decoded' }), {
          status: 422,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      return new Response(new Blob(['tile'], { type: 'image/webp' }), {
        status: 200,
        headers: { 'Content-Type': 'image/webp' }
      })
    })
    const wrapper = mountMontage()
    await vi.waitFor(() => {
      expect(wrapper.find('[data-slice-index="0"] .montage-view__retry').exists()).toBe(true)
    })
    expect(wrapper.find('[data-slice-index="0"] .montage-view__error').text()).toContain('无法解码')

    failFirstTile = false
    const retry = wrapper.find('[data-slice-index="0"] .montage-view__retry')
    await retry.trigger('click')

    await vi.waitFor(() => {
      expect(wrapper.find('[data-slice-index="0"] img').exists()).toBe(true)
    })
    const requestCountForSlice = (sliceIndex: number) =>
      getTileRequests().filter((url) => new URL(url).searchParams.get('sliceIndex') === String(sliceIndex)).length
    expect(requestCountForSlice(0)).toBe(2)
    expect(requestCountForSlice(1)).toBe(1)
  })

  it('explains when the running backend does not provide the montage endpoint', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Not Found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    )
    const wrapper = mountMontage()

    await vi.waitFor(() => {
      expect(wrapper.find('[data-slice-index="0"] .montage-view__retry').exists()).toBe(true)
    })
    expect(wrapper.find('[data-slice-index="0"] .montage-view__error').text()).toContain('重启配套后端')
  })

  it('coalesces rapid window changes before refreshing visible tiles', async () => {
    const wrapper = mountMontage()
    await vi.waitFor(() => expect(getTileRequests()).toHaveLength(16))

    await wrapper.setProps({
      activeTab: createTab({ currentWindowInfo: { ww: 500, wl: 50 } })
    })
    await wrapper.setProps({
      activeTab: createTab({ currentWindowInfo: { ww: 600, wl: 60 } })
    })
    await wrapper.setProps({
      activeTab: createTab({ currentWindowInfo: { ww: 700, wl: 70 } })
    })

    await vi.waitFor(() => expect(getTileRequests()).toHaveLength(32))
    const refreshedUrls = getTileRequests().slice(16)
    expect(refreshedUrls.every((url) => url.includes('ww=700') && url.includes('wl=70'))).toBe(true)
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('ww=500'))).toBe(false)
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('ww=600'))).toBe(false)
  })

  it('derives the title window values from the shared montage header metadata', async () => {
    const wrapper = mountMontage('stack:window', {
      windowLabel: '',
      currentWindowInfo: null,
      initialWindowInfo: null,
      cornerInfo: {
        topLeft: [],
        topRight: [],
        bottomLeft: [],
        bottomRight: [],
        tags: {}
      }
    })

    await vi.waitFor(() => {
      expect(wrapper.find('.montage-view__subtitle').text()).toContain('WW 400 / WL 40')
    })
    expect((wrapper.emitted('stateChange') ?? []).some(([payload]) =>
      (payload as { windowInfo?: { ww: number; wl: number } }).windowInfo?.ww === 400 &&
      (payload as { windowInfo?: { ww: number; wl: number } }).windowInfo?.wl === 40
    )).toBe(true)
  })

  it('updates window information immediately from drags across the montage area', async () => {
    const windowWrapper = mountMontage('stack:window')
    await vi.waitFor(() => expect(getTileRequests()).toHaveLength(16))
    await vi.waitFor(() => expect(windowWrapper.find('.montage-view__image').exists()).toBe(true))
    const requestCountBeforeDrag = getTileRequests().length
    stubPointerCapture(windowWrapper.find('.montage-view__scroller').element)
    dispatchPointer(windowWrapper.find('[data-slice-index="0"]').element, 'pointerdown', {
      isPrimary: true,
      button: 0,
      pointerId: 12,
      clientX: 10,
      clientY: 10
    })
    dispatchPointer(windowWrapper.find('.montage-view').element, 'pointermove', {
      isPrimary: true,
      pointerId: 12,
      clientX: 80,
      clientY: 30
    })
    await windowWrapper.vm.$nextTick()
    expect(windowWrapper.find('.montage-view__subtitle').text()).toContain('WW 470 / WL 20')
    expect(windowWrapper.find('.montage-view__image').attributes('style')).toContain('filter: contrast')
    await vi.waitFor(() => expect(getTileRequests().length).toBeGreaterThan(requestCountBeforeDrag))
    expect(getTileRequests().slice(requestCountBeforeDrag).some((url) =>
      url.includes('ww=470') && url.includes('wl=20')
    )).toBe(true)
    dispatchPointer(windowWrapper.find('.montage-view').element, 'pointerup', {
      isPrimary: true,
      pointerId: 12,
      clientX: 80,
      clientY: 30
    })
    expect(windowWrapper.emitted('pointerDown')).toBeUndefined()
    expect(windowWrapper.emitted('pointerMove')).toBeUndefined()
    expect(windowWrapper.emitted('pointerUp')).toBeUndefined()
    expect((windowWrapper.emitted('stateChange') ?? []).some(([payload]) =>
      (payload as { windowInfo?: { ww: number; wl: number } }).windowInfo?.ww === 470 &&
      (payload as { windowInfo?: { ww: number; wl: number } }).windowInfo?.wl === 20
    )).toBe(true)

    const resetWrapper = mountMontage('stack:reset')
    dispatchPointer(resetWrapper.find('[data-slice-index="0"]').element, 'pointerdown', {
      isPrimary: true,
      button: 0,
      pointerId: 13
    })
    expect(resetWrapper.emitted('stateChange')).toBeUndefined()
  })

  it('keeps montage corner information in the shared header with tag-label tooltips', async () => {
    const wrapper = mountMontage()

    expect(wrapper.find('.montage-view__subtitle').text()).toContain('WW 400 / WL 40')
    expect(wrapper.find('.montage-view__subtitle').text()).toContain('Rainbow')
    expect(wrapper.find('.montage-view__subtitle').text()).not.toContain('1.00×')
    expect(wrapper.find('.montage-view__subtitle').text()).not.toContain('缩放')
    expect(wrapper.find('.montage-view__common-info-label').text()).toBe('影像信息')
    expect(wrapper.find('.montage-view__common-info').text()).toContain('SIEMENS / SOMATOM')
    expect(wrapper.find('.montage-view__common-info').text()).not.toContain('W: 400 L: 40')
    const sliceThicknessLine = wrapper.findAll('.montage-view__common-info-line').find((line) => line.text() === '0.6mm')
    expect(sliceThicknessLine?.attributes('data-tooltip')).toBe('层厚')
    await sliceThicknessLine?.trigger('mouseenter', { clientX: 120, clientY: 40 })
    expect(wrapper.find('.montage-view__tag-tooltip').text()).toBe('层厚')
    await sliceThicknessLine?.trigger('mouseleave')
    expect(wrapper.find('.montage-view__tag-tooltip').exists()).toBe(false)
    expect(wrapper.findAll('.montage-view__slice-info')).toHaveLength(0)
    const requestsBeforeHover = getCornerInfoRequests().length
    await wrapper.find('[data-slice-index="1"]').trigger('mouseenter')
    expect(getCornerInfoRequests()).toHaveLength(requestsBeforeHover)

    await wrapper.setProps({
      activeTab: createTab({ showCornerInfo: false })
    })
    expect(wrapper.find('.montage-view__common-info').exists()).toBe(false)
    expect(wrapper.findAll('.montage-view__slice-info')).toHaveLength(0)

    await wrapper.setProps({
      activeTab: createTab({ showCornerInfo: true })
    })
    expect(wrapper.find('.montage-view__common-info').text()).not.toContain('W: 400 L: 40')
  })

  it('applies one normalized pan/zoom transform to every loaded tile and suppresses drag activation', async () => {
    const wrapper = mountMontage('stack:zoom', {
      montageTransformState: { zoom: 2, offsetX: 0, offsetY: 0 }
    })
    const scroller = wrapper.find('.montage-view__scroller').element as HTMLElement
    stubPointerCapture(scroller)
    await vi.waitFor(() => expect(wrapper.findAll('img')).toHaveLength(16))

    dispatchPointer(wrapper.find('[data-slice-index="0"]').element, 'pointerdown', {
      isPrimary: true,
      button: 0,
      pointerId: 21,
      clientX: 20,
      clientY: 100
    })
    dispatchPointer(wrapper.find('.montage-view').element, 'pointermove', {
      isPrimary: true,
      pointerId: 21,
      clientX: 20,
      clientY: 40
    })
    dispatchPointer(wrapper.find('.montage-view').element, 'pointerup', {
      isPrimary: true,
      pointerId: 21,
      clientX: 20,
      clientY: 40
    })

    const transformEvents = (wrapper.emitted('stateChange') ?? [])
      .map(([payload]) => payload as { transform?: { zoom: number } })
      .filter((payload) => payload.transform)
    expect(transformEvents.at(-1)?.transform?.zoom).toBeGreaterThan(2)
    const imageTransforms = wrapper.findAll('.montage-view__image').map((image) => image.attributes('style'))
    expect(new Set(imageTransforms).size).toBe(1)

    await wrapper.find('[data-slice-index="3"]').trigger('click')
    expect(wrapper.emitted('stateChange')).not.toContainEqual([{
      tabKey: 'montage-series-1',
      selectedSliceIndex: 3
    }])
  })

  it('uses right-button dragging for global zoom regardless of the selected left-button tool', async () => {
    const wrapper = mountMontage('stack:window', {
      montageTransformState: { zoom: 2, offsetX: 0, offsetY: 0 }
    })
    const scroller = wrapper.find('.montage-view__scroller').element as HTMLElement
    stubPointerCapture(scroller)

    dispatchPointer(wrapper.find('[data-slice-index="0"]').element, 'pointerdown', {
      isPrimary: true,
      button: 2,
      pointerId: 31,
      clientY: 90
    })
    dispatchPointer(wrapper.find('.montage-view').element, 'pointermove', {
      isPrimary: true,
      button: 2,
      pointerId: 31,
      clientY: 30
    })
    dispatchPointer(wrapper.find('.montage-view').element, 'pointerup', {
      isPrimary: true,
      button: 2,
      pointerId: 31,
      clientY: 30
    })

    const lastTransform = (wrapper.emitted('stateChange') ?? [])
      .map(([payload]) => payload as { transform?: { zoom: number } })
      .filter((payload) => payload.transform)
      .at(-1)?.transform
    expect(lastTransform?.zoom).toBeGreaterThan(2)
    expect(wrapper.emitted('pointerDown')).toBeUndefined()
  })

  it('captures montage pointer interactions on press while still permitting slice double-click', async () => {
    const wrapper = mountMontage('stack:zoom')
    const scroller = wrapper.find('.montage-view__scroller').element as HTMLElement
    const setPointerCapture = vi.fn()
    Object.assign(scroller, {
      setPointerCapture,
      hasPointerCapture: vi.fn(() => false),
      releasePointerCapture: vi.fn()
    })
    const tile = wrapper.find('[data-slice-index="4"]')

    dispatchPointer(tile.element, 'pointerdown', {
      isPrimary: true,
      button: 0,
      pointerId: 41,
      clientX: 30,
      clientY: 30
    })
    dispatchPointer(tile.element, 'pointerup', {
      isPrimary: true,
      button: 0,
      pointerId: 41,
      clientX: 30,
      clientY: 30
    })
    expect(setPointerCapture).toHaveBeenCalledWith(41)

    await tile.trigger('dblclick')
    expect(wrapper.emitted('openSlice')?.at(-1)).toEqual([{
      seriesId: 'series-1',
      sliceIndex: 4
    }])
  })

  it('persists column and selection state, supports keyboard navigation, and toggles key slices', async () => {
    const wrapper = mountMontage()
    const sixColumns = wrapper.findAll('.montage-view__column-button').find((button) => button.text() === '6')

    await sixColumns?.trigger('click')
    expect(wrapper.emitted('stateChange')).toContainEqual([{
      tabKey: 'montage-series-1',
      columnCount: 6
    }])

    await wrapper.find('[data-slice-index="0"]').trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.emitted('stateChange')).toContainEqual([{
      tabKey: 'montage-series-1',
      selectedSliceIndex: 1
    }])

    await wrapper.find('[data-slice-index="2"] .montage-view__star').trigger('click')
    expect(wrapper.emitted('toggleSliceStar')?.at(-1)).toEqual([{ sliceIndex: 2 }])

    await wrapper.setProps({ starredSliceIndexes: [2] })
    expect(wrapper.find('[data-slice-index="2"] .montage-view__star').classes()).toContain('montage-view__star--active')
  })
})
