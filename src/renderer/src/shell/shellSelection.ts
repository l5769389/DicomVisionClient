export type ShellKind = 'desktop' | 'mobile'

export interface ShellSelectionInput {
  hasDesktopRuntime?: boolean
  hasCoarsePointer?: boolean
  hostname?: string
  maxTouchPoints?: number
  pathname?: string
  viewportWidth?: number
}

const MOBILE_ROUTE_PATTERN = /^\/mobile(?:\/|$)/i
const MOBILE_HOST_PATTERN = /^(m|mobile)\./i
const MOBILE_WIDTH_MAX = 820

export function isMobileRoute(pathname: string | undefined): boolean {
  return MOBILE_ROUTE_PATTERN.test(pathname ?? '')
}

export function isMobileHostname(hostname: string | undefined): boolean {
  return MOBILE_HOST_PATTERN.test(hostname ?? '')
}

export function shouldAutoUseMobileShell(input: ShellSelectionInput): boolean {
  if (input.hasDesktopRuntime) {
    return false
  }

  const width = Number(input.viewportWidth)
  const touchPoints = Number(input.maxTouchPoints ?? 0)
  return Number.isFinite(width) && width <= MOBILE_WIDTH_MAX && (input.hasCoarsePointer === true || touchPoints > 0)
}

export function resolveShellKind(input: ShellSelectionInput): ShellKind {
  if (input.hasDesktopRuntime) {
    return 'desktop'
  }
  if (isMobileRoute(input.pathname) || isMobileHostname(input.hostname)) {
    return 'mobile'
  }
  return shouldAutoUseMobileShell(input) ? 'mobile' : 'desktop'
}

export function rewritePathForMobileShell(pathname: string, search = '', hash = ''): string {
  if (isMobileRoute(pathname)) {
    return `${pathname}${search}${hash}`
  }
  return `/mobile${search}${hash}`
}
