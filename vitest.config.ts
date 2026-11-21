import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: {
      DATABASE_URL: "file:./dev.db",
      AUTH_SECRET: "test-secret-test-secret-test-secret",
      BRIDGE_MOCK: "true",
      APP_URL: "http://localhost:3000",
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
