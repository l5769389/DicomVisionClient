export interface DockResizeConfig {
  collapsedWidth: number
  collapseThreshold: number
  minWidth: number
  maxWidth: number
}

export interface DockResizeResult {
  collapsed: boolean
  rawWidth: number
  width: number
}

export function resolveDockResize(
  startWidth: number,
  pointerDelta: number,
  config: DockResizeConfig
): DockResizeResult {
  const rawWidth = Math.round(startWidth + pointerDelta)
  const collapsed = rawWidth < config.collapseThreshold
  return {
    collapsed,
    rawWidth,
    width: collapsed
      ? Math.max(config.collapsedWidth, Math.min(config.collapseThreshold - 1, rawWidth))
      : Math.max(config.minWidth, Math.min(config.maxWidth, rawWidth))
  }
}
