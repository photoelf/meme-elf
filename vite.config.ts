import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import type { Plugin, ViteDevServer } from 'vite';
import { defineConfig } from 'vitest/config';

import { createTemplateCatalogPromoter } from './src/dev/template-catalog-promote';

const WORKSPACE_ROOT = fileURLToPath(new URL('./', import.meta.url));

export default defineConfig({
  plugins: [react(), templatePromotePlugin()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './vitest.setup.ts',
  },
});

function templatePromotePlugin(): Plugin {
  return {
    name: 'template-promote-plugin',
    configureServer(server: ViteDevServer) {
      const promoteCatalog = createTemplateCatalogPromoter({ workspaceRoot: WORKSPACE_ROOT });

      server.middlewares.use(async (req, res, next) => {
        const request = req as PromoteRequest;
        const requestPath = request.url?.split('?')[0];

        if (requestPath !== '/__dev/templates/promote') {
          next();
          return;
        }

        if (!isLocalhostOnlyServer(server)) {
          res.statusCode = 404;
          res.end();
          return;
        }

        if (request.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }

        try {
          const payload = await readJsonBody(request);
          await promoteCatalog(payload as Parameters<typeof promoteCatalog>[0]);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true }));
        } catch (error) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              ok: false,
              error: error instanceof Error ? error.message : 'Failed to promote template catalog.',
            }),
          );
        }
      });
    },
  };
}

function isLocalhostOnlyServer(server: ViteDevServer) {
  const host = server.config.server.host;
  return host === undefined || host === false || host === 'localhost' || host === '127.0.0.1';
}

type PromoteRequest = {
  method?: string;
  url?: string;
  on: (
    event: 'data' | 'end' | 'error',
    listener: ((chunk: Uint8Array | string) => void) | (() => void) | ((error: unknown) => void),
  ) => void;
};

function readJsonBody(req: PromoteRequest): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let raw = '';

    req.on('data', (chunk) => {
      raw += typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk, { stream: true });
    });
    req.on('end', () => {
      try {
        const normalized = raw.trim();
        resolve(normalized.length > 0 ? (JSON.parse(normalized) as unknown) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}
