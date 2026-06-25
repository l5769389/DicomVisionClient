import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { STACK_OPERATION_PREFIX } from '@shared/viewerConstants'
import ViewportVoiOverlay from './ViewportVoiOverlay.vue'
import type { MprPlaneInfo, MprSegmentationConfig } from '../../../types/viewer'
import {
  MPR_SEGMENTATION_MAX_THRESHOLD_REGIONS,
  MPR_SEGMENTATION_MAX_VOI_SPHERES
} from '../../../types/viewer'

const dispatchWorkspaceStatusToastMock = vi.hoisted(() => vi.fn())

vi.mock('../../../composables/workspace/tasks/workspaceStatus', () => ({
  dispatchWorkspaceStatusToast: dispatchWorkspaceStatusToastMock
}))

vi.mock('../../../composables/ui/useUiPreferences', () => ({
  useUiPreferences: () => ({
    locale: { value: 'zh-CN' }
  })
}))

const coronalPlane: MprPlaneInfo = {
  viewport: 'mpr-cor',
  centerWorld: [0, 0, 0],
  cursorCenterWorld: [0, 0, 0],
  rowWorld: [1, 0, 0],
  colWorld: [0, 0, 1],
  normalWorld: [0, 1, 0],
  pixelSpacingRowMm: 1,
  pixelSpacingColMm: 2,
  pixelSpacingNormalMm: 1,
  outputShape: [100, 50],
  row: [1, 0, 0],
  col: [0, 0, 1],
  normal: [0, 1, 0],
  isOblique: false
}

function createSegmentationConfig(): MprSegmentationConfig {
  return {
    enabled: true,
    clientRevision: 1,
    selectedRegionId: 'r1',
    selectedVoi: false,
    selectedVoiId: null,
    thresholdRegions: [
      {
        id: 'r1',
        enabled: true,
        label: '1',
        thresholdHu: 300,
        thresholdMode: 'hu',
        thresholdPercentile: 80,
        color: '#ff4df8',
        box: {
          centerWorld: [0, 0, 0],
          rowWorld: [0, 1, 0],
          colWorld: [0, 0, 1],
          normalWorld: [1, 0, 0],
          widthMm: 50,
          heightMm: 50,
          depthMm: 20,
          sourceViewport: 'mpr-ax'
        },
        stats: null
      }
    ],
    voiSpheres: [],
    voiSphere: null
  }
}

function createEmptyConfig(): MprSegmentationConfig {
  return {
    enabled: true,
    clientRevision: 1,
    selectedRegionId: null,
    selectedVoi: false,
    selectedVoiId: null,
    thresholdRegions: [],
    voiSpheres: [],
    voiSphere: null
  }
}

function createMixedConfig(): MprSegmentationConfig {
  return {
    ...createSegmentationConfig(),
    selectedRegionId: null,
    selectedVoi: true,
    selectedVoiId: 'v1',
    thresholdRegions: [
      {
        ...createSegmentationConfig().thresholdRegions[0]!,
        box: {
          centerWorld: [0, 0, 0],
          rowWorld: [1, 0, 0],
          colWorld: [0, 0, 1],
          normalWorld: [0, 1, 0],
          widthMm: 24,
          heightMm: 24,
          depthMm: 12,
          sourceViewport: 'mpr-cor'
        }
      }
    ],
    voiSpheres: [
      {
        id: 'v1',
        label: '1',
        enabled: true,
        centerWorld: [0, 0, 0],
        radiusMm: 16,
        color: '#22d3ee',
        stats: null
      }
    ],
    voiSphere: {
      id: 'v1',
      label: '1',
      enabled: true,
      centerWorld: [0, 0, 0],
      radiusMm: 16,
      color: '#22d3ee',
      stats: null
    }
  }
}

function createVoiConfig(selectedVoi = false, secondVoi = false): MprSegmentationConfig {
  const firstSphere = {
    id: 'v1',
    label: '1',
    enabled: true,
    centerWorld: [0, 0, 0] as [number, number, number],
    radiusMm: 12,
    color: '#22d3ee',
    stats: {
      huMean: 101,
      huMin: 80,
      huMax: 120,
      huStdDev: 7,
      volumeCm3: 2.75,
      sampleCount: 48
    }
  }
  const secondSphere = {
    id: 'v2',
    label: '2',
    enabled: true,
    centerWorld: [10, 0, 0] as [number, number, number],
    radiusMm: 8,
    color: '#22d3ee',
    stats: null
  }
  const spheres = secondVoi ? [firstSphere, secondSphere] : [firstSphere]
  const selectedVoiId = selectedVoi ? spheres.at(-1)!.id : null
  return {
    enabled: true,
    clientRevision: 2,
    selectedRegionId: null,
    selectedVoiId,
    selectedVoi,
    thresholdRegions: [],
    voiSpheres: spheres,
    voiSphere: selectedVoiId ? spheres.find((sphere) => sphere.id === selectedVoiId)! : spheres[0]!
  }
}

function createPointerEvent(type: string, clientX: number, clientY: number, pointerId = 1): PointerEvent {
  const event = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent
  Object.defineProperties(event, {
    button: { value: 0 },
    clientX: { value: clientX },
    clientY: { value: clientY },
    pointerId: { value: pointerId }
  })
  return event
}

function prepareOverlayElement(wrapper: ReturnType<typeof mount<typeof ViewportVoiOverlay>>): Element {
  const overlay = wrapper.find('[data-testid="viewport-segmentation-overlay"]').element
  overlay.getBoundingClientRect = () => ({
    bottom: 100,
    height: 100,
    left: 0,
    right: 100,
    top: 0,
    width: 100,
    x: 0,
    y: 0,
    toJSON: () => ({})
  } as DOMRect)
  Object.defineProperties(overlay, {
    setPointerCapture: { value: () => undefined, configurable: true },
    releasePointerCapture: { value: () => undefined, configurable: true }
  })
  return overlay
}

describe('ViewportVoiOverlay', () => {
  beforeEach(() => {
    dispatchWorkspaceStatusToastMock.mockReset()
  })

  it('hides all threshold and VOI overlays when segmentation preview is disabled', () => {
    const config = {
      ...createMixedConfig(),
      enabled: false
    }
    const wrapper = mount(ViewportVoiOverlay, {
      props: {
        activeOperation: 'segmentation:threshold',
        editable: true,
        isActive: true,
        viewportKey: 'mpr-cor',
        config,
        imageFrame: { left: 0, top: 0, width: 100, height: 100 },
        mprPlane: coronalPlane
      }
    })

    expect(wrapper.find('[data-testid="viewport-segmentation-overlay"]').exists()).toBe(false)
    expect(wrapper.find('rect[data-region-id="r1"]').exists()).toBe(false)
    expect(wrapper.find('ellipse[data-voi-id="v1"]').exists()).toBe(false)
  })

  it('draws non-source threshold rects from the physical box intersection instead of backend mask bbox', () => {
    const wrapper = mount(ViewportVoiOverlay, {
      props: {
        viewportKey: 'mpr-cor',
        config: createSegmentationConfig(),
        imageFrame: { left: 0, top: 0, width: 100, height: 100 },
        mprPlane: coronalPlane,
        segmentationOverlay: {
          regions: [
            {
              regionId: 'r1',
              visible: true,
              rect: { xMin: 0.9, yMin: 0.9, xMax: 1, yMax: 1 }
            }
          ]
        }
      }
    })

    const regionRect = wrapper.findAll('rect')[1]!
    expect(Number.parseFloat(regionRect.attributes('x') ?? '')).toBeCloseTo(25)
    expect(Number.parseFloat(regionRect.attributes('y') ?? '')).toBeCloseTo(40)
    expect(Number.parseFloat(regionRect.attributes('width') ?? '')).toBeCloseTo(50)
    expect(Number.parseFloat(regionRect.attributes('height') ?? '')).toBeCloseTo(20)
  })

  it('selects a VOI before exposing active viewport edit handles', async () => {
    const wrapper = mount(ViewportVoiOverlay, {
      props: {
        activeOperation: 'segmentation:voi',
        editable: true,
        isActive: true,
        viewportKey: 'mpr-cor',
        config: createVoiConfig(false),
        imageFrame: { left: 0, top: 0, width: 100, height: 100 },
        mprPlane: coronalPlane
      }
    })
    wrapper.find('[data-testid="viewport-segmentation-overlay"]').element.getBoundingClientRect = () => ({
      bottom: 100,
      height: 100,
      left: 0,
      right: 100,
      top: 0,
      width: 100,
      x: 0,
      y: 0,
      toJSON: () => ({})
    } as DOMRect)

    expect(wrapper.findAll('circle')).toHaveLength(0)
    const pointerDown = new Event('pointerdown', { bubbles: true, cancelable: true }) as PointerEvent
    Object.defineProperties(pointerDown, {
      clientX: { value: 50 },
      clientY: { value: 50 },
      pointerId: { value: 1 }
    })
    wrapper.find('ellipse').element.dispatchEvent(pointerDown)
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('modeChange')?.at(-1)).toEqual(['segmentation:voi'])
    expect(wrapper.emitted('configChange')?.at(-1)).toEqual([
      expect.objectContaining({
        selectedRegionId: null,
        selectedVoi: true,
        selectedVoiId: 'v1'
      }),
      'select'
    ])
  })

  it('shows VOI handles only for the selected active viewport', async () => {
    const wrapper = mount(ViewportVoiOverlay, {
      props: {
        activeOperation: 'segmentation:voi',
        editable: true,
        isActive: true,
        viewportKey: 'mpr-cor',
        config: createVoiConfig(true),
        imageFrame: { left: 0, top: 0, width: 160, height: 120 },
        mprPlane: coronalPlane
      }
    })

    expect(wrapper.findAll('circle')).toHaveLength(4)
    expect(wrapper.find('[data-testid="viewport-voi-metrics"]').exists()).toBe(false)

    await wrapper.setProps({ isActive: false })

    expect(wrapper.findAll('circle')).toHaveLength(0)
  })

  it('draws the selected threshold rectangle above VOI spheres', () => {
    const wrapper = mount(ViewportVoiOverlay, {
      props: {
        activeOperation: 'segmentation:threshold',
        editable: true,
        isActive: true,
        viewportKey: 'mpr-cor',
        config: {
          ...createMixedConfig(),
          selectedRegionId: 'r1',
          selectedVoi: false,
          selectedVoiId: null
        },
        imageFrame: { left: 0, top: 0, width: 100, height: 100 },
        mprPlane: coronalPlane
      }
    })

    const selectedRect = wrapper.find('rect[data-region-id="r1"]').element
    const voiEllipse = wrapper.find('ellipse[data-voi-id="v1"]').element

    expect(voiEllipse.compareDocumentPosition(selectedRect) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('renders a non-intersecting threshold rectangle as a dashed projection without handles', () => {
    const wrapper = mount(ViewportVoiOverlay, {
      props: {
        activeOperation: 'segmentation:threshold',
        editable: true,
        isActive: true,
        viewportKey: 'mpr-cor',
        config: {
          ...createSegmentationConfig(),
          thresholdRegions: [
            {
              ...createSegmentationConfig().thresholdRegions[0]!,
              box: {
                centerWorld: [0, 40, 0],
                rowWorld: [0, 1, 0],
                colWorld: [0, 0, 1],
                normalWorld: [1, 0, 0],
                widthMm: 50,
                heightMm: 50,
                depthMm: 20,
                sourceViewport: 'mpr-ax'
              }
            }
          ]
        },
        imageFrame: { left: 0, top: 0, width: 100, height: 100 },
        mprPlane: coronalPlane
      }
    })

    const projectedRect = wrapper.find('rect[data-region-id="r1"]')
    expect(projectedRect.exists()).toBe(true)
    expect(projectedRect.attributes('stroke-dasharray')).toBe('4 4')
    expect(wrapper.findAll('circle')).toHaveLength(0)
  })

  it('does not draw threshold highlight samples for non-intersecting dashed projections', async () => {
    const fillRect = vi.fn()
    const requestAnimationFrame = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback): number => {
        callback(0)
        return 1
      })
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue({
        clearRect: vi.fn(),
        fillRect,
        setTransform: vi.fn(),
        globalAlpha: 1,
        fillStyle: ''
      } as unknown as CanvasRenderingContext2D)

    try {
      const wrapper = mount(ViewportVoiOverlay, {
        props: {
          activeOperation: 'segmentation:threshold',
          editable: true,
          isActive: true,
          viewportKey: 'mpr-cor',
          config: {
            ...createSegmentationConfig(),
            thresholdRegions: [
              {
                ...createSegmentationConfig().thresholdRegions[0]!,
                box: {
                  centerWorld: [0, 40, 0],
                  rowWorld: [0, 1, 0],
                  colWorld: [0, 0, 1],
                  normalWorld: [1, 0, 0],
                  widthMm: 50,
                  heightMm: 50,
                  depthMm: 20,
                  sourceViewport: 'mpr-ax'
                }
              }
            ]
          },
          imageFrame: { left: 0, top: 0, width: 100, height: 100 },
          mprPlane: coronalPlane,
          segmentationOverlay: {
            regions: [
              {
                regionId: 'r1',
                visible: true,
                rect: null,
                sampleRevision: 1,
                samples: {
                  points: [25.5, 45.5, 500],
                  totalCount: 1,
                  sampledCount: 1
                }
              }
            ]
          }
        }
      })
      await wrapper.vm.$nextTick()

      expect(wrapper.find('rect[data-region-id="r1"]').attributes('stroke-dasharray')).toBe('4 4')
      expect(fillRect).not.toHaveBeenCalled()
    } finally {
      getContext.mockRestore()
      requestAnimationFrame.mockRestore()
    }
  })

  it('redraws threshold highlight samples when sampled points change without a revision or length change', async () => {
    const clearRect = vi.fn()
    const rafCallbacks: FrameRequestCallback[] = []
    const flushRaf = (): void => {
      const callbacks = rafCallbacks.splice(0)
      callbacks.forEach((callback) => callback(0))
    }
    const requestAnimationFrame = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback): number => {
        rafCallbacks.push(callback)
        return rafCallbacks.length
      })
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue({
        clearRect,
        fillRect: vi.fn(),
        setTransform: vi.fn(),
        globalAlpha: 1,
        fillStyle: ''
      } as unknown as CanvasRenderingContext2D)

    try {
      const wrapper = mount(ViewportVoiOverlay, {
        props: {
          activeOperation: 'segmentation:threshold',
          editable: true,
          isActive: true,
          viewportKey: 'mpr-cor',
          config: createSegmentationConfig(),
          imageFrame: { left: 0, top: 0, width: 100, height: 100 },
          mprPlane: coronalPlane,
          segmentationOverlay: {
            regions: [
              {
                regionId: 'r1',
                visible: true,
                rect: null,
                sampleRevision: 1,
                samples: {
                  points: [25, 50, 500, 26, 50, 500, 27, 50, 500],
                  totalCount: 3,
                  sampledCount: 3
                }
              }
            ]
          }
        }
      })
      await wrapper.vm.$nextTick()
      await wrapper.vm.$nextTick()
      flushRaf()
      clearRect.mockClear()
      requestAnimationFrame.mockClear()

      await wrapper.setProps({
        segmentationOverlay: {
          regions: [
            {
              regionId: 'r1',
              visible: true,
              rect: null,
              sampleRevision: 1,
              samples: {
                points: [25, 50, 500, 30, 50, 500, 27, 50, 500],
                totalCount: 3,
                sampledCount: 3
              }
            }
          ]
        }
      })
      await wrapper.vm.$nextTick()
      await wrapper.vm.$nextTick()

      expect(requestAnimationFrame).toHaveBeenCalled()
      flushRaf()
      expect(clearRect).toHaveBeenCalled()
    } finally {
      getContext.mockRestore()
      requestAnimationFrame.mockRestore()
    }
  })

  it('keeps existing threshold highlight samples on the stable canvas while drawing a new region', async () => {
    const stableClearRect = vi.fn()
    const activeClearRect = vi.fn()
    const rafCallbacks: FrameRequestCallback[] = []
    const flushRaf = (): void => {
      const callbacks = rafCallbacks.splice(0)
      callbacks.forEach((callback) => callback(0))
    }
    const requestAnimationFrame = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback): number => {
        rafCallbacks.push(callback)
        return rafCallbacks.length
      })
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockImplementation(function (this: HTMLCanvasElement) {
        const isActiveCanvas = this.getAttribute('data-testid') === 'viewport-segmentation-active-highlight'
        return {
          clearRect: isActiveCanvas ? activeClearRect : stableClearRect,
          fillRect: vi.fn(),
          setTransform: vi.fn(),
          globalAlpha: 1,
          fillStyle: ''
        } as unknown as CanvasRenderingContext2D
      })

    try {
      const wrapper = mount(ViewportVoiOverlay, {
        props: {
          activeOperation: 'segmentation:threshold',
          editable: true,
          isActive: true,
          viewportKey: 'mpr-cor',
          config: createSegmentationConfig(),
          imageFrame: { left: 0, top: 0, width: 100, height: 100 },
          mprPlane: coronalPlane,
          segmentationOverlay: {
            regions: [
              {
                regionId: 'r1',
                visible: true,
                rect: null,
                sampleRevision: 1,
                samples: {
                  points: [25, 50, 500, 26, 50, 500, 27, 50, 500],
                  totalCount: 3,
                  sampledCount: 3
                }
              }
            ]
          }
        }
      })
      const overlay = prepareOverlayElement(wrapper)
      await wrapper.vm.$nextTick()
      await wrapper.vm.$nextTick()
      flushRaf()
      stableClearRect.mockClear()
      activeClearRect.mockClear()

      wrapper.find('svg rect').element.dispatchEvent(createPointerEvent('pointerdown', 20, 20))
      await wrapper.vm.$nextTick()
      await wrapper.vm.$nextTick()
      flushRaf()
      stableClearRect.mockClear()
      activeClearRect.mockClear()

      overlay.dispatchEvent(createPointerEvent('pointermove', 70, 70))
      await wrapper.vm.$nextTick()
      await wrapper.vm.$nextTick()
      flushRaf()

      expect(stableClearRect).not.toHaveBeenCalled()
      expect(activeClearRect).toHaveBeenCalled()
    } finally {
      getContext.mockRestore()
      requestAnimationFrame.mockRestore()
    }
  })

  it('renders multiple VOI projections but only exposes handles for the selected one', () => {
    const wrapper = mount(ViewportVoiOverlay, {
      props: {
        activeOperation: 'segmentation:voi',
        editable: true,
        isActive: true,
        viewportKey: 'mpr-cor',
        config: createVoiConfig(true, true),
        imageFrame: { left: 0, top: 0, width: 160, height: 120 },
        mprPlane: coronalPlane
      }
    })

    expect(wrapper.findAll('ellipse')).toHaveLength(2)
    expect(wrapper.findAll('circle')).toHaveLength(4)
    expect(wrapper.find('ellipse[data-voi-id="v2"]').attributes('stroke')).toBe('#22d3ee')
    expect(wrapper.find('ellipse[data-voi-id="v1"]').attributes('stroke')).toBe('#22d3ee')
  })

  it('finishes a newly drawn VOI without leaving it selected', async () => {
    const wrapper = mount(ViewportVoiOverlay, {
      props: {
        activeOperation: 'segmentation:voi',
        editable: true,
        isActive: true,
        viewportKey: 'mpr-cor',
        config: createEmptyConfig(),
        imageFrame: { left: 0, top: 0, width: 100, height: 100 },
        mprPlane: coronalPlane
      }
    })
    const overlay = prepareOverlayElement(wrapper)
    const background = wrapper.find('svg rect').element

    background.dispatchEvent(createPointerEvent('pointerdown', 50, 50))
    overlay.dispatchEvent(createPointerEvent('pointermove', 62, 50))
    overlay.dispatchEvent(createPointerEvent('pointerup', 62, 50))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('configChange')?.at(-1)).toEqual([
      expect.objectContaining({
        selectedVoi: false,
        selectedVoiId: null,
        voiSpheres: [
          expect.objectContaining({
            id: expect.stringContaining('voi-')
          })
        ]
      }),
      'end'
    ])
  })

  it.each([
    [`${STACK_OPERATION_PREFIX}segmentation:threshold`, 'threshold'],
    [`${STACK_OPERATION_PREFIX}segmentation:voi`, 'voi']
  ])('creates segmentation geometry with %s', async (activeOperation, kind) => {
    const wrapper = mount(ViewportVoiOverlay, {
      props: {
        activeOperation,
        editable: true,
        isActive: true,
        viewportKey: 'mpr-cor',
        config: createEmptyConfig(),
        imageFrame: { left: 0, top: 0, width: 100, height: 100 },
        mprPlane: coronalPlane
      }
    })
    const overlay = prepareOverlayElement(wrapper)
    const background = wrapper.find('svg rect').element
    const [startX, startY]: [number, number] = kind === 'threshold' ? [20, 20] : [50, 50]
    const [endX, endY]: [number, number] = kind === 'threshold' ? [70, 70] : [62, 50]

    background.dispatchEvent(createPointerEvent('pointerdown', startX, startY))
    overlay.dispatchEvent(createPointerEvent('pointermove', endX, endY))
    overlay.dispatchEvent(createPointerEvent('pointerup', endX, endY))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('configChange')?.at(-1)?.[0]).toEqual(expect.objectContaining(
      kind === 'threshold'
        ? { thresholdRegions: [expect.objectContaining({ id: expect.stringContaining('threshold-') })] }
        : { voiSpheres: [expect.objectContaining({ id: expect.stringContaining('voi-') })] }
    ))
  })

  it('uses the provided default colors when creating threshold and VOI items', async () => {
    const thresholdWrapper = mount(ViewportVoiOverlay, {
      props: {
        activeOperation: 'segmentation:threshold',
        defaultThresholdColor: '#00ff00',
        editable: true,
        isActive: true,
        viewportKey: 'mpr-cor',
        config: createEmptyConfig(),
        imageFrame: { left: 0, top: 0, width: 100, height: 100 },
        mprPlane: coronalPlane
      }
    })
    const thresholdOverlay = prepareOverlayElement(thresholdWrapper)
    thresholdWrapper.find('svg rect').element.dispatchEvent(createPointerEvent('pointerdown', 20, 20))
    thresholdOverlay.dispatchEvent(createPointerEvent('pointermove', 70, 70))
    thresholdOverlay.dispatchEvent(createPointerEvent('pointerup', 70, 70))
    await thresholdWrapper.vm.$nextTick()

    expect(thresholdWrapper.emitted('configChange')?.at(-1)).toEqual([
      expect.objectContaining({
        thresholdRegions: [
          expect.objectContaining({
            color: '#00ff00',
            label: ''
          })
        ]
      }),
      'end'
    ])

    const voiWrapper = mount(ViewportVoiOverlay, {
      props: {
        activeOperation: 'segmentation:voi',
        defaultVoiColor: '#ffcc00',
        editable: true,
        isActive: true,
        viewportKey: 'mpr-cor',
        config: createEmptyConfig(),
        imageFrame: { left: 0, top: 0, width: 100, height: 100 },
        mprPlane: coronalPlane
      }
    })
    const voiOverlay = prepareOverlayElement(voiWrapper)
    voiWrapper.find('svg rect').element.dispatchEvent(createPointerEvent('pointerdown', 50, 50))
    voiOverlay.dispatchEvent(createPointerEvent('pointermove', 62, 50))
    voiOverlay.dispatchEvent(createPointerEvent('pointerup', 62, 50))
    await voiWrapper.vm.$nextTick()

    expect(voiWrapper.emitted('configChange')?.at(-1)).toEqual([
      expect.objectContaining({
        voiSpheres: [
          expect.objectContaining({
            color: '#ffcc00',
            label: ''
          })
        ]
      }),
      'end'
    ])
  })

  it('blocks creating a threshold rectangle after the maximum count is reached', async () => {
    const config = createEmptyConfig()
    config.thresholdRegions = Array.from({ length: MPR_SEGMENTATION_MAX_THRESHOLD_REGIONS }, (_, index) => ({
      ...createSegmentationConfig().thresholdRegions[0]!,
      id: `r${index + 1}`,
      label: `${index + 1}`
    }))
    const wrapper = mount(ViewportVoiOverlay, {
      props: {
        activeOperation: 'segmentation:threshold',
        editable: true,
        isActive: true,
        viewportKey: 'mpr-cor',
        config,
        imageFrame: { left: 0, top: 0, width: 100, height: 100 },
        mprPlane: coronalPlane
      }
    })
    const overlayPointerDown = vi.fn()
    const overlay = prepareOverlayElement(wrapper)
    overlay.addEventListener('pointerdown', overlayPointerDown)
    const pointerDown = createPointerEvent('pointerdown', 20, 20)
    wrapper.find('svg rect').element.dispatchEvent(pointerDown)
    await wrapper.vm.$nextTick()

    expect(pointerDown.defaultPrevented).toBe(true)
    expect(overlayPointerDown).not.toHaveBeenCalled()
    expect(wrapper.emitted('configChange')).toBeUndefined()
    expect(dispatchWorkspaceStatusToastMock).toHaveBeenCalledWith(expect.stringContaining('10'), 'warning')
  })

  it('finishes threshold editing locally when the maximum count is reached', async () => {
    const config = createEmptyConfig()
    config.thresholdRegions = Array.from({ length: MPR_SEGMENTATION_MAX_THRESHOLD_REGIONS }, (_, index) => ({
      ...createSegmentationConfig().thresholdRegions[0]!,
      id: `r${index + 1}`,
      label: `${index + 1}`
    }))
    config.selectedRegionId = 'r1'
    const wrapper = mount(ViewportVoiOverlay, {
      props: {
        activeOperation: 'segmentation:threshold',
        editable: true,
        isActive: true,
        viewportKey: 'mpr-cor',
        config,
        imageFrame: { left: 0, top: 0, width: 100, height: 100 },
        mprPlane: coronalPlane
      }
    })
    const overlay = prepareOverlayElement(wrapper)
    const background = wrapper.find('svg rect').element

    background.dispatchEvent(createPointerEvent('pointerdown', 20, 20))
    overlay.dispatchEvent(createPointerEvent('pointermove', 45, 45))
    overlay.dispatchEvent(createPointerEvent('pointerup', 45, 45))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('configChange')).toHaveLength(1)
    expect(wrapper.emitted('configChange')?.[0]).toEqual([
      expect.objectContaining({
        selectedRegionId: null,
        selectedVoi: false,
        selectedVoiId: null,
        thresholdRegions: expect.arrayContaining([expect.objectContaining({ id: 'r1' })])
      }),
      'select'
    ])
    expect(dispatchWorkspaceStatusToastMock).toHaveBeenCalledWith(expect.stringContaining('10'), 'warning')
  })

  it('blocks creating a VOI after the maximum count is reached', async () => {
    const firstSphere = createVoiConfig(false).voiSpheres[0]!
    const config = createEmptyConfig()
    config.voiSpheres = Array.from({ length: MPR_SEGMENTATION_MAX_VOI_SPHERES }, (_, index) => ({
      ...firstSphere,
      id: `v${index + 1}`,
      label: `${index + 1}`
    }))
    config.voiSphere = config.voiSpheres[0] ?? null
    const wrapper = mount(ViewportVoiOverlay, {
      props: {
        activeOperation: 'segmentation:voi',
        editable: true,
        isActive: true,
        viewportKey: 'mpr-cor',
        config,
        imageFrame: { left: 0, top: 0, width: 100, height: 100 },
        mprPlane: coronalPlane
      }
    })
    const overlayPointerDown = vi.fn()
    const overlay = prepareOverlayElement(wrapper)
    overlay.addEventListener('pointerdown', overlayPointerDown)

    const pointerDown = createPointerEvent('pointerdown', 50, 50)
    wrapper.find('svg rect').element.dispatchEvent(pointerDown)
    await wrapper.vm.$nextTick()

    expect(pointerDown.defaultPrevented).toBe(true)
    expect(overlayPointerDown).not.toHaveBeenCalled()
    expect(wrapper.emitted('configChange')).toBeUndefined()
    expect(dispatchWorkspaceStatusToastMock).toHaveBeenCalledWith(expect.stringContaining('10'), 'warning')
  })

  it('removes a newly drawn VOI when it is below the minimum radius', async () => {
    const wrapper = mount(ViewportVoiOverlay, {
      props: {
        activeOperation: 'segmentation:voi',
        editable: true,
        isActive: true,
        viewportKey: 'mpr-cor',
        config: createEmptyConfig(),
        imageFrame: { left: 0, top: 0, width: 100, height: 100 },
        mprPlane: coronalPlane
      }
    })
    const overlay = prepareOverlayElement(wrapper)
    const background = wrapper.find('svg rect').element

    background.dispatchEvent(createPointerEvent('pointerdown', 50, 50))
    overlay.dispatchEvent(createPointerEvent('pointermove', 52, 50))
    overlay.dispatchEvent(createPointerEvent('pointerup', 52, 50))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('configChange')?.at(-1)).toEqual([
      expect.objectContaining({
        selectedVoi: false,
        selectedVoiId: null,
        voiSpheres: []
      }),
      'end'
    ])
  })

  it('finishes threshold editing locally on a blank click without recalculating samples', async () => {
    const wrapper = mount(ViewportVoiOverlay, {
      props: {
        activeOperation: 'segmentation:threshold',
        editable: true,
        isActive: true,
        viewportKey: 'mpr-cor',
        config: {
          ...createMixedConfig(),
          selectedRegionId: 'r1',
          selectedVoi: false,
          selectedVoiId: null
        },
        imageFrame: { left: 0, top: 0, width: 100, height: 100 },
        mprPlane: coronalPlane
      }
    })
    const overlay = prepareOverlayElement(wrapper)
    const background = wrapper.find('svg rect').element

    background.dispatchEvent(createPointerEvent('pointerdown', 20, 20))
    overlay.dispatchEvent(createPointerEvent('pointerup', 20, 20))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('configChange')?.at(-1)).toEqual([
      expect.objectContaining({
        selectedRegionId: null,
        selectedVoi: false,
        selectedVoiId: null
      }),
      'select'
    ])
    expect(wrapper.emitted('configChange')?.some((event) => event[1] === 'end')).toBe(false)
  })

  it('finishes VOI editing locally on a blank click without recalculating samples', async () => {
    const wrapper = mount(ViewportVoiOverlay, {
      props: {
        activeOperation: 'segmentation:voi',
        editable: true,
        isActive: true,
        viewportKey: 'mpr-cor',
        config: createVoiConfig(true),
        imageFrame: { left: 0, top: 0, width: 100, height: 100 },
        mprPlane: coronalPlane
      }
    })
    const overlay = prepareOverlayElement(wrapper)
    const background = wrapper.find('svg rect').element

    background.dispatchEvent(createPointerEvent('pointerdown', 20, 20))
    overlay.dispatchEvent(createPointerEvent('pointerup', 20, 20))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('configChange')?.at(-1)).toEqual([
      expect.objectContaining({
        selectedRegionId: null,
        selectedVoi: false,
        selectedVoiId: null
      }),
      'select'
    ])
    expect(wrapper.emitted('configChange')?.some((event) => event[1] === 'end')).toBe(false)
  })

  it('restores the next VOI selection when a too-small active VOI is removed', async () => {
    const wrapper = mount(ViewportVoiOverlay, {
      props: {
        activeOperation: 'segmentation:voi',
        editable: true,
        isActive: true,
        viewportKey: 'mpr-cor',
        config: createVoiConfig(true),
        imageFrame: { left: 0, top: 0, width: 100, height: 100 },
        mprPlane: coronalPlane
      }
    })
    const overlay = prepareOverlayElement(wrapper)
    const background = wrapper.find('svg rect').element

    background.dispatchEvent(createPointerEvent('pointerdown', 50, 50))
    overlay.dispatchEvent(createPointerEvent('pointermove', 52, 50))
    overlay.dispatchEvent(createPointerEvent('pointerup', 52, 50))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('configChange')?.at(-1)).toEqual([
      expect.objectContaining({
        selectedRegionId: null,
        selectedVoi: true,
        selectedVoiId: 'v1',
        voiSpheres: [
          expect.objectContaining({
            id: 'v1'
          })
        ],
        voiSphere: expect.objectContaining({
          id: 'v1'
        })
      }),
      'end'
    ])
  })

  it('removes a newly drawn threshold rectangle when it is below the minimum size', async () => {
    const wrapper = mount(ViewportVoiOverlay, {
      props: {
        activeOperation: 'segmentation:threshold',
        editable: true,
        isActive: true,
        viewportKey: 'mpr-cor',
        config: createEmptyConfig(),
        imageFrame: { left: 0, top: 0, width: 100, height: 100 },
        mprPlane: coronalPlane
      }
    })
    const overlay = prepareOverlayElement(wrapper)
    const background = wrapper.find('svg rect').element

    background.dispatchEvent(createPointerEvent('pointerdown', 50, 50))
    overlay.dispatchEvent(createPointerEvent('pointermove', 54, 50))
    overlay.dispatchEvent(createPointerEvent('pointerup', 54, 50))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('configChange')?.at(-1)).toEqual([
      expect.objectContaining({
        selectedRegionId: null,
        thresholdRegions: []
      }),
      'end'
    ])
  })

  it('selects an overlapping threshold rectangle before allowing source-viewport edits', async () => {
    const wrapper = mount(ViewportVoiOverlay, {
      props: {
        activeOperation: 'segmentation:threshold',
        editable: true,
        isActive: true,
        viewportKey: 'mpr-cor',
        config: createMixedConfig(),
        imageFrame: { left: 0, top: 0, width: 100, height: 100 },
        mprPlane: coronalPlane
      }
    })
    prepareOverlayElement(wrapper)

    const thresholdRect = wrapper.find('rect[data-region-id="r1"]')
    expect(thresholdRect.exists()).toBe(true)
    thresholdRect.element.dispatchEvent(createPointerEvent('pointerdown', 50, 50))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('modeChange')?.at(-1)).toEqual(['segmentation:threshold', 'mpr-cor'])
    expect(wrapper.emitted('configChange')?.at(-1)).toEqual([
      expect.objectContaining({
        selectedRegionId: 'r1',
        selectedVoi: false,
        selectedVoiId: null
      }),
      'select'
    ])
  })

  it('activates threshold mode when an existing rectangle is hit from another operation', async () => {
    const wrapper = mount(ViewportVoiOverlay, {
      props: {
        activeOperation: `${STACK_OPERATION_PREFIX}segmentation:voi`,
        editable: true,
        isActive: true,
        viewportKey: 'mpr-cor',
        config: createMixedConfig(),
        imageFrame: { left: 0, top: 0, width: 100, height: 100 },
        mprPlane: coronalPlane
      }
    })
    prepareOverlayElement(wrapper)

    const thresholdRect = wrapper.find('rect[data-region-id="r1"]')
    expect(thresholdRect.exists()).toBe(true)
    thresholdRect.element.dispatchEvent(createPointerEvent('pointerdown', 50, 50))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('modeChange')?.at(-1)).toEqual(['segmentation:threshold', 'mpr-cor'])
    expect(wrapper.emitted('configChange')?.at(-1)).toEqual([
      expect.objectContaining({
        selectedRegionId: 'r1',
        selectedVoi: false,
        selectedVoiId: null
      }),
      'select'
    ])
  })

  it('activates VOI mode when an existing sphere is hit from another operation', async () => {
    const wrapper = mount(ViewportVoiOverlay, {
      props: {
        activeOperation: `${STACK_OPERATION_PREFIX}segmentation:threshold`,
        editable: true,
        isActive: true,
        viewportKey: 'mpr-cor',
        config: createVoiConfig(false),
        imageFrame: { left: 0, top: 0, width: 100, height: 100 },
        mprPlane: coronalPlane
      }
    })
    prepareOverlayElement(wrapper)

    const sphere = wrapper.find('ellipse[data-voi-id="v1"]')
    expect(sphere.exists()).toBe(true)
    sphere.element.dispatchEvent(createPointerEvent('pointerdown', 50, 50))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('modeChange')?.at(-1)).toEqual(['segmentation:voi'])
    expect(wrapper.emitted('configChange')?.at(-1)).toEqual([
      expect.objectContaining({
        selectedRegionId: null,
        selectedVoi: true,
        selectedVoiId: 'v1'
      }),
      'select'
    ])
  })

  it('does not trigger backend recalculation when activating a threshold rectangle for dragging', async () => {
    const wrapper = mount(ViewportVoiOverlay, {
      props: {
        activeOperation: 'segmentation:threshold',
        editable: true,
        isActive: true,
        viewportKey: 'mpr-cor',
        config: {
          ...createMixedConfig(),
          selectedRegionId: 'r1',
          selectedVoi: false,
          selectedVoiId: null
        },
        imageFrame: { left: 0, top: 0, width: 100, height: 100 },
        mprPlane: coronalPlane
      }
    })
    prepareOverlayElement(wrapper)

    const thresholdRect = wrapper.find('rect[data-region-id="r1"]')
    expect(thresholdRect.exists()).toBe(true)
    thresholdRect.element.dispatchEvent(createPointerEvent('pointerdown', 50, 50))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('configChange')?.[0]).toEqual([
      expect.objectContaining({
        selectedRegionId: 'r1',
        selectedVoi: false,
        selectedVoiId: null
      }),
      'select'
    ])
  })
})
