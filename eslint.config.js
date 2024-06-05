const globals = require('globals');

module.exports = [
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.commonjs,
        ...globals.es6,
        ...globals.node,
        expect: 'readonly',
        describe: 'readonly',
        it: 'readonly'
      }
    },
    rules: {
      'space-before-function-paren': 'off',
      'no-extra-semi': 'off',
      'object-curly-spacing': ['error', 'always'],
      'brace-style': ['error', 'stroustrup', { allowSingleLine: true }],
      'no-useless-escape': 'off',
      'standard/no-callback-literal': 'off',
      'new-cap': 'off',
      'no-console': ['error', { allow: ['error'] }]
    }
  }
];