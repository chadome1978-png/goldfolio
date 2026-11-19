import { createHash, randomUUID } from 'node:crypto';
import {
  clearAuthCookies,
  completeOAuth,
  ensureCsrfToken,
  getSession,
  startOAuth,
  validatePublicOrigin,
  verifyCsrf,
} from './manus-auth.mjs';
import {
  downloadAttachment,
  getHolding,
  getPreference,
  listHoldingMetadata,
  listHoldings,
  removeAttachment,
  savePreference,
  uploadAttachment,
  upsertHolding,
} from './supabase-client.mjs';

const ATTACHMENT_BUCKET = 'goldfolio-attachments';
const MAX_JSON_BYTES = 16 * 1024 * 1024;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

function json(response, status, body, headers = {}) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  response.end(JSON.stringify(body));
}

function methodNotAllowed(response, allow) {
  json(response, 405, { error: 'method_not_allowed' }, { Allow: allow });
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_JSON_BYTES) {
      const error = new Error('request_too_large');
      error.code = 'request_too_large';
      throw error;
    }
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid');
    return value;
  } catch {
    const error = new Error('invalid_json');
    error.code = 'invalid_json';
    throw error;
  }
}

function asIso(value) {
  if (typeof value !== 'string' || value.length > 40) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString();
}

function safeDisplayName(value) {
  if (typeof value !== 'string') return 'attachment';
  const cleaned = value.replace(/[\u0000-\u001f\u007f\\/]/g, '_').trim().slice(0, 180);
  return cleaned || 'attachment';
}

function ownerKey(openId) {
  return createHash('sha256').update(openId).digest('hex').slice(0, 24);
}

function publicAttachment(metadata, path) {
  if (!metadata || !path || !ALLOWED_MIME_TYPES.has(metadata.mimeType)) return null;
  return {
    name: safeDisplayName(metadata.name),
    mimeType: metadata.mimeType,
    sizeBytes: Number(metadata.sizeBytes) || 0,
    ...(typeof metadata.sha256 === 'string' && /^[a-f0-9]{64}$/i.test(metadata.sha256) ? { sha256: metadata.sha256.toLowerCase() } : {}),
  };
}

function publicRow(row) {
  const deletedAt = row.deleted_at ? asIso(row.deleted_at) : null;
  const payload = row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload) ? row.payload : {};
  return {
    id: row.holding_id,
    holding: deletedAt ? null : { ...payload, id: row.holding_id, updatedAt: asIso(row.updated_at) },
    updatedAt: asIso(row.updated_at),
    deletedAt,
    goldPhoto: deletedAt ? null : publicAttachment(row.gold_photo, row.gold_photo_path),
    warrantyDocument: deletedAt ? null : publicAttachment(row.warranty_document, row.warranty_document_path),
  };
}

function validHolding(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || !UUID_PATTERN.test(input.id ?? '')) return null;
  if (!['bar', 'ornament'].includes(input.kind)) return null;
  const quantity = Number(input.quantity);
  const weightPerItem = Number(input.weightPerItem);
  const purchasePricePerBaht = Number(input.purchasePricePerBaht);
  const additionalCost = Number(input.additionalCost);
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1_000_000) return null;
  if (![weightPerItem, purchasePricePerBaht, additionalCost].every(Number.isFinite)) return null;
  if (weightPerItem <= 0 || weightPerItem > 1_000_000 || purchasePricePerBaht <= 0 || purchasePricePerBaht > 1_000_000_000 || additionalCost < 0 || additionalCost > 1_000_000_000) return null;
  const purchasedAt = typeof input.purchasedAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.purchasedAt) ? input.purchasedAt : null;
  const createdAt = asIso(input.createdAt);
  const updatedAt = asIso(input.updatedAt);
  if (!purchasedAt || !createdAt || !updatedAt || typeof input.note !== 'string' || input.note.length > 240) return null;
  if (Date.parse(updatedAt) > Date.now() + 5 * 60_000) return null;
  return {
    id: input.id.toLowerCase(),
    kind: input.kind,
    quantity,
    weightPerItem,
    purchasePricePerBaht,
    additionalCost,
    purchasedAt,
    note: input.note.trim(),
    createdAt,
    updatedAt,
  };
}

function validManualQuote(value) {
  if (value === null) return null;
  if (!value || typeof value !== 'object' || value.source !== 'manual') return undefined;
  const prices = ['barBuy', 'barSell', 'ornamentBuy', 'ornamentSell'];
  const quote = {};
  for (const key of prices) {
    const item = value[key];
    if (item !== null && (!Number.isFinite(Number(item)) || Number(item) <= 0 || Number(item) > 1_000_000_000)) return undefined;
    quote[key] = item === null ? null : Number(item);
  }
  if (!prices.some((key) => quote[key] !== null)) return undefined;
  const quotedAt = asIso(value.quotedAt);
  if (!quotedAt || Date.parse(quotedAt) > Date.now() + 5 * 60_000) return undefined;
  return { ...quote, quotedAt, source: 'manual', sourceUrl: 'https://www.goldtraders.or.th/' };
}

function bytesMatchMime(bytes, mimeType) {
  if (mimeType === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === 'image/png') return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mimeType === 'image/webp') return bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (mimeType === 'application/pdf') return bytes.length >= 5 && bytes.toString('ascii', 0, 5) === '%PDF-';
  return false;
}

function decodeAttachment(input) {
  if (!input || typeof input !== 'object' || !ALLOWED_MIME_TYPES.has(input.mimeType)) return null;
  if (typeof input.dataUrl !== 'string' || input.dataUrl.length > 7_200_000) return null;
  const match = input.dataUrl.match(/^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]*={0,2})$/i);
  if (!match || match[1].toLowerCase() !== input.mimeType.toLowerCase()) return null;
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length < 1 || bytes.length > MAX_ATTACHMENT_BYTES || bytes.length !== Number(input.sizeBytes)) return null;
  if (!bytesMatchMime(bytes, input.mimeType)) return null;
  return {
    bytes,
    mimeType: input.mimeType,
    name: safeDisplayName(input.name),
    sizeBytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

function storagePath(ownerId, holdingId, slot) {
  const owner = createHash('sha256').update(ownerId).digest('hex');
  return `${owner}/${holdingId}/${slot}/${randomUUID()}`;
}

function attachmentFields(row, slot) {
  return slot === 'goldPhoto'
    ? { metadata: row?.gold_photo ?? null, path: row?.gold_photo_path ?? null }
    : { metadata: row?.warranty_document ?? null, path: row?.warranty_document_path ?? null };
}

function csrfOrReject(request, response) {
  if (verifyCsrf(request)) return true;
  json(response, 403, { error: 'csrf_validation_failed' });
  return false;
}

async function requireEnabled(ownerId) {
  const preference = await getPreference(ownerId);
  if (!preference?.cloud_sync_enabled) {
    const error = new Error('cloud_sync_not_enabled');
    error.code = 'cloud_sync_not_enabled';
    throw error;
  }
  return preference;
}

function sendRouteError(response, error) {
  if (error?.code === 'cloud_not_configured') return json(response, 503, { error: 'cloud_not_configured' });
  if (error?.code === 'cloud_sync_not_enabled') return json(response, 409, { error: 'cloud_sync_not_enabled' });
  if (error?.code === 'request_too_large') return json(response, 413, { error: 'request_too_large' });
  if (error?.code === 'invalid_json') return json(response, 400, { error: 'invalid_json' });
  if (error?.code === 'attachment_download_failed') return json(response, 404, { error: 'attachment_not_found' });
  json(response, 502, { error: 'cloud_service_unavailable' });
}

async function authRoute(request, response, url) {
  if (url.pathname === '/api/auth/status') {
    if (request.method !== 'GET') return methodNotAllowed(response, 'GET');
    const session = getSession(request);
    if (!session) return json(response, 200, { authenticated: false });
    const csrf = ensureCsrfToken(request, response);
    return json(response, 200, { authenticated: true, user: { name: session.name }, csrfToken: csrf });
  }
  if (url.pathname === '/api/auth/login') {
    if (request.method !== 'GET') return methodNotAllowed(response, 'GET');
    try { return startOAuth(response, url.searchParams.get('origin')); }
    catch (error) { return json(response, error?.message === 'invalid_origin' ? 400 : 503, { error: error?.message === 'invalid_origin' ? 'invalid_origin' : 'auth_not_configured' }); }
  }
  if (url.pathname === '/api/auth/callback') {
    if (request.method !== 'GET') return methodNotAllowed(response, 'GET');
    try { return await completeOAuth(request, response, url); }
    catch (error) {
      const status = error?.message === 'auth_not_configured' ? 503 : 401;
      return json(response, status, { error: status === 503 ? 'auth_not_configured' : 'oauth_failed' });
    }
  }
  if (url.pathname === '/api/auth/logout') {
    if (request.method !== 'POST') return methodNotAllowed(response, 'POST');
    if (!getSession(request)) return json(response, 200, { ok: true });
    if (!csrfOrReject(request, response)) return;
    clearAuthCookies(response);
    return json(response, 200, { ok: true });
  }
  return false;
}

async function cloudRoute(request, response, url) {
  if (!url.pathname.startsWith('/api/cloud/')) return false;
  const session = getSession(request);
  if (!session) return json(response, 401, { error: 'authentication_required' });
  const ownerId = session.openId;

  try {
    if (url.pathname === '/api/cloud/status') {
      if (request.method !== 'GET') return methodNotAllowed(response, 'GET');
      const [preference, rows] = await Promise.all([getPreference(ownerId), listHoldingMetadata(ownerId)]);
      const active = rows.filter((row) => !row.deleted_at);
      const attachments = active.reduce((count, row) => count + Number(Boolean(row.gold_photo_path)) + Number(Boolean(row.warranty_document_path)), 0);
      return json(response, 200, {
        enabled: preference?.cloud_sync_enabled === true,
        holdingsCount: active.length,
        attachmentsCount: attachments,
        lastSyncedAt: preference?.last_synced_at ? asIso(preference.last_synced_at) : null,
        ownerKey: ownerKey(ownerId),
      });
    }

    if (url.pathname === '/api/cloud/enable') {
      if (request.method !== 'POST') return methodNotAllowed(response, 'POST');
      if (!csrfOrReject(request, response)) return;
      const body = await readJson(request);
      if (body.consent !== true) return json(response, 400, { error: 'explicit_consent_required' });
      const saved = await savePreference(ownerId, { cloud_sync_enabled: true });
      if (!saved?.cloud_sync_enabled) throw new Error('preference_save_failed');
      return json(response, 200, { ok: true, enabled: true });
    }

    if (url.pathname === '/api/cloud/holdings') {
      if (request.method === 'GET') {
        await requireEnabled(ownerId);
        const rows = await listHoldings(ownerId);
        return json(response, 200, { records: rows.map(publicRow) });
      }
      if (request.method !== 'POST') return methodNotAllowed(response, 'GET, POST');
      if (!csrfOrReject(request, response)) return;
      await requireEnabled(ownerId);
      const body = await readJson(request);
      const isDeletion = body.deletedAt !== undefined && body.deletedAt !== null;
      const holding = isDeletion ? null : validHolding(body.holding);
      const id = isDeletion ? body.id : holding?.id;
      if (!UUID_PATTERN.test(id ?? '')) return json(response, 400, { error: 'invalid_holding' });
      const updatedAt = isDeletion ? asIso(body.deletedAt) : holding?.updatedAt;
      if (!updatedAt || Date.parse(updatedAt) > Date.now() + 5 * 60_000) return json(response, 400, { error: 'invalid_updated_at' });

      const current = await getHolding(ownerId, id.toLowerCase());
      if (current && Date.parse(current.updated_at) >= Date.parse(updatedAt)) {
        return json(response, 200, { applied: false, record: publicRow(current) });
      }

      const changes = isDeletion ? { goldPhoto: { mode: 'remove' }, warrantyDocument: { mode: 'remove' } } : body.attachments;
      const decodedChanges = {};
      for (const slot of ['goldPhoto', 'warrantyDocument']) {
        const change = changes?.[slot];
        if (!change || !['keep', 'remove', 'replace'].includes(change.mode)) return json(response, 400, { error: 'invalid_attachment_change' });
        if (change.mode === 'replace') {
          decodedChanges[slot] = decodeAttachment(change.attachment);
          if (!decodedChanges[slot]) return json(response, 400, { error: 'invalid_attachment' });
        }
      }

      const uploaded = [];
      const oldPaths = [];
      const newSlots = {};
      for (const [slot, column] of [['goldPhoto', 'gold_photo'], ['warrantyDocument', 'warranty_document']]) {
        const old = attachmentFields(current, slot);
        const change = changes[slot];
        if (change.mode === 'keep') {
          newSlots[slot] = { metadata: old.metadata, path: old.path };
        } else if (change.mode === 'replace') {
          const decoded = decodedChanges[slot];
          const path = storagePath(ownerId, id.toLowerCase(), slot);
          try {
            await uploadAttachment(path, decoded.bytes, decoded.mimeType);
          } catch (error) {
            for (const newPath of uploaded) await removeAttachment(newPath).catch(() => {});
            throw error;
          }
          uploaded.push(path);
          newSlots[slot] = { metadata: { name: decoded.name, mimeType: decoded.mimeType, sizeBytes: decoded.sizeBytes, sha256: decoded.sha256 }, path };
        } else {
          newSlots[slot] = { metadata: null, path: null };
        }
        if (old.path && old.path !== newSlots[slot].path) oldPaths.push(old.path);
      }

      const payload = isDeletion ? {} : holding;
      const result = await upsertHolding(
        ownerId,
        id.toLowerCase(),
        payload,
        newSlots.goldPhoto.metadata,
        newSlots.goldPhoto.path,
        newSlots.warrantyDocument.metadata,
        newSlots.warrantyDocument.path,
        updatedAt,
        isDeletion ? updatedAt : null,
      ).catch(async (error) => {
        for (const newPath of uploaded) await removeAttachment(newPath).catch(() => {});
        throw error;
      });

      if (!result.applied) {
        for (const newPath of uploaded) await removeAttachment(newPath).catch(() => {});
        return json(response, 200, { applied: false, record: publicRow(result.row) });
      }
      for (const oldPath of oldPaths) await removeAttachment(oldPath).catch(() => {});
      return json(response, 200, { applied: true, record: publicRow(result.row) });
    }

    const attachmentMatch = url.pathname.match(/^\/api\/cloud\/attachments\/([0-9a-f-]{36})\/(goldPhoto|warrantyDocument)$/i);
    if (attachmentMatch) {
      if (request.method !== 'GET') return methodNotAllowed(response, 'GET');
      await requireEnabled(ownerId);
      const holdingId = attachmentMatch[1].toLowerCase();
      const slot = attachmentMatch[2] === 'goldPhoto' ? 'goldPhoto' : 'warrantyDocument';
      const row = await getHolding(ownerId, holdingId);
      const { metadata, path } = attachmentFields(row, slot);
      if (!path || !metadata || !ALLOWED_MIME_TYPES.has(metadata.mimeType)) return json(response, 404, { error: 'attachment_not_found' });
      const downloaded = await downloadAttachment(path);
      if (downloaded.bytes.length > MAX_ATTACHMENT_BYTES || !bytesMatchMime(downloaded.bytes, metadata.mimeType)) return json(response, 502, { error: 'attachment_invalid' });
      response.writeHead(200, {
        'Content-Type': metadata.mimeType,
        'Content-Length': String(downloaded.bytes.length),
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(safeDisplayName(metadata.name))}`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      response.end(downloaded.bytes);
      return true;
    }

    if (url.pathname === '/api/cloud/preferences') {
      if (request.method === 'GET') {
        const preference = await requireEnabled(ownerId);
        return json(response, 200, {
          manualQuote: preference.manual_quote ?? null,
          manualQuoteUpdatedAt: preference.manual_quote_updated_at ? asIso(preference.manual_quote_updated_at) : null,
        });
      }
      if (request.method !== 'POST') return methodNotAllowed(response, 'GET, POST');
      if (!csrfOrReject(request, response)) return;
      const preference = await requireEnabled(ownerId);
      const body = await readJson(request);
      const clientUpdatedAt = asIso(body.updatedAt);
      const manualQuote = validManualQuote(body.manualQuote);
      if (!clientUpdatedAt || manualQuote === undefined || Date.parse(clientUpdatedAt) > Date.now() + 5 * 60_000) return json(response, 400, { error: 'invalid_preferences' });
      const currentUpdatedAt = preference.manual_quote_updated_at ? Date.parse(preference.manual_quote_updated_at) : 0;
      if (currentUpdatedAt >= Date.parse(clientUpdatedAt)) return json(response, 200, { applied: false, manualQuote: preference.manual_quote ?? null, updatedAt: preference.manual_quote_updated_at ?? null });
      const saved = await savePreference(ownerId, { manual_quote: manualQuote, manual_quote_updated_at: clientUpdatedAt });
      return json(response, 200, { applied: true, manualQuote: saved?.manual_quote ?? null, updatedAt: saved?.manual_quote_updated_at ?? null });
    }

    if (url.pathname === '/api/cloud/sync-complete') {
      if (request.method !== 'POST') return methodNotAllowed(response, 'POST');
      if (!csrfOrReject(request, response)) return;
      await requireEnabled(ownerId);
      const now = new Date().toISOString();
      const saved = await savePreference(ownerId, { last_synced_at: now });
      return json(response, 200, { ok: true, lastSyncedAt: saved?.last_synced_at ?? now });
    }

    return json(response, 404, { error: 'not_found' });
  } catch (error) {
    return sendRouteError(response, error);
  }
}

export async function handleGoldfolioApi(request, response) {
  const url = new URL(request.url ?? '/', 'http://localhost');
  try {
    const authHandled = await authRoute(request, response, url);
    if (authHandled !== false) return true;
    const cloudHandled = await cloudRoute(request, response, url);
    return cloudHandled !== false;
  } catch (error) {
    const status = error?.message === 'oauth_state_invalid' ? 401 : error?.message === 'auth_not_configured' ? 503 : 502;
    json(response, status, { error: status === 401 ? 'oauth_failed' : status === 503 ? 'auth_not_configured' : 'cloud_service_unavailable' });
    return true;
  }
}
