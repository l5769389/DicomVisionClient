export const DEFAULT_PSEUDOCOLOR_PRESET = 'bw'

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
