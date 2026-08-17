// ESLint plano (flat config) — mínimo y coherente con ES2022 en navegador.
export default [
  {
    files: ['supabase/**/*.js', 'tests/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        window: 'readonly', document: 'readonly', navigator: 'readonly',
        localStorage: 'readonly', crypto: 'readonly', performance: 'readonly',
        console: 'readonly', fetch: 'readonly', Intl: 'readonly', Blob: 'readonly',
        URL: 'readonly', CustomEvent: 'readonly', self: 'readonly', caches: 'readonly',
        module: 'writable', globalThis: 'readonly', location: 'readonly',
        confirm: 'readonly', setTimeout: 'readonly', Request: 'readonly', Response: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['warn', { args: 'none' }],
      'no-undef': 'error',
      'no-var': 'warn',
      eqeqeq: ['warn', 'smart']
    }
  },
  {
    files: ['tests/**/*.mjs'],
    languageOptions: { sourceType: 'module' }
  }
];
