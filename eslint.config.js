import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/out/**', '**/coverage/**', 'prototipos/**', 'services/**'] },
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
    },
  },
  {
    files: ['**/*.js', '**/*.cjs', '**/*.mjs'],
    ignores: ['extensions/gnome/**'],
    languageOptions: { globals: globals.node },
  },
  {
    // Extensão GNOME: roda no GJS do gnome-shell, não no Node.
    files: ['extensions/gnome/**/*.js'],
    languageOptions: {
      globals: {
        global: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      },
    },
  },
  prettier,
);
