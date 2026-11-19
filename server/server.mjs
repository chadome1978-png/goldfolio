import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getOfficialGoldQuote } from './price-source.mjs';
import { handleGoldfolioApi } from './cloud-api.mjs';

const PORT = Number(process.env.PORT) || 3000;
const DIST = resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 30;
const rateWindows = new Map();

function sendJson(response, status, value, headers = {}) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  response.end(JSON.stringify(value));
}

function withinRateLimit(key) {
  const now = Date.now();
  let window = rateWindows.get(key);
  if (!window || now - window.startedAt >= WINDOW_MS) {
    window = { startedAt: now, count: 0 };
    rateWindows.set(key, window);
  }
  window.count += 1;
  if (rateWindows.size > 5000) {
    for (const [address, entry] of rateWindows) {
      if (now - entry.startedAt >= WINDOW_MS) rateWindows.delete(address);
    }
  }
  return window.count <= MAX_REQUESTS_PER_WINDOW;
}

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

async function serveStatic(pathname, response) {
  let decoded;
  try { decoded = decodeURIComponent(pathname); }
  catch { sendJson(response, 400, { error: 'invalid_path' }); return; }
  if (decoded.includes('\0')) { sendJson(response, 400, { error: 'invalid_path' }); return; }

  let filePath = resolve(DIST, `.${decoded}`);
  if (filePath !== DIST && !filePath.startsWith(`${DIST}${sep}`)) {
    sendJson(response, 400, { error: 'invalid_path' });
    return;
  }

  try {
    const content = await readFile(filePath);
    response.writeHead(200, {
      'Content-Type': MIME_TYPES[extname(filePath)] ?? 'application/octet-stream',
      'Cache-Control': extname(filePath) === '.html' ? 'no-cache' : 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(content);
  } catch {
    if (!extname(decoded)) {
      try {
        const content = await readFile(resolve(DIST, 'index.html'));
        response.writeHead(200, { 'Content-Type': MIME_TYPES['.html'], 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
        response.end(content);
        return;
      } catch { /* fall through to 404 */ }
    }
    sendJson(response, 404, { error: 'not_found' });
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  if (url.pathname === '/_app/health') {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (url.pathname === '/api/gold-prices') {
    if (request.method !== 'GET') {
      sendJson(response, 405, { error: 'method_not_allowed' }, { Allow: 'GET' });
      return;
    }
    const address = request.socket.remoteAddress ?? 'unknown';
    if (!withinRateLimit(address)) {
      sendJson(response, 429, { error: 'rate_limited' }, { 'Retry-After': '60' });
      return;
    }
    try {
      const snapshot = await getOfficialGoldQuote();
      sendJson(response, 200, snapshot);
    } catch {
      sendJson(response, 502, { error: 'price_source_unavailable', message: 'ไม่สามารถดึงราคาจากสมาคมค้าทองคำได้ในขณะนี้' });
    }
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    if (await handleGoldfolioApi(request, response)) return;
    sendJson(response, 404, { error: 'not_found' });
    return;
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    sendJson(response, 405, { error: 'method_not_allowed' }, { Allow: 'GET, HEAD' });
    return;
  }
  await serveStatic(url.pathname, response);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Gold portfolio server listening on ${PORT}`);
});
