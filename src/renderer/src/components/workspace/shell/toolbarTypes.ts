import type { CompareSyncSettingKey, MprLayoutKey } from '../../../types/viewer'

export interface StackToolOption {
  value: string
  label: string
  icon?: string
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

export type StackToolOptionSelectionMode = 'single' | 'multiple' | 'none'

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
  title?: string
  icon: string
  pressed?: boolean
  /** Persistent on/off state that is separate from the active interaction mode. */
  stateActive?: boolean
  /** Exposes stateActive as a toggle state to assistive technology and styling. */
  stateControl?: boolean
  swatchKey?: string
  kind?: 'mode' | 'action'
  menuKind?: 'options' | 'layout' | 'mprLayout'
  inlineKind?: 'fusionPetDisplay' | 'fusionRegistration'
  options?: StackToolOption[]
  dockOptions?: StackToolOption[]
  footerOptions?: StackToolOption[]
  /** Defines whether options are mutually exclusive, independently toggled, or immediate actions. */
  optionSelectionMode?: StackToolOptionSelectionMode
  rangeControl?: StackToolRangeControl
  /** Reflect the selected option on the primary button. Defaults to false. */
  showSelectedOptionIcon?: boolean
}

const MULTIPLE_OPTION_TOOL_KEYS = new Set(['compareSync', 'display'])
const IMMEDIATE_OPTION_TOOL_KEYS = new Set(['export', 'fusionRegistration', 'page', 'reset', 'rotate'])

export function resolveStackToolOptionSelectionMode(tool: StackTool): StackToolOptionSelectionMode {
  if (tool.optionSelectionMode) {
    return tool.optionSelectionMode
  }
  if (MULTIPLE_OPTION_TOOL_KEYS.has(tool.key)) {
    return 'multiple'
  }
  if (IMMEDIATE_OPTION_TOOL_KEYS.has(tool.key)) {
    return 'none'
  }
  return 'single'
}

export function isStackToolOptionSelected(
  tool: StackTool,
  option: StackToolOption,
  selectedValue?: string
): boolean {
  const mode = resolveStackToolOptionSelectionMode(tool)
  if (mode === 'none') {
    return false
  }
  if (mode === 'multiple') {
    return option.checked === true
  }
  if (tool.key === 'volumeOrientation') {
    return option.checked === true
  }
  return selectedValue === option.value
}

export interface StackToolOptionSelectBehavior {
  keepMenuOpen?: boolean
}
