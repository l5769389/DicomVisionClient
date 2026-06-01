import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import {
  createRendererManualChunks,
  createRendererPlugins,
  rendererDefine,
  rendererInput,
  rendererResolveAlias
} from './vite.renderer.shared'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    build: {
      modulePreload: {
        resolveDependencies: () => []
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
