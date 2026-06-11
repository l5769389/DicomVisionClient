import { isMobileHostname, isMobileRoute, resolveShellKind, rewritePathForMobileShell } from './shell/shellSelection'

function waitForFirstPaint(): Promise<void> {
  if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    let settled = false
    const finish = (): void => {
      if (settled) {
        return
      }
      settled = true
      window.clearTimeout(timeoutId)
      resolve()
    }
    const timeoutId = window.setTimeout(finish, 120)
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(finish)
    })
  })
}

function showBootError(error: unknown): void {
  console.error(error)
  const root = document.getElementById('app')
  if (!root) {
    return
  }

  const panel = document.createElement('div')
  panel.className = 'app-start-error'
  panel.textContent = 'DICOM Vision failed to start. Please reload the page or restart the app.'
  root.appendChild(panel)
}

function injectStyle(id: string, cssText: string): void {
  if (document.getElementById(id)) {
    return
  }

  const style = document.createElement('style')
  style.id = id
  style.textContent = cssText
  document.head.appendChild(style)
}

async function loadWorkspaceStyles(): Promise<void> {
  const { default: appStyles } = await import('./style.css?inline')
  injectStyle('dicomvision-app-styles', appStyles)
}

function getPointerIsCoarse(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
}

function resolveInitialShellKind() {
  return resolveShellKind({
    hasDesktopRuntime: typeof window !== 'undefined' && Boolean(window.viewerApi),
    hasCoarsePointer: getPointerIsCoarse(),
    hostname: typeof window !== 'undefined' ? window.location.hostname : '',
    maxTouchPoints: typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0,
    pathname: typeof window !== 'undefined' ? window.location.pathname : '/',
    viewportWidth: typeof window !== 'undefined' ? window.innerWidth : 1024
  })
}

function normalizeMobileRoute(): void {
  if (
    typeof window === 'undefined' ||
    isMobileRoute(window.location.pathname) ||
    isMobileHostname(window.location.hostname)
  ) {
    return
  }

  window.history.replaceState(
    window.history.state,
    '',
    rewritePathForMobileShell(window.location.pathname, window.location.search, window.location.hash)
  )
}

async function mountWorkspaceApp(): Promise<void> {
  await waitForFirstPaint()
  const shellKind = resolveInitialShellKind()
  if (shellKind === 'mobile') {
    normalizeMobileRoute()
  }

  const appImport = shellKind === 'mobile'
    ? import('./apps/mobile/MobileWorkspaceApp.vue')
    : import('./WorkspaceApp.vue')
  const [{ createApp }, { default: WorkspaceApp }, { vuetify }] = await Promise.all([
    import('vue'),
    appImport,
    import('./plugins/vuetify'),
    loadWorkspaceStyles()
  ])

  createApp(WorkspaceApp).use(vuetify).mount('#app')
}

void mountWorkspaceApp().catch(showBootError)
