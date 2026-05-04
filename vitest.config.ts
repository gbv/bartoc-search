import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: "node",
    include: ["src/tests/**/*.spec.ts", "src/tests/**/*.test.ts"],
    testTimeout: 120_000,   // Solr boot + indexing
    hookTimeout: 120_000,
    pool: "threads",
    poolOptions: { threads: { singleThread: true } },
    globals: true,
    reporters: ["default"],
    // coverage (c8)
    coverage: {
      reporter: ["text", "html"],
      reportsDirectory: "./coverage",
      exclude: ["**/dist/**", "**/tests/**"],
    },
  },
});
