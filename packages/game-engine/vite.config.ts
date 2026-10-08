import { defineConfig } from 'vite-plus'

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: { name: '@sift-dik/game-engine' },
  pack: {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    sourcemap: true,
  },
})
