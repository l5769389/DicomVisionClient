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

export interface StackTool {
  key: string
  label: string
  icon: string
  swatchKey?: string
  kind?: 'mode' | 'action'
  menuKind?: 'options' | 'layout' | 'mprLayout'
  inlineKind?: 'fusionPetDisplay' | 'fusionRegistration'
  options?: StackToolOption[]
  showSelectedOptionIcon?: boolean
}

export interface StackToolOptionSelectBehavior {
  keepMenuOpen?: boolean
}
