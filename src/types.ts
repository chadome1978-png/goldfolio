export type GoldKind = 'bar' | 'ornament';

export interface Holding {
  id: string;
  kind: GoldKind;
  quantity: number;
  weightPerItem: number;
  purchasePricePerBaht: number;
  additionalCost: number;
  purchasedAt: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface ManualQuote {
  barBuy: number | null;
  barSell: number | null;
  ornamentBuy: number | null;
  ornamentSell: number | null;
  quotedAt: string;
  sourceUrl: string;
}

export interface AppSettings {
  key: 'quote';
  value: ManualQuote;
}

export type AppTab = 'overview' | 'holdings' | 'prices' | 'backup';
