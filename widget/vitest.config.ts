import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfig from './vite.config.js'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      include: ['src/**/*.integration.ts'],
      exclude: [...configDefaults.exclude, 'e2e/**'],
      root: fileURLToPath(new URL('./', import.meta.url)),
      coverage: {
        provider: 'v8',
        reporter: ['lcov', 'text'],
        reportsDirectory: '../coverage/widget',
        include: ['src/**/*.{ts,vue}'],
        exclude: ['src/**/__tests__/**', 'src/main.ts'],
      },
    },
  }),
)
