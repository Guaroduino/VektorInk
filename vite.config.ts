import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    open: true,
  },
  build: {
    outDir: 'dist',
  },
  resolve: {
    alias: {
      'tess2.js': 'tess2',
    },
  },
});
