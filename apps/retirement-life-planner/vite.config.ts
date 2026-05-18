import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  base: process.env.GITHUB_PAGES === "true" ? "/retirement-simulator/" : "/",
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/src/lib/simulation") || id.includes("/src/lib/taxEngine") || id.includes("/src/lib/taxFilingAdvice")) {
            return "app-calculation";
          }
          if (id.includes("/src/lib/flexibleFreeCash") || id.includes("/src/lib/assetUseAnalysis") || id.includes("/src/lib/scenarioDiff")) {
            return "app-analysis";
          }
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("react") || id.includes("react-dom") || id.includes("scheduler")) return "vendor-react";
          if (id.includes("recharts") || id.includes("d3-") || id.includes("victory-vendor")) return "vendor-charts";
          if (id.includes("lucide-react")) return "vendor-icons";
          if (id.includes("zustand") || id.includes("immer")) return "vendor-state";
          return undefined;
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    css: true,
  },
});
