import { defineConfig } from 'oxlint'

export default defineConfig({
  plugins: ['typescript', 'react', 'jsx-a11y', 'import', 'oxc'],
  ignorePatterns: ['dist/**', 'public/assets/**'],
  rules: {
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  },
})
