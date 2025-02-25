import eslintPluginTypescript from "@typescript-eslint/eslint-plugin";
import eslintParserTypescript from "@typescript-eslint/parser";
import eslintPluginSimpleImportSort from "eslint-plugin-simple-import-sort";
import globals from "globals";

export default [
  {
    files: ["**/*.ts", "**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
      parser: eslintParserTypescript,
    },
    plugins: {
      "@typescript-eslint": eslintPluginTypescript,
      "simple-import-sort": eslintPluginSimpleImportSort,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "simple-import-sort/imports": "error",
    },
  },
];
