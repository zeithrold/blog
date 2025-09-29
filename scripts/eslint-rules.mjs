/**
 * More strict rules for ESLint, for a better code quality.
 * @type import('@antfu/eslint-config').Rules
 */
const rules = {
  'complexity': [
    'error',
    {
      max: 6,
    },
  ],
  'jsdoc/check-indentation': 'error',
  'jsdoc/require-jsdoc': [
    'warn',
    {
      require: {
        ArrowFunctionExpression: true,
        ClassDeclaration: true,
        FunctionDeclaration: true,
        FunctionExpression: true,
        MethodDefinition: true,
      },
    },
  ],
  'max-depth': [
    'error',
    4,
  ],
  'max-lines': [
    'error',
    200,
  ],
  'max-lines-per-function': [
    'warn',
    40,
  ],
  'style/array-bracket-newline': [
    'error',
    {
      minItems: 2,
      multiline: true,
    },
  ],
  'style/array-element-newline': [
    'error',
    {
      consistent: true,
      minItems: 4,
    },
  ],
  'style/curly-newline': [
    'error',
    {
      consistent: true,
      minElements: 2,
    },
  ],
  'ts/max-params': [
    'error',
    { max: 3 },
  ],
  'vue/component-name-in-template-casing': [
    'error',
    'PascalCase',
  ],
  'vue/block-lang': [
    'error',
    {
      script: { lang: 'ts' },
    },
  ],
  'vue/component-api-style': [
    'error',
    ['script-setup'],
  ],
  'vue/define-emits-declaration': [
    'error',
    'type-based',
  ],
  'vue/define-props-declaration': [
    'error',
    'type-based',
  ],
  'vue/define-props-destructuring': 'error',
  'vue/html-comment-content-newline': [
    'error',
    {
      singleline: 'never',
      multiline: 'always',
    },
  ],
  'vue/max-template-depth': [
    'error',
    { maxDepth: 5 },
  ],
  'vue/next-tick-style': 'error',
  'vue/max-attributes-per-line': [
    'error',
    {
      singleline: { max: 3 },
      multiline: { max: 1 },
    },
  ],
}

export default rules
