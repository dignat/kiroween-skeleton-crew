import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

// The Witch's Pantry web UI (task 20), deployed to GitHub Pages (task 22).
// `base` must match the Pages subpath (https://<user>.github.io/<repo>/). It is
// overridable with VITE_BASE so a different repo name or a custom domain works
// without editing this file.
const srcRoot = fileURLToPath(new URL('./src', import.meta.url));
const distOut = fileURLToPath(new URL('./dist', import.meta.url));

export default defineConfig({
  root: srcRoot,
  base: process.env.VITE_BASE ?? '/',
  build: {
    outDir: distOut,
    emptyOutDir: true,
  },
});
