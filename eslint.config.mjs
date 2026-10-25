import js from '@eslint/js';
import globals from 'globals';
export default [
  { ignores: ['dist/**', 'coverage/**'] },
  js.configs.recommended,
  {
    files: ['**/*.mjs'],
    languageOptions: { globals: globals.node },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-constant-binary-expression': 'error',
      eqeqeq: 'error',
      'no-implicit-coercion': 'error',
    },
  },
];
