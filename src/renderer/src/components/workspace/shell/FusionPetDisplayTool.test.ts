import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import FusionPetDisplayTool from './FusionPetDisplayTool.vue'
import { DEFAULT_FUSION_PET_WINDOW_MAX, DEFAULT_FUSION_PET_WINDOW_MIN } from '../../../constants/pseudocolor'
import type { ViewerTabItem } from '../../../types/viewer'

vi.mock('vuetify/components', () => ({
  VBtn: {
    name: 'VBtn',
    props: {
      disabled: Boolean,
      title: String
    },
    template: `
      <button type="button" :disabled="disabled" :title="title">
        <span class="v-btn__content">
          <slot />
        </span>
      </button>
    `
  },
  VMenu: {
    name: 'VMenu',
    template: `
      <div class="v-menu-stub">
        <slot name="activator" :props="{}" />
        <slot />
      </div>
    `
  }
}))

function createFusionTab(
  petWindowMax = DEFAULT_FUSION_PET_WINDOW_MAX,
  petWindowMin = DEFAULT_FUSION_PET_WINDOW_MIN
): ViewerTabItem {
  return {
    key: 'fusion:ct:pet',
    seriesId: 'ct',
    seriesTitle: 'CT',
    title: 'CT + PET',
    viewType: 'PETCTFusion',
    viewId: '',
    imageSrc: '',
    sliceLabel: '',
    windowLabel: '',
    cornerInfo: { topLeft: [], topRight: [], bottomLeft: [], bottomRight: [] },
    orientation: { top: null, right: null, bottom: null, left: null, volumeQuaternion: null },
    transformState: { rotationDegrees: 0, horFlip: false, verFlip: false },
    pseudocolorPreset: 'bw',
    petInfo: {
      seriesId: 'pet',
      petUnit: 'SUVbw',
      petUnitLabel: 'g/ml (SUVbw)',
      petWindowMin,
      petWindowMax,
      pseudocolorPreset: 'hotmetal',
      unitOptions: [
        { unit: 'source', label: 'Source (BQML)', available: true },
        { unit: 'kBqml', label: 'kBq/ml', available: true },
        { unit: 'SUVbw', label: 'g/ml (SUVbw)', available: true }
      ]
    },
    fusionInfo: {
      paneRole: 'fusion-overlay-ax',
      ctSeriesId: 'ct',
      petSeriesId: 'pet',
      petPseudocolorPreset: 'petct-rainbow',
      petUnit: 'SUVbw',
      petUnitLabel: 'g/ml (SUVbw)',
      petWindowMin,
      petWindowMax,
      alpha: 0.52,
      revision: 1,
      registration: {
        translateRowMm: 0,
        translateColMm: 0,
        rotationDegrees: 0,
        saved: false
      }
    }
  } as ViewerTabItem
}

function createPetTab(): ViewerTabItem {
  return {
    ...createFusionTab(),
    key: 'pet-tab',
    seriesId: 'pet',
    seriesTitle: 'PET FDG SUV',
    title: 'PET FDG SUV · PET',
    viewType: 'PET',
    fusionInfo: null,
    petInfo: {
      seriesId: 'pet',
      petUnit: 'SUVbw',
      petUnitLabel: 'g/ml (SUVbw)',
      petWindowMin: 0,
      petWindowMax: 8,
      pseudocolorPreset: 'bwinverse',
      unitOptions: [
        { unit: 'source', label: 'Source (BQML)', available: true },
        { unit: 'kBqml', label: 'kBq/ml', available: true },
        { unit: 'SUVbw', label: 'g/ml (SUVbw)', available: true }
      ]
    }
  } as ViewerTabItem
}

describe('FusionPetDisplayTool', () => {
  it('emits fusion-specific PET display selections', async () => {
    vi.useFakeTimers()
    const wrapper = mount(FusionPetDisplayTool, {
      props: {
        activeTab: createFusionTab()
      }
    })

    expect(wrapper.find<HTMLInputElement>('input[type="range"]').element.value).toBe(
      String(DEFAULT_FUSION_PET_WINDOW_MAX)
    )
    expect(wrapper.findAll('.fusion-pet-display-tool__dropdown-button')).toHaveLength(2)
    expect(wrapper.find('.fusion-pet-display-tool__dropdown-button--range').exists()).toBe(true)
    const unitButton = wrapper.find('.fusion-pet-display-tool__dropdown-button--unit')
    expect(unitButton.exists()).toBe(true)
    expect(unitButton.attributes('title')).toBe('g/ml (SUVbw)')
    expect(wrapper.find('.fusion-pet-display-tool__unit-label').text()).toBe('g/ml (SUVbw)')
    expect(wrapper.find<HTMLInputElement>('.fusion-pet-display-tool__range-max-input').element.value).toBe('30')
    const unitOption = wrapper
      .findAll<HTMLButtonElement>('.fusion-pet-display-tool__unit-option')
      .find((button) => button.text().includes('kBq/ml'))
    expect(unitOption).toBeTruthy()
    await unitOption?.trigger('click')
    const slider = wrapper.find('input[type="range"]')
    await slider.setValue('12.5')
    vi.advanceTimersByTime(90)

    expect(wrapper.emitted('select')).toEqual([
      ['fusionPetUnit:kBqml'],
      ['fusionPetWindow:0:12.5']
    ])

    wrapper.unmount()
    vi.useRealTimers()
  })

  it('emits standalone PET display selections with petConfig prefixes', async () => {
    vi.useFakeTimers()
    const wrapper = mount(FusionPetDisplayTool, {
      props: {
        activeTab: createPetTab()
      }
    })

    expect(wrapper.find('.fusion-pet-display-tool__range-track').attributes('style')).toContain('rgb(255 255 255)')
    const unitOption = wrapper
      .findAll<HTMLButtonElement>('.fusion-pet-display-tool__unit-option')
      .find((button) => button.text().includes('kBq/ml'))
    await unitOption?.trigger('click')
    const slider = wrapper.find('input[type="range"]')
    await slider.setValue('6')
    vi.advanceTimersByTime(90)

    expect(wrapper.emitted('select')).toEqual([
      ['petUnit:kBqml'],
      ['petWindow:0:6']
    ])

    wrapper.unmount()
    vi.useRealTimers()
  })

  it('switches the PET range immediately when the optimistic unit state changes', async () => {
    const tab = createPetTab()
    tab.petInfo = {
      ...tab.petInfo!,
      autoWindowMax: 8,
      controlWindowMax: 40,
      unitOptions: [
        {
          unit: 'source',
          label: 'Source (BQML)',
          available: true,
          autoWindowMin: 0,
          autoWindowMax: 800_000,
          controlWindowMax: 1_000_000
        },
        {
          unit: 'SUVbw',
          label: 'g/ml (SUVbw)',
          available: true,
          autoWindowMin: 0,
          autoWindowMax: 8,
          controlWindowMax: 40
        }
      ]
    }
    const wrapper = mount(FusionPetDisplayTool, {
      props: { activeTab: tab }
    })

    await wrapper.setProps({
      activeTab: {
        ...tab,
        petInfo: {
          ...tab.petInfo!,
          petUnit: 'source',
          petUnitLabel: 'Source (BQML)',
          petWindowMin: 0,
          petWindowMax: 800_000,
          autoWindowMin: 0,
          autoWindowMax: 800_000,
          controlWindowMax: 1_000_000
        }
      }
    })
    await nextTick()

    expect(wrapper.find<HTMLInputElement>('input[type="range"]').element.value).toBe('800000')
    expect(wrapper.find<HTMLInputElement>('input[type="range"]').attributes('max')).toBe('1000000')
  })

  it('keeps unavailable quantitative units disabled with the backend reason', async () => {
    const tab = createPetTab()
    tab.petInfo = {
      ...tab.petInfo!,
      unitOptions: [
        { unit: 'source', label: 'Source (BQML)', available: true },
        {
          unit: 'SUL',
          label: 'g/ml (SUL)',
          available: false,
          reason: 'Requires sex, height and weight'
        }
      ]
    }
    const wrapper = mount(FusionPetDisplayTool, {
      props: { activeTab: tab }
    })

    const unavailableOption = wrapper
      .findAll<HTMLButtonElement>('.fusion-pet-display-tool__unit-option')
      .find((button) => button.text().includes('SUL'))
    expect(unavailableOption?.attributes('disabled')).toBeDefined()
    expect(unavailableOption?.attributes('title')).toBe('Requires sex, height and weight')
    await unavailableOption?.trigger('click')
    expect(wrapper.emitted('select')).toBeUndefined()
  })

  it('uses a data-derived range instead of SUV quick limits for source activity values', () => {
    const tab = createPetTab()
    tab.petInfo = {
      ...tab.petInfo!,
      petUnit: 'source',
      petUnitLabel: 'Source (BQML)',
      petWindowMax: 65_535,
      autoWindowMax: 65_535,
      unitOptions: [
        { unit: 'source', label: 'Source (BQML)', available: true }
      ]
    }
    const wrapper = mount(FusionPetDisplayTool, {
      props: { activeTab: tab }
    })

    expect(wrapper.find<HTMLInputElement>('.fusion-pet-display-tool__range-max-input').element.value).toBe('100000')
    expect(
      wrapper.findAll('.fusion-pet-display-tool__range-option').map((option) => option.text())
    ).toEqual(['50000', '100000', '200000', '500000'])
  })

  it('debounces typed PET range maximum changes before rescaling the current value', async () => {
    vi.useFakeTimers()
    const wrapper = mount(FusionPetDisplayTool, {
      props: {
        activeTab: createFusionTab(15)
      }
    })

    const maxInput = wrapper.find<HTMLInputElement>('.fusion-pet-display-tool__range-max-input')
    maxInput.element.value = '60'
    await maxInput.trigger('input')

    expect(wrapper.find<HTMLInputElement>('input[type="range"]').element.value).toBe('15')
    vi.advanceTimersByTime(360)
    await nextTick()
    expect(wrapper.find<HTMLInputElement>('input[type="range"]').element.value).toBe('30')
    expect(wrapper.emitted('select')).toEqual([['fusionPetWindow:0:30']])

    wrapper.unmount()
    vi.useRealTimers()
  })

  it('applies committed PET range maximum immediately', async () => {
    const wrapper = mount(FusionPetDisplayTool, {
      props: {
        activeTab: createFusionTab(4.5)
      }
    })

    const option = wrapper
      .findAll<HTMLButtonElement>('.fusion-pet-display-tool__range-option')
      .find((button) => button.text() === '10')
    expect(option).toBeTruthy()
    await option?.trigger('click')

    expect(wrapper.find<HTMLInputElement>('input[type="range"]').element.value).toBe('1.5')
    expect(wrapper.emitted('select')).toEqual([['fusionPetWindow:0:1.5']])

    wrapper.unmount()
  })

  it('does not expand the PET range from a non-PET backend window value', async () => {
    const wrapper = mount(FusionPetDisplayTool, {
      props: {
        activeTab: createFusionTab(4.5)
      }
    })

    await wrapper.setProps({ activeTab: createFusionTab(240, -160) })

    expect(wrapper.find<HTMLInputElement>('input[type="range"]').element.value).toBe(
      String(DEFAULT_FUSION_PET_WINDOW_MAX)
    )
    expect(wrapper.find<HTMLInputElement>('.fusion-pet-display-tool__range-max-input').element.value).toBe('30')

    wrapper.unmount()
  })

  it('does not initialize from a leaked CT window range', () => {
    const wrapper = mount(FusionPetDisplayTool, {
      props: {
        activeTab: createFusionTab(240, -160)
      }
    })

    expect(wrapper.find<HTMLInputElement>('input[type="range"]').element.value).toBe(
      String(DEFAULT_FUSION_PET_WINDOW_MAX)
    )
    expect(wrapper.find<HTMLInputElement>('.fusion-pet-display-tool__range-max-input').element.value).toBe('30')

    wrapper.unmount()
  })

  it('falls back to the default range maximum for invalid typed PET limits', async () => {
    const wrapper = mount(FusionPetDisplayTool, {
      props: {
        activeTab: createFusionTab(8)
      }
    })

    const maxInput = wrapper.find<HTMLInputElement>('.fusion-pet-display-tool__range-max-input')
    await maxInput.setValue('1000000000001')
    await maxInput.trigger('change')
    await nextTick()
    expect(wrapper.find<HTMLInputElement>('.fusion-pet-display-tool__range-max-input').element.value).toBe('30')
    expect(wrapper.find<HTMLInputElement>('input[type="range"]').element.max).toBe('30')
    expect(wrapper.emitted('select')?.at(-1)).toEqual(['fusionPetWindow:0:8'])

    const updatedMaxInput = wrapper.find<HTMLInputElement>('.fusion-pet-display-tool__range-max-input')
    await updatedMaxInput.setValue('abc')
    await updatedMaxInput.trigger('change')
    await nextTick()
    expect(wrapper.find<HTMLInputElement>('.fusion-pet-display-tool__range-max-input').element.value).toBe('30')
    expect(wrapper.find<HTMLInputElement>('input[type="range"]').element.max).toBe('30')

    wrapper.unmount()
  })
})
