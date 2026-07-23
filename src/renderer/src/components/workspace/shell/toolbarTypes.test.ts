import { describe, expect, it } from 'vitest'
import {
  isStackToolOptionSelected,
  resolveStackToolOptionSelectionMode,
  usesStackToolOptionDangerTone,
  type StackTool,
  type StackToolOption
} from './toolbarTypes'

const option = (value: string, checked?: boolean): StackToolOption => ({
  value,
  label: value,
  checked
})

describe('toolbar option selection semantics', () => {
  it('uses one selected value for single-choice tools', () => {
    const tool: StackTool = { key: 'window', label: 'Window', icon: 'window', optionSelectionMode: 'single' }

    expect(isStackToolOptionSelected(tool, option('lung'), 'lung')).toBe(true)
    expect(isStackToolOptionSelected(tool, option('bone', true), 'lung')).toBe(false)
  })

  it('uses checked state for multiple-choice tools', () => {
    const tool: StackTool = { key: 'display', label: 'Display', icon: 'eye', optionSelectionMode: 'multiple' }

    expect(isStackToolOptionSelected(tool, option('corner', true), 'scale')).toBe(true)
    expect(isStackToolOptionSelected(tool, option('scale', false), 'scale')).toBe(false)
  })

  it('never persists selection for immediate actions', () => {
    const tool: StackTool = { key: 'reset', label: 'Reset', icon: 'reset', optionSelectionMode: 'none' }

    expect(isStackToolOptionSelected(tool, option('reset:all', true), 'reset:all')).toBe(false)
  })

  it('uses the authoritative checked orientation so oblique mode cannot select two faces', () => {
    const tool: StackTool = { key: 'volumeOrientation', label: 'Orientation', icon: 'orientation', optionSelectionMode: 'single' }
    const orientations = [option('volumeOrientation:A', false), option('volumeOrientation:P', true)]

    expect(orientations.filter((item) => isStackToolOptionSelected(tool, item, 'volumeOrientation:A'))).toEqual([
      orientations[1]
    ])
  })

  it('keeps compatibility defaults for legacy tool definitions', () => {
    expect(resolveStackToolOptionSelectionMode({ key: 'compareSync', label: 'Sync', icon: 'sync' })).toBe('multiple')
    expect(resolveStackToolOptionSelectionMode({ key: 'export', label: 'Export', icon: 'export' })).toBe('none')
    expect(resolveStackToolOptionSelectionMode({ key: 'window', label: 'Window', icon: 'window' })).toBe('single')
  })

  it('uses one danger tone for reset, clear, and delete actions', () => {
    for (const value of ['reset:view', 'window:reset', 'clear:measurements', 'delete:preset']) {
      expect(usesStackToolOptionDangerTone(option(value))).toBe(true)
    }

    expect(usesStackToolOptionDangerTone(option('measure:line'))).toBe(false)
  })
})
