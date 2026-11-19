import type { Holding, HoldingAttachment, ManualQuote } from '../../types';

export interface CloudAuthStatus {
  authenticated: boolean;
  user?: { name: string };
  csrfToken?: string;
}

export interface CloudStatus {
  enabled: boolean;
  holdingsCount: number;
  attachmentsCount: number;
  lastSyncedAt: string | null;
  ownerKey: string;
}

export interface RemoteHolding {
  id: string;
  holding: Holding | null;
  updatedAt: string | null;
  deletedAt: string | null;
  goldPhoto: Omit<HoldingAttachment, 'dataUrl'> | null;
  warrantyDocument: Omit<HoldingAttachment, 'dataUrl'> | null;
}

export interface RemotePreferences {
  manualQuote: ManualQuote | null;
  manualQuoteUpdatedAt: string | null;
}

export class CloudApiError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status: number) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

let csrfToken = '';

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (init.method && init.method !== 'GET' && csrfToken) headers.set('X-Goldfolio-CSRF', csrfToken);
  const response = await fetch(path, { ...init, headers, credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) {
    let code = 'cloud_service_unavailable';
    try { code = (await response.json())?.error ?? code; } catch { /* keep generic code */ }
    throw new CloudApiError(code, response.status);
  }
  return response.json() as Promise<T>;
}

export async function fetchAuthStatus(): Promise<CloudAuthStatus> {
  const status = await request<CloudAuthStatus>('/api/auth/status');
  csrfToken = status.csrfToken ?? '';
  return status;
}

export function loginHref(): string {
  return `/api/auth/login?origin=${encodeURIComponent(window.location.origin)}`;
}

export async function logout(): Promise<void> {
  await request<{ ok: true }>('/api/auth/logout', { method: 'POST', body: '{}' });
  csrfToken = '';
}

export async function fetchCloudStatus(): Promise<CloudStatus> {
  return request<CloudStatus>('/api/cloud/status');
}

export async function enableCloudSync(): Promise<void> {
  await request('/api/cloud/enable', { method: 'POST', body: JSON.stringify({ consent: true }) });
}

export async function fetchRemoteHoldings(): Promise<RemoteHolding[]> {
  const result = await request<{ records: RemoteHolding[] }>('/api/cloud/holdings');
  return result.records;
}

export async function saveRemoteHolding(
  holding: Holding,
  attachments: { goldPhoto: { mode: 'keep' | 'remove' } | { mode: 'replace'; attachment: HoldingAttachment }; warrantyDocument: { mode: 'keep' | 'remove' } | { mode: 'replace'; attachment: HoldingAttachment } },
): Promise<{ applied: boolean; record: RemoteHolding }> {
  return request('/api/cloud/holdings', {
    method: 'POST',
    body: JSON.stringify({ holding, attachments }),
  });
}

export async function deleteRemoteHolding(id: string, deletedAt: string): Promise<{ applied: boolean; record: RemoteHolding }> {
  return request('/api/cloud/holdings', { method: 'POST', body: JSON.stringify({ id, deletedAt }) });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('attachment_read_failed'));
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('attachment_read_failed'));
    reader.readAsDataURL(blob);
  });
}

export async function downloadRemoteAttachment(id: string, slot: 'goldPhoto' | 'warrantyDocument', metadata: Omit<HoldingAttachment, 'dataUrl'>): Promise<HoldingAttachment> {
  const response = await fetch(`/api/cloud/attachments/${encodeURIComponent(id)}/${slot}`, { credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) {
    let code = 'attachment_download_failed';
    try { code = (await response.json())?.error ?? code; } catch { /* keep generic code */ }
    throw new CloudApiError(code, response.status);
  }
  const blob = await response.blob();
  if (blob.size !== metadata.sizeBytes) throw new CloudApiError('attachment_size_mismatch', 502);
  if (metadata.sha256) {
    const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
    const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
    if (hash !== metadata.sha256.toLowerCase()) throw new CloudApiError('attachment_hash_mismatch', 502);
  }
  return { ...metadata, dataUrl: await blobToDataUrl(blob) } as HoldingAttachment;
}

export async function fetchRemotePreferences(): Promise<RemotePreferences> {
  return request<RemotePreferences>('/api/cloud/preferences');
}

export async function saveRemotePreferences(manualQuote: ManualQuote | null, updatedAt: string): Promise<{ applied: boolean; manualQuote: ManualQuote | null; updatedAt: string | null }> {
  return request('/api/cloud/preferences', { method: 'POST', body: JSON.stringify({ manualQuote, updatedAt }) });
}

export async function markCloudSyncComplete(): Promise<{ ok: true; lastSyncedAt: string }> {
  return request('/api/cloud/sync-complete', { method: 'POST', body: '{}' });
}
