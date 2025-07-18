import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { createHtmlPlugin } from 'vite-plugin-html'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())

  return {
    plugins: [
      react(),
      createHtmlPlugin({
        inject: {
          data: {
            googleMapsApiKey: env.VITE_GOOGLE_MAPS_API_KEY,
          },
        },
      }),
    ],
  }
})
