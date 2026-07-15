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

function mountOverlay(props: Partial<InstanceType<typeof ViewportAnnotationOverlay>['$props']> = {}) {
  return mount(ViewportAnnotationOverlay, {
    props: {
      annotations: [annotation],
      selectedAnnotationId: annotation.annotationId,
      imageFrame,
      ...props
    },
    global: {
      stubs: {
        AppIcon: { template: '<span />' }
      }
    }
  })
}

describe('ViewportAnnotationOverlay', () => {
  it('preserves offscreen arrow geometry instead of clamping endpoints', () => {
    const wrapper = mountOverlay({
      annotations: [
        {
          ...annotation,
          points: [
            { x: -0.2, y: 0.25 },
            { x: 1.3, y: 0.75 }
          ]
        }
      ],
      selectedAnnotationId: null
    })
    const line = wrapper.find('line')

    expect(line.attributes('x1')).toBe('-40')
    expect(line.attributes('y1')).toBe('25')
    expect(line.attributes('x2')).toBe('260')
    expect(line.attributes('y2')).toBe('75')
    wrapper.unmount()
  })

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

  it('shows the annotation editor while a new annotation is active', async () => {
    const draftAnnotation: AnnotationOverlay = {
      ...annotation,
      annotationId: 'draft-annotation',
      text: ''
    }
    const wrapper = mountOverlay({
      annotations: [],
      selectedAnnotationId: draftAnnotation.annotationId,
      draftAnnotation
    })

    const input = wrapper.find('input')
    expect(input.exists()).toBe(true)
    expect(wrapper.find('[data-annotation-ui-root]').exists()).toBe(true)
    expect(wrapper.findAll('button')).toHaveLength(1)

    await input.setValue('Finding')

    expect(wrapper.emitted('updateAnnotationText')?.[0]).toEqual([
      { annotationId: draftAnnotation.annotationId, text: 'Finding' }
    ])
    wrapper.unmount()
  })

  it('keeps actions available when editing an existing annotation through the draft layer', () => {
    const wrapper = mountOverlay({
      draftAnnotation: annotation
    })

    expect(wrapper.find('input').exists()).toBe(true)
    expect(wrapper.findAll('button')).toHaveLength(3)
    wrapper.unmount()
  })
})
