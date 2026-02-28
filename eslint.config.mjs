import nextConfig from "eslint-config-next";
import coreWebVitals from "eslint-config-next/core-web-vitals";
import tsConfig from "eslint-config-next/typescript";
import eslintConfigPrettier from "eslint-config-prettier";
import vitestPlugin from "@vitest/eslint-plugin";

const config = [
  {
    ignores: [".next/", "out/", "data/", "next-env.d.ts"],
  },
  ...nextConfig,
  ...coreWebVitals,
  ...tsConfig,
  {
    rules: {
      "no-console": "off",
    },
  },
  {
    files: ["tests/**/*.ts"],
    plugins: { vitest: vitestPlugin },
    rules: {
      ...vitestPlugin.configs.recommended.rules,
    },
  },
  eslintConfigPrettier,
];

export default config;
