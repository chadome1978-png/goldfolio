import { Coins, Gem } from 'lucide-react';
import type { Holding, ManualQuote } from '../types';
import { holdingCost, totalWeight } from '../features/holdings/calculations';
import { currency, decimal } from '../lib/format';

interface Props { holdings: Holding[]; quote: ManualQuote; }
const money = (value: number | null) => value === null ? '—' : currency.format(value);

export default function CategoryBreakdown({ holdings, quote }: Props) {
  const categories = [
    { kind: 'bar' as const, title: 'ทองคำแท่ง', buy: quote.barBuy, icon: <Coins size={16} />, tone: 'ruby' },
    { kind: 'ornament' as const, title: 'ทองรูปพรรณ', buy: quote.ornamentBuy, icon: <Gem size={16} />, tone: 'gold' },
  ];
  return <section className="panel category-breakdown"><div className="panel-heading"><div><h2>สรุปแยกตามประเภท</h2><p>เปรียบเทียบต้นทุนและมูลค่าประเมินตามราคาที่บันทึก</p></div></div><div className="category-grid">
    {categories.map(({ kind, title, buy, icon, tone }) => {
      const items = holdings.filter((item) => item.kind === kind);
      const count = items.reduce((sum, item) => sum + item.quantity, 0);
      const weight = totalWeight(items);
      const cost = items.reduce((sum, item) => sum + holdingCost(item), 0);
      const value = items.length === 0 || buy === null ? null : weight * buy;
      const profit = value === null ? null : value - cost;
      return <article className={`category-card category-${tone}`} key={kind}>
        <div className="category-title"><span className="category-icon">{icon}</span><div><strong>{title}</strong><small>{count} ชิ้น · {decimal.format(weight)} บาททองคำ</small></div></div>
        <div className="category-metric"><span>ต้นทุนรวม</span><b>{currency.format(cost)}</b></div>
        <div className="category-metric"><span>มูลค่าประเมิน</span><b>{money(value)}</b></div>
        <div className="category-metric category-outcome"><span>กำไร/ขาดทุนโดยประมาณ</span><b className={profit === null ? '' : profit >= 0 ? 'profit-positive' : 'profit-negative'}>{profit === null ? 'รอราคาอ้างอิง' : `${profit >= 0 ? '+' : '−'}${currency.format(Math.abs(profit))}`}</b></div>
      </article>;
    })}
  </div></section>;
}
