import nextVitals from "eslint-config-next/core-web-vitals.js";
import nextTypescript from "eslint-config-next/typescript.js";

export default [
  ...nextVitals,
  ...nextTypescript,
  {
    rules: {
      // Existing UI uses browser speech APIs with vendor-specific runtime shapes.
      // Keep lint useful while those APIs are progressively given explicit types.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts"],
  },
];
