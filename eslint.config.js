import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import svelteConfig from './svelte.config.js';

export default ts.config(
  { ignores: ['dist/', 'dev-dist/', 'node_modules/', 'test-results/', 'playwright-report/'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } }
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: { parserOptions: { parser: ts.parser, extraFileExtensions: ['.svelte'], svelteConfig } }
  },
  {
    // Puerta pública: un módulo solo entra a otro por su index.ts (plan, punto 1).
    files: ['src/**/*.{ts,svelte}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          regex: '(^|/)modules/[^/]+/(?!index(\\.ts)?$).+',
          message: 'Usa la puerta pública del módulo (su index.ts).'
        }, {
          regex: '^\\.\\./(?!\\.\\.)[^/]+/(?!index(\\.ts)?$).+',
          message: 'Usa la puerta pública del módulo (su index.ts).'
        }]
      }]
    }
  }
);
