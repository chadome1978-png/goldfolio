import type { ManualQuote } from '../../types';

export interface OfficialPriceSnapshot {
  quote: ManualQuote;
  fetchedAt: string;
  stale: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function validTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

export async function fetchOfficialPrice(signal?: AbortSignal): Promise<OfficialPriceSnapshot> {
  const response = await fetch('/api/gold-prices', { cache: 'no-store', signal });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error('ไม่สามารถเชื่อมต่อราคาสมาคมค้าทองคำได้');
  if (!isRecord(body) || !isRecord(body.quote)) throw new Error('รูปแบบข้อมูลราคาสมาคมฯ ไม่ถูกต้อง');

  const quote = body.quote;
  const prices = [quote.barBuy, quote.barSell, quote.ornamentBuy, quote.ornamentSell];
  if (!prices.every((price) => typeof price === 'number' && Number.isFinite(price) && price > 0)
    || !validTimestamp(quote.quotedAt) || !validTimestamp(body.fetchedAt)) {
    throw new Error('ข้อมูลราคาสมาคมฯ ไม่ครบหรือไม่ถูกต้อง');
  }

  return {
    quote: {
      barBuy: quote.barBuy as number,
      barSell: quote.barSell as number,
      ornamentBuy: quote.ornamentBuy as number,
      ornamentSell: quote.ornamentSell as number,
      quotedAt: quote.quotedAt,
      sourceUrl: 'https://www.goldtraders.or.th/',
      source: 'association',
      fetchedAt: body.fetchedAt,
    },
    fetchedAt: body.fetchedAt,
    stale: body.stale === true,
  };
}
