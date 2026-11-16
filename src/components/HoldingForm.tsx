import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import type { GoldKind, Holding } from '../types';

interface Props {
  initial?: Holding | null;
  onClose: () => void;
  onSave: (holding: Holding) => Promise<void>;
}

export default function HoldingForm({ initial, onClose, onSave }: Props) {
  const [kind, setKind] = useState<GoldKind>(initial?.kind ?? 'bar');
  const [quantity, setQuantity] = useState(String(initial?.quantity ?? 1));
  const [weight, setWeight] = useState(String(initial?.weightPerItem ?? 1));
  const [price, setPrice] = useState(String(initial?.purchasePricePerBaht ?? ''));
  const [additionalCost, setAdditionalCost] = useState(String(initial?.additionalCost ?? 0));
  const [purchasedAt, setPurchasedAt] = useState(initial?.purchasedAt ?? new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState(initial?.note ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const qty = Number(quantity), weightValue = Number(weight), priceValue = Number(price), fees = Number(additionalCost);
    if (![qty, weightValue, priceValue, fees].every(Number.isFinite) || qty < 1 || weightValue <= 0 || priceValue <= 0 || fees < 0) {
      setError('ตรวจสอบจำนวน น้ำหนัก ราคา และต้นทุนเพิ่มเติมอีกครั้ง');
      return;
    }
    setSaving(true); setError('');
    const now = new Date().toISOString();
    try {
      await onSave({
        id: initial?.id ?? crypto.randomUUID(), kind, quantity: qty, weightPerItem: weightValue,
        purchasePricePerBaht: priceValue, additionalCost: fees, purchasedAt, note: note.trim(),
        createdAt: initial?.createdAt ?? now, updatedAt: now,
      });
      onClose();
    } catch {
      setError('บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง');
      setSaving(false);
    }
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="modal" role="dialog" aria-modal="true" aria-labelledby="holding-form-title">
      <div className="modal-head"><div><span className="eyebrow">รายการสินทรัพย์</span><h2 id="holding-form-title">{initial ? 'แก้ไขข้อมูลทอง' : 'เพิ่มรายการทอง'}</h2></div><button className="icon-button" onClick={onClose} aria-label="ปิด"><X size={19} /></button></div>
      <form onSubmit={submit} className="form-stack">
        <div className="field"><label htmlFor="gold-kind">ประเภททอง</label><select id="gold-kind" value={kind} onChange={(e) => setKind(e.target.value as GoldKind)}><option value="bar">ทองคำแท่ง 96.5%</option><option value="ornament">ทองรูปพรรณ 96.5%</option></select></div>
        <div className="form-grid"><div className="field"><label htmlFor="quantity">จำนวนชิ้น</label><input id="quantity" type="number" min="1" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} required /></div><div className="field"><label htmlFor="weight">น้ำหนักต่อชิ้น (บาททองคำ)</label><input id="weight" type="number" min="0.01" step="0.01" value={weight} onChange={(e) => setWeight(e.target.value)} required /></div></div>
        <div className="field"><label htmlFor="purchase-price">ราคาซื้อต่อบาททองคำ (บาท)</label><input id="purchase-price" type="number" min="1" step="0.01" placeholder="เช่น 42000" value={price} onChange={(e) => setPrice(e.target.value)} required /><span className="field-hint">ใช้บันทึกราคาทองก่อนรวมค่ากำเหน็จ</span></div>
        <div className="field"><label htmlFor="extra-cost">ค่ากำเหน็จ/ต้นทุนเพิ่มเติมรวม (บาท)</label><input id="extra-cost" type="number" min="0" step="0.01" value={additionalCost} onChange={(e) => setAdditionalCost(e.target.value)} /></div>
        <div className="field"><label htmlFor="purchased-at">วันที่ซื้อ</label><input id="purchased-at" type="date" value={purchasedAt} onChange={(e) => setPurchasedAt(e.target.value)} required /></div>
        <div className="field"><label htmlFor="note">บันทึกเพิ่มเติม <span className="optional">(ไม่บังคับ)</span></label><textarea id="note" rows={2} maxLength={240} value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น ร้านที่ซื้อ หรือรายละเอียดใบรับประกัน" /></div>
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="modal-actions"><button type="button" className="button button-ghost" onClick={onClose}>ยกเลิก</button><button className="button button-primary" disabled={saving}>{saving ? 'กำลังบันทึก…' : 'บันทึกข้อมูล'}</button></div>
      </form>
    </section>
  </div>;
}
