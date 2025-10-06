// Flat config
import js from "@eslint/js";
import ts from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import importPlugin from "eslint-plugin-import";
import unused from "eslint-plugin-unused-imports";

export default [
  { ignores: ["dist", "node_modules"] },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { parser: tsParser },
    plugins: { "@typescript-eslint": ts, import: importPlugin, "unused-imports": unused },
    rules: {
      ...js.configs.recommended.rules,
      "@typescript-eslint/consistent-type-imports": "error",
      "unused-imports/no-unused-imports": "error",
      "import/order": ["error", {
        "groups": ["builtin","external","internal","parent","sibling","index"],
        "pathGroups": [{ "pattern": "@/**", "group": "internal", "position": "after" }],
        "newlines-between": "always"
      }]
    }
  }
];
