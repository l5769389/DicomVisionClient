export interface StackToolOption {
  value: string
  label: string
  icon: string
  swatchKey?: string
}

export interface StackTool {
  key: string
  label: string
  icon: string
  swatchKey?: string
  kind?: 'mode' | 'action'
  options?: StackToolOption[]
}
