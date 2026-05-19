import { describe, expect, it } from 'vitest'
import type { DicomTagItem } from '../../types/viewer'
import {
  createDicomTagEditInputValue,
  serializeDicomTagEditValue,
  validateDicomTagEditValue
} from './dicomTagVrEdit'

function createTag(vr: string, value = ''): DicomTagItem {
  return {
    tag: '(0010,0010)',
    keyword: 'Demo',
    name: 'Demo',
    vr,
    value,
    depth: 0,
    tagPath: ['00100010']
  }
}

describe('dicomTagVrEdit', () => {
  it('converts DA values between DICOM and HTML date formats', () => {
    expect(createDicomTagEditInputValue(createTag('DA', '20260519'))).toBe('2026-05-19')
    expect(serializeDicomTagEditValue('DA', '2026-05-19')).toBe('20260519')
    expect(validateDicomTagEditValue(createTag('DA'), '2026-02-30', true)).toContain('DA')
  })

  it('converts TM values between DICOM and HTML time formats', () => {
    expect(createDicomTagEditInputValue(createTag('TM', '103005'))).toBe('10:30:05')
    expect(serializeDicomTagEditValue('TM', '10:30:05')).toBe('103005')
    expect(validateDicomTagEditValue(createTag('TM'), '25:00:00', false)).toContain('TM')
  })

  it('validates numeric and UID VR values', () => {
    expect(validateDicomTagEditValue(createTag('IS'), '12\\-4', false)).toBe('')
    expect(validateDicomTagEditValue(createTag('IS'), '12.5', false)).toContain('IS')
    expect(validateDicomTagEditValue(createTag('DS'), '12.5\\-3', false)).toBe('')
    expect(validateDicomTagEditValue(createTag('UI'), '1.2.826.0.1', false)).toBe('')
    expect(validateDicomTagEditValue(createTag('UI'), '1.2.bad', false)).toContain('UI')
  })

  it('normalizes and validates CS values', () => {
    expect(serializeDicomTagEditValue('CS', ' derived ')).toBe('DERIVED')
    expect(validateDicomTagEditValue(createTag('CS'), 'DERIVED_1', false)).toBe('')
    expect(validateDicomTagEditValue(createTag('CS'), 'bad-value', false)).toContain('CS')
  })
})
