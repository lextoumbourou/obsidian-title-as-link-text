module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    plugins: [
        '@typescript-eslint'
    ],
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended'
    ],
    env: {
        node: true,
        jest: true
    },
    rules: {
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        '@typescript-eslint/no-explicit-any': 'warn',
        'no-console': ['warn', { allow: ['warn', 'error'] }],
        'semi': ['error', 'always'],
        'quotes': ['error', 'single']
    }
};