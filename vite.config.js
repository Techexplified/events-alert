import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        home: resolve(__dirname, 'home.html'),
        createAlert: resolve(__dirname, 'create-alert.html'),
        conditions: resolve(__dirname, 'conditions.html'),
        authorized: resolve(__dirname, 'authorized.html')
      }
    }
  }
});
