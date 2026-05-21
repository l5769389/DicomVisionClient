import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import {
  createRendererPlugins,
  rendererDefine,
  rendererInput,
  rendererResolveAlias
} from './vite.renderer.shared'

export default defineConfig({
  root: 'src/renderer',
  envDir: resolve(__dirname),
  build: {
    outDir: '../../dist-web',
    emptyOutDir: true,
    rollupOptions: {
      input: rendererInput
    }
  },
  publicDir: 'public',
  resolve: {
    alias: rendererResolveAlias
  },
  define: rendererDefine,
  plugins: createRendererPlugins()
})
