import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["node_modules/**", "test-results/**", "local-data/**", "dist/**"],
  },
  ...tseslint.configs.recommended,
  {
    files: ["tests/desktop/probe/*.cjs"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    files: ["**/*.ts"],
    rules: { "@typescript-eslint/consistent-type-imports": "error" },
  },
);
