const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
  {
    ignores: ["coverage/**", "node_modules/**"],
  },
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-unused-vars": ["error", { args: "none" }],
    },
  },
  {
    // vitestのテストファイルはESM構文(import/export)で書かれている
    files: ["**/*.test.js"],
    languageOptions: {
      sourceType: "module",
    },
  },
];
