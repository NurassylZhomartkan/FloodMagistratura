import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
  },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':  ['react', 'react-dom', 'react-router-dom'],
          'vendor-mui':    ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
          'vendor-mapbox': ['mapbox-gl', '@mapbox/mapbox-gl-draw', '@mapbox/mapbox-gl-geocoder'],
          'vendor-three':  ['three', 'threebox-plugin'],
          'vendor-turf':   ['@turf/turf'],
          'vendor-chart':  ['chart.js', 'react-chartjs-2'],
          'vendor-i18n':   ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
          'vendor-misc':   ['zustand', 'geotiff'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/auth': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    }
  }
})
