import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import VueDevTools from 'vite-plugin-vue-devtools'
import vuetify from 'vite-plugin-vuetify'

const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string }

export default defineConfig({
  root: 'src/renderer',
  envDir: resolve(__dirname),
  build: {
    outDir: '../../dist-web',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve('src/renderer/index.html')
      }
    }
  },
  publicDir: 'public',
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src'),
      '@shared': resolve('src/shared')
    }
  },
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version)
  },
  plugins: [
    VueDevTools(),
    vue(),
    vuetify(),
    tailwindcss()
  ]
})
