import type { ManualQuote } from '../../types';

const BANGKOK_TIME_ZONE = 'Asia/Bangkok';

export function quoteIsComplete(quote: ManualQuote): boolean {
  return [quote.barBuy, quote.barSell, quote.ornamentBuy, quote.ornamentSell].every(
    (value) => value !== null && Number.isFinite(value) && value > 0,
  ) && Boolean(quote.quotedAt);
}

export function quoteIsStale(quote: ManualQuote, now = Date.now()): boolean {
  if (!quote.quotedAt) return false;
  const timestamp = new Date(quote.quotedAt).getTime();
  return !Number.isFinite(timestamp) || now - timestamp > 24 * 60 * 60 * 1000;
}

export function localDateTimeValue(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: BANGKOK_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}T${value('hour')}:${value('minute')}`;
}

export function parseThaiDateTimeValue(value: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(value);
  if (!match) throw new Error('รูปแบบวันและเวลาไม่ถูกต้อง');
  return new Date(`${match[1]}T${match[2]}:00+07:00`).toISOString();
}
