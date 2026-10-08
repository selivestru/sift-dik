import { defineConfig } from 'vite-plus'

export default defineConfig({
  fmt: {
    semi: false,
    singleQuote: true,
    jsxSingleQuote: false,
    trailingComma: 'all',
    printWidth: 100,
    tabWidth: 2,
    useTabs: false,
    arrowParens: 'always',
    bracketSpacing: true,
    bracketSameLine: false,
    quoteProps: 'as-needed',
    endOfLine: 'lf',
    sortImports: true,
    sortPackageJson: true,
    overrides: [{ files: ['apps/**'], options: { sortTailwindcss: true } }],
    ignorePatterns: ['**/dist/**', '**/.vite/**', '**/.vitest/**'],
  },
  lint: {
    plugins: ['typescript', 'import', 'oxc', 'vitest', 'unicorn'],
    jsPlugins: [{ name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin' }],
    options: { typeAware: true, typeCheck: true },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'vite-plus/prefer-vite-plus-imports': 'error',
    },
    overrides: [
      {
        files: ['apps/**/*.{ts,tsx}'],
        plugins: ['react', 'react-perf'],
        rules: {
          'react/rules-of-hooks': 'error',
          'react/only-export-components': ['warn', { allowConstantExport: true }],
        },
      },
      {
        files: ['apps/*/src/routes/**/*.{ts,tsx}'],
        plugins: ['react'],
        rules: { 'react/only-export-components': 'off' },
      },
    ],
    ignorePatterns: ['**/dist/**', '**/.vite/**', '**/.vitest/**'],
  },
  test: { projects: ['packages/game-engine/vite.config.ts'] },
  staged: {
    '*': 'vp check --fix',
  },
})
