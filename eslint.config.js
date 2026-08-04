import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import tailwindPlugin from 'eslint-plugin-tailwindcss';

export default tseslint.config(
  {
    ignores: ['dist', 'node_modules', 'temp-app', '.agents', 'capacitor.config.ts']
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,jsx,mjs,cjs,ts,tsx}'],
    plugins: {
      react: reactPlugin,
      tailwindcss: tailwindPlugin,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      'tailwindcss/no-arbitrary-value': 'error',
      'tailwindcss/no-custom-classname': 'off',
      '@typescript-eslint/no-unused-vars': 'off', 
      'react/react-in-jsx-scope': 'off'
    },
  }
);
