export type GoldKind = 'bar' | 'ornament';

export interface HoldingAttachment {
  name: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';
  dataUrl: string;
  sizeBytes: number;
  sha256?: string;
}

export interface Holding {
  id: string;
  kind: GoldKind;
  quantity: number;
  weightPerItem: number;
  purchasePricePerBaht: number;
  additionalCost: number;
  purchasedAt: string;
  note: string;
  goldPhoto?: HoldingAttachment;
  warrantyDocument?: HoldingAttachment;
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
  source?: 'manual' | 'association';
  fetchedAt?: string;
}

export interface DeletionTombstone {
  id: string;
  deletedAt: string;
}

export interface LocalCloudSyncState {
  enabled: boolean;
  ownerKey: string | null;
  lastSyncedAt: string | null;
  manualQuoteUpdatedAt: string | null;
  error: string | null;
}

export interface AppSettings {
  key: 'quote';
  value: ManualQuote;
}

export type AppTab = 'overview' | 'holdings' | 'prices' | 'backup';
