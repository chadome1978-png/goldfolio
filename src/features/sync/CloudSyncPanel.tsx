import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Cloud, CloudUpload, LoaderCircle, LogIn, LogOut, RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react';
import type { Holding, HoldingAttachment, LocalCloudSyncState, ManualQuote } from '../../types';
import { formatDateTime } from '../../lib/format';
import {
  clearDeletionTombstones,
  getCloudSyncState,
  getDeletionTombstones,
  getHoldings,
  getManualQuote,
  removeHolding,
  saveCloudSyncState,
  saveHolding,
  saveManualQuote,
  saveQuote,
} from '../../lib/storage/db';
import {
  CloudApiError,
  deleteRemoteHolding,
  downloadRemoteAttachment,
  enableCloudSync,
  fetchAuthStatus,
  fetchCloudStatus,
  fetchRemoteHoldings,
  fetchRemotePreferences,
  loginHref,
  logout,
  markCloudSyncComplete,
  saveRemoteHolding,
  saveRemotePreferences,
  type CloudAuthStatus,
  type CloudStatus,
  type RemoteHolding,
} from './api';

const EMPTY_SYNC: LocalCloudSyncState = { enabled: false, ownerKey: null, lastSyncedAt: null, manualQuoteUpdatedAt: null, error: null };

function errorText(error: unknown): string {
  const code = error instanceof CloudApiError ? error.code : '';
  if (code === 'cloud_not_configured') return 'ยังไม่ได้ตั้งค่า credential ฝั่ง server สำหรับฐานข้อมูลและ private Storage ของ BNK';
  if (code === 'authentication_required') return 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง';
  if (code === 'csrf_validation_failed') return 'โทเค็นความปลอดภัยหมดอายุ กรุณาโหลดหน้าใหม่';
  if (code === 'cloud_sync_not_enabled') return 'ยังไม่ได้ยืนยันเปิด Cloud Sync';
  if (code.startsWith('attachment_')) return 'ซิงก์ไฟล์แนบไม่สำเร็จ ข้อมูลในเครื่องยังคงอยู่';
  if (code === 'cloud_service_unavailable' || code === 'database_request_failed') return 'ติดต่อฐานข้อมูล BNK ไม่สำเร็จ ตรวจสอบการตั้งค่าและลองอีกครั้ง';
  return 'ซิงก์ไม่สำเร็จ ข้อมูลในเครื่องยังคงอยู่ ลองซิงก์ใหม่ได้';
}

async function attachmentDigest(attachment: HoldingAttachment): Promise<string> {
  if (attachment.sha256 && /^[a-f0-9]{64}$/i.test(attachment.sha256)) return attachment.sha256.toLowerCase();
  const comma = attachment.dataUrl.indexOf(',');
  if (comma < 0) throw new CloudApiError('attachment_invalid', 400);
  const binary = atob(attachment.dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  attachment.sha256 = hash;
  return hash;
}

async function attachmentChange(local: HoldingAttachment | undefined, remote: Omit<HoldingAttachment, 'dataUrl'> | null) {
  if (!local) return { mode: 'remove' as const };
  if (remote?.sha256 && local.name === remote.name && local.mimeType === remote.mimeType && local.sizeBytes === remote.sizeBytes) {
    if (await attachmentDigest(local) === remote.sha256.toLowerCase()) return { mode: 'keep' as const };
  }
  return { mode: 'replace' as const, attachment: local };
}

async function restoreRemoteRecord(remote: RemoteHolding): Promise<Holding | null> {
  if (!remote.holding || remote.deletedAt) {
    await removeHolding(remote.id, false);
    return null;
  }
  const [goldPhoto, warrantyDocument] = await Promise.all([
    remote.goldPhoto ? downloadRemoteAttachment(remote.id, 'goldPhoto', remote.goldPhoto) : Promise.resolve(undefined),
    remote.warrantyDocument ? downloadRemoteAttachment(remote.id, 'warrantyDocument', remote.warrantyDocument) : Promise.resolve(undefined),
  ]);
  const holding: Holding = {
    ...remote.holding,
    ...(goldPhoto ? { goldPhoto } : {}),
    ...(warrantyDocument ? { warrantyDocument } : {}),
  };
  await saveHolding(holding);
  return holding;
}

export default function CloudSyncPanel({
  visible,
  holdings,
  quote,
  onHoldingsChange,
  onQuoteChange,
}: {
  visible: boolean;
  holdings: Holding[];
  quote: ManualQuote;
  onHoldingsChange: (holdings: Holding[]) => void;
  onQuoteChange: (quote: ManualQuote) => void;
}) {
  const [auth, setAuth] = useState<CloudAuthStatus | null>(null);
  const [status, setStatus] = useState<CloudStatus | null>(null);
  const [localSync, setLocalSync] = useState<LocalCloudSyncState>(EMPTY_SYNC);
  const [authLoading, setAuthLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [statusError, setStatusError] = useState('');
  const [syncError, setSyncError] = useState('');
  const syncing = useRef(false);
  const syncRef = useRef<(ownerKey: string) => Promise<void>>(async () => {});
  const mounted = useRef(true);

  async function refreshCloudStatus() {
    setStatusLoading(true);
    try {
      const latest = await fetchCloudStatus();
      if (mounted.current) { setStatus(latest); setStatusError(''); }
      return latest;
    } catch (error) {
      if (mounted.current) { setStatus(null); setStatusError(errorText(error)); }
      return null;
    } finally {
      if (mounted.current) setStatusLoading(false);
    }
  }

  useEffect(() => {
    mounted.current = true;
    let active = true;
    void (async () => {
      try {
        const [stored, authStatus] = await Promise.all([getCloudSyncState(), fetchAuthStatus()]);
        if (!active) return;
        setLocalSync(stored);
        setAuth(authStatus);
        setAuthLoading(false);
        if (authStatus.authenticated) await refreshCloudStatus();
      } catch {
        if (active) { setAuth({ authenticated: false }); setStatusError('ตรวจสอบสถานะบัญชีไม่สำเร็จ'); setAuthLoading(false); }
      }
    })();
    return () => { active = false; mounted.current = false; };
  }, []);

  const authenticated = auth?.authenticated === true;
  const ownerMatches = Boolean(status && localSync.enabled && localSync.ownerKey === status.ownerKey);
  const syncActive = Boolean(authenticated && status?.enabled && ownerMatches);
  const localAttachmentCount = holdings.reduce((count, item) => count + Number(Boolean(item.goldPhoto)) + Number(Boolean(item.warrantyDocument)), 0);

  async function persistSyncState(next: LocalCloudSyncState) {
    await saveCloudSyncState(next);
    if (mounted.current) setLocalSync(next);
  }

  async function runSync(ownerKey: string) {
    if (syncing.current || !authenticated) return;
    syncing.current = true;
    setWorking(true);
    setSyncError('');
    try {
      const localAtStart = await getHoldings();
      const deletionsAtStart = await getDeletionTombstones();
      let remoteRecords = await fetchRemoteHoldings();
      const remoteById = new Map(remoteRecords.map((item) => [item.id, item]));
      const localById = new Map(localAtStart.map((item) => [item.id, item]));
      const tombstoneById = new Map(deletionsAtStart.map((item) => [item.id, item]));
      const clearIds: string[] = [];

      for (const remote of remoteRecords) {
        const local = localById.get(remote.id);
        const tombstone = tombstoneById.get(remote.id);
        const remoteTime = Date.parse(remote.updatedAt ?? '');
        const localTime = local ? Date.parse(local.updatedAt) : tombstone ? Date.parse(tombstone.deletedAt) : Number.NEGATIVE_INFINITY;
        if (remote.deletedAt) {
          if (local && Date.parse(remote.deletedAt) >= Date.parse(local.updatedAt)) await removeHolding(remote.id, false);
          if (tombstone && Date.parse(remote.deletedAt) >= Date.parse(tombstone.deletedAt)) clearIds.push(remote.id);
        } else if (remote.holding && remoteTime > localTime) {
          await restoreRemoteRecord(remote);
        }
      }
      await clearDeletionTombstones(clearIds);

      let localItems = await getHoldings();
      let localDeletions = await getDeletionTombstones();

      for (const item of localItems) {
        const remote = remoteById.get(item.id);
        const remoteTime = Date.parse(remote?.updatedAt ?? '');
        const needsUpload = !remote || !Number.isFinite(remoteTime) || Date.parse(item.updatedAt) > remoteTime;
        if (!needsUpload) continue;
        const result = await saveRemoteHolding(item, {
          goldPhoto: await attachmentChange(item.goldPhoto, remote?.goldPhoto ?? null),
          warrantyDocument: await attachmentChange(item.warrantyDocument, remote?.warrantyDocument ?? null),
        });
        remoteById.set(item.id, result.record);
        if (result.applied) {
          if (item.goldPhoto && result.record.goldPhoto?.sha256) item.goldPhoto.sha256 = result.record.goldPhoto.sha256;
          if (item.warrantyDocument && result.record.warrantyDocument?.sha256) item.warrantyDocument.sha256 = result.record.warrantyDocument.sha256;
          await saveHolding(item);
        }
        if (!result.applied && result.record.holding && Date.parse(result.record.updatedAt ?? '') > Date.parse(item.updatedAt)) {
          await restoreRemoteRecord(result.record);
        }
      }

      for (const tombstone of localDeletions) {
        const remote = remoteById.get(tombstone.id);
        if (remote && Date.parse(remote.updatedAt ?? '') >= Date.parse(tombstone.deletedAt)) {
          if (!remote.deletedAt && remote.holding) await restoreRemoteRecord(remote);
          clearIds.push(tombstone.id);
          continue;
        }
        const result = await deleteRemoteHolding(tombstone.id, tombstone.deletedAt);
        remoteById.set(tombstone.id, result.record);
        if (result.applied || Date.parse(result.record.updatedAt ?? '') >= Date.parse(tombstone.deletedAt)) clearIds.push(tombstone.id);
      }
      await clearDeletionTombstones([...new Set(clearIds)]);

      remoteRecords = await fetchRemoteHoldings();
      localItems = await getHoldings();
      localDeletions = await getDeletionTombstones();
      const finalLocal = new Map(localItems.map((item) => [item.id, item]));
      const finalTombstones = new Map(localDeletions.map((item) => [item.id, item]));
      for (const remote of remoteRecords) {
        const local = finalLocal.get(remote.id);
        const deletion = finalTombstones.get(remote.id);
        const localTime = local ? Date.parse(local.updatedAt) : deletion ? Date.parse(deletion.deletedAt) : Number.NEGATIVE_INFINITY;
        if (Date.parse(remote.updatedAt ?? '') > localTime) {
          if (remote.deletedAt) await removeHolding(remote.id, false);
          else if (remote.holding) await restoreRemoteRecord(remote);
        }
      }

      const remotePreferences = await fetchRemotePreferences();
      const localManualQuote = await getManualQuote();
      const syncState = await getCloudSyncState();
      const localQuoteTime = syncState.manualQuoteUpdatedAt ?? (localManualQuote?.quotedAt || (localManualQuote ? new Date().toISOString() : null));
      const remoteQuoteTime = remotePreferences.manualQuoteUpdatedAt;
      if (localManualQuote && localQuoteTime && (!remoteQuoteTime || Date.parse(localQuoteTime) > Date.parse(remoteQuoteTime))) {
        await saveRemotePreferences(localManualQuote, localQuoteTime);
      } else if (remotePreferences.manualQuote && remoteQuoteTime && (!localQuoteTime || Date.parse(remoteQuoteTime) > Date.parse(localQuoteTime))) {
        await saveManualQuote(remotePreferences.manualQuote);
        if (quote.source === 'manual' || !quote.barBuy || !quote.barSell) {
          await saveQuote(remotePreferences.manualQuote);
          onQuoteChange(remotePreferences.manualQuote);
        }
        syncState.manualQuoteUpdatedAt = remoteQuoteTime;
      }

      const completion = await markCloudSyncComplete();
      const updatedSync: LocalCloudSyncState = {
        ...syncState,
        enabled: true,
        ownerKey,
        lastSyncedAt: completion.lastSyncedAt,
        error: null,
      };
      await persistSyncState(updatedSync);
      const refreshedStatus = await fetchCloudStatus();
      if (mounted.current) { setStatus(refreshedStatus); setStatusError(''); }
      const allHoldings = await getHoldings();
      onHoldingsChange(allHoldings.sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt)));
    } catch (error) {
      const message = errorText(error);
      setSyncError(message);
      const current = await getCloudSyncState().catch(() => localSync);
      await persistSyncState({ ...current, enabled: true, ownerKey, error: message });
      const refreshed = await fetchCloudStatus().catch(() => null);
      if (refreshed && mounted.current) setStatus(refreshed);
    } finally {
      syncing.current = false;
      if (mounted.current) setWorking(false);
    }
  }
  syncRef.current = runSync;

  useEffect(() => {
    if (!syncActive || !status?.ownerKey) return;
    const timer = window.setTimeout(() => { void syncRef.current(status.ownerKey); }, 650);
    return () => window.clearTimeout(timer);
  }, [syncActive, status?.ownerKey, holdings, quote.source, quote.quotedAt]);

  useEffect(() => {
    if (!syncActive || !status?.ownerKey) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void syncRef.current(status.ownerKey);
    }, 90_000);
    const onVisible = () => { if (document.visibilityState === 'visible') void syncRef.current(status.ownerKey); };
    window.addEventListener('online', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('online', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [syncActive, status?.ownerKey]);

  async function confirmCloudSync() {
    if (!status || !authenticated || working) return;
    setWorking(true);
    setSyncError('');
    try {
      await enableCloudSync();
      const next = { ...localSync, enabled: true, ownerKey: status.ownerKey, error: null };
      await persistSyncState(next);
      const refreshed = await fetchCloudStatus();
      setStatus(refreshed);
      await syncRef.current(status.ownerKey);
    } catch (error) {
      setSyncError(errorText(error));
    } finally {
      if (mounted.current) setWorking(false);
    }
  }

  async function signOut() {
    try {
      setWorking(true);
      await logout();
      setAuth({ authenticated: false });
      setStatus(null);
      setStatusError('');
      setSyncError('');
    } catch (error) {
      setSyncError(errorText(error));
    } finally {
      if (mounted.current) setWorking(false);
    }
  }

  if (!visible) return null;
  return <section className="panel cloud-sync-panel" aria-labelledby="cloud-sync-title">
    <div className="sync-panel-head">
      <span className="sync-panel-icon"><Cloud size={21} /></span>
      <div><span className="eyebrow">PRIVATE CLOUD · SUPABASE BNK</span><h2 id="cloud-sync-title">Cloud Sync และบัญชีผู้ใช้</h2><p>ข้อมูลหลักยังอยู่ในเครื่อง และจะส่งขึ้น BNK หลังเข้าสู่ระบบและยืนยันเท่านั้น</p></div>
    </div>
    {authLoading ? <div className="sync-status-line"><LoaderCircle className="sync-spinner" size={17} />กำลังตรวจสอบบัญชี Manus…</div> : !authenticated ? <div className="sync-signed-out">
      <p>เข้าสู่ระบบด้วย Manus เพื่อเชื่อมบัญชีส่วนตัวกับข้อมูลใน BNK การเข้าสู่ระบบเพียงอย่างเดียวยังไม่ส่งข้อมูลจากอุปกรณ์</p>
      <a className="button button-primary" href={loginHref()}><LogIn size={16} />เข้าสู่ระบบ Manus</a>
      {statusError && <p className="sync-error" role="alert">{statusError}</p>}
    </div> : <>
      <div className="sync-account-row"><span><ShieldCheck size={16} />เข้าสู่ระบบแล้ว{auth?.user?.name ? ` · ${auth.user.name}` : ' · Manus'}</span><button type="button" className="button button-ghost button-small" onClick={() => void signOut()} disabled={working}><LogOut size={14} />ออกจากระบบ</button></div>
      {statusError ? <div className="sync-error-box" role="alert"><TriangleAlert size={17} /><div><strong>ยังเชื่อม BNK ไม่ได้</strong><p>{statusError}</p><button className="button button-ghost button-small" onClick={() => void refreshCloudStatus()} disabled={statusLoading}><RefreshCw size={14} />ตรวจสอบอีกครั้ง</button></div></div> : status ? <>
        <div className="sync-count-grid">
          <div><span>ในอุปกรณ์นี้</span><strong>{holdings.length} รายการ</strong><small>{localAttachmentCount} ไฟล์แนบ</small></div>
          <div><span>ใน BNK</span><strong>{status.holdingsCount} รายการ</strong><small>{status.attachmentsCount} ไฟล์แนบ</small></div>
        </div>
        {syncActive ? <div className="sync-active-box">
          <p className="sync-success-line"><CheckCircle2 size={17} />เปิด Cloud Sync บนอุปกรณ์นี้แล้ว</p>
          <p>รายการทองและไฟล์แนบจะรวมตามเวลาที่แก้ไขล่าสุด ข้อมูลยังเก็บสำเนาในอุปกรณ์นี้</p>
          <div className="sync-actions"><button className="button button-primary" onClick={() => void syncRef.current(status.ownerKey)} disabled={working}>{working ? <LoaderCircle className="sync-spinner" size={16} /> : <CloudUpload size={16} />}{working ? 'กำลังซิงก์…' : 'ซิงก์ตอนนี้'}</button><button className="button button-ghost button-small" onClick={() => void refreshCloudStatus()} disabled={statusLoading}><RefreshCw size={14} />ตรวจสถานะ</button></div>
          {localSync.lastSyncedAt && <small className="sync-last-time">ซิงก์สำเร็จล่าสุด {formatDateTime(localSync.lastSyncedAt)}</small>}
          {syncError && <p className="sync-error" role="alert">{syncError} <button className="text-button" onClick={() => void syncRef.current(status.ownerKey)}>ลองอีกครั้ง</button></p>}
        </div> : <div className="sync-consent-box">
          <p><strong>ยังไม่มีการส่งข้อมูลจากอุปกรณ์นี้</strong> การยืนยันจะเปิดใช้ Cloud Sync และเริ่มรวมรายการทองกับไฟล์แนบในเครื่อง ({holdings.length} รายการ, {localAttachmentCount} ไฟล์) กับ BNK ({status.holdingsCount} รายการ, {status.attachmentsCount} ไฟล์) โดยใช้ข้อมูลที่แก้ไขล่าสุด รายการที่ถูกลบจะซิงก์เป็นสถานะลบ ไม่ลบข้อมูลทั้งหมดของอีกฝั่ง</p>
          <button className="button button-primary" onClick={() => void confirmCloudSync()} disabled={working}>{working ? <LoaderCircle className="sync-spinner" size={16} /> : <CloudUpload size={16} />}{working ? 'กำลังเริ่ม…' : 'ยืนยันเปิดซิงก์และรวมข้อมูล'}</button>
          <small>หากยังไม่ต้องการซิงก์ ให้ไม่กดยืนยัน ข้อมูลในเครื่องจะไม่ถูกอัปโหลด</small>
          {syncError && <p className="sync-error" role="alert">{syncError}</p>}
        </div>}
      </> : <div className="sync-status-line"><LoaderCircle className="sync-spinner" size={17} />กำลังตรวจสอบสถานะ BNK…</div>}
    </>}
  </section>;
}
