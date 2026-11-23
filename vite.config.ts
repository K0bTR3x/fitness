import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { viteSingleFile } from 'vite-plugin-singlefile'

// "demo" rejimi: Supabase olmadan, məlumat telefonun yaddaşında, bir HTML faylında (önizləmə üçün).
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [
    vue(),
    tailwindcss(),
    mode === 'demo'
      ? viteSingleFile()
      : VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['icon.svg', 'apple-touch-icon.png'],
          manifest: {
            name: 'Fitness Dashboard',
            short_name: 'Fitness',
            lang: 'az',
            start_url: './',
            display: 'standalone',
            background_color: '#F3F4F6',
            theme_color: '#16A34A',
            icons: [
              { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
              { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
              { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
            ],
          },
          workbox: {
            globPatterns: ['**/*.{js,css,html,svg,png,jpg,woff2}'],
            navigateFallback: 'index.html',
            importScripts: ['push-sw.js'],
          },
        }),
  ],
  build: { outDir: mode === 'demo' ? 'dist-demo' : 'dist' },
  test: { environment: 'node' },
}))
