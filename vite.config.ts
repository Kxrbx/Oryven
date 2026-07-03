import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Tauri default dev port
const TAURI_DEV_PORT = 1420;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  clearScreen: false,
  server: {
    port: TAURI_DEV_PORT,
    strictPort: true,
    host: "localhost",
    watch: {
      // Don't watch src-tauri to avoid restart loops
      ignored: ["**/src-tauri/**"],
    },
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: "es2022",
    minify: "esbuild",
    sourcemap: false,
  },
});
