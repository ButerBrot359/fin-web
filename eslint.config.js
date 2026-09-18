import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import eslintConfigPrettier from 'eslint-config-prettier'
import importPlugin from 'eslint-plugin-import'

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
      eslintConfigPrettier,
    ],
    languageOptions: {
      ecmaVersion: 2024,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports' },
      ],
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      'react-hooks/incompatible-library': 'off',
    },
  },
  // --- Защита FSD-границ (eslint-plugin-import) -------------------------
  // Диагностический режим: все правила на warn, линт не падает, но
  // нарушения видны. Поднять no-restricted-paths до error после фикса
  // известных нарушений W-3/W-4 (features/report-result-view → pages/reports,
  // features/report-settings → pages, features/dict-sidebar → pages,
  // shared → entities в enum-field/format-cell-value).
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      import: importPlugin,
    },
    settings: {
      // Без этого ExportMap (no-cycle) не умеет парсить транзитивно
      // посещаемые .ts/.tsx файлы во flat config.
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx'],
      },
      'import/resolver': {
        alias: {
          map: [['@', './src']],
          extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
        },
      },
    },
    rules: {
      // Известный цикл в легаси: dict-sidebar ⇄ form-renderer — поэтому warn.
      // maxDepth 6 — минимум, при котором этот цикл (через barrel'ы) виден.
      'import/no-cycle': ['warn', { maxDepth: 6, ignoreExternal: true }],
      // Направление слоёв FSD: app > pages > widgets > features > entities > shared.
      // target — кто импортирует, from — откуда импортировать запрещено.
      'import/no-restricted-paths': [
        'warn',
        {
          zones: [
            {
              target: './src/pages',
              from: './src/app',
              message: 'FSD: слой pages не может импортировать из app.',
            },
            {
              target: './src/widgets',
              from: ['./src/app', './src/pages'],
              message: 'FSD: слой widgets не может импортировать из app/pages.',
            },
            {
              target: './src/features',
              from: ['./src/app', './src/pages', './src/widgets'],
              message:
                'FSD: слой features не может импортировать из app/pages/widgets.',
            },
            {
              target: './src/entities',
              from: ['./src/app', './src/pages', './src/widgets', './src/features'],
              message:
                'FSD: слой entities не может импортировать из app/pages/widgets/features.',
            },
            {
              target: './src/shared',
              from: [
                './src/app',
                './src/pages',
                './src/widgets',
                './src/features',
                './src/entities',
              ],
              message:
                'FSD: слой shared не может импортировать из вышестоящих слоёв.',
            },
          ],
        },
      ],
      // Запрет deep-imports во внутренности чужих слайсов — только через
      // barrel (index.ts) слайса. @/shared/** не ограничиваем (своя
      // barrel-политика), app/** освобождён ниже (gateway-паттерн).
      // Относительные импорты внутри слайса под паттерны не попадают.
      'no-restricted-imports': [
        'warn',
        {
          patterns: [
            {
              group: [
                '@/features/**/ui/**',
                '@/features/**/lib/**',
                '@/features/**/model/**',
                '@/features/**/api/**',
                '@/widgets/**/ui/**',
                '@/widgets/**/lib/**',
                '@/widgets/**/model/**',
                '@/widgets/**/api/**',
                '@/pages/**/ui/**',
                '@/pages/**/lib/**',
                '@/pages/**/model/**',
                '@/pages/**/api/**',
              ],
              message:
                'Deep-import во внутренности слайса запрещён — импортируйте через публичный API (index.ts) слайса.',
            },
          ],
        },
      ],
    },
  },
  // app-слой собирает приложение и подключает реализации к gateway —
  // ему разрешены любые импорты, включая внутренности слайсов.
  {
    files: ['src/app/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': 'off',
    },
  }
)
