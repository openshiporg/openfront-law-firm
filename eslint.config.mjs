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
  {
    // The NKS dashboard is inherited platform code kept byte-for-byte with its
    // upstream (dynamic Keystone admin types, generated field views). Its
    // conventions are not this app's; owned code keeps the full rule set.
    files: ["features/dashboard/**/*.{ts,tsx}"],
    rules: {
      "@next/next/no-img-element": "off",
      "@next/next/no-location-assign-relative-destination": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "prefer-const": "off",
      "react-hooks/exhaustive-deps": "off",
      "react-hooks/immutability": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
      "react-hooks/rules-of-hooks": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/static-components": "off",
      "react/no-children-prop": "off",
      "react/no-unescaped-entities": "off",
    },
  },
  {
    // node:test suites are CommonJS scripts that load TypeScript sources through a
    // require hook (Module._extensions), which these rules cannot express.
    files: ["tests/**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "@next/next/no-assign-module-variable": "off",
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
