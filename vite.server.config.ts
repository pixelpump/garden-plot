import { defineConfig } from 'vite';

// The puzzle checker as one CommonJS file for Shepherd's Express API (npm run build:server).
export default defineConfig({
  build: {
    outDir: 'dist-server',
    emptyOutDir: true,
    minify: false,
    target: 'node20',
    lib: {
      entry: 'src/server.ts',
      formats: ['cjs'],
      fileName: () => 'garden-plot.cjs',
    },
  },
});
