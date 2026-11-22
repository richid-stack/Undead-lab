import globals from 'globals';

// Catches the class of bug a bundler does not: names used but never imported/defined.
export default [
  { ignores: ['dist/**', 'node_modules/**', 'tests/**', 'docs/**'] },
  {
    files: ['src/**/*.js', 'tools/**/*.mjs', 'vite.config.js', 'eslint.config.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.browser, ...globals.node } },
    rules: { 'no-undef': 'error', 'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_' }], 'no-redeclare': 'error' },
  },
];
