/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Everything (code, styles, fonts, logo) is inlined into one HTML file for the demo.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: { assetsInlineLimit: 100_000_000, outDir: 'dist' },
  test: { environment: 'node' },
});
