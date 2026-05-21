import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import {
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
      rollupOptions: {
        input: rendererInput
      }
    },
    resolve: {
      alias: rendererResolveAlias
    },
    define: rendererDefine,
    plugins: createRendererPlugins()
  }
})
