import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["node_modules/**", ".astra/**", "dist/**"] },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    rules: { "@typescript-eslint/consistent-type-imports": "error" },
  },
);
