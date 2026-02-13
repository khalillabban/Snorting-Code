module.exports = {
  preset: "jest-expo",
  testEnvironment: "jsdom",
  rootDir: "./",

  transformIgnorePatterns: [
    "node_modules/(?!(jest-)?react-native|@react-native|react-clone-referenced-element|@react-native-community|expo(nent)?|@expo(nent)?/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|@sentry/.*|react-router-native)",
  ],
  setupFilesAfterEnv: ["@testing-library/jest-native/extend-expect"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],

  collectCoverageFrom: [
    "**/*.{ts,tsx}", // Collect from ALL files
    "!**/__tests__/**", // Exclude test directory
    "!**/*.test.{ts,tsx}", // Exclude test files
    "!**/*.spec.{ts,tsx}", // Exclude spec files
    "!**/node_modules/**",
    "!**/coverage/**",
    "!**/.expo/**",
    "!**/babel.config.js",
    "!**/jest.config.js",
    "!**/metro.config.js",
    "!**/app.config.js",
    "!**/*.config.{js,ts}",
  ],

  testMatch: [
    "**/__tests__/**/*.test.(ts|tsx)",
    "**/?(*.)+(spec|test).[jt]s?(x)",
  ],

  coverageDirectory: "coverage",
  coverageReporters: ["lcov", "text", "clover"],

  moduleNameMapper: {
    "^utils/(.*)$": "<rootDir>/utils/$1",
    "^constants/(.*)$": "<rootDir>/constants/$1",
  },
};
