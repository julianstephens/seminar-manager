import babel from "@rolldown/plugin-babel";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const apiProxyTarget =
    process.env.VITE_API_PROXY_TARGET ||
    (mode === "production" ? "http://api:3000" : "http://localhost:3000");

  return {
    plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
    resolve: {
      alias: {
        "@": "/src",
      },
    },
    server: {
      proxy: {
        "/api": {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
