import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", ".next", "build", ".wrangler", ".open-next", "node_modules", "out", "lib/feedback-widget"] },
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  }
);
