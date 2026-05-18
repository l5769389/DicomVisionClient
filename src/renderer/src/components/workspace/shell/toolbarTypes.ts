import type { CompareSyncSettingKey } from '../../../types/viewer'

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
  syncKey?: CompareSyncSettingKey
}

export interface StackTool {
  key: string
  label: string
  icon: string
  swatchKey?: string
  kind?: 'mode' | 'action'
  menuKind?: 'options' | 'layout'
  options?: StackToolOption[]
  showSelectedOptionIcon?: boolean
}
