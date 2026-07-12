import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Só existe para o vitest resolver o alias "@/" do tsconfig (o Next resolve sozinho).
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
  },
});
