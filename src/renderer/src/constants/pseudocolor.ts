export const DEFAULT_PSEUDOCOLOR_PRESET = 'bw'
export const DEFAULT_FUSION_PET_PSEUDOCOLOR_PRESET = 'hotiron'
export const DEFAULT_FUSION_PET_STANDALONE_PSEUDOCOLOR_PRESET = 'hotiron'
export const DEFAULT_PET_STANDALONE_PSEUDOCOLOR_PRESET = DEFAULT_FUSION_PET_STANDALONE_PSEUDOCOLOR_PRESET
export const DEFAULT_FUSION_PET_WINDOW_MIN = 0
// Only used while the authoritative PET metadata is loading. The server derives
// the actual display suggestion from the current quantitative volume.
export const DEFAULT_FUSION_PET_WINDOW_MAX = 1
export const DEFAULT_PET_RANGE_UPPER_LIMIT = 30
export const MAX_PET_RANGE_UPPER_LIMIT = 1_000_000_000_000

export const PSEUDOCOLOR_REGISTRY_VERSION = 'dicomvision-2026.2'

type Rgb = readonly [number, number, number]

export interface PseudocolorRegistryEntry {
  key: string
  label: string
  version: string
  provenance: string
  license: string
  sha256: string
  lut: readonly Rgb[]
  gradient: string
}

function clampByte(value: number): number {
  const bounded = Math.max(0, Math.min(255, value))
  const floor = Math.floor(bounded)
  const fraction = bounded - floor
  if (fraction < 0.5) return floor
  if (fraction > 0.5) return floor + 1
  return floor % 2 === 0 ? floor : floor + 1
}

function buildLut(builder: (x: number, index: number) => Rgb): readonly Rgb[] {
  return Array.from({ length: 256 }, (_, index) => {
    const [red, green, blue] = builder(index / 255, index)
    return [clampByte(red), clampByte(green), clampByte(blue)] as const
  })
}

function lutGradient(lut: readonly Rgb[], direction = '90deg'): string {
  const stops = lut.map(
    ([red, green, blue], index) =>
      `rgb(${red} ${green} ${blue}) ${(index / 255) * 100}%`
  )
  return `linear-gradient(${direction}, ${stops.join(', ')})`
}

function buildHsvRamp(): readonly Rgb[] {
  return buildLut((x) => {
    const hue = 0.75 * (1 - x)
    const saturation = 1 - 0.18 * x
    const value = 0.4 + 0.6 * x
    const chroma = value * saturation
    const sectorValue = (hue % 1) * 6
    const intermediate = chroma * (1 - Math.abs((sectorValue % 2) - 1))
    const sector = Math.floor(sectorValue) % 6
    const candidates: Rgb[] = [
      [chroma, intermediate, 0],
      [intermediate, chroma, 0],
      [0, chroma, intermediate],
      [0, intermediate, chroma],
      [intermediate, 0, chroma],
      [chroma, 0, intermediate]
    ]
    const [red = 0, green = 0, blue = 0] = candidates[sector] ?? candidates[0]
    const offset = value - chroma
    return [(red + offset) * 255, (green + offset) * 255, (blue + offset) * 255]
  })
}

const LUTS = {
  bw: buildLut((_x, index) => [index, index, index]),
  bwinverse: buildLut((_x, index) => [255 - index, 255 - index, 255 - index]),
  blackbody: buildLut((x) => [
    Math.min(1, 3 * x) * 255,
    Math.max(0, Math.min(1, 3 * x - 1)) * 255,
    Math.max(0, Math.min(1, 3 * x - 2)) * 255
  ]),
  hotiron: buildLut((x) => [
    Math.min(1, 2 * x) * 255,
    Math.max(0, Math.min(1, 2 * x - 1)) * 255,
    Math.max(0, Math.min(1, 4 * x - 3)) * 255
  ]),
  hotmetal: buildLut((x) => [
    Math.min(1, 1.4 * x) * 255,
    Math.max(0, Math.min(1, 2.8 * x - 1.4)) * 255,
    Math.max(0, Math.min(1, 4 * x - 3)) * 255
  ]),
  pet: buildLut((x) => [
    (x < 0.25 ? 0 : x < 0.75 ? 2 * x - 0.5 : 1) * 255,
    (x < 0.25 ? 2 * x : x < 0.5 ? 1 - 2 * x : 2 * x - 1) * 255,
    (x < 0.5 ? 2 * x : x < 0.75 ? 3 - 4 * x : 4 * x - 3) * 255
  ]),
  rainbow: buildHsvRamp()
} as const

const LUT_HASHES: Record<keyof typeof LUTS, string> = {
  bw: '72432263dbfe17abc40ed269f24c7a344e077e3671007dfc8a2f3851f8193dc2',
  bwinverse: '346f6a25ad11ec5b45a83392366f269058ba209d2877491634a2405f86beb3db',
  blackbody: 'c50f9920dc226cbf2db7c62a94a0dd9d9a5a81e0973e73ca67c36cc66a2583d2',
  hotiron: '03db970356806b8fa1dfddb6022c69d5e6cc8fd62dfc67dbce8a90724506356c',
  hotmetal: 'd0e644c3e683ed0cb0983315e7c1af18180027d77de9d3f09f2f76a05bdbd2b8',
  pet: 'e8aaab29be18ff65e063f3d691b9fa09db0fc85c9a28007e16fc872220411dd2',
  rainbow: '4317d05e950432d6dafc6363cff8ed2e30f6a5ab1fd958207c24721f6270f585'
}

function registryEntry(key: keyof typeof LUTS, label: string): PseudocolorRegistryEntry {
  const lut = LUTS[key]
  return {
    key,
    label,
    version: PSEUDOCOLOR_REGISTRY_VERSION,
    provenance: 'DicomVision analytic 256-entry palette',
    license: 'DicomVision project license',
    sha256: LUT_HASHES[key],
    lut,
    gradient: lutGradient(lut)
  }
}

export const PSEUDOCOLOR_PRESET_OPTIONS = [
  registryEntry('blackbody', 'BlackBody'),
  registryEntry('bw', 'BW'),
  registryEntry('bwinverse', 'BWInverse'),
  registryEntry('hotiron', 'HotIron'),
  registryEntry('hotmetal', 'HotMetal'),
  registryEntry('pet', 'PET'),
  registryEntry('rainbow', 'Rainbow')
] as const

export type PseudocolorPresetKey = (typeof PSEUDOCOLOR_PRESET_OPTIONS)[number]['key']
const PSEUDOCOLOR_VERTICAL_GRADIENTS = new Map<PseudocolorPresetKey, string>(
  PSEUDOCOLOR_PRESET_OPTIONS.map((option) => [option.key, lutGradient(option.lut, '0deg')])
)

export const FUSION_PET_PSEUDOCOLOR_PRESET_OPTIONS = [
  {
    key: 'petct-rainbow',
    label: 'PET/CT Rainbow（历史）',
    version: PSEUDOCOLOR_REGISTRY_VERSION,
    provenance: 'Compatibility alias of HotMetal',
    license: 'DicomVision project license',
    sha256: LUT_HASHES.hotmetal,
    lut: LUTS.hotmetal,
    gradient: lutGradient(LUTS.hotmetal)
  },
  ...PSEUDOCOLOR_PRESET_OPTIONS
    .filter((option) => ['bw', 'bwinverse', 'hotiron', 'hotmetal', 'pet', 'rainbow', 'blackbody'].includes(option.key))
] as const

export type FusionPetPseudocolorPresetKey = (typeof FUSION_PET_PSEUDOCOLOR_PRESET_OPTIONS)[number]['key']
const FUSION_PET_VERTICAL_GRADIENTS = new Map<FusionPetPseudocolorPresetKey, string>(
  FUSION_PET_PSEUDOCOLOR_PRESET_OPTIONS.map((option) => [option.key, lutGradient(option.lut, '0deg')])
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

// Keep the renderer surface and its text overlays in step with the server's
// LUT. These values are the first (zero-intensity) colour of each LUT, which
// is also used outside the acquired image field.
const PSEUDOCOLOR_BACKGROUND_COLORS: Record<string, string> = {
  blackbody: '#000000',
  bw: '#000000',
  bwinverse: '#ffffff',
  hotiron: '#000000',
  hotmetal: '#000000',
  pet: '#000000',
  'petct-rainbow': '#000000',
  rainbow: '#330066'
}

function normalizeBackgroundPreset(value: string | null | undefined): string {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/^pseudocolor:/, '')
  return PSEUDOCOLOR_BACKGROUND_COLORS[normalized] ? normalized : DEFAULT_PSEUDOCOLOR_PRESET
}

export function getPseudocolorBackgroundColor(value: string | null | undefined): string {
  return PSEUDOCOLOR_BACKGROUND_COLORS[normalizeBackgroundPreset(value)] ?? PSEUDOCOLOR_BACKGROUND_COLORS.bw
}

export function isPseudocolorBackgroundLight(value: string | null | undefined): boolean {
  const color = getPseudocolorBackgroundColor(value)
  const channels = [1, 3, 5].map((index) => Number.parseInt(color.slice(index, index + 2), 16) / 255)
  const [red = 0, green = 0, blue = 0] = channels
  const toLinear = (channel: number) => (
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  )
  const luminance = 0.2126 * toLinear(red) + 0.7152 * toLinear(green) + 0.0722 * toLinear(blue)
  return luminance >= 0.46
}

export function normalizePetRangeUpperLimit(value: string | number | null | undefined): number {
  const parsed = typeof value === 'number' ? value : Number(String(value ?? '').trim())
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= MAX_PET_RANGE_UPPER_LIMIT
    ? parsed
    : DEFAULT_PET_RANGE_UPPER_LIMIT
}

export function isPetSuvUnit(value: string | null | undefined): boolean {
  return ['SUVBW', 'SUVBSA', 'SUL'].includes(String(value ?? '').trim().toUpperCase())
}

function nicePetRangeCeiling(value: number): number {
  const finiteValue = Number.isFinite(value) ? Math.max(1, value) : 1
  const magnitude = 10 ** Math.floor(Math.log10(finiteValue))
  const normalized = finiteValue / magnitude
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10
  return Math.min(MAX_PET_RANGE_UPPER_LIMIT, step * magnitude)
}

export function resolvePetRangeUpperLimit(
  currentMax: number,
  autoMax: number | null | undefined,
  unit: string | null | undefined
): number {
  if (isPetSuvUnit(unit)) {
    return Math.max(DEFAULT_PET_RANGE_UPPER_LIMIT, Math.ceil(currentMax))
  }
  const reference = Math.max(
    1,
    Number.isFinite(currentMax) ? currentMax : 1,
    Number.isFinite(Number(autoMax)) ? Number(autoMax) : 1
  )
  return Math.max(reference, nicePetRangeCeiling(reference))
}

export function buildPetRangeUpperLimitOptions(
  referenceMax: number,
  unit: string | null | undefined
): number[] {
  if (isPetSuvUnit(unit)) {
    return [5, 10, 20, 30, 40]
  }
  const base = nicePetRangeCeiling(referenceMax)
  return Array.from(
    new Set(
      [0.5, 1, 2, 5]
        .map((factor) => Math.min(MAX_PET_RANGE_UPPER_LIMIT, Math.max(1, base * factor)))
        .map((value) => Number(value.toPrecision(8)))
    )
  )
}
