import { globalIgnores } from '../node_modules/.bun/eslint@10.8.1+1a1acd4c2fa5b1a4/node_modules/eslint/lib/config-api.js'
import { defineConfigWithVueTs, vueTsConfigs } from '../node_modules/.bun/@vue+eslint-config-typescript@14.9.0+4739fbbd95b8d73c/node_modules/@vue/eslint-config-typescript/dist/index.mjs'
import pluginVue from '../node_modules/.bun/eslint-plugin-vue@10.9.2+d1f2631c5cd8e498/node_modules/eslint-plugin-vue/dist/index.js'
import pluginVitest from '../node_modules/.bun/@vitest+eslint-plugin@1.6.27+001564ad9ebcb0c0/node_modules/@vitest/eslint-plugin/dist/index.mjs'
import pluginOxlint from '../node_modules/.bun/eslint-plugin-oxlint@1.73.0+16f7eb975a1083a1/node_modules/eslint-plugin-oxlint/dist/index.mjs'

// To allow more languages other than `ts` in `.vue` files, uncomment the following lines:
// import { configureVueProject } from '@vue/eslint-config-typescript'
// configureVueProject({ scriptLangs: ['ts', 'tsx'] })
// More info at https://github.com/vuejs/eslint-config-typescript/#advanced-setup

export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{vue,ts,mts,tsx}'],
  },

  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**']),

  ...pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,

  {
    ...pluginVitest.configs.recommended,
    files: ['src/**/__tests__/*'],
  },

  ...pluginOxlint.buildFromOxlintConfigFile('.oxlintrc.json'),
)
