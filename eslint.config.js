// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const sonarjs = require("eslint-plugin-sonarjs");

module.exports = defineConfig([
  expoConfig,

  {
    plugins: {
      sonarjs,
    },
    rules: {
      // Zyklomatische Komplexität
      complexity: ["warn", 10],

      // Code Smells / Maintainability
      "sonarjs/cognitive-complexity": ["warn", 10],
      "sonarjs/no-duplicate-string": "warn",
      "sonarjs/no-identical-functions": "warn",
    },
  },

  {
    ignores: ["node_modules/*", ".expo/*", "dist/*", "build/*", "coverage/*"],
  },
]);
