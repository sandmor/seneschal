import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist', 'node_modules', 'src/api/**', '**/*.gen.ts'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/naming-convention': [
        'error',

        // Types, interfaces, enums, classes, type parameters
        { selector: 'typeLike', format: ['PascalCase'] },

        // Enum members
        { selector: 'enumMember', format: ['PascalCase'] },

        // All const variables — camelCase (utilities), PascalCase (React components), or UPPER_CASE (constants)
        {
          selector: 'variable',
          modifiers: ['const'],
          format: null,
          filter: {
            regex: '^__[a-zA-Z][a-zA-Z0-9]*$',
            match: true,
          },
        },
        {
          selector: 'variable',
          modifiers: ['const'],
          format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
          leadingUnderscore: 'allow',
        },

        // Mutable variables — camelCase only
        {
          selector: 'variable',
          format: ['camelCase'],
          leadingUnderscore: 'allow',
        },

        // Exported functions — camelCase (utilities) or PascalCase (React components as function declarations)
        {
          selector: 'function',
          modifiers: ['exported'],
          format: ['camelCase', 'PascalCase'],
        },

        // 6. Non-exported functions — camelCase only
        {
          selector: 'function',
          format: ['camelCase'],
        },

        // Parameters — camelCase, allow leading underscore for unused
        {
          selector: 'parameter',
          format: ['camelCase'],
          leadingUnderscore: 'allow',
        },

        // Class properties and methods — camelCase
        {
          selector: 'classProperty',
          format: ['camelCase'],
          leadingUnderscore: 'allow',
        },
        {
          selector: 'classMethod',
          format: ['camelCase'],
        },

        // Type properties — camelCase
        {
          selector: 'typeProperty',
          format: ['camelCase'],
          leadingUnderscore: 'allow',
        },

        // Object literal properties — no enforcement (framework configs, external APIs)
        {
          selector: 'objectLiteralProperty',
          format: null,
        },
      ],
    },
  },
);
