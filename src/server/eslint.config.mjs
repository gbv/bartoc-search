import globals from "globals"
import pluginJs from "@eslint/js"
import tseslint from "typescript-eslint"
import jest from "eslint-plugin-jest"

export default [
  {
    ignores: ["dist/"],
  },
  { files: ["src/**/*.{js,ts}"] },
  { files: ["**/*.js"], languageOptions: { sourceType: "commonjs" } },
  { languageOptions: { globals: globals.node } },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/tests/**/*.{js,ts}"],
    ...jest.configs["flat/recommended"],
    rules: {
      ...jest.configs["flat/recommended"].rules,
      "jest/prefer-expect-assertions": "off",
    },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
]
