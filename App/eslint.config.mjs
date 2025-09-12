import { defineConfig } from "eslint/config";
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import pluginReactNative from "eslint-plugin-react-native";
import pluginPrettier from "eslint-plugin-prettier";
import prettier from "eslint-config-prettier";

export default defineConfig([
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.es6,
        // Globals específicos de React Native
        __DEV__: "readonly",
        fetch: "readonly",
        FormData: "readonly",
        navigator: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      react: pluginReact,
      "react-hooks": pluginReactHooks,
      "react-native": pluginReactNative,
      prettier: pluginPrettier,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tseslint.configs.recommended.rules,
      ...pluginReact.configs.recommended.rules,
      ...pluginReactHooks.configs.recommended.rules,

      // Prettier
      "prettier/prettier": ["error"],

      // React específico
      "react/react-in-jsx-scope": "off", // No necesario en RN
      "react/prop-types": "off", // Usamos TypeScript

      // TypeScript específico
      "@typescript-eslint/no-var-requires": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],

      // React Native específico
      "react-native/no-unused-styles": "error",
      "react-native/no-inline-styles": "warn",
      "react-native/no-color-literals": "warn",
      "react-native/no-raw-text": "off", // A veces necesitamos texto sin Text component
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  },
  {
    // Configuración específica para archivos de configuración
    files: ["*.config.{js,ts,mjs}", "babel.config.js", "metro.config.js"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "@typescript-eslint/no-var-requires": "off",
    },
  },
  prettier,
]);
