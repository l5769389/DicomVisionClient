export interface UiThemePreset {
  id: 'industrial-utility' | 'aurora' | 'clinical-light'
  labelZh: string
  labelEn: string
  summaryZh: string
  summaryEn: string
  toneZh: string
  toneEn: string
  preview: string
  mobile: {
    accent: string
    panel: string
    rail: string
    surface: string
    text: string
  }
}

export const UI_THEME_PRESETS: readonly UiThemePreset[] = [
  {
    id: 'industrial-utility',
    labelZh: '工业实用风（默认）',
    labelEn: 'Industrial Utility (Default)',
    summaryZh: '深色控制台配色，强调边界、禁用态和高频操作识别。',
    summaryEn: 'Dark console styling with clearer control boundaries, disabled states, and action contrast.',
    toneZh: '深色',
    toneEn: 'Dark',
    preview: 'linear-gradient(135deg,#080b0e 0%,#151c22 42%,#27323a 72%,#6fa9c4 100%)',
    mobile: {
      accent: '#6fa9c4',
      panel: '#151c22',
      rail: 'linear-gradient(90deg,#12181e,#2b3942,#6fa9c4)',
      surface: '#202a31',
      text: '#edf3f7'
    }
  },
  {
    id: 'aurora',
    labelZh: '冷蓝深色',
    labelEn: 'Aurora Dark',
    summaryZh: '深蓝背景配冷蓝高亮，保留原始界面的柔和层次。',
    summaryEn: 'Deep navy surfaces with cool blue highlights and the original softer layering.',
    toneZh: '深色',
    toneEn: 'Dark',
    preview: 'linear-gradient(135deg,#091119 0%,#0d1822 48%,#1d3344 78%,#66d0ff 100%)',
    mobile: {
      accent: '#66d0ff',
      panel: '#0a121c',
      rail: 'linear-gradient(90deg,#0a121c,#243847,#66d0ff)',
      surface: '#182733',
      text: '#edf6fb'
    }
  },
  {
    id: 'clinical-light',
    labelZh: '临床浅色',
    labelEn: 'Clinical Light',
    summaryZh: '浅灰白界面配冷蓝强调，适合明亮环境和演示场景。',
    summaryEn: 'Light gray clinical surfaces with restrained blue accents for bright rooms and demos.',
    toneZh: '浅色',
    toneEn: 'Light',
    preview: 'linear-gradient(135deg,#f8fbfd 0%,#e8eff4 42%,#d5e1e9 72%,#4f8fb8 100%)',
    mobile: {
      accent: '#2f6f97',
      panel: '#f7fafc',
      rail: 'linear-gradient(90deg,#eef4f8,#cadbe6,#2f6f97)',
      surface: '#e0e9f0',
      text: '#1f3347'
    }
  }
]
