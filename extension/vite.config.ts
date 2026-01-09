import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

/**
 * Vite configuration for Chrome Extension
 *
 * Architecture:
 * - Builds extension as multi-entry application (background, popup, options)
 * - Extension is now self-contained (no CLI dependencies)
 * - Output to dist-extension/ (isolated from CLI build)
 * - Resolves path aliases to reuse types from CLI
 */
export default defineConfig({
  plugins: [react()],

  // Use relative paths for Chrome extension
  base: './',

  build: {
    outDir: '../dist-extension',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        // Multiple entry points for extension components
        background: resolve(__dirname, 'src/background/service-worker.ts'),
        popup: resolve(__dirname, 'src/popup/index.tsx'),
        options: resolve(__dirname, 'src/options/index.tsx'),
        offscreen: resolve(__dirname, 'src/offscreen/offscreen.ts'),
      },
      output: {
        // Keep entry files at root for manifest.json
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name].[hash].js',
        assetFileNames: 'assets/[name].[ext]'
      }
    }
  },

  resolve: {
    alias: {
      '@core': resolve(__dirname, '../src/core'),
      '@converters': resolve(__dirname, '../src/converters'),
      '@types': resolve(__dirname, '../src/types.ts'),
      '@errors': resolve(__dirname, '../src/errors'),
    }
  }
})


