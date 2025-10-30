import { defineConfig } from 'vite';

export default defineConfig({
  base: '/VektorInk/',
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
