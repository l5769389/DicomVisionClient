import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ViewportAnnotationOverlay from './ViewportAnnotationOverlay.vue'
import type { AnnotationOverlay } from '../../../types/viewer'

const annotation: AnnotationOverlay = {
  annotationId: 'annotation-1',
  toolType: 'arrow',
  points: [
    { x: 0.25, y: 0.5 },
    { x: 0.75, y: 0.5 }
  ],
  text: 'A',
  color: '#ffd166',
  size: 'md'
}

const imageFrame = {
  left: 0,
  top: 0,
  width: 200,
  height: 100,
  naturalWidth: 200,
  naturalHeight: 100
}

function mountOverlay() {
  return mount(ViewportAnnotationOverlay, {
    props: {
      annotations: [annotation],
      selectedAnnotationId: annotation.annotationId,
      imageFrame
    },
    global: {
      stubs: {
        AppIcon: { template: '<span />' }
      }
    }
  })
}

describe('ViewportAnnotationOverlay', () => {
  it('renders backend-projected normalized coordinates directly in the image frame', () => {
    const wrapper = mountOverlay()
    const line = wrapper.find('line')

    expect(line.attributes('x1')).toBe('50')
    expect(line.attributes('y1')).toBe('50')
    expect(line.attributes('x2')).toBe('150')
    expect(line.attributes('y2')).toBe('50')
    wrapper.unmount()
  })

  it('keeps stroke and handle size in screen units', () => {
    const wrapper = mountOverlay()
    const line = wrapper.find('line')

    expect(line.attributes('stroke-width')).toBe('2.5')
    expect(wrapper.find('circle').attributes('r')).toBe('4')
    wrapper.unmount()
  })
})
