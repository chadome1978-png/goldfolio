import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const SESSION_COOKIE = 'webdev_app_session';
const STATE_COOKIE = 'goldfolio_oauth_state';
const CSRF_COOKIE = 'goldfolio_csrf';
const SESSION_SECONDS = 60 * 60 * 24 * 30;
const STATE_SECONDS = 10 * 60;
const PROJECT_PREVIEW_ORIGIN = 'https://8328-iukdj92oxdx31g5rmcrsz-e205edc6.sg2.manus.computer';

function parseCookies(request) {
  const header = request.headers.cookie ?? '';
  const cookies = new Map();
  for (const pair of header.split(';')) {
    const separator = pair.indexOf('=');
    if (separator < 0) continue;
    const name = pair.slice(0, separator).trim();
    try { cookies.set(name, decodeURIComponent(pair.slice(separator + 1).trim())); } catch { /* ignore malformed cookies */ }
  }
  return cookies;
}

function addCookies(response, values) {
  const previous = response.getHeader('Set-Cookie');
  const list = Array.isArray(previous) ? previous : previous ? [String(previous)] : [];
  response.setHeader('Set-Cookie', [...list, ...values]);
}

function cookie(name, value, maxAge, httpOnly = true) {
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; Secure; SameSite=None${httpOnly ? '; HttpOnly' : ''}`;
}

function expiredCookie(name, httpOnly = true) {
  return `${name}=; Path=/; Max-Age=0; Secure; SameSite=None${httpOnly ? '; HttpOnly' : ''}`;
}

function constantTimeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' || left.length === 0 || left.length !== right.length) return false;
  return timingSafeEqual(Buffer.from(left), Buffer.from(right));
}

function jwtSecret() {
  const value = process.env.MANUS_JWT_SECRET;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function signJwt(payload) {
  const secret = jwtSecret();
  if (!secret) throw new Error('auth_not_configured');
  const head = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const unsigned = `${head}.${body}`;
  const signature = createHmac('sha256', secret).update(unsigned).digest('base64url');
  return `${unsigned}.${signature}`;
}

export function getSession(request) {
  const secret = jwtSecret();
  const projectId = process.env.MANUS_PROJECT_ID;
  if (!secret || !projectId) return null;
  const token = parseCookies(request).get(SESSION_COOKIE);
  if (!token || token.length > 12_000) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (header?.alg !== 'HS256') return null;
    const expected = createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest();
    const supplied = Buffer.from(parts[2], 'base64url');
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
    const now = Math.floor(Date.now() / 1000);
    if (claims?.appId !== projectId || typeof claims.openId !== 'string' || claims.openId.length < 1 || claims.openId.length > 512) return null;
    if (!Number.isFinite(claims.exp) || claims.exp <= now) return null;
    if (claims.nbf !== undefined && (!Number.isFinite(claims.nbf) || claims.nbf > now)) return null;
    return { openId: claims.openId, name: typeof claims.name === 'string' ? claims.name.slice(0, 100) : '', origin: typeof claims.origin === 'string' ? claims.origin : null };
  } catch {
    return null;
  }
}

export function ensureCsrfToken(request, response) {
  const current = parseCookies(request).get(CSRF_COOKIE);
  if (current && /^[A-Za-z0-9_-]{40,100}$/.test(current)) return current;
  const token = randomBytes(32).toString('base64url');
  addCookies(response, [cookie(CSRF_COOKIE, token, SESSION_SECONDS, false)]);
  return token;
}

export function verifyCsrf(request) {
  const fromCookie = parseCookies(request).get(CSRF_COOKIE);
  const fromHeader = request.headers['x-goldfolio-csrf'];
  return typeof fromHeader === 'string' && constantTimeEqual(fromCookie, fromHeader);
}

export function validatePublicOrigin(rawOrigin) {
  if (typeof rawOrigin !== 'string' || rawOrigin.length > 500) return null;
  try {
    const url = new URL(rawOrigin);
    if (url.origin !== rawOrigin || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null;
    if (url.protocol !== 'https:') return null;
    const configured = (process.env.GOLDFOLIO_ALLOWED_ORIGINS ?? '').split(',').map((origin) => origin.trim()).filter(Boolean);
    if (url.origin !== PROJECT_PREVIEW_ORIGIN && !configured.includes(url.origin)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function startOAuth(response, publicOrigin) {
  const projectId = process.env.MANUS_PROJECT_ID;
  const portalBase = process.env.MANUS_OAUTH_PORTAL_URL;
  if (!projectId || !portalBase || !jwtSecret()) throw new Error('auth_not_configured');
  const origin = validatePublicOrigin(publicOrigin);
  if (!origin) throw new Error('invalid_origin');
  const redirectUri = `${origin}/api/auth/callback`;
  const nonce = randomBytes(32).toString('base64url');
  const stateSecret = randomBytes(32).toString('base64url');
  const payload = { redirectUri, origin, nonce };
  const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = createHmac('sha256', stateSecret).update(payloadEncoded).digest('base64url');
  const state = Buffer.from(JSON.stringify({ ...payload, mac })).toString('base64url');
  addCookies(response, [cookie(STATE_COOKIE, `${nonce}.${stateSecret}`, STATE_SECONDS)]);
  const authorize = new URL(`${portalBase.replace(/\/$/, '')}/app-auth`);
  authorize.searchParams.set('appId', projectId);
  authorize.searchParams.set('redirectUri', redirectUri);
  authorize.searchParams.set('state', state);
  authorize.searchParams.set('responseType', 'code');
  response.writeHead(302, { Location: authorize.toString(), 'Cache-Control': 'no-store' });
  response.end();
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12_000),
  });
  let result;
  try { result = await response.json(); } catch { result = null; }
  if (!response.ok || !result || result.error) throw new Error('oauth_provider_error');
  return result;
}

export async function completeOAuth(request, response, callbackUrl) {
  const query = callbackUrl.searchParams;
  const cookies = parseCookies(request);
  const stateCookie = cookies.get(STATE_COOKIE) ?? '';
  addCookies(response, [expiredCookie(STATE_COOKIE)]);
  if (query.has('error') || !query.get('code') || !stateCookie || stateCookie.length > 200) throw new Error('oauth_state_invalid');

  let state;
  try { state = JSON.parse(Buffer.from(query.get('state') ?? '', 'base64url').toString('utf8')); } catch { throw new Error('oauth_state_invalid'); }
  const [cookieNonce, stateSecret] = stateCookie.split('.');
  const origin = validatePublicOrigin(state?.origin);
  const expectedRedirect = origin ? `${origin}/api/auth/callback` : '';
  const payload = { redirectUri: state?.redirectUri, origin: state?.origin, nonce: state?.nonce };
  const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const expectedMac = stateSecret ? createHmac('sha256', stateSecret).update(payloadEncoded).digest('base64url') : '';
  if (!origin || state?.redirectUri !== expectedRedirect || !constantTimeEqual(state?.nonce, cookieNonce) || !constantTimeEqual(state?.mac, expectedMac)) throw new Error('oauth_state_invalid');

  const projectId = process.env.MANUS_PROJECT_ID;
  const apiBase = process.env.MANUS_OAUTH_API_URL;
  if (!projectId || !apiBase || !jwtSecret()) throw new Error('auth_not_configured');
  const exchangeUrl = `${apiBase.replace(/\/$/, '')}/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
  const token = await postJson(exchangeUrl, {
    clientId: projectId,
    grantType: 'authorization_code',
    code: query.get('code'),
    redirectUri: expectedRedirect,
  });
  if (typeof token.accessToken !== 'string' || token.accessToken.length < 1) throw new Error('oauth_provider_error');

  const userInfoUrl = `${apiBase.replace(/\/$/, '')}/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
  const user = await postJson(userInfoUrl, { accessToken: token.accessToken });
  if (typeof user.openId !== 'string' || user.openId.length < 1 || user.openId.length > 512) throw new Error('oauth_provider_error');

  const now = Math.floor(Date.now() / 1000);
  const session = signJwt({ appId: projectId, openId: user.openId, name: typeof user.name === 'string' ? user.name.slice(0, 100) : '', origin, iat: now, exp: now + SESSION_SECONDS });
  addCookies(response, [
    cookie(SESSION_COOKIE, session, SESSION_SECONDS),
    cookie(CSRF_COOKIE, randomBytes(32).toString('base64url'), SESSION_SECONDS, false),
  ]);
  response.writeHead(303, { Location: `${origin}/`, 'Cache-Control': 'no-store' });
  response.end();
}

export function clearAuthCookies(response) {
  addCookies(response, [expiredCookie(SESSION_COOKIE), expiredCookie(STATE_COOKIE), expiredCookie(CSRF_COOKIE, false)]);
}
