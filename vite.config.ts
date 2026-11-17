import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";

export default defineConfig({
  plugins: [react(), tailwindcss(), jsxLocPlugin(), vitePluginManusRuntime()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "client/src"), "@shared": path.resolve(import.meta.dirname, "shared") } },
  root: path.resolve(import.meta.dirname, "client"),
  envDir: path.resolve(import.meta.dirname),
  build: { outDir: path.resolve(import.meta.dirname, "dist/public"), emptyOutDir: true },
  server: { host: "0.0.0.0", port: 3000, strictPort: true,
    allowedHosts: [".manus.computer", ".manuspre.computer", ".manus-asia.computer", ".manuscomputer.ai", "localhost", "127.0.0.1"],
    fs: { strict: true, deny: ["**/.git/**", "**/.env", "**/.env.*"] },
  },
});
