const globals = require('globals');

module.exports = [
  {
    ignores: ['node_modules', 'dist', 'build'],

    files: ['**/*.js'],

    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',

      globals: {
        ...globals.node, // 👈 HII NDIO FIX
      },
    },

    plugins: {
      'unused-imports': require('eslint-plugin-unused-imports'),
    },

    rules: {
      'no-undef': 'error',

      'unused-imports/no-unused-imports': 'error',

      'unused-imports/no-unused-vars': [
        'error',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],
    },
  },
];
