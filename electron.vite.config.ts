import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import VueDevTools from 'vite-plugin-vue-devtools'

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
        input: {
          index: resolve('src/renderer/index.html')
        }
      }
    },
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [
      VueDevTools(),
      vue(),
      tailwindcss()
    ]
  }
})
