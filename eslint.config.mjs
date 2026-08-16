import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  {
    // The audit harnesses are plain Node scripts that drive a browser against
    // the built app. They are not part of the bundle, so the app rules for
    // module syntax and browser globals do not apply to them.
    files: ["scripts/**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: { require: "readonly", module: "writable", process: "readonly", console: "readonly", __dirname: "readonly", fetch: "readonly", AbortSignal: "readonly", setTimeout: "readonly" },
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
];

export default eslintConfig;
