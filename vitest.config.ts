import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string }

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src'),
      '@shared': resolve('src/shared')
    }
  },
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version)
  },
  test: {
    environment: 'jsdom',
    include: ['src/renderer/src/**/*.test.ts'],
    css: true
  }
})
