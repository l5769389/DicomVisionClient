import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import DockInfoPopover from './DockInfoPopover.vue'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('DockInfoPopover', () => {
  it('opens one anchored explanation at a time and closes on outside click', async () => {
    const wrapper = mount({
      components: { DockInfoPopover },
      template: '<div><DockInfoPopover text="First help" /><DockInfoPopover text="Second help" /></div>'
    }, { attachTo: document.body })

    const triggers = wrapper.findAll('.dock-info-popover__trigger')
    await triggers[0]!.trigger('click')
    expect(document.body.textContent).toContain('First help')

    await triggers[1]!.trigger('click')
    expect(document.body.textContent).not.toContain('First help')
    expect(document.body.textContent).toContain('Second help')

    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(document.body.textContent).not.toContain('Second help')
    wrapper.unmount()
  })

  it('closes on Escape and returns focus to the trigger', async () => {
    const wrapper = mount(DockInfoPopover, {
      props: { text: 'Keyboard help' },
      attachTo: document.body
    })
    const trigger = wrapper.get<HTMLElement>('.dock-info-popover__trigger')
    await trigger.trigger('click')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await wrapper.vm.$nextTick()

    expect(document.body.textContent).not.toContain('Keyboard help')
    expect(document.activeElement).toBe(trigger.element)
    wrapper.unmount()
  })
})
