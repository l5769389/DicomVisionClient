import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { getPseudocolorGradient } from '../../../constants/pseudocolor'
import PseudocolorBand from './PseudocolorBand.vue'

describe('PseudocolorBand', () => {
  it('uses the selected preset gradient for menu options', () => {
    const wrapper = mount(PseudocolorBand, {
      props: { preset: 'rainbow', compact: true }
    })

    expect(wrapper.attributes('style')).toContain(getPseudocolorGradient('rainbow'))
    expect(wrapper.classes()).toContain('w-[30px]')
  })
})
