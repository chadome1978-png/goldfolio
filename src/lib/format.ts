export const currency = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 });
export const decimal = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 });
export const dateFormat = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' });
export const dateTimeFormat = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Bangkok' });

export function formatDate(value: string): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : dateFormat.format(date);
}

export function formatDateTime(value: string): string {
  if (!value) return 'ยังไม่มีข้อมูล';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : dateTimeFormat.format(date);
}
