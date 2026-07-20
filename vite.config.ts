import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // VITE_PUBLIC_HOST is set only in a local, gitignored .env.local on the server that
  // sits behind the Phase 013 nginx+HTTPS proxy (see docs/ARCHITECTURE.md). Left unset,
  // Vite keeps its normal local-dev allowedHosts/HMR behavior (e.g. localhost:5174).
  const publicHost = env.VITE_PUBLIC_HOST

  return {
    plugins: [react()],
    server: {
      host: true,
      port: 5174,
      ...(publicHost
        ? {
            allowedHosts: [publicHost],
            hmr: { protocol: 'wss', host: publicHost, clientPort: 443 },
          }
        : {}),
      proxy: {
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true,
        },
      },
    },
  }
})
