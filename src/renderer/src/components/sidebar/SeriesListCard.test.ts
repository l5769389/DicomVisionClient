import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import SeriesListCard from './SeriesListCard.vue'
import type { FolderSeriesItem } from '../../types/viewer'

vi.mock('vuetify/components', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    VBtn: defineComponent({
      name: 'VBtn',
      props: ['disabled'],
      emits: ['click'],
      setup(props, { emit, slots }) {
        return () =>
          h(
            'button',
            {
              class: 'v-btn-stub',
              disabled: props.disabled,
              type: 'button',
              onClick: (event: MouseEvent) => emit('click', event)
            },
            slots.default?.()
          )
      }
    }),
    VCard: defineComponent({
      name: 'VCard',
      setup(_, { slots }) {
        return () => h('article', { class: 'v-card-stub' }, slots.default?.())
      }
    })
  }
})

vi.mock('../../composables/ui/useUiLocale', async () => {
  const { computed, ref } = await import('vue')
  return {
    useUiLocale: () => ({
      locale: ref('en-US'),
      t: (key: string) =>
        ({
          seriesActions: 'Series actions',
          unnamedSeries: 'Unnamed series'
        })[key] ?? key,
      viewerCopy: computed(() => ({
        keySliceReviewAction: (count: number) => `${count} key slice(s)`
      }))
    })
  }
})

const globalStubs = {
  AppIcon: {
    props: ['name'],
    template: '<span class="app-icon-stub">{{ name }}</span>'
  },
  VBtn: {
    emits: ['click'],
    template: '<button class="v-btn-stub" type="button" @click="$emit(\'click\', $event)"><slot /></button>'
  },
  VCard: {
    template: '<article class="v-card-stub"><slot /></article>'
  }
}

function createSeries(overrides: Partial<FolderSeriesItem> = {}): FolderSeriesItem {
  return {
    seriesId: 'series-1',
    seriesInstanceUid: '1.2.3.series',
    studyInstanceUid: '1.2.3.study',
    patientId: 'PID',
    patientName: 'Patient',
    studyDate: '20260530',
    studyDescription: 'Study',
    accessionNumber: 'ACC',
    modality: 'CT',
    seriesDescription: 'CT RGB',
    instanceCount: 1,
    width: 512,
    height: 512,
    thumbnailSrc: '',
    thumbnailUrl: '',
    folderPath: '.',
    isImageSeries: true,
    standardObjectType: null,
    preferredViewType: null,
    compatibilityIssues: [
      {
        code: 'missing-pixel-spacing',
        title: 'Missing Pixel Spacing',
        detail: 'No spacing',
        severity: 'warning',
        affectedInstances: 1
      }
    ],
    ...overrides
  }
}

describe('SeriesListCard', () => {
  it('does not show compatibility issue chips in the series list card', () => {
    const wrapper = mount(SeriesListCard, {
      props: {
        keySliceCount: 2,
        selected: false,
        series: createSeries()
      },
      global: {
        stubs: globalStubs
      }
    })

    expect(wrapper.find('.series-key-slice-chip').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Missing Pixel Spacing')

    wrapper.unmount()
  })
})
