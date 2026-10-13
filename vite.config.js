import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { env } from 'node:process'

const buildId =
  env.GITHUB_SHA ||
  env.GIT_COMMIT ||
  `build-${Date.now()}`

export default defineConfig({
  define: {
    'import.meta.env.VITE_APP_BUILD_ID': JSON.stringify(buildId),
  },
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'emit-app-version',
      apply: 'build',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'version.json',
          source: JSON.stringify({
            buildId,
            builtAt: new Date().toISOString(),
          }),
        })
      },
    },
  ],
})