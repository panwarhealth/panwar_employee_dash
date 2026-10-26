import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

const outDir = path.resolve(__dirname, 'public/scorm-player');

const fileList = (): Plugin => ({
  name: 'scorm-player-files',
  writeBundle() {
    const files = fs
      .readdirSync(outDir, { recursive: true, withFileTypes: true })
      .filter((d) => d.isFile() && d.name !== 'files.json')
      .map((d) => path.relative(outDir, path.join(d.parentPath, d.name)).split(path.sep).join('/'));
    fs.writeFileSync(path.join(outDir, 'files.json'), JSON.stringify(files));
  },
});

const classicScript = (): Plugin => ({
  name: 'scorm-player-classic-script',
  enforce: 'post',
  transformIndexHtml: (html) =>
    html
      .replace(
        /<script type="module" crossorigin src="([^"]+)"><\/script>/,
        '<script defer src="$1"></script>',
      )
      .replace(/ crossorigin/g, ''),
});

export default defineConfig({
  root: path.resolve(__dirname, 'src/course/player'),
  base: './',
  plugins: [react(), classicScript(), fileList()],
  build: {
    outDir,
    emptyOutDir: true,
    target: 'es2019',
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: { output: { format: 'iife', inlineDynamicImports: true } },
  },
});
