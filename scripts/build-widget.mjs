import { fileURLToPath } from 'node:url'

import { build, defineConfig } from '../node_modules/.bun/node_modules/vite/dist/node/index.js'
import vue from '../node_modules/.bun/node_modules/@vitejs/plugin-vue/dist/index.mjs'
import vueDevTools from '../node_modules/.bun/node_modules/vite-plugin-vue-devtools/dist/vite.js'

const widgetRoot = fileURLToPath(new URL('../widget', import.meta.url))
const widgetSrc = fileURLToPath(new URL('../widget/src', import.meta.url))
const coreSrc = fileURLToPath(new URL('../packages/core/src', import.meta.url))
const vuePackage = fileURLToPath(new URL('../node_modules/.bun/node_modules/vue', import.meta.url))
const widgetDist = fileURLToPath(new URL('../widget/dist', import.meta.url))
const previewHtml = fileURLToPath(new URL('../widget/index.html', import.meta.url))
const demoHtml = fileURLToPath(new URL('../widget/demo.html', import.meta.url))

await build(
  defineConfig({
    configFile: false,
    root: widgetRoot,
    input: {
      preview: previewHtml,
      demo: demoHtml,
    },
    plugins: [
      vue({ customElement: true }),
      vueDevTools(),
    ],
    resolve: {
      alias: {
        '@': widgetSrc,
        '@agichat/core': coreSrc,
        vue: vuePackage,
      },
    },
    build: {
      outDir: widgetDist,
    },
  })
)
