import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ""),
        // SSE streaming requires the proxy to flush chunks immediately
        // rather than buffer the response.
        ws: false,
        configure: (proxy) => {
          proxy.on("proxyRes", (proxyRes) => {
            const ct = proxyRes.headers["content-type"];
            if (typeof ct === "string" && ct.includes("text/event-stream")) {
              proxyRes.headers["cache-control"] = "no-cache, no-transform";
              proxyRes.headers["x-accel-buffering"] = "no";
              proxyRes.headers["connection"] = "keep-alive";
            }
          });
        },
      },
    },
  },
});
