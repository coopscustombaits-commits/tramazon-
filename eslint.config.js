const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // `functions/lib` is compiled output — gitignored, but a flat config
    // doesn't read nested .gitignore files, so it has to be named here or
    // eslint reports on generated JavaScript.
    ignores: ['dist/*', 'node_modules/*', '.expo/*', 'functions/lib/*'],
  },
]);
