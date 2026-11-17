const ENDPOINT = 'https://www.goldtraders.or.th/api/GoldPrices/Details?readjson=false';
const SOURCE_URL = 'https://www.goldtraders.or.th/';
const CACHE_TTL_MS = 30_000;
const UPSTREAM_TIMEOUT_MS = 10_000;
const MAX_FUTURE_SKEW_MS = 5 * 60_000;

let cachedSnapshot;
let cachedAt = 0;

function toBangkokIso(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const raw = value.trim();
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw);
  const date = new Date(hasTimezone ? raw : `${raw}+07:00`);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function positivePrice(value) {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function normalizeRecord(record, nowMs = Date.now()) {
  if (!record || typeof record !== 'object') return null;
  const quotedAt = toBangkokIso(record.asTime);
  const barBuy = positivePrice(record.bL_BuyPrice);
  const barSell = positivePrice(record.bL_SellPrice);
  const ornamentBuy = positivePrice(record.oM965_BuyPrice);
  const ornamentSell = positivePrice(record.oM965_SellPrice);
  if (!quotedAt || Date.parse(quotedAt) > nowMs + MAX_FUTURE_SKEW_MS || !barBuy || !barSell || !ornamentBuy || !ornamentSell) return null;
  return { barBuy, barSell, ornamentBuy, ornamentSell, quotedAt, sourceUrl: SOURCE_URL, source: 'association' };
}

async function fetchSnapshot() {
  const response = await fetch(ENDPOINT, {
    headers: { Accept: 'application/json', Referer: SOURCE_URL },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Official price endpoint returned ${response.status}`);
  const text = await response.text();
  if (text.length > 2_000_000) throw new Error('Official price response exceeds size limit');
  const history = JSON.parse(text);
  if (!Array.isArray(history)) throw new Error('Official price response is not a history array');

  const datedRecords = history.map((item) => ({ item, quotedAt: toBangkokIso(item?.asTime) }));
  if (!datedRecords.length || datedRecords.some((entry) => !entry.quotedAt)) {
    throw new Error('Official price response contains a record with an invalid timestamp');
  }
  datedRecords.sort((a, b) => Date.parse(b.quotedAt) - Date.parse(a.quotedAt));
  const latest = datedRecords[0];
  const quote = normalizeRecord(latest.item);
  if (!quote) throw new Error('Latest official 96.5% quote record is invalid or future-dated');

  const fetchedAt = new Date().toISOString();
  return { quote, fetchedAt, stale: false };
}

export async function getOfficialGoldQuote() {
  const now = Date.now();
  if (cachedSnapshot && now - cachedAt < CACHE_TTL_MS) return cachedSnapshot;

  try {
    const snapshot = await fetchSnapshot();
    cachedSnapshot = snapshot;
    cachedAt = Date.now();
    return snapshot;
  } catch (error) {
    if (cachedSnapshot) return { ...cachedSnapshot, stale: true };
    throw error;
  }
}
