import { defineConfig } from 'oxlint'

export default defineConfig({
  plugins: ['typescript', 'import', 'oxc', 'vitest', 'unicorn'],

  options: {
    typeAware: true,
    typeCheck: true,
  },

  rules: {
    'no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      },
    ],
  },
})
