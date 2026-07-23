import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import {
  createRendererManualChunks,
  createRendererPlugins,
  rendererDefine,
  rendererInput,
  rendererResolveAlias,
  resolveRendererModulePreloadDependencies
} from './vite.renderer.shared'

const configuredRendererPort = Number.parseInt(process.env.DICOM_VISION_RENDERER_PORT ?? '', 10)
const rendererServer = Number.isInteger(configuredRendererPort) && configuredRendererPort > 0
  ? {
      host: '127.0.0.1',
      port: configuredRendererPort,
      strictPort: true
    }
  : undefined

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    ...(rendererServer ? { server: rendererServer } : {}),
    build: {
      modulePreload: {
        resolveDependencies: resolveRendererModulePreloadDependencies
      },
      rollupOptions: {
        input: rendererInput,
        output: {
          manualChunks: createRendererManualChunks
        }
      }
    },
    resolve: {
      alias: rendererResolveAlias
    },
    define: rendererDefine,
    plugins: createRendererPlugins()
  }
})
