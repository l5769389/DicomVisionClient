import { describe, expect, it } from 'vitest'
import type { HangingProtocolRule } from '../../ui/useUiPreferences'
import type { FolderSeriesItem } from '../../../types/viewer'
import {
  createLayoutTemplateFromHangingProtocolRule,
  findMatchingHangingProtocolRule
} from './hangingProtocolRules'

function createRule(overrides: Partial<HangingProtocolRule>): HangingProtocolRule {
  return {
    id: 'rule-a',
    name: 'Rule A',
    enabled: true,
    modality: 'CT',
    seriesDescriptionKeyword: 'CHEST',
    rows: 1,
    columns: 2,
    ...overrides
  }
}

function createSeries(overrides: Partial<FolderSeriesItem>): FolderSeriesItem {
  return {
    folderPath: '',
    instanceCount: 20,
    seriesId: 'series-a',
    thumbnailSrc: '',
    thumbnailUrl: '',
    modality: 'CT',
    seriesDescription: 'Chest Lung',
    ...overrides
  } as FolderSeriesItem
}

describe('hangingProtocolRules', () => {
  it('matches the first enabled rule by modality and description keyword', () => {
    const rules = [
      createRule({ id: 'disabled', enabled: false, modality: 'CT', seriesDescriptionKeyword: 'CHEST' }),
      createRule({ id: 'matched', modality: 'ct', seriesDescriptionKeyword: 'lung' })
    ]

    expect(findMatchingHangingProtocolRule(rules, createSeries({}))?.id).toBe('matched')
  })

  it('allows ALL modality and empty keyword rules', () => {
    const rule = createRule({ id: 'fallback', modality: 'ALL', seriesDescriptionKeyword: '', rows: 2, columns: 2 })

    expect(findMatchingHangingProtocolRule([rule], createSeries({ modality: 'MR', seriesDescription: 'Brain' }))?.id).toBe('fallback')
  })

  it('creates a layout template from a matched rule', () => {
    const template = createLayoutTemplateFromHangingProtocolRule(
      createRule({ id: 'rule-layout', name: 'Chest Compare', rows: 2, columns: 3 })
    )

    expect(template).toMatchObject({
      key: 'hanging:rule-layout',
      label: 'Chest Compare',
      rows: 2,
      columns: 3
    })
    expect(template.slots).toHaveLength(6)
  })
})
