import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ViewportVoiOverlay from './ViewportVoiOverlay.vue'
import type { MprPlaneInfo, MprSegmentationConfig } from '../../../types/viewer'

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
            color: '#00ff00'
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
            color: '#ffcc00'
          })
        ]
      }),
      'end'
    ])
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
