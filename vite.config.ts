import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig, Plugin } from 'vite';

const LEGACY_JS_ALIASES = [
  'index-H4ta2Lfz.js',
  'index-DOBY5U0E.js',
  'index-GNzn6AF-.js',
  'index-D55SRQMF.js',
  'index-DrbKFzjM.js',
  'index-BffrS0Mk.js',
  'index-Ch_wfcD0.js',
];

const LEGACY_CSS_ALIASES = [
  'index-BUCstWlN.css',
  'index-BlwBnZL_.css',
  'index-Ckz1pUCl.css',
  'index-zkKCPrOo.css',
  'index-8uUlO5Lv.css',
];

function keepLegacyAssetAliases(): Plugin {
  return {
    name: 'keep-legacy-asset-aliases',
    closeBundle() {
      const assetsDir = path.resolve(__dirname, 'dist/assets');
      const mainJs = path.join(assetsDir, 'app.js');
      const mainCss = path.join(assetsDir, 'app.css');
      if (fs.existsSync(mainJs)) {
        for (const alias of LEGACY_JS_ALIASES) {
          fs.copyFileSync(mainJs, path.join(assetsDir, alias));
        }
      }
      if (fs.existsSync(mainCss)) {
        for (const alias of LEGACY_CSS_ALIASES) {
          fs.copyFileSync(mainCss, path.join(assetsDir, alias));
        }
      }
    },
  };
}

export default defineConfig(() => {
  const now = new Date();
  const buildTime = now.toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const buildDate = now.toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  });

  return {
    base: './',
    plugins: [react(), tailwindcss(), keepLegacyAssetAliases()],
    server: {
      allowedHosts: true,
    },
    build: {
      rollupOptions: {
        output: {
          entryFileNames: 'assets/app.js',
          chunkFileNames: 'assets/chunk-[name].js',
          assetFileNames: 'assets/app[extname]',
        },
      },
    },
    define: {
      __BUILD_TIMESTAMP__: JSON.stringify(`${buildTime} - ${buildDate}`),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  };
});
