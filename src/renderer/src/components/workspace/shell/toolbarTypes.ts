export interface StackToolOption {
  value: string
  label: string
  icon: string
  swatchKey?: string
  description?: string
  badge?: string
}

export interface StackTool {
  key: string
  label: string
  icon: string
  swatchKey?: string
  kind?: 'mode' | 'action'
  options?: StackToolOption[]
  showSelectedOptionIcon?: boolean
}
