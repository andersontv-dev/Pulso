import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'coverage/**',
    'playwright-report/**',
    'test-results/**',
    'next-env.d.ts',
  ]),
  {
    // Architectural boundary, enforced by the linter rather than by convention.
    // Only the BFF route handlers may reach the form30x transport layer: the API
    // key is server-only, and components must consume aggregated domain data.
    files: ['src/components/**/*.{ts,tsx}', 'src/hooks/**/*.{ts,tsx}', 'src/app/**/page.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/lib/api', '@/lib/api/*'],
              message:
                'UI code must not talk to form30x directly. Go through /api/* route handlers; the API key never reaches the browser.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/lib/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/lib/api', '@/lib/api/*', 'next/*'],
              message:
                'lib/domain must stay pure and transport-agnostic so it can be unit tested without the network.',
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
