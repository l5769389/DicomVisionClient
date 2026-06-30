import type { CompareSyncSettingKey, MprLayoutKey } from '../../../types/viewer'

export interface StackToolOption {
  value: string
  label: string
  icon: string
  layoutRows?: number
  layoutColumns?: number
  swatchKey?: string
  description?: string
  badge?: string
  group?: string
  checked?: boolean
  disabled?: boolean
  mprLayoutKey?: MprLayoutKey
  syncKey?: CompareSyncSettingKey
}

export interface StackToolRangeTick {
  value: number
  label: string
}

export interface StackToolRangeControl {
  kind: 'zoom'
  value: number
  min: number
  max: number
  step: number
  ticks: StackToolRangeTick[]
  resetValue: number
}

export interface StackTool {
  key: string
  label: string
  icon: string
  swatchKey?: string
  kind?: 'mode' | 'action'
  menuKind?: 'options' | 'layout' | 'mprLayout'
  inlineKind?: 'fusionPetDisplay' | 'fusionRegistration'
  options?: StackToolOption[]
  dockOptions?: StackToolOption[]
  rangeControl?: StackToolRangeControl
  showSelectedOptionIcon?: boolean
}

export interface StackToolOptionSelectBehavior {
  keepMenuOpen?: boolean
}
