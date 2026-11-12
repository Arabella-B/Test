/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// Vite builds the website. The PWA plugin adds the "install on home screen"
// manifest and a service worker so the app keeps working offline.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Gap Year Hub",
        short_name: "Gap Year",
        description: "Plan, budget and share your gap year.",
        theme_color: "#7C3AED",
        background_color: "#FFF8F0",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // pdf.js is large; allow it to be cached so PDF import works offline.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        globPatterns: ["**/*.{js,mjs,css,html,svg,png,woff2}"],
        navigateFallback: "/index.html",
      },
    }),
  ],
  server: { port: 5173, strictPort: true },
  test: { environment: "node" },
});
