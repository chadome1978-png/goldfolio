export interface OfficialGoldQuote {
  barBuy: number;
  barSell: number;
  ornamentBuy: number;
  ornamentSell: number;
  quotedAt: string;
  sourceUrl: string;
  source: 'association';
}

export interface OfficialGoldSnapshot {
  quote: OfficialGoldQuote;
  fetchedAt: string;
  stale: boolean;
}

export function getOfficialGoldQuote(): Promise<OfficialGoldSnapshot>;
