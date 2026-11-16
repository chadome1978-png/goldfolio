import { useState, type FormEvent } from 'react';
import { ExternalLink, X } from 'lucide-react';
import type { ManualQuote } from '../types';
import { localDateTimeValue, parseThaiDateTimeValue } from '../features/prices/quote';

interface Props { initial: ManualQuote; onClose: () => void; onSave: (quote: ManualQuote) => Promise<void>; }

export default function QuoteForm({ initial, onClose, onSave }: Props) {
  const [barBuy, setBarBuy] = useState(initial.barBuy?.toString() ?? '');
  const [barSell, setBarSell] = useState(initial.barSell?.toString() ?? '');
  const [ornamentBuy, setOrnamentBuy] = useState(initial.ornamentBuy?.toString() ?? '');
  const [ornamentSell, setOrnamentSell] = useState(initial.ornamentSell?.toString() ?? '');
  const [quotedAt, setQuotedAt] = useState(initial.quotedAt ? localDateTimeValue(new Date(initial.quotedAt)) : localDateTimeValue());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const inputs = [barBuy, barSell, ornamentBuy, ornamentSell];
    const values = inputs.map(Number);
    if (values.some((value, index) => !inputs[index] || !Number.isFinite(value) || value <= 0)) {
      setError('กรุณากรอกราคาทั้ง 4 ช่องเป็นตัวเลขมากกว่า 0'); return;
    }
    let timestamp: string;
    try { timestamp = parseThaiDateTimeValue(quotedAt); }
    catch { setError('กรุณาระบุวันและเวลาอ้างอิงในรูปแบบที่ถูกต้อง'); return; }
    if (Date.parse(timestamp) > Date.now() + 5 * 60_000) { setError('เวลาอ้างอิงต้องไม่อยู่ในอนาคต'); return; }
    setSaving(true); setError('');
    try {
      await onSave({ barBuy: values[0], barSell: values[1], ornamentBuy: values[2], ornamentSell: values[3], quotedAt: timestamp, sourceUrl: 'https://www.goldtraders.or.th/' });
      onClose();
    } catch {
      setError('บันทึกราคาไม่สำเร็จ กรุณาลองอีกครั้ง'); setSaving(false);
    }
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="modal" role="dialog" aria-modal="true" aria-labelledby="quote-form-title">
      <div className="modal-head"><div><span className="eyebrow">อ้างอิงจากสมาคมค้าทองคำ</span><h2 id="quote-form-title">บันทึกราคาอ้างอิง</h2></div><button className="icon-button" onClick={onClose} aria-label="ปิด"><X size={19} /></button></div>
      <div className="notice notice-warm"><strong>กรอกราคาด้วยตนเอง</strong><p>แอปไม่ได้ดึงราคาอัตโนมัติ โปรดตรวจราคาจากสมาคมฯ แล้วกรอกข้อมูลและเวลาประกาศ</p><a href="https://www.goldtraders.or.th/" target="_blank" rel="noreferrer">เปิดเว็บสมาคมค้าทองคำ <ExternalLink size={13} /></a></div>
      <form onSubmit={submit} className="form-stack">
        <div className="form-grid">
          <div className="field"><label htmlFor="bar-buy">ทองแท่ง · รับซื้อ (บาท/บาททองคำ)</label><input id="bar-buy" type="number" min="1" step="0.01" value={barBuy} onChange={(event) => setBarBuy(event.target.value)} required /></div>
          <div className="field"><label htmlFor="bar-sell">ทองแท่ง · ขายออก (บาท/บาททองคำ)</label><input id="bar-sell" type="number" min="1" step="0.01" value={barSell} onChange={(event) => setBarSell(event.target.value)} required /></div>
          <div className="field"><label htmlFor="orn-buy">รูปพรรณ · ฐานภาษีอ้างอิง (บาท/บาททองคำ)</label><input id="orn-buy" type="number" min="1" step="0.01" value={ornamentBuy} onChange={(event) => setOrnamentBuy(event.target.value)} required /></div>
          <div className="field"><label htmlFor="orn-sell">รูปพรรณ · ขายออก (บาท/บาททองคำ)</label><input id="orn-sell" type="number" min="1" step="0.01" value={ornamentSell} onChange={(event) => setOrnamentSell(event.target.value)} required /></div>
        </div>
        <div className="field"><label htmlFor="quote-time">วันและเวลาที่ตรวจสอบราคาสมาคมฯ (เวลาไทย)</label><input id="quote-time" type="datetime-local" value={quotedAt} onChange={(event) => setQuotedAt(event.target.value)} required /></div>
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="modal-actions"><button type="button" className="button button-ghost" onClick={onClose}>ยกเลิก</button><button className="button button-primary" disabled={saving}>{saving ? 'กำลังบันทึก…' : 'บันทึกราคา'}</button></div>
      </form>
    </section>
  </div>;
}
