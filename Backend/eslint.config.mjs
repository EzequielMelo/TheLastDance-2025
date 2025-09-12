// eslint.config.mjs
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";
import prettier from "eslint-config-prettier";

export default defineConfig([
  {
    files: ["**/*.{js,cjs,ts}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        project: "./tsconfig.json",
      },
      globals: globals.node,
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      // TypeScript específicas
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/prefer-const": "error",

      // Reglas generales
      "no-console": "off", // Permitir console.log en backend
      "no-debugger": "error",
      "prefer-const": "error",
      "no-var": "error",

      // Para APIs REST
      "consistent-return": "error",
      "no-unreachable": "error",

      // Async/await
      "no-async-promise-executor": "error",
      "require-await": "warn",

      // Imports
      "no-duplicate-imports": "error",

      // Seguridad básica
      "no-eval": "error",
      "no-implied-eval": "error",
    },
  },
  {
    // Configuración específica para archivos de test (si los tienes)
    files: ["**/*.test.ts", "**/*.spec.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": "off",
    },
  },
  {
    // Archivos de configuración
    files: ["*.config.{js,mjs,ts}", "*.d.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  ...tseslint.configs.recommended,
  prettier, // Debe ir al final para sobreescribir reglas conflictivas
]);
