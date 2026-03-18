import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    extensions: [".mjs", ".js", ".ts", ".jsx", ".tsx", ".json"],
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/tests/setup.ts"],
    globals: true,
    pool: "forks",
    execArgv: ["--no-experimental-webstorage"],
    server: {
      deps: {
        inline: [
          "@burnt-labs/signers",
          "@burnt-labs/account-management",
          "cosmjs-types",
        ],
      },
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      exclude: [
        "node_modules/",
        "src/tests/**",
        "**/*.d.ts",
        "**/*.config.*",
        "**/index.ts",
        "**/assets/**",
        "**/generated/**",
        "**/*.json",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
    include: ["src/**/*.{test,spec}.{js,jsx,ts,tsx}"],
    exclude: ["node_modules", "dist"],
  },
});
