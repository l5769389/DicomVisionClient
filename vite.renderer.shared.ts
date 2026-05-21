import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import type { PluginOption } from 'vite'
import VueDevTools from 'vite-plugin-vue-devtools'
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
    VueDevTools(),
    vue(),
    vuetify({
      autoImport: {
        labs: true
      }
    }),
    tailwindcss()
  ]
}
