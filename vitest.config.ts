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
        // Barrel re-export files have no executable code worth covering.
        "src/index.ts",
        "src/client/index.ts",
        "src/webhooks/index.ts",
      ],
    },
  },
  esbuild: {
    target: "node18",
  },
});
