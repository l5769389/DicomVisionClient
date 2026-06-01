function waitForFirstPaint(): Promise<void> {
  if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve())
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

async function mountWorkspaceApp(): Promise<void> {
  await waitForFirstPaint()

  const [{ createApp }, { default: WorkspaceApp }, { vuetify }] = await Promise.all([
    import('vue'),
    import('./WorkspaceApp.vue'),
    import('./plugins/vuetify'),
    loadWorkspaceStyles()
  ])

  createApp(WorkspaceApp).use(vuetify).mount('#app')
}

void mountWorkspaceApp().catch(showBootError)
