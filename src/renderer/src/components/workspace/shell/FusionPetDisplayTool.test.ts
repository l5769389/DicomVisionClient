import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import FusionPetDisplayTool from './FusionPetDisplayTool.vue'
import type { ViewerTabItem } from '../../../types/viewer'

vi.mock('vuetify/components', () => ({
  VCombobox: {
    name: 'VCombobox',
    props: {
      disabled: Boolean,
      items: {
        type: Array,
        default: () => []
      },
      modelValue: {
        type: [Number, String],
        default: ''
      }
    },
    emits: ['update:modelValue', 'update:search'],
    template: `
      <div class="v-combobox-stub">
        <input
          class="v-combobox-stub__input"
          :disabled="disabled"
          :value="modelValue"
          @input="$emit('update:search', $event.target.value)"
          @change="$emit('update:modelValue', $event.target.value)"
        />
        <button
          v-for="item in items"
          :key="item"
          class="v-combobox-stub__option"
          type="button"
          @click="$emit('update:modelValue', item)"
        >
          {{ item }}
        </button>
      </div>
    `
  }
}))

function createFusionTab(petWindowMax = 4.5, petWindowMin = 0): ViewerTabItem {
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

describe('FusionPetDisplayTool', () => {
  it('emits fusion-specific PET display selections', async () => {
    vi.useFakeTimers()
    const wrapper = mount(FusionPetDisplayTool, {
      props: {
        activeTab: createFusionTab()
      }
    })

    const selects = wrapper.findAll('select')
    expect(selects).toHaveLength(1)
    expect(wrapper.find<HTMLInputElement>('input[type="range"]').element.value).toBe('4.5')
    expect(wrapper.find<HTMLInputElement>('.v-combobox-stub__input').element.value).toBe('30')
    await selects[0].setValue('kBqml')
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

  it('debounces typed PET range maximum changes before rescaling the current value', async () => {
    vi.useFakeTimers()
    const wrapper = mount(FusionPetDisplayTool, {
      props: {
        activeTab: createFusionTab(15)
      }
    })

    const maxInput = wrapper.find<HTMLInputElement>('.v-combobox-stub__input')
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
      .findAll<HTMLButtonElement>('.v-combobox-stub__option')
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

    expect(wrapper.find<HTMLInputElement>('input[type="range"]').element.value).toBe('4.5')
    expect(wrapper.find<HTMLInputElement>('.v-combobox-stub__input').element.value).toBe('30')

    wrapper.unmount()
  })

  it('does not initialize from a leaked CT window range', () => {
    const wrapper = mount(FusionPetDisplayTool, {
      props: {
        activeTab: createFusionTab(240, -160)
      }
    })

    expect(wrapper.find<HTMLInputElement>('input[type="range"]').element.value).toBe('4.5')
    expect(wrapper.find<HTMLInputElement>('.v-combobox-stub__input').element.value).toBe('30')

    wrapper.unmount()
  })
})
