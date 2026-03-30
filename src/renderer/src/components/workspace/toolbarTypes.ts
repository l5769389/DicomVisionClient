export interface StackToolOption {
  value: string
  label: string
  icon: string
}

export interface StackTool {
  key: string
  label: string
  icon: string
  kind?: 'mode' | 'action'
  options?: StackToolOption[]
}
