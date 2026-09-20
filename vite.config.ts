import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  const publicHost = env.VERCEL_PROJECT_PRODUCTION_URL || env.VERCEL_URL
  return {
  define: {
    'import.meta.env.VITE_PUBLIC_SITE_URL': JSON.stringify(env.VITE_PUBLIC_SITE_URL || (publicHost ? `https://${publicHost}` : '')),
  },
  server: {
    proxy: {
      '/ncbi': {
        target: 'https://eutils.ncbi.nlm.nih.gov',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ncbi/, '/entrez/eutils'),
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectManifest: {
        rollupFormat: 'es',
      },
      manifest: {
        name: 'TYD – Track Your Dose',
        short_name: 'TYD',
        description: 'Persönliche Peptid-Management-App für Inventar, Zyklen und Protokoll.',
        theme_color: '#00ccf5',
        background_color: '#07091a',
        display: 'standalone',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  }
})
