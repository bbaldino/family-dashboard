import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import boundaries from 'eslint-plugin-boundaries'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      // Lets boundaries resolve extensionless imports and the `@/*` tsconfig alias.
      'import/resolver': { typescript: { alwaysTryTypes: true } },
      'boundaries/elements': [
        { type: 'data', pattern: 'src/data/**' },
        { type: 'shell', pattern: 'src/shell/**' },
        { type: 'palettes', pattern: 'src/palettes/**' },
        { type: 'admin', pattern: 'src/admin/**' },
        { type: 'ui', pattern: ['src/ui/**', 'src/components/**'] },
        { type: 'lib', pattern: 'src/lib/**' },
        { type: 'hooks', pattern: 'src/hooks/**' },
        { type: 'utils', pattern: 'src/utils/**' },
        { type: 'theme', pattern: 'src/themes/*/**', capture: ['themeName'] },
      ],
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'allow',
          policies: [
            // Data layer is pure — must not know about presentation.
            {
              from: { element: { type: 'data' } },
              disallow: {
                to: { element: { types: { anyOf: ['theme', 'admin', 'shell'] } } },
              },
            },
            // Admin stays theme-neutral.
            {
              from: { element: { type: 'admin' } },
              disallow: { to: { element: { type: 'theme' } } },
            },
            // Themes can't cross-import each other.
            {
              from: { element: { type: 'theme' } },
              disallow: {
                to: {
                  element: {
                    type: 'theme',
                    captured: {
                      themeName: '!{{ from.element.captured.themeName }}',
                    },
                  },
                },
              },
            },
          ],
        },
      ],
    },
  },
])
