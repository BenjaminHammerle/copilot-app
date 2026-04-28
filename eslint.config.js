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
      ...sonarjs.configs.recommended.rules,
      // Zyklomatische Komplexität
      complexity: ["warn", 10],

      // Code Smells / Maintainability
      "sonarjs/cognitive-complexity": ["warn", 10],
      "sonarjs/no-duplicate-string": "warn",
      "sonarjs/no-identical-functions": "warn",
      "sonarjs/no-all-duplicated-branches": "warn",
      "sonarjs/no-identical-expressions": "warn",
      "sonarjs/no-redundant-boolean": "warn",
    },
  },

  {
    ignores: ["node_modules/*", ".expo/*", "dist/*", "build/*", "coverage/*"],
  },
]);
