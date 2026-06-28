export const DEFAULT_PSEUDOCOLOR_PRESET = 'bw'
export const DEFAULT_FUSION_PET_PSEUDOCOLOR_PRESET = 'petct-rainbow'
export const DEFAULT_FUSION_PET_STANDALONE_PSEUDOCOLOR_PRESET = 'bwinverse'
export const DEFAULT_PET_STANDALONE_PSEUDOCOLOR_PRESET = DEFAULT_FUSION_PET_STANDALONE_PSEUDOCOLOR_PRESET
export const DEFAULT_FUSION_PET_WINDOW_MIN = 0
export const DEFAULT_FUSION_PET_WINDOW_MAX = 4.49
export const DEFAULT_PET_RANGE_UPPER_LIMIT = 30
export const MAX_PET_RANGE_UPPER_LIMIT = 999

export const PSEUDOCOLOR_PRESET_OPTIONS = [
  {
    key: 'blackbody',
    label: 'BlackBody',
    gradient: 'linear-gradient(90deg, #000000 0%, #541000 22%, #b81f00 42%, #f08b00 66%, #d5d87a 84%, #fffdf3 100%)'
  },
  {
    key: 'bw',
    label: 'BW',
    gradient: 'linear-gradient(90deg, #070707 0%, #3e3e3e 34%, #9f9f9f 70%, #ffffff 100%)'
  },
  {
    key: 'bwinverse',
    label: 'BWInverse',
    gradient: 'linear-gradient(90deg, #ffffff 0%, #c7c7c7 30%, #676767 66%, #050505 100%)'
  },
  {
    key: 'cardiac',
    label: 'Cardiac',
    gradient: 'linear-gradient(90deg, #2eff37 0%, #16f0c7 14%, #1b90ff 30%, #3157ff 44%, #b22bff 58%, #ff2cc3 70%, #ff5a4a 80%, #ffe34d 90%, #7aff45 100%)'
  },
  {
    key: 'hotiron',
    label: 'HotIron',
    gradient: 'linear-gradient(90deg, #000000 0%, #430000 22%, #930000 42%, #ea3500 62%, #ff9d00 82%, #fff6dc 100%)'
  },
  {
    key: 'pet',
    label: 'PET',
    gradient: 'linear-gradient(90deg, #1c37ff 0%, #1668ff 18%, #13b0ff 36%, #14e4d9 52%, #a432ff 68%, #ff4a63 84%, #ffd650 100%)'
  },
  {
    key: 'rainbow',
    label: 'Rainbow',
    gradient: 'linear-gradient(90deg, #7022ff 0%, #2556ff 18%, #00acff 34%, #00d56f 54%, #ffe044 78%, #ff5f2f 100%)'
  }
] as const

export type PseudocolorPresetKey = (typeof PSEUDOCOLOR_PRESET_OPTIONS)[number]['key']
const PSEUDOCOLOR_VERTICAL_GRADIENTS = new Map<PseudocolorPresetKey, string>(
  PSEUDOCOLOR_PRESET_OPTIONS.map((option) => [option.key, option.gradient.replace('90deg', '0deg')])
)

export const FUSION_PET_PSEUDOCOLOR_PRESET_OPTIONS = [
  {
    key: DEFAULT_FUSION_PET_PSEUDOCOLOR_PRESET,
    label: 'Rainbow',
    gradient:
      'linear-gradient(90deg, #000000 0%, #3a0000 12%, #8d0000 30%, #e21b00 52%, #ff8a00 72%, #ffe100 88%, #fffef0 100%)'
  }
] as const

export type FusionPetPseudocolorPresetKey = (typeof FUSION_PET_PSEUDOCOLOR_PRESET_OPTIONS)[number]['key']
const FUSION_PET_VERTICAL_GRADIENTS = new Map<FusionPetPseudocolorPresetKey, string>(
  FUSION_PET_PSEUDOCOLOR_PRESET_OPTIONS.map((option) => [option.key, option.gradient.replace('90deg', '0deg')])
)

export function normalizePseudocolorPresetKey(value: string | null | undefined): PseudocolorPresetKey {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/^pseudocolor:/, '')

  return (
    PSEUDOCOLOR_PRESET_OPTIONS.find((option) => option.key === normalized)?.key ?? DEFAULT_PSEUDOCOLOR_PRESET
  )
}

export function toPseudocolorSelectionValue(value: string | null | undefined): string {
  return `pseudocolor:${normalizePseudocolorPresetKey(value)}`
}

export function getPseudocolorGradient(value: string | null | undefined): string {
  const key = normalizePseudocolorPresetKey(value)
  return (
    PSEUDOCOLOR_PRESET_OPTIONS.find((option) => option.key === key)?.gradient ??
    PSEUDOCOLOR_PRESET_OPTIONS[1].gradient
  )
}

export function getVerticalPseudocolorGradient(value: string | null | undefined): string {
  const key = normalizePseudocolorPresetKey(value)
  return PSEUDOCOLOR_VERTICAL_GRADIENTS.get(key) ?? PSEUDOCOLOR_VERTICAL_GRADIENTS.get(DEFAULT_PSEUDOCOLOR_PRESET) ?? getPseudocolorGradient(key)
}

export function normalizeFusionPetPseudocolorPresetKey(
  value: string | null | undefined
): FusionPetPseudocolorPresetKey {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/^pseudocolor:/, '')

  return (
    FUSION_PET_PSEUDOCOLOR_PRESET_OPTIONS.find((option) => option.key === normalized)?.key ??
    DEFAULT_FUSION_PET_PSEUDOCOLOR_PRESET
  )
}

export function getFusionPetPseudocolorGradient(value: string | null | undefined): string {
  const key = normalizeFusionPetPseudocolorPresetKey(value)
  return (
    FUSION_PET_PSEUDOCOLOR_PRESET_OPTIONS.find((option) => option.key === key)?.gradient ??
    FUSION_PET_PSEUDOCOLOR_PRESET_OPTIONS[0].gradient
  )
}

export function getVerticalFusionPetPseudocolorGradient(value: string | null | undefined): string {
  const key = normalizeFusionPetPseudocolorPresetKey(value)
  return FUSION_PET_VERTICAL_GRADIENTS.get(key) ?? FUSION_PET_VERTICAL_GRADIENTS.get(DEFAULT_FUSION_PET_PSEUDOCOLOR_PRESET) ?? getFusionPetPseudocolorGradient(key)
}

export function normalizePetRangeUpperLimit(value: string | number | null | undefined): number {
  const parsed = typeof value === 'number' ? value : Number(String(value ?? '').trim())
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= MAX_PET_RANGE_UPPER_LIMIT
    ? parsed
    : DEFAULT_PET_RANGE_UPPER_LIMIT
}
