const PROJECT_URL = 'https://etsguakphlytlvzotmor.supabase.co';
const ATTACHMENT_BUCKET = 'goldfolio-attachments';
const KEY_NAME = 'GOLDFOLIO_SUPABASE_SECRET_KEY';
const STORAGE_KEY_NAME = 'GOLDFOLIO_SUPABASE_STORAGE_SERVICE_KEY';

function secretKey() {
  const key = process.env[KEY_NAME];
  if (typeof key !== 'string' || key.length < 16) {
    const error = new Error('cloud_not_configured');
    error.code = 'cloud_not_configured';
    throw error;
  }
  if (key.startsWith('sb_publishable_') || key.startsWith('sb_anon_')) {
    const error = new Error('server_secret_key_required');
    error.code = 'cloud_not_configured';
    throw error;
  }
  return key;
}

function apiHeaders(extra = {}) {
  // Supabase opaque sb_secret keys are not JWTs: send the key in apikey only.
  // Legacy service_role JWT keys also work through the same header.
  return { apikey: secretKey(), ...extra };
}

function storageHeaders(extra = {}) {
  const key = process.env[STORAGE_KEY_NAME];
  const parts = typeof key === 'string' ? key.split('.') : [];
  let claims = null;
  try { claims = parts.length === 3 ? JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) : null; } catch { claims = null; }
  if (!key || claims?.role !== 'service_role') {
    const error = new Error('cloud_not_configured');
    error.code = 'cloud_not_configured';
    throw error;
  }
  return { apikey: key, Authorization: `Bearer ${key}`, ...extra };
}

function storageObjectUrl(path) {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  return `${PROJECT_URL}/storage/v1/object/${ATTACHMENT_BUCKET}/${encodedPath}`;
}

export function ownerFilter(ownerId) {
  return `eq.${ownerId}`;
}

export async function databaseRequest(path, options = {}) {
  const headers = apiHeaders({ Accept: 'application/json', ...(options.headers ?? {}) });
  const response = await fetch(`${PROJECT_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: AbortSignal.timeout(15_000),
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = null; }
  }
  if (!response.ok) {
    const error = new Error('database_request_failed');
    error.code = 'database_request_failed';
    error.status = response.status;
    throw error;
  }
  return { data, headers: response.headers };
}

export async function getPreference(ownerId) {
  const query = new URLSearchParams({
    select: 'owner_id,cloud_sync_enabled,manual_quote,manual_quote_updated_at,updated_at,last_synced_at',
    owner_id: ownerFilter(ownerId),
    limit: '1',
  });
  const { data } = await databaseRequest(`/rest/v1/goldfolio_preferences?${query}`);
  return Array.isArray(data) ? data[0] ?? null : null;
}

export async function savePreference(ownerId, patch) {
  const body = { owner_id: ownerId, ...patch, updated_at: new Date().toISOString() };
  const query = new URLSearchParams({ on_conflict: 'owner_id' });
  const { data } = await databaseRequest(`/rest/v1/goldfolio_preferences?${query}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' },
    body,
  });
  return Array.isArray(data) ? data[0] ?? null : null;
}

export async function listHoldings(ownerId) {
  const output = [];
  const pageSize = 200;
  for (let offset = 0; offset < 20_000; offset += pageSize) {
    const query = new URLSearchParams({
      select: 'holding_id,payload,gold_photo,gold_photo_path,warranty_document,warranty_document_path,updated_at,deleted_at',
      owner_id: ownerFilter(ownerId),
      order: 'updated_at.asc',
      limit: String(pageSize),
      offset: String(offset),
    });
    const { data } = await databaseRequest(`/rest/v1/goldfolio_holdings?${query}`);
    if (!Array.isArray(data)) throw new Error('database_response_invalid');
    output.push(...data);
    if (data.length < pageSize) return output;
  }
  throw new Error('cloud_record_limit_exceeded');
}

export async function getHolding(ownerId, holdingId) {
  const query = new URLSearchParams({
    select: 'holding_id,payload,gold_photo,gold_photo_path,warranty_document,warranty_document_path,updated_at,deleted_at',
    owner_id: ownerFilter(ownerId),
    holding_id: `eq.${holdingId}`,
    limit: '1',
  });
  const { data } = await databaseRequest(`/rest/v1/goldfolio_holdings?${query}`);
  if (!Array.isArray(data)) throw new Error('database_response_invalid');
  return data[0] ?? null;
}

export async function listHoldingMetadata(ownerId) {
  const output = [];
  const pageSize = 500;
  for (let offset = 0; offset < 20_000; offset += pageSize) {
    const query = new URLSearchParams({
      select: 'holding_id,gold_photo_path,warranty_document_path,updated_at,deleted_at',
      owner_id: ownerFilter(ownerId),
      order: 'updated_at.asc',
      limit: String(pageSize),
      offset: String(offset),
    });
    const { data } = await databaseRequest(`/rest/v1/goldfolio_holdings?${query}`);
    if (!Array.isArray(data)) throw new Error('database_response_invalid');
    output.push(...data);
    if (data.length < pageSize) return output;
  }
  throw new Error('cloud_record_limit_exceeded');
}

export async function upsertHolding(ownerId, holdingId, payload, goldPhoto, goldPhotoPath, warrantyDocument, warrantyDocumentPath, updatedAt, deletedAt) {
  const { data } = await databaseRequest('/rest/v1/rpc/goldfolio_upsert_holding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      p_owner_id: ownerId,
      p_holding_id: holdingId,
      p_payload: payload,
      p_gold_photo: goldPhoto,
      p_gold_photo_path: goldPhotoPath,
      p_warranty_document: warrantyDocument,
      p_warranty_document_path: warrantyDocumentPath,
      p_updated_at: updatedAt,
      p_deleted_at: deletedAt,
    },
  });
  if (!data || typeof data !== 'object' || !data.row) throw new Error('database_response_invalid');
  return { applied: data.applied === true, row: data.row };
}

export async function uploadAttachment(path, bytes, mimeType) {
  const response = await fetch(storageObjectUrl(path), {
    method: 'POST',
    headers: storageHeaders({ 'Content-Type': mimeType, 'x-upsert': 'false' }),
    body: bytes,
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    const error = new Error('attachment_upload_failed');
    error.code = 'attachment_upload_failed';
    error.status = response.status;
    throw error;
  }
}

export async function downloadAttachment(path) {
  const response = await fetch(`${PROJECT_URL}/storage/v1/object/authenticated/${ATTACHMENT_BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'GET',
    headers: storageHeaders(),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    const error = new Error('attachment_download_failed');
    error.code = 'attachment_download_failed';
    error.status = response.status;
    throw error;
  }
  return { bytes: Buffer.from(await response.arrayBuffer()), contentType: response.headers.get('content-type') ?? 'application/octet-stream' };
}

export async function removeAttachment(path) {
  const response = await fetch(`${PROJECT_URL}/storage/v1/object/${ATTACHMENT_BUCKET}`, {
    method: 'DELETE',
    headers: storageHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ prefixes: [path] }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok && response.status !== 404) {
    const error = new Error('attachment_delete_failed');
    error.code = 'attachment_delete_failed';
    error.status = response.status;
    throw error;
  }
}
