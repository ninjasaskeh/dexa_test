import { defineConfig, mergeConfig } from "vitest/config"
import viteConfig from "./vite.config.ts"

// Format tanggal/jam di test mengikuti zona waktu server
process.env.TZ = "Asia/Jakarta"

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      include: ["src/**/*.test.{ts,tsx}"],
      setupFiles: ["src/test/setup.ts"],
      restoreMocks: true,
    },
  }),
)
