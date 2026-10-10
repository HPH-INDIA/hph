import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "");
  const proxyTarget = env.API_PROXY_TARGET;

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      port: 5173,
      proxy: proxyTarget
        ? {
            "/api": { target: proxyTarget, changeOrigin: true, secure: true },
            "/swagger-ui": { target: proxyTarget, changeOrigin: true, secure: true },
          }
        : undefined,
    },
  };
});
