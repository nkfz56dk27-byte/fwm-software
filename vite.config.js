import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        entryFileNames: `[name].[hash].js`,
        chunkFileNames: `[name].[hash].js`,
        assetFileNames: `[name].[hash].[ext]`,
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('firebase')) {
              return 'firebase-vendor'
            }
            if (id.includes('supabase')) {
              return 'supabase-vendor'
            }
            if (id.includes('react-router')) {
              return 'react-router-vendor'
            }
            return 'vendors'
          }
        }
      }
    },
    chunkSizeWarningLimit: 1000
  }
})

