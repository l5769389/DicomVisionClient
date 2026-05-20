import type { MprLayoutKey } from '../../../types/viewer'

export const MPR_LAYOUT_OPTION_PREFIX = 'mpr-layout:'
export type MprDefaultLayoutKey = MprLayoutKey

export const DEFAULT_MPR_LAYOUT_KEY: MprDefaultLayoutKey = 'right-primary'

export interface MprLayoutOption {
  key: MprLayoutKey
  label: string
  disabled?: boolean
}

export const MPR_LAYOUT_OPTIONS: MprLayoutOption[] = [
  { key: 'three-columns', label: '3 Columns' },
  { key: 'right-primary', label: 'Primary Right' },
  { key: 'three-rows', label: '3 Rows' },
  { key: 'quad', label: '2 x 2' },
  { key: 'mpr-3d', label: 'MPR + 3D' }
]

export function toMprLayoutSelectionValue(key: MprLayoutKey): string {
  return `${MPR_LAYOUT_OPTION_PREFIX}${key}`
}

export function isMprLayoutKey(value: unknown): value is MprLayoutKey {
  return (
    value === 'three-columns' ||
    value === 'right-primary' ||
    value === 'three-rows' ||
    value === 'quad' ||
    value === 'mpr-3d'
  )
}

export function parseMprLayoutSelectionValue(value: string | null | undefined): MprLayoutKey | null {
  if (!value?.startsWith(MPR_LAYOUT_OPTION_PREFIX)) {
    return null
  }

  const key = value.slice(MPR_LAYOUT_OPTION_PREFIX.length)
  return isMprLayoutKey(key) ? key : null
}
