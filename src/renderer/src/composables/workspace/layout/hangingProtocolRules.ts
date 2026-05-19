import type { HangingProtocolRule } from '../../ui/useUiPreferences'
import type { FolderSeriesItem, ViewerLayoutTemplate } from '../../../types/viewer'
import { createUniformLayoutTemplate } from './viewerLayoutTemplates'

export function findMatchingHangingProtocolRule(
  rules: HangingProtocolRule[],
  series: FolderSeriesItem | null | undefined
): HangingProtocolRule | null {
  if (!series) {
    return null
  }

  const modality = normalizeRuleText(series.modality)
  const description = normalizeRuleText(series.seriesDescription)
  return rules.find((rule) => {
    if (!rule.enabled) {
      return false
    }
    const ruleModality = normalizeRuleText(rule.modality)
    if (ruleModality && ruleModality !== 'ALL' && ruleModality !== modality) {
      return false
    }
    const keyword = normalizeRuleText(rule.seriesDescriptionKeyword)
    return !keyword || description.includes(keyword)
  }) ?? null
}

export function createLayoutTemplateFromHangingProtocolRule(rule: HangingProtocolRule): ViewerLayoutTemplate {
  const template = createUniformLayoutTemplate(rule.rows, rule.columns, 'custom')
  return {
    ...template,
    key: `hanging:${rule.id}`,
    label: rule.name || template.label
  }
}

function normalizeRuleText(value: string | null | undefined): string {
  return (value ?? '').trim().toUpperCase()
}
