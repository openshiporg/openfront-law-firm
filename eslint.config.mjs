import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
    },
  },
  {
    files: [
      "app/api/**/*.{ts,tsx}",
      "features/keystone/**/*.{ts,tsx}",
      "pages/api/**/*.ts",
      "tests/**/*.ts",
    ],
    rules: {
      // Keystone hook/context and GraphQL runtime values are intentionally dynamic.
      // Runtime validators and strict generated types provide the boundary instead.
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  globalIgnores([
    ".keystone/**",
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
    ".runtime/**",
  ]),
]);
