import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "dist/",
        "docs/",
        "**/*.d.ts",
        "**/*.config.*",
        "src/playground/**",
        "**/__tests__/**",
        "**/*.test.*",
        "**/*.spec.*",
      ],
    },
  },
  esbuild: {
    target: "node18",
  },
});
