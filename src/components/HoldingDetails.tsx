import { CalendarDays, Coins, Pencil, X } from 'lucide-react';
import type { Holding, ManualQuote } from '../types';
import { holdingCost, holdingProfit, holdingValue } from '../features/holdings/calculations';
import { currency, decimal, formatDate } from '../lib/format';

interface Props { item: Holding; quote: ManualQuote; onClose: () => void; onEdit: () => void; }
const money = (value: number | null) => value === null ? 'รอราคาอ้างอิง' : currency.format(value);

export default function HoldingDetails({ item, quote, onClose, onEdit }: Props) {
  const title = item.kind === 'bar' ? 'ทองคำแท่ง' : 'ทองรูปพรรณ';
  const currentValue = holdingValue(item, quote);
  const profit = holdingProfit(item, quote);
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="modal detail-modal" role="dialog" aria-modal="true" aria-labelledby="holding-detail-title">
      <div className="modal-head"><div><span className="eyebrow">รายละเอียดสินทรัพย์</span><h2 id="holding-detail-title">{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="ปิด"><X size={19} /></button></div>
      <div className="detail-identity"><span className="holding-emblem"><Coins size={19} /></span><div><strong>{title} 96.5%</strong><span>{item.quantity} ชิ้น · {decimal.format(item.quantity * item.weightPerItem)} บาททองคำ</span></div></div>
      <div className="detail-value"><span>มูลค่าประเมินโดยประมาณ</span><strong>{money(currentValue)}</strong><small>อ้างอิงราคาที่บันทึกในแอป ไม่ใช่ราคาซื้อขายรับประกัน</small></div>
      <div className="detail-grid">
        <div><span>ราคาซื้อต่อบาททองคำ</span><strong>{currency.format(item.purchasePricePerBaht)}</strong></div>
        <div><span>ต้นทุนรวม</span><strong>{currency.format(holdingCost(item))}</strong></div>
        <div><span>ค่ากำเหน็จ/ต้นทุนเพิ่ม</span><strong>{currency.format(item.additionalCost)}</strong></div>
        <div><span>วันที่ซื้อ</span><strong><CalendarDays size={13} />{formatDate(item.purchasedAt)}</strong></div>
        <div className="detail-result"><span>กำไร/ขาดทุนโดยประมาณ</span><strong className={profit === null ? 'profit-pending' : profit >= 0 ? 'profit-positive' : 'profit-negative'}>{profit === null ? 'รอราคาอ้างอิง' : `${profit >= 0 ? '+' : '−'}${currency.format(Math.abs(profit))}`}</strong></div>
      </div>
      {item.note && <div className="detail-note"><span>บันทึกเพิ่มเติม</span><p>{item.note}</p></div>}
      <div className="modal-actions"><button className="button button-ghost" onClick={onClose}>ปิด</button><button className="button button-primary" onClick={onEdit}><Pencil size={15} />แก้ไขข้อมูล</button></div>
    </section>
  </div>;
}
