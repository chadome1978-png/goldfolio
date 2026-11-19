import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { getOfficialGoldQuote } from './server/price-source.mjs';
import { handleGoldfolioApi } from './server/cloud-api.mjs';

function goldfolioApiPlugin(): Plugin {
  const middleware = (request: IncomingMessage, response: ServerResponse, next: (error?: unknown) => void) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (!url.pathname.startsWith('/api/')) return next();
    void handleGoldfolioApi(request, response).then((handled) => {
      if (!handled && !response.writableEnded) next();
    }).catch(() => {
      if (!response.writableEnded) {
        response.statusCode = 500;
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.setHeader('Cache-Control', 'no-store');
        response.end(JSON.stringify({ error: 'internal_error' }));
      }
    });
  };

  return {
    name: 'goldfolio-cloud-api',
    configureServer(server) { server.middlewares.use(middleware); },
    configurePreviewServer(server) { server.middlewares.use(middleware); },
  };
}

function priceApiPlugin(): Plugin {
  const middleware = (request: IncomingMessage, response: ServerResponse, next: (error?: unknown) => void) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (url.pathname === '/_app/health') {
      response.statusCode = 200;
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      response.end(JSON.stringify({ ok: true }));
      return;
    }
    if (url.pathname !== '/api/gold-prices') return next();
    if (request.method !== 'GET') {
      response.statusCode = 405;
      response.setHeader('Allow', 'GET');
      response.end(JSON.stringify({ error: 'method_not_allowed' }));
      return;
    }
    void getOfficialGoldQuote().then((snapshot) => {
      response.statusCode = 200;
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      response.setHeader('Cache-Control', 'no-store');
      response.setHeader('X-Content-Type-Options', 'nosniff');
      response.end(JSON.stringify(snapshot));
    }).catch(() => {
      response.statusCode = 502;
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      response.setHeader('Cache-Control', 'no-store');
      response.end(JSON.stringify({ error: 'price_source_unavailable', message: 'ไม่สามารถดึงราคาจากสมาคมค้าทองคำได้ในขณะนี้' }));
    });
  };

  return {
    name: 'gold-association-price-api',
    configureServer(server) { server.middlewares.use(middleware); },
    configurePreviewServer(server) { server.middlewares.use(middleware); },
  };
}

export default defineConfig({
  plugins: [react(), priceApiPlugin(), goldfolioApiPlugin()],
  build: { outDir: 'dist', emptyOutDir: true },
});
