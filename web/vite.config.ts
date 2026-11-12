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
        // The main page (index.html) is NOT saved at install time. Right after a new
        // version goes live, Render's network can still hand out the old page for a few
        // minutes, and saving that would keep people on the old version.
        globPatterns: ["**/*.{js,mjs,css,svg,png,woff2}"],
        navigateFallback: null,
        runtimeCaching: [
          {
            // Pages: always try the internet first (so updates show straight away),
            // and fall back to the last saved copy when offline. Every page of the app
            // is the same file, so they share one saved copy.
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "app-page",
              networkTimeoutSeconds: 5,
              plugins: [{ cacheKeyWillBeUsed: async () => "/app-page" }],
            },
          },
        ],
      },
    }),
  ],
  server: { port: 5173, strictPort: true },
  test: { environment: "node" },
});
