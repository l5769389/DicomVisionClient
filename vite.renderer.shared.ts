import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import type { PluginOption } from 'vite'
import vuetify from 'vite-plugin-vuetify'

const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string }

export const rendererInput = {
  index: resolve('src/renderer/index.html')
}

export const rendererResolveAlias = {
  '@renderer': resolve('src/renderer/src'),
  '@shared': resolve('src/shared')
}

export const rendererDefine = {
  __APP_VERSION__: JSON.stringify(packageJson.version)
}

export function createRendererPlugins(): PluginOption[] {
  return [
    vue(),
    vuetify({
      autoImport: {
        labs: true
      }
    }),
    tailwindcss()
  ]
}

export function createRendererManualChunks(id: string): string | undefined {
  const normalizedId = id.replace(/\\/g, '/')

  if (normalizedId.includes('/node_modules/@vue/') || normalizedId.includes('/node_modules/vue/')) {
    return 'vue'
  }
  if (normalizedId.includes('/node_modules/vuetify/')) {
    return 'vuetify'
  }
  if (
    normalizedId.includes('/node_modules/socket.io-client/') ||
    normalizedId.includes('/node_modules/@socket.io/') ||
    normalizedId.includes('/node_modules/engine.io-client/')
  ) {
    return 'socketio'
  }
  return undefined
}

const DEFERRED_PRELOAD_PATTERNS = [
  /PacsBrowserDialog/i,
  /SidebarSettingsDialog/i,
  /MprSegmentationPanel/i,
  /MprMipConfigPanel/i,
  /VolumeRenderConfigPanel/i,
  /MtfCurvePanelContent/i,
  /QaWaterResultPanelContent/i,
  /ViewerResultDock/i,
  /FusionRegistrationSaveDialog/i,
  /WorkspaceExportNameDialog/i,
  /WorkspaceExportNotice/i,
  /MobileSettingsOverlay/i,
  /MobileCompareStackViewport/i,
  /MobileMprViewport/i,
  /MobilePetCtFusionViewport/i,
  /MobileStackViewport/i,
  /MobileVolumeViewport/i,
  /CompareStackView/i,
  /DicomTagView/i,
  /FourDView/i,
  /LayoutView/i,
  /MprView/i,
  /PetCtFusionView/i,
  /StackView/i,
  /VolumeView/i,
  /exporting/i
]

export function resolveRendererModulePreloadDependencies(_filename: string, deps: string[]): string[] {
  return deps.filter((dep) => !DEFERRED_PRELOAD_PATTERNS.some((pattern) => pattern.test(dep)))
}
