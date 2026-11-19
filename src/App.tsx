import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowDownUp, ArrowDownRight, ArrowUpRight, BarChart3, CalendarDays,
  Check, ChevronRight, CircleDollarSign, Coins, Download, ExternalLink, Eye, FileUp,
  LayoutDashboard, Package, Pencil, Plus, RefreshCw, Search, ShieldCheck, Trash2, X,
} from 'lucide-react';
import HoldingForm from './components/HoldingForm';
import HoldingDetails from './components/HoldingDetails';
import CategoryBreakdown from './components/CategoryBreakdown';
import QuoteForm from './components/QuoteForm';
import { holdingCost, holdingProfit, holdingValue, totalWeight, totals } from './features/holdings/calculations';
import { fetchOfficialPrice } from './features/prices/api';
import { quoteIsComplete, quoteIsStale } from './features/prices/quote';
import { currency, decimal, formatDate, formatDateTime } from './lib/format';
import { getHoldings, getQuote, removeHolding, replaceAllHoldings, saveHolding, saveQuote } from './lib/storage/db';
import type { AppTab, Holding, HoldingAttachment, ManualQuote } from './types';

const emptyQuote: ManualQuote = { barBuy: null, barSell: null, ornamentBuy: null, ornamentSell: null, quotedAt: '', sourceUrl: 'https://www.goldtraders.or.th/' };
const sourceUrl = 'https://www.goldtraders.or.th/';
type QuoteSyncStatus = 'loading' | 'current' | 'stale' | 'error' | 'manual';

function money(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value) ? '—' : currency.format(value);
}

function kindName(kind: Holding['kind']): string { return kind === 'bar' ? 'ทองคำแท่ง' : 'ทองรูปพรรณ'; }

function validAttachment(value: unknown, allowedTypes: string[]): value is HoldingAttachment {
  if (value === undefined) return true;
  if (!value || typeof value !== 'object') return false;
  const attachment = value as Partial<HoldingAttachment>;
  if (typeof attachment.name !== 'string' || attachment.name.length > 255 || typeof attachment.mimeType !== 'string' || !allowedTypes.includes(attachment.mimeType)) return false;
  if (typeof attachment.sizeBytes !== 'number' || !Number.isFinite(attachment.sizeBytes) || attachment.sizeBytes <= 0 || attachment.sizeBytes > 5 * 1024 * 1024) return false;
  if (typeof attachment.dataUrl !== 'string' || attachment.dataUrl.length > 7_100_000) return false;
  const prefix = `data:${attachment.mimeType};base64,`;
  if (!attachment.dataUrl.startsWith(prefix)) return false;
  return /^[A-Za-z0-9+/]*={0,2}$/.test(attachment.dataUrl.slice(prefix.length));
}

function StatCard({ label, value, note, icon, tone = '' }: { label: string; value: string; note: string; icon: React.ReactNode; tone?: string }) {
  return <article className="stat-card"><div className="stat-top"><span>{label}</span><span className="stat-icon">{icon}</span></div><strong className={`stat-value ${tone}`}>{value}</strong><span className="stat-note">{note}</span></article>;
}

function QuotePanel({ quote, onEdit, onRefresh, status, lastCheckedAt, refreshing, compact = false }: {
  quote: ManualQuote;
  onEdit: () => void;
  onRefresh: () => void;
  status: QuoteSyncStatus;
  lastCheckedAt: string | null;
  refreshing: boolean;
  compact?: boolean;
}) {
  const complete = quoteIsComplete(quote);
  const stale = complete && quoteIsStale(quote);
  const statusLabels: Record<QuoteSyncStatus, string> = {
    loading: 'กำลังเชื่อมต่อ',
    current: 'เชื่อมต่อแล้ว',
    stale: 'ใช้ราคาล่าสุด',
    error: 'เชื่อมต่อไม่ได้',
    manual: 'ราคาสำรอง',
  };
  const statusDescriptions: Record<QuoteSyncStatus, string> = {
    loading: 'กำลังตรวจราคาจากสมาคมค้าทองคำ',
    current: 'เชื่อมต่อสมาคมค้าทองคำแล้ว',
    stale: 'ใช้สำเนาราคาล่าสุด · ต้นทางตอบช้า',
    error: 'เชื่อมต่อไม่ได้ · ใช้ราคาในอุปกรณ์ถ้ามี',
    manual: 'ใช้ราคาที่กรอกเองชั่วคราว',
  };
  const displayTime = quote.fetchedAt ?? lastCheckedAt;
  const timeLabel = status === 'error' && quote.fetchedAt ? 'ดึงสำเร็จล่าสุด' : status === 'manual' ? 'ตรวจระบบล่าสุด' : 'ดึงข้อมูลล่าสุด';
  return <section className={`market-card ${compact ? 'market-card-compact' : ''}`} aria-labelledby={compact ? undefined : 'market-title'} aria-label={compact ? 'ราคาสมาคมค้าทองคำ' : undefined}>
    <div className="market-head">
      <div className="market-heading">
        <div className="market-kicker-line">
          <span className="market-kicker">ราคาอ้างอิง · สมาคมค้าทองคำ</span>
          <span className={`price-status-badge price-sync-${status}`} role="status" aria-live="polite" title={statusDescriptions[status]}><i className="price-status-dot" aria-hidden="true" />{statusLabels[status]}</span>
        </div>
        {!compact && <h2 id="market-title">ราคาทองคำ 96.5%</h2>}
      </div>
      {!compact && <div className="market-head-actions">
        <button className="button button-light button-small" onClick={onEdit}><Pencil size={14} /> กรอกราคาสำรอง</button>
        <button type="button" className="price-refresh-button" onClick={onRefresh} disabled={refreshing} aria-label="รีเฟรชราคาสมาคมค้าทองคำ"><RefreshCw size={14} className={refreshing ? 'is-spinning' : ''} /><span className="price-refresh-label">{refreshing ? 'กำลังตรวจ' : 'รีเฟรช'}</span></button>
      </div>}
    </div>
    {complete ? <>
      <div className="quote-grid">
        <div className="quote-type"><div className="quote-type-title"><span className="quote-glyph">แท่ง</span><strong>ทองคำแท่ง</strong></div><div className="quote-pair"><div><span>รับซื้อ</span><b>{money(quote.barBuy)}</b></div><div><span>ขายออก</span><b>{money(quote.barSell)}</b></div></div></div>
        <div className="quote-type"><div className="quote-type-title"><span className="quote-glyph">รูป</span><strong>ทองรูปพรรณ</strong></div><div className="quote-pair"><div><span>ฐานภาษี</span><b>{money(quote.ornamentBuy)}</b></div><div><span>ขายออก</span><b>{money(quote.ornamentSell)}</b></div></div></div>
      </div>
      {!compact && <div className="quote-foot">
        <span className={stale ? 'quote-stale' : ''}>{stale ? <AlertTriangle size={14} /> : <Check size={14} />} {stale ? 'ราคาอ้างอิงเกิน 24 ชั่วโมง · กรุณาตรวจสอบใหม่' : `ประกาศล่าสุด ณ ${formatDateTime(quote.quotedAt)}`}</span>
        {displayTime && <span className="price-sync-time">{timeLabel} {formatDateTime(displayTime)}</span>}
        <a href={sourceUrl} target="_blank" rel="noreferrer">เปิดแหล่งทางการ <ExternalLink size={13} /></a>
      </div>}
    </> : <div className="quote-empty"><div><strong>{status === 'error' ? 'ยังดึงราคาอ้างอิงไม่ได้' : 'กำลังโหลดราคาอ้างอิง'}</strong><p>{compact ? (status === 'error' ? 'ดูสถานะและจัดการราคาได้ที่หน้า ราคาอ้างอิง' : 'กำลังตรวจราคาประกาศล่าสุดจากสมาคมค้าทองคำ') : (status === 'error' ? 'กดลองรีเฟรชอีกครั้ง หรือกรอกราคาสำรองจากประกาศสมาคมฯ' : 'กำลังตรวจราคาประกาศล่าสุดจากสมาคมค้าทองคำ')}</p>{!compact && <a href={sourceUrl} target="_blank" rel="noreferrer">เปิดเว็บสมาคมค้าทองคำ <ExternalLink size={14} /></a>}</div><span className="quote-empty-icon"><CircleDollarSign size={28} /></span></div>}
    {!compact && <div className="manual-hint"><AlertTriangle size={14} /> คำนวณจากราคาประกาศ ไม่ใช่ราคาซื้อขายรับประกัน · ตรวจอัตโนมัติทุก 2 นาทีขณะเปิดแอป</div>}
  </section>;
}

function HoldingLine({ item, quote, onEdit, onDelete, onDetails, compact = false }: { item: Holding; quote: ManualQuote; onEdit: () => void; onDelete: () => void; onDetails: () => void; compact?: boolean }) {
  const profit = holdingProfit(item, quote);
  return <article className={`holding-line ${compact ? 'holding-line-compact' : ''}`}>
    <div className="holding-emblem"><Coins size={18} /></div>
    <div className="holding-main"><strong>{kindName(item.kind)} <span className="purity-tag">96.5%</span></strong><span>{item.quantity} ชิ้น · {decimal.format(item.weightPerItem)} บาท/ชิ้น · ซื้อ {formatDate(item.purchasedAt)}</span></div>
    <div className="holding-cost"><span>ต้นทุนรวม</span><strong>{money(holdingCost(item))}</strong></div>
    <div className={`holding-profit ${profit === null ? 'profit-pending' : profit >= 0 ? 'profit-positive' : 'profit-negative'}`}><span>{profit === null ? 'มูลค่าปัจจุบัน' : profit >= 0 ? 'กำไรโดยประมาณ' : 'ขาดทุนโดยประมาณ'}</span><strong>{profit === null ? money(holdingValue(item, quote)) : <>{profit >= 0 ? '+' : '−'}{currency.format(Math.abs(profit))}</>}</strong></div>
    <div className="row-actions"><button className="icon-button" aria-label="ดูรายละเอียด" onClick={onDetails}><Eye size={15} /></button><button className="icon-button" aria-label="แก้ไขรายการ" onClick={onEdit}><Pencil size={15} /></button><button className="icon-button danger-icon" aria-label="ลบรายการ" onClick={onDelete}><Trash2 size={15} /></button></div>
  </article>;
}

export default function App() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [quote, setQuote] = useState<ManualQuote>(emptyQuote);
  const [tab, setTab] = useState<AppTab>('overview');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [holdingDialog, setHoldingDialog] = useState<Holding | null | 'new'>(null);
  const [detailHolding, setDetailHolding] = useState<Holding | null>(null);
  const [quoteDialog, setQuoteDialog] = useState(false);
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<'all' | Holding['kind']>('all');
  const [sortBy, setSortBy] = useState('date');
  const importRef = useRef<HTMLInputElement>(null);
  const refreshPricesRef = useRef<() => Promise<void>>(async () => {});
  const [priceStatus, setPriceStatus] = useState<QuoteSyncStatus>('loading');
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let active = true;
    let localLoaded = false;
    let refreshInProgress = false;
    const refresh = async () => {
      if (!active || refreshInProgress) return;
      refreshInProgress = true;
      setRefreshing(true);
      setPriceStatus('loading');
      setLastCheckedAt(new Date().toISOString());
      try {
        const snapshot = await fetchOfficialPrice();
        await saveQuote(snapshot.quote);
        if (!active) return;
        setQuote(snapshot.quote);
        setLastCheckedAt(snapshot.fetchedAt);
        setPriceStatus(snapshot.stale ? 'stale' : 'current');
      } catch {
        if (active) setPriceStatus('error');
      } finally {
        refreshInProgress = false;
        if (active) setRefreshing(false);
      }
    };
    refreshPricesRef.current = refresh;
    void Promise.all([getHoldings(), getQuote()]).then(([items, currentQuote]) => {
      if (!active) return;
      setHoldings(items.sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt)));
      setQuote(currentQuote);
      setBusy(false);
      localLoaded = true;
      void refresh();
    }).catch(() => {
      if (active) { setError('อ่านข้อมูลในอุปกรณ์ไม่สำเร็จ กรุณาลองเปิดแอปอีกครั้ง'); setBusy(false); }
    });
    const timer = window.setInterval(() => {
      if (localLoaded && document.visibilityState === 'visible') void refresh();
    }, 120_000);
    const onVisibilityChange = () => {
      if (localLoaded && document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      refreshPricesRef.current = async () => {};
    };
  }, []);

  const summary = useMemo(() => totals(holdings, quote), [holdings, quote]);
  const totalProfit = quoteIsComplete(quote) ? summary.value - summary.cost : null;
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('th-TH');
    const list = holdings.filter((item) => {
      const matchesKind = kindFilter === 'all' || item.kind === kindFilter;
      const matchesQuery = !needle || `${kindName(item.kind)} ${item.note} ${item.purchasedAt}`.toLocaleLowerCase('th-TH').includes(needle);
      return matchesKind && matchesQuery;
    });
    return list.sort((a, b) => {
      if (sortBy === 'weight') return b.quantity * b.weightPerItem - a.quantity * a.weightPerItem;
      if (sortBy === 'profit') return (holdingProfit(b, quote) ?? -Infinity) - (holdingProfit(a, quote) ?? -Infinity);
      if (sortBy === 'cost') return holdingCost(b) - holdingCost(a);
      return b.purchasedAt.localeCompare(a.purchasedAt);
    });
  }, [holdings, kindFilter, query, sortBy, quote]);

  async function handleSaveHolding(item: Holding) {
    await saveHolding(item);
    setHoldings((current) => [item, ...current.filter((entry) => entry.id !== item.id)].sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt)));
    setMessage('บันทึกรายการทองแล้ว');
  }

  async function handleDelete(item: Holding) {
    if (!window.confirm(`ลบรายการ ${kindName(item.kind)} น้ำหนัก ${decimal.format(item.quantity * item.weightPerItem)} บาททองคำใช่หรือไม่?`)) return;
    await removeHolding(item.id);
    setHoldings((current) => current.filter((entry) => entry.id !== item.id));
    setMessage('ลบรายการแล้ว');
  }

  async function handleSaveQuote(nextQuote: ManualQuote) {
    const manualQuote: ManualQuote = { ...nextQuote, source: 'manual', fetchedAt: undefined };
    await saveQuote(manualQuote);
    setQuote(manualQuote);
    setPriceStatus('manual');
    setMessage('บันทึกราคาสำรองแล้ว · ระบบจะกลับไปใช้ราคาสมาคมฯ เมื่อเชื่อมต่อได้');
  }

  function exportBackup() {
    const payload = { format: 'thong-port-backup', version: 1, exportedAt: new Date().toISOString(), holdings, quote };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `thong-port-backup-${new Date().toISOString().slice(0, 10)}.json`; anchor.click(); URL.revokeObjectURL(url);
    setMessage('ดาวน์โหลดไฟล์สำรองแล้ว');
  }

  async function importBackup(file?: File) {
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== 'object' || !('format' in parsed) || parsed.format !== 'thong-port-backup' || !('version' in parsed) || parsed.version !== 1 || !('holdings' in parsed) || !Array.isArray(parsed.holdings) || !('quote' in parsed)) throw new Error('ไฟล์นี้ไม่ใช่ไฟล์สำรองของทองพอร์ต');
      const incoming = parsed.holdings as Holding[];
      const isValid = incoming.every((item) => item && typeof item.id === 'string' && (item.kind === 'bar' || item.kind === 'ornament') && typeof item.quantity === 'number' && Number.isInteger(item.quantity) && item.quantity >= 1 && typeof item.weightPerItem === 'number' && Number.isFinite(item.weightPerItem) && item.weightPerItem > 0 && typeof item.purchasePricePerBaht === 'number' && Number.isFinite(item.purchasePricePerBaht) && item.purchasePricePerBaht > 0 && typeof item.additionalCost === 'number' && Number.isFinite(item.additionalCost) && item.additionalCost >= 0 && typeof item.purchasedAt === 'string' && typeof item.note === 'string' && typeof item.createdAt === 'string' && typeof item.updatedAt === 'string' && validAttachment(item.goldPhoto, ['image/jpeg', 'image/png', 'image/webp']) && validAttachment(item.warrantyDocument, ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']));
      if (!isValid) throw new Error('ข้อมูลรายการทองในไฟล์ไม่ถูกต้อง');
      const incomingQuote = parsed.quote as ManualQuote;
      const validQuote = [incomingQuote.barBuy, incomingQuote.barSell, incomingQuote.ornamentBuy, incomingQuote.ornamentSell].every((value) => value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0)) && typeof incomingQuote.quotedAt === 'string';
      if (!validQuote) throw new Error('ข้อมูลราคาในไฟล์ไม่ถูกต้อง');
      if (!window.confirm(`นำเข้าข้อมูล ${incoming.length} รายการ? ข้อมูลปัจจุบันจะถูกแทนที่`)) return;
      await replaceAllHoldings(incoming);
      await saveQuote(incomingQuote);
      setHoldings(incoming); setQuote(incomingQuote); setError(''); setMessage('กู้คืนข้อมูลสำเร็จ');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'อ่านไฟล์ไม่สำเร็จ');
    } finally {
      if (importRef.current) importRef.current.value = '';
    }
  }

  const pageTitle: Record<AppTab, string> = { overview: 'ภาพรวมพอร์ต', holdings: 'สินทรัพย์ทอง', prices: 'ราคาอ้างอิง', backup: 'ข้อมูลและความเป็นส่วนตัว' };

  return <div className="app-shell home-theme-preview">
    <aside className="sidebar">
      <a className="brand" href="#top" onClick={(event) => { event.preventDefault(); setTab('overview'); }}><span className="brand-mark"><Coins size={21} /></span><span>ทองพอร์ต<small>PERSONAL GOLD</small></span></a>
      <div className="sidebar-section"><span className="sidebar-label">พอร์ตของฉัน</span>
        <button className={`nav-link ${tab === 'overview' ? 'is-active' : ''}`} onClick={() => setTab('overview')}><LayoutDashboard size={18} />ภาพรวม</button>
        <button className={`nav-link ${tab === 'holdings' ? 'is-active' : ''}`} onClick={() => setTab('holdings')}><Package size={18} />สินทรัพย์ทอง<span className="nav-count">{holdings.length}</span></button>
        <button className={`nav-link ${tab === 'prices' ? 'is-active' : ''}`} onClick={() => setTab('prices')}><BarChart3 size={18} />ราคาอ้างอิง</button>
      </div>
      <div className="sidebar-bottom"><div className="privacy-card"><ShieldCheck size={17} /><div><strong>ข้อมูลอยู่ในอุปกรณ์นี้</strong><span>ไม่มีบัญชี · ไม่มี cloud sync</span></div></div><button className={`nav-link ${tab === 'backup' ? 'is-active' : ''}`} onClick={() => setTab('backup')}><Download size={18} />สำรองและกู้คืน</button><div className="version-note">ข้อมูลส่วนตัว · จัดเก็บใน browser</div></div>
    </aside>

    <main className="main-area" id="top">
      <header className="topbar"><div className="mobile-brand"><span className="brand-mark"><Coins size={19} /></span>ทองพอร์ต</div><div className="breadcrumb"><span>พอร์ตส่วนตัว</span><ChevronRight size={15} /><strong>{pageTitle[tab]}</strong></div><div className="topbar-right"><span className="privacy-pill"><ShieldCheck size={14} /> จัดเก็บในอุปกรณ์นี้</span><button className="avatar" aria-label="ข้อมูลส่วนตัว">ท</button></div></header>
      <div className="content-area">
        {error && <div className="toast toast-error" role="alert"><AlertTriangle size={16} />{error}<button onClick={() => setError('')} aria-label="ปิดข้อความ"><X size={15} /></button></div>}
        {message && <div className="toast toast-success" role="status"><Check size={16} />{message}<button onClick={() => setMessage('')} aria-label="ปิดข้อความ"><X size={15} /></button></div>}
        {busy ? <div className="loading-state"><span className="spinner" />กำลังเปิดพอร์ตทองของคุณ…</div> : <>
          {tab === 'overview' && <>
            <QuotePanel quote={quote} onEdit={() => setQuoteDialog(true)} onRefresh={() => void refreshPricesRef.current()} status={priceStatus} lastCheckedAt={lastCheckedAt} refreshing={refreshing} compact />
            <div className="stats-grid"><StatCard label="มูลค่าพอร์ตโดยประมาณ" value={quoteIsComplete(quote) ? money(summary.value) : 'รอราคาอ้างอิง'} note={quote.source === 'association' ? `ประเมินจากราคาสมาคมฯ ณ ${formatDateTime(quote.quotedAt)}` : 'ประเมินจากราคาสำรองล่าสุดที่มีในอุปกรณ์'} icon={<CircleDollarSign size={18} />} /><StatCard label="ต้นทุนรวม" value={money(summary.cost)} note={`${holdings.length} รายการในพอร์ต`} icon={<Coins size={18} />} /><StatCard label={totalProfit === null ? 'กำไร/ขาดทุนโดยประมาณ' : totalProfit >= 0 ? 'กำไรโดยประมาณ' : 'ขาดทุนโดยประมาณ'} value={totalProfit === null ? 'รอราคาอ้างอิง' : `${totalProfit >= 0 ? '+' : '−'}${currency.format(Math.abs(totalProfit))}`} note={totalProfit === null || summary.cost === 0 ? 'รอราคาสมาคมฯ เพื่อคำนวณผลต่าง' : `${totalProfit >= 0 ? '+' : ''}${((totalProfit / summary.cost) * 100).toFixed(2)}% จากต้นทุน`} icon={totalProfit !== null && totalProfit < 0 ? <ArrowDownRight size={18} /> : <ArrowUpRight size={18} />} tone={totalProfit === null ? '' : totalProfit >= 0 ? 'tone-positive' : 'tone-negative'} /><StatCard label="น้ำหนักรวม" value={`${decimal.format(totalWeight(holdings))} บาท`} note={`${summary.barCount} รายการแท่ง · ${summary.ornamentCount} รายการรูปพรรณ`} icon={<Package size={18} />} /></div>
            <div className="overview-grid">
              <section className="panel allocation-panel">
                <div className="panel-heading"><div><h2>สัดส่วนสินทรัพย์</h2><p>เปรียบเทียบน้ำหนักทองตามประเภท</p></div><span className="panel-icon"><BarChart3 size={17} /></span></div>
                <Allocation holdings={holdings} />
                <div className="allocation-legend"><span><i className="legend-dot dot-ruby" />ทองคำแท่ง <b>{decimal.format(summary.barCount)} ชิ้น</b></span><span><i className="legend-dot dot-gold" />ทองรูปพรรณ <b>{decimal.format(summary.ornamentCount)} ชิ้น</b></span></div>
              </section>
              <section className="panel recent-panel">
                <div className="panel-heading"><div><h2>รายการล่าสุด</h2><p>สินทรัพย์ทองที่เพิ่มล่าสุด</p></div><button className="text-button" onClick={() => setTab('holdings')}>ดูทั้งหมด <ChevronRight size={14} /></button></div>
                {holdings.length ? <div className="recent-list">{[...holdings].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4).map((item) => <button className="recent-item" key={item.id} onClick={() => setDetailHolding(item)}><span className="recent-icon"><Coins size={16} /></span><span className="recent-copy"><b>{kindName(item.kind)}</b><small>{item.quantity} ชิ้น · {decimal.format(item.quantity * item.weightPerItem)} บาททองคำ</small></span><span className="recent-value">{money(holdingCost(item))}<ChevronRight size={14} /></span></button>)}</div> : <EmptyState title="ยังไม่มีรายการทอง" description="เพิ่มรายการแรกเพื่อเริ่มติดตามพอร์ตของคุณ" action="เพิ่มรายการทอง" onAction={() => setHoldingDialog('new')} />}
              </section>
            </div>
            <CategoryBreakdown holdings={holdings} quote={quote} />
            <div className="footnote"><AlertTriangle size={14} />มูลค่าและกำไร/ขาดทุนเป็นการประมาณจากราคารับซื้อ/ฐานภาษีที่สมาคมฯ ประกาศล่าสุด ไม่ใช่ราคาซื้อขายรับประกัน · ราคาอัปเดตตามรอบประกาศของสมาคมฯ</div>
          </>}

          {tab === 'holdings' && <>
            <div className="page-heading"><div><span className="eyebrow">YOUR GOLD ASSETS</span><h1>สินทรัพย์ทอง</h1><p>จัดการรายการทองแท่งและทองรูปพรรณทั้งหมด</p></div><button className="button button-primary" onClick={() => setHoldingDialog('new')}><Plus size={17} />เพิ่มรายการทอง</button></div>
            <div className="list-toolbar"><label className="search-field"><Search size={17} /><input aria-label="ค้นหารายการทอง" placeholder="ค้นหาประเภทหรือบันทึก…" value={query} onChange={(e) => setQuery(e.target.value)} /><kbd>/</kbd></label><label className="select-field"><span className="sr-only">กรองตามประเภท</span><select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as typeof kindFilter)}><option value="all">ทองทุกประเภท</option><option value="bar">ทองคำแท่ง</option><option value="ornament">ทองรูปพรรณ</option></select></label><label className="select-field sort-field"><ArrowDownUp size={15} /><span className="sr-only">เรียงตาม</span><select value={sortBy} onChange={(e) => setSortBy(e.target.value)}><option value="date">วันที่ซื้อ</option><option value="weight">น้ำหนัก</option><option value="cost">ต้นทุนสูงสุด</option><option value="profit">กำไร/ขาดทุน</option></select></label></div>
            <div className="list-summary"><span>แสดง {filtered.length} จาก {holdings.length} รายการ</span><span>น้ำหนักรวม {decimal.format(totalWeight(filtered))} บาททองคำ</span></div>
            <section className="holdings-list">{filtered.length ? filtered.map((item) => <HoldingLine key={item.id} item={item} quote={quote} onDetails={() => setDetailHolding(item)} onEdit={() => setHoldingDialog(item)} onDelete={() => void handleDelete(item)} />) : <EmptyState title={holdings.length ? 'ไม่พบรายการที่ค้นหา' : 'เริ่มบันทึกสินทรัพย์ทอง'} description={holdings.length ? 'ลองเปลี่ยนคำค้นหาหรือตัวกรอง' : 'เพิ่มจำนวน น้ำหนัก ราคาซื้อ และวันที่ซื้อของทองที่ถืออยู่'} action={holdings.length ? undefined : 'เพิ่มรายการทอง'} onAction={() => setHoldingDialog('new')} />}</section>
          </>}

          {tab === 'prices' && <>
            <div className="page-heading"><div><span className="eyebrow">GOLD TRADERS ASSOCIATION</span><h1>ราคาอ้างอิง</h1><p>ดึงประกาศล่าสุดและคำนวณมูลค่าพอร์ตใหม่โดยอัตโนมัติ</p></div><button className="button button-primary" onClick={() => setQuoteDialog(true)}><Pencil size={16} />กรอกราคาสำรอง</button></div>
            <QuotePanel quote={quote} onEdit={() => setQuoteDialog(true)} onRefresh={() => void refreshPricesRef.current()} status={priceStatus} lastCheckedAt={lastCheckedAt} refreshing={refreshing} />
            <section className="panel price-instructions"><div className="instruction-icon"><CalendarDays size={19} /></div><div><h2>ราคาอัปเดตอัตโนมัติ</h2><p>ระบบตรวจ endpoint ของสมาคมฯ เมื่อเปิดแอปและทุก 2 นาทีขณะหน้าเว็บเปิดอยู่; กำไร/ขาดทุนและมูลค่าพอร์ตจะคำนวณใหม่ทันทีหลังได้รับราคา แสดงเวลาประกาศจริงแยกจากเวลาที่ดึงข้อมูล และไม่มีการอ้างว่าราคาเป็น tick-by-tick</p><a href={sourceUrl} target="_blank" rel="noreferrer">ไปที่ goldtraders.or.th <ExternalLink size={14} /></a></div></section>
            <div className="notice notice-warn"><AlertTriangle size={17} /><p><strong>ราคาประเมินเป็นราคาอ้างอิง ไม่ใช่ราคาขายจริงรับประกัน</strong><br />เมื่อดึงข้อมูลไม่ได้ แอปใช้ราคาล่าสุดที่บันทึกไว้ในอุปกรณ์และแสดงสถานะการเชื่อมต่อ คุณกรอกราคาสำรองเองได้ โดยระบบจะกลับไปใช้ราคาสมาคมฯ เมื่อเชื่อมต่อสำเร็จครั้งถัดไป</p></div>
          </>}

          {tab === 'backup' && <>
            <div className="page-heading"><div><span className="eyebrow">LOCAL DATA CONTROL</span><h1>ข้อมูลและความเป็นส่วนตัว</h1><p>ข้อมูลสินทรัพย์ทองถูกจัดเก็บใน browser ของอุปกรณ์นี้</p></div></div>
            <section className="panel privacy-panel"><div className="privacy-large"><ShieldCheck size={22} /></div><div><h2>ข้อมูลพอร์ตเก็บไว้ในอุปกรณ์นี้</h2><p>ไม่มีบัญชีผู้ใช้และไม่มี cloud sync รายการทอง ต้นทุน รูปทอง และใบรับประกันไม่ออกจากอุปกรณ์นี้; server ใช้เฉพาะดึงราคาสาธารณะจากสมาคมฯ และไม่รับข้อมูลพอร์ต หากล้างข้อมูล browser หรือเปลี่ยนอุปกรณ์ รายการอาจหายได้ โปรดดาวน์โหลดไฟล์สำรองเป็นระยะ</p></div></section>
            <div className="backup-grid"><section className="panel backup-card"><span className="backup-icon"><Download size={20} /></span><h2>ส่งออกไฟล์สำรอง</h2><p>ดาวน์โหลดรายการทองและราคาอ้างอิงเป็นไฟล์ JSON เพื่อเก็บไว้นอก browser</p><button className="button button-primary" onClick={exportBackup}><Download size={16} />ดาวน์โหลดข้อมูลสำรอง</button></section><section className="panel backup-card"><span className="backup-icon backup-icon-muted"><FileUp size={20} /></span><h2>นำเข้าหรือกู้คืน</h2><p>เลือกไฟล์สำรองจากทองพอร์ต ข้อมูลปัจจุบันจะถูกแทนที่หลังยืนยัน</p><input ref={importRef} className="sr-only" type="file" accept="application/json,.json" onChange={(e) => void importBackup(e.target.files?.[0])} /><button className="button button-ghost" onClick={() => importRef.current?.click()}><FileUp size={16} />เลือกไฟล์ JSON</button></section></div>
            <div className="notice notice-warm"><AlertTriangle size={17} /><p><strong>สำรองข้อมูลอย่างปลอดภัย</strong><br />ไฟล์ JSON มีข้อมูลพอร์ตและราคาซื้อของคุณ เก็บไว้ในที่ปลอดภัยและอย่าส่งต่อให้ผู้อื่นโดยไม่จำเป็น</p></div>
          </>}
        </>}
        <footer className="app-footer"><span>ทองพอร์ต <i /> พอร์ตทองส่วนตัว</span><span>ราคาอ้างอิงสมาคมฯ · ตรวจอัตโนมัติทุก 2 นาที</span></footer>
      </div>
    </main>

    <nav className="mobile-nav" aria-label="เมนูหลัก"><button className={tab === 'overview' ? 'mobile-nav-active' : ''} onClick={() => setTab('overview')}><LayoutDashboard size={18} /><span>ภาพรวม</span></button><button className={tab === 'holdings' ? 'mobile-nav-active' : ''} onClick={() => setTab('holdings')}><Package size={18} /><span>สินทรัพย์</span></button><button className="mobile-nav-add" aria-label="เพิ่มรายการทอง" onClick={() => setHoldingDialog('new')}><span><Plus size={20} /></span><span>เพิ่มทอง</span></button><button className={tab === 'prices' ? 'mobile-nav-active' : ''} onClick={() => setTab('prices')}><BarChart3 size={18} /><span>ราคา</span></button><button className={tab === 'backup' ? 'mobile-nav-active' : ''} onClick={() => setTab('backup')}><Download size={18} /><span>สำรอง</span></button></nav>

    {detailHolding && <HoldingDetails item={detailHolding} quote={quote} onClose={() => setDetailHolding(null)} onEdit={() => { setHoldingDialog(detailHolding); setDetailHolding(null); }} />}
    {holdingDialog !== null && <HoldingForm initial={holdingDialog === 'new' ? null : holdingDialog} onClose={() => setHoldingDialog(null)} onSave={handleSaveHolding} />}
    {quoteDialog && <QuoteForm initial={quote} onClose={() => setQuoteDialog(false)} onSave={handleSaveQuote} />}
  </div>;
}

function Allocation({ holdings }: { holdings: Holding[] }) {
  const bar = holdings.filter((item) => item.kind === 'bar').reduce((sum, item) => sum + item.quantity * item.weightPerItem, 0);
  const ornament = holdings.filter((item) => item.kind === 'ornament').reduce((sum, item) => sum + item.quantity * item.weightPerItem, 0);
  const total = bar + ornament;
  return <div className="allocation-content">{total ? <><div className="allocation-total"><span>ทองทั้งหมด</span><strong>{decimal.format(total)} <small>บาททองคำ</small></strong></div><div className="allocation-bar" role="img" aria-label={`ทองแท่ง ${total ? Math.round((bar / total) * 100) : 0} เปอร์เซ็นต์ ทองรูปพรรณ ${total ? Math.round((ornament / total) * 100) : 0} เปอร์เซ็นต์`}><span className="allocation-bar-ruby" style={{ width: `${(bar / total) * 100}%` }} /><span className="allocation-bar-gold" style={{ width: `${(ornament / total) * 100}%` }} /></div><div className="allocation-percent"><span>{Math.round((bar / total) * 100)}%</span><span>{Math.round((ornament / total) * 100)}%</span></div></> : <div className="allocation-empty"><span className="allocation-total"><span>ยังไม่มีข้อมูลน้ำหนัก</span><strong>—</strong></span><div className="allocation-bar"><span className="allocation-bar-ruby" style={{ width: '50%' }} /><span className="allocation-bar-gold" style={{ width: '50%' }} /></div></div>}</div>;
}

function EmptyState({ title, description, action, onAction }: { title: string; description: string; action?: string; onAction?: () => void }) {
  return <div className="empty-state"><span className="empty-icon"><Coins size={24} /></span><h3>{title}</h3><p>{description}</p>{action && onAction && <button className="button button-ghost" onClick={onAction}><Plus size={16} />{action}</button>}</div>;
}
