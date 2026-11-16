import { useState, type ChangeEvent, type FormEvent } from 'react';
import { FileCheck2, FileText, ImagePlus, LoaderCircle, Trash2, Upload, X } from 'lucide-react';
import type { GoldKind, Holding, HoldingAttachment } from '../types';

interface Props {
  initial?: Holding | null;
  onClose: () => void;
  onSave: (holding: Holding) => Promise<void>;
}

type AttachmentSlot = 'goldPhoto' | 'warrantyDocument';

const MAX_SOURCE_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_STORED_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_PDF_BYTES = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function readDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('อ่านไฟล์ไม่สำเร็จ'));
    reader.onerror = () => reject(new Error('อ่านไฟล์ไม่สำเร็จ'));
    reader.readAsDataURL(blob);
  });
}

async function compressImage(file: File): Promise<Blob> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = objectUrl;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('เปิดรูปนี้ไม่ได้ กรุณาเลือก JPEG, PNG หรือ WebP'));
    });
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('ไฟล์ภาพนี้ไม่มีข้อมูลรูปที่ใช้งานได้');

    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('ปรับขนาดรูปไม่สำเร็จ กรุณาลองอีกครั้ง');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => result ? resolve(result) : reject(new Error('บันทึกรูปไม่สำเร็จ')), 'image/jpeg', 0.82);
    });
    if (blob.size > MAX_STORED_IMAGE_BYTES) throw new Error('รูปยังมีขนาดใหญ่เกิน 3 MB หลังปรับขนาด กรุณาเลือกภาพอื่น');
    return blob;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function makeAttachment(file: File, slot: AttachmentSlot): Promise<HoldingAttachment> {
  if (ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    if (file.size > MAX_SOURCE_IMAGE_BYTES) throw new Error('รูปต้นฉบับต้องมีขนาดไม่เกิน 10 MB');
    const blob = await compressImage(file);
    return { name: file.name, mimeType: 'image/jpeg', dataUrl: await readDataUrl(blob), sizeBytes: blob.size };
  }

  if (slot === 'warrantyDocument' && file.type === 'application/pdf') {
    if (file.size > MAX_PDF_BYTES) throw new Error('ไฟล์ PDF ใบรับประกันต้องมีขนาดไม่เกิน 5 MB');
    return { name: file.name, mimeType: 'application/pdf', dataUrl: await readDataUrl(file), sizeBytes: file.size };
  }

  throw new Error(slot === 'goldPhoto'
    ? 'รูปทองรองรับเฉพาะ JPEG, PNG หรือ WebP'
    : 'ใบรับประกันรองรับเฉพาะภาพ JPEG, PNG, WebP หรือ PDF');
}

function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function todayBangkokDateInput(): string {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export default function HoldingForm({ initial, onClose, onSave }: Props) {
  const [kind, setKind] = useState<GoldKind>(initial?.kind ?? 'bar');
  const [quantity, setQuantity] = useState(String(initial?.quantity ?? 1));
  const [weight, setWeight] = useState(String(initial?.weightPerItem ?? 1));
  const [price, setPrice] = useState(String(initial?.purchasePricePerBaht ?? ''));
  const [additionalCost, setAdditionalCost] = useState(String(initial?.additionalCost ?? 0));
  const [purchasedAt, setPurchasedAt] = useState(initial?.purchasedAt ?? todayBangkokDateInput());
  const [note, setNote] = useState(initial?.note ?? '');
  const [goldPhoto, setGoldPhoto] = useState<HoldingAttachment | null>(initial?.goldPhoto ?? null);
  const [warrantyDocument, setWarrantyDocument] = useState<HoldingAttachment | null>(initial?.warrantyDocument ?? null);
  const [processingAttachment, setProcessingAttachment] = useState<AttachmentSlot | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function chooseAttachment(slot: AttachmentSlot, event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    setError('');
    setProcessingAttachment(slot);
    void makeAttachment(file, slot).then((attachment) => {
      if (slot === 'goldPhoto') setGoldPhoto(attachment);
      else setWarrantyDocument(attachment);
    }).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : 'เตรียมไฟล์แนบไม่สำเร็จ');
    }).finally(() => setProcessingAttachment(null));
  }

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
        ...(goldPhoto ? { goldPhoto } : {}),
        ...(warrantyDocument ? { warrantyDocument } : {}),
        createdAt: initial?.createdAt ?? now, updatedAt: now,
      });
      onClose();
    } catch {
      setError('บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง');
      setSaving(false);
    }
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="modal gold-form-modal" role="dialog" aria-modal="true" aria-labelledby="holding-form-title">
      <div className="modal-head"><div><span className="eyebrow">รายการสินทรัพย์ · ธุรกรรมซื้อเข้า</span><h2 id="holding-form-title">{initial ? 'แก้ไขข้อมูลทอง' : 'บันทึกทองที่ซื้อเข้าใหม่'}</h2></div><button className="icon-button" onClick={onClose} aria-label="ปิด"><X size={19} /></button></div>
      <form onSubmit={submit} className="form-stack">
        <div className="field"><label htmlFor="gold-kind">ประเภททอง</label><select id="gold-kind" value={kind} onChange={(e) => setKind(e.target.value as GoldKind)}><option value="bar">ทองคำแท่ง 96.5%</option><option value="ornament">ทองรูปพรรณ 96.5%</option></select></div>
        <div className="form-grid"><div className="field"><label htmlFor="quantity">จำนวนชิ้น</label><input id="quantity" type="number" min="1" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} required /></div><div className="field"><label htmlFor="weight">น้ำหนักต่อชิ้น (บาททองคำ)</label><input id="weight" type="number" min="0.01" step="0.01" value={weight} onChange={(e) => setWeight(e.target.value)} required /></div></div>
        <div className="field"><label htmlFor="purchase-price">ราคาซื้อต่อบาททองคำ (บาท)</label><input id="purchase-price" type="number" min="1" step="0.01" placeholder="เช่น 42000" value={price} onChange={(e) => setPrice(e.target.value)} required /><span className="field-hint">ใช้บันทึกราคาทองก่อนรวมค่ากำเหน็จ</span></div>
        <div className="form-grid"><div className="field"><label htmlFor="extra-cost">ค่ากำเหน็จ/ต้นทุนเพิ่มเติมรวม (บาท)</label><input id="extra-cost" type="number" min="0" step="0.01" value={additionalCost} onChange={(e) => setAdditionalCost(e.target.value)} /></div><div className="field"><label htmlFor="purchased-at">วันที่ซื้อ</label><input id="purchased-at" type="date" value={purchasedAt} onChange={(e) => setPurchasedAt(e.target.value)} required /></div></div>

        <section className="attachment-section" aria-labelledby="attachments-heading">
          <div className="attachment-heading"><div><h3 id="attachments-heading">รูปทองและใบรับประกัน <span className="optional">ไม่บังคับ</span></h3><p>เก็บไว้ในอุปกรณ์นี้และรวมในไฟล์สำรอง</p></div><FileCheck2 size={19} aria-hidden="true" /></div>
          <div className="attachment-grid">
            <article className="attachment-card">
              <div className="attachment-card-title"><span className="attachment-icon"><ImagePlus size={16} /></span><div><strong>รูปทอง</strong><small>ภาพสินค้า 1 รูป</small></div></div>
              {goldPhoto ? <div className="attachment-image-preview"><img src={goldPhoto.dataUrl} alt="ตัวอย่างรูปทองที่แนบ" /><span title={goldPhoto.name}>{goldPhoto.name}<small>{formatBytes(goldPhoto.sizeBytes)} · ปรับขนาดแล้ว</small></span></div> : <div className="attachment-empty"><ImagePlus size={20} /><span>เพิ่มภาพทองที่ซื้อไว้</span></div>}
              <input className="sr-only" id="gold-photo-upload" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => chooseAttachment('goldPhoto', event)} tabIndex={-1} />
              <div className="attachment-actions"><button type="button" className="button button-attachment" onClick={() => document.getElementById('gold-photo-upload')?.click()} disabled={processingAttachment !== null || saving}>{processingAttachment === 'goldPhoto' ? <LoaderCircle className="attachment-spinner" size={15} /> : <Upload size={15} />}{goldPhoto ? 'เปลี่ยนรูป' : 'เลือกรูปทอง'}</button>{goldPhoto && <button type="button" className="attachment-remove" onClick={() => setGoldPhoto(null)} aria-label="ลบรูปทองที่แนบ" disabled={processingAttachment !== null || saving}><Trash2 size={15} /></button>}</div>
              <small className="attachment-hint">JPEG, PNG หรือ WebP · รูปต้นฉบับไม่เกิน 10 MB</small>
            </article>

            <article className="attachment-card">
              <div className="attachment-card-title"><span className="attachment-icon"><FileText size={16} /></span><div><strong>ใบรับประกัน</strong><small>ภาพหรือ PDF 1 ไฟล์</small></div></div>
              {warrantyDocument ? warrantyDocument.mimeType === 'application/pdf' ? <div className="attachment-document-preview"><FileText size={25} /><span title={warrantyDocument.name}>{warrantyDocument.name}<small>PDF · {formatBytes(warrantyDocument.sizeBytes)}</small></span></div> : <div className="attachment-image-preview"><img src={warrantyDocument.dataUrl} alt="ตัวอย่างใบรับประกันที่แนบ" /><span title={warrantyDocument.name}>{warrantyDocument.name}<small>{formatBytes(warrantyDocument.sizeBytes)} · ปรับขนาดแล้ว</small></span></div> : <div className="attachment-empty"><FileCheck2 size={20} /><span>เพิ่มใบรับประกันหรือใบเสร็จ</span></div>}
              <input className="sr-only" id="warranty-upload" type="file" accept="image/jpeg,image/png,image/webp,application/pdf,.pdf" onChange={(event) => chooseAttachment('warrantyDocument', event)} tabIndex={-1} />
              <div className="attachment-actions"><button type="button" className="button button-attachment" onClick={() => document.getElementById('warranty-upload')?.click()} disabled={processingAttachment !== null || saving}>{processingAttachment === 'warrantyDocument' ? <LoaderCircle className="attachment-spinner" size={15} /> : <Upload size={15} />}{warrantyDocument ? 'เปลี่ยนไฟล์' : 'เลือกใบรับประกัน'}</button>{warrantyDocument && <button type="button" className="attachment-remove" onClick={() => setWarrantyDocument(null)} aria-label="ลบใบรับประกันที่แนบ" disabled={processingAttachment !== null || saving}><Trash2 size={15} /></button>}</div>
              <small className="attachment-hint">ภาพไม่เกิน 10 MB ก่อนปรับขนาด · PDF ไม่เกิน 5 MB</small>
            </article>
          </div>
        </section>

        <div className="field"><label htmlFor="note">บันทึกเพิ่มเติม <span className="optional">(ไม่บังคับ)</span></label><textarea id="note" rows={2} maxLength={240} value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น ร้านที่ซื้อ หรือเลขที่ใบรับประกัน" /></div>
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="modal-actions"><button type="button" className="button button-ghost" onClick={onClose}>ยกเลิก</button><button className="button button-primary" disabled={saving || processingAttachment !== null}>{saving ? 'กำลังบันทึก…' : processingAttachment ? 'กำลังเตรียมไฟล์…' : 'บันทึกข้อมูลทอง'}</button></div>
      </form>
    </section>
  </div>;
}
