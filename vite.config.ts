// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  vite: {
    plugins: [
      VitePWA({
        registerType: "autoUpdate",
        // Disabled in dev so Lovable's preview iframe is never affected.
        devOptions: { enabled: false },
        includeAssets: ["icon-192.png", "icon-512.png"],
        manifest: {
          name: "Flebo Perú · Historias Clínicas",
          short_name: "Flebo Perú",
          description:
            "Historias clínicas digitales para la clínica Flebo Perú. Funciona offline en tablet.",
          theme_color: "#0a84ff",
          background_color: "#ffffff",
          display: "standalone",
          orientation: "portrait",
          start_url: "/",
          scope: "/",
          lang: "es-PE",
          icons: [
            { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
            { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
          ],
        },
        workbox: {
          navigateFallbackDenylist: [/^\/~oauth/, /^\/api\//],
          globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
          runtimeCaching: [
            {
              urlPattern: ({ url }) =>
                url.hostname.endsWith("supabase.co") &&
                url.pathname.includes("/storage/v1/object/public/"),
              handler: "CacheFirst",
              options: {
                cacheName: "supabase-storage",
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
          ],
        },
      }),
    ],
  },
});
