import { fileURLToPath } from 'node:url'

import { build, defineConfig } from '../node_modules/.bun/node_modules/vite/dist/node/index.js'
import vue from '../node_modules/.bun/node_modules/@vitejs/plugin-vue/dist/index.mjs'
import vueDevTools from '../node_modules/.bun/node_modules/vite-plugin-vue-devtools/dist/vite.js'

const widgetRoot = fileURLToPath(new URL('../widget', import.meta.url))
const widgetSrc = fileURLToPath(new URL('../widget/src', import.meta.url))
const vuePackage = fileURLToPath(new URL('../node_modules/.bun/node_modules/vue', import.meta.url))
const widgetDist = fileURLToPath(new URL('../widget/dist', import.meta.url))

await build(
  defineConfig({
    configFile: false,
    root: widgetRoot,
    plugins: [
      vue({ customElement: true }),
      vueDevTools(),
    ],
    resolve: {
      alias: {
        '@': widgetSrc,
        vue: vuePackage,
      },
    },
    build: {
      outDir: widgetDist,
    },
  })
)
