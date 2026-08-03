import nextVitals from 'eslint-config-next/core-web-vitals';

/** @type {import('eslint').Linter.Config[]} */
const eslintConfig = [
  ...nextVitals,
  {
    ignores: [
      '.next/**',
      'out/**',
      'build/**',
      'node_modules/**',
      'node_scripts/**',
      'scripts/**',
      'Frontend/**',
      'Backend/**',
      'next-env.d.ts',
    ],
  },
  {
    // React 19 / eslint-plugin-react-hooks added strict setState-in-effect checks.
    // Mount-time data loading and theme hydration still use effects in this app;
    // keep them as warnings until those components are refactored.
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
];

export default eslintConfig;
