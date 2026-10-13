import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  /* server: {
    // Same-origin proxy avoids CORS during local development.
    // Forwards /api/proxy?... → Azure ArcGIS .NET proxy  
    proxy: {
      "/api/proxy": {
        target:
          "https://arcgisdotnetproxy-gtgyfedfcqauh4hh.centralindia-01.azurewebsites.net",
        changeOrigin: true,
        secure: true,
      },
    },
  }, */
  optimizeDeps: {
    include: [
      "@arcgis/core",
      "@arcgis/map-components",
      "@esri/calcite-components",
    ],
  },
  build: {
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/@arcgis")) return "arcgis";
          if (id.includes("node_modules/@esri/calcite")) return "calcite";
        },
      },
    },
  },
});
