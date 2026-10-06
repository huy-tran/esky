// https://nuxt.com/docs/api/configuration/nuxt-config
import pkg from './package.json'

export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  modules: ['@nuxt/ui'],
  ssr: false,
  devtools: { enabled: false },
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      title: 'Esky',
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/esky-icon.svg' }]
    }
  },
  runtimeConfig: {
    public: {
      // Single source of truth for the version: package.json (tauri.conf.json reads it too).
      appVersion: pkg.version
    }
  },
  ui: {
    // Fonts are bundled locally through @fontsource (see main.css).
    fonts: false
  },
  icon: {
    // Bundle every Lucide icon used in the source so the desktop app works offline.
    provider: 'none',
    clientBundle: {
      // Icon names live in data and composables too, not only in templates.
      scan: { globInclude: ['app/**/*.{vue,ts}'] },
      sizeLimitKb: 512
    }
  },
  colorMode: {
    preference: 'dark',
    fallback: 'dark'
  },
  // Every window loads its own route from the static build.
  nitro: {
    prerender: { routes: ['/', '/settings', '/float'] }
  },
  // Tauri expects a fixed port and a static build.
  devServer: { port: 1420 },
  vite: {
    clearScreen: false,
    envPrefix: ['VITE_', 'TAURI_'],
    server: { strictPort: true }
  },
  ignore: ['**/src-tauri/**']
})
