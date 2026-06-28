import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import {
  createRendererManualChunks,
  createRendererPlugins,
  rendererDefine,
  rendererInput,
  rendererResolveAlias,
  resolveRendererModulePreloadDependencies
} from './vite.renderer.shared'

export default defineConfig({
  root: 'src/renderer',
  envDir: resolve(__dirname),
  build: {
    outDir: '../../dist-web',
    emptyOutDir: true,
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
  publicDir: 'public',
  resolve: {
    alias: rendererResolveAlias
  },
  define: rendererDefine,
  plugins: createRendererPlugins()
})
