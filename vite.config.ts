// vite.config.js
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Load environment variables based on the current mode (development/production)
  // Set third parameter to '' to load all env vars regardless of prefix
  // @ts-ignore
  const env = loadEnv(mode, (process as any).cwd(), '')

  return {
    plugins: [react()],
    build: {
      outDir: 'dist',   // Vercel expects this folder
    },
    define: {
      // Manually shim process.env for the browser
      // Fallback to empty string to prevent build errors if keys are missing
      // Support both API_KEY and VITE_GEMINI_API_KEY for flexibility
      'process.env.API_KEY': JSON.stringify(env.API_KEY || env.VITE_GEMINI_API_KEY || ''),
      'process.env.REPLICATE_API_TOKEN': JSON.stringify(env.REPLICATE_API_TOKEN || env.VITE_REPLICATE_API_TOKEN || ''),
      'process.env.SUPABASE_URL': JSON.stringify(env.SUPABASE_URL || env.VITE_SUPABASE_URL || ''),
      'process.env.SUPABASE_ANON_KEY': JSON.stringify(env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || ''),
    },
    base: '/',
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path
        }
      }
    }
  }
})