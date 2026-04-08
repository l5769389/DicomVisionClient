export const VIEW_OPERATION_TYPES = {
  setSize: 'setSize',
  scroll: 'scroll',
  crosshair: 'crosshair',
  pan: 'pan',
  zoom: 'zoom',
  window: 'window',
  rotate3d: 'rotate3d',
  reset: 'reset',
  volumePreset: 'volumePreset',
  volumeConfig: 'volumeConfig'
} as const
export type ViewOperationType = (typeof VIEW_OPERATION_TYPES)[keyof typeof VIEW_OPERATION_TYPES]

export const DRAG_ACTION_TYPES = {
  start: 'start',
  move: 'move',
  end: 'end'
} as const
export type DragActionType = (typeof DRAG_ACTION_TYPES)[keyof typeof DRAG_ACTION_TYPES]

export const STACK_OPERATION_PREFIX = 'stack:'
export const STACK_DEFAULT_OPERATION = `${STACK_OPERATION_PREFIX}${VIEW_OPERATION_TYPES.pan}`
export const STACK_DRAG_OPERATIONS = [
  VIEW_OPERATION_TYPES.pan,
  VIEW_OPERATION_TYPES.zoom,
  VIEW_OPERATION_TYPES.window,
  VIEW_OPERATION_TYPES.rotate3d
] as const

export const VIEWPORT_DEFAULT_SIZE = {
  width: 960,
  height: 720
} as const

export const VIEWPORT_ZOOM_LIMITS = {
  min: 0.5,
  max: 3
} as const
