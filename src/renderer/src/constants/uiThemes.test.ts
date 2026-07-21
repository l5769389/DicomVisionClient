import { describe, expect, it } from 'vitest'
import { UI_THEME_PRESETS } from './uiThemes'

describe('UI theme catalog', () => {
  it('keeps one complete localized catalog for desktop and mobile settings', () => {
    expect(UI_THEME_PRESETS.map((theme) => theme.id)).toEqual([
      'industrial-utility',
      'aurora',
      'clinical-light'
    ])

    for (const theme of UI_THEME_PRESETS) {
      expect(theme.labelZh).not.toBe('')
      expect(theme.labelEn).not.toBe('')
      expect(theme.summaryZh).not.toBe('')
      expect(theme.summaryEn).not.toBe('')
      expect(theme.toneZh).not.toBe('')
      expect(theme.toneEn).not.toBe('')
      expect(theme.preview).toContain('gradient')
      expect(theme.mobile.rail).toContain('gradient')
    }
  })

  it('keeps mobile previews aligned with three distinct theme roles', () => {
    const mobilePalettes = UI_THEME_PRESETS.map((theme) => theme.mobile)

    expect(new Set(mobilePalettes.map((theme) => theme.panel)).size).toBe(3)
    expect(new Set(mobilePalettes.map((theme) => theme.surface)).size).toBe(3)
    expect(UI_THEME_PRESETS.find((theme) => theme.id === 'clinical-light')?.mobile.panel).toBe('#f7fafc')
    expect(UI_THEME_PRESETS.find((theme) => theme.id === 'industrial-utility')?.mobile.panel).toBe('#151c22')
    expect(UI_THEME_PRESETS.find((theme) => theme.id === 'aurora')?.mobile.panel).toBe('#0a121c')
  })
})
