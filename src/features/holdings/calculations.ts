import type { Holding, ManualQuote } from '../../types';

export function holdingCost(item: Holding): number {
  return item.quantity * item.weightPerItem * item.purchasePricePerBaht + item.additionalCost;
}

export function holdingValue(item: Holding, quote: ManualQuote): number | null {
  const perBaht = item.kind === 'bar' ? quote.barBuy : quote.ornamentBuy;
  if (perBaht === null || !Number.isFinite(perBaht)) return null;
  return item.quantity * item.weightPerItem * perBaht;
}

export function holdingProfit(item: Holding, quote: ManualQuote): number | null {
  const value = holdingValue(item, quote);
  return value === null ? null : value - holdingCost(item);
}

export function totalWeight(items: Holding[]): number {
  return items.reduce((sum, item) => sum + item.quantity * item.weightPerItem, 0);
}

export function totals(items: Holding[], quote: ManualQuote) {
  return items.reduce(
    (result, item) => {
      result.cost += holdingCost(item);
      const value = holdingValue(item, quote);
      if (value === null) result.hasMissingPrice = true;
      else result.value += value;
      result.weight += item.quantity * item.weightPerItem;
      if (item.kind === 'bar') result.barCount += item.quantity;
      else result.ornamentCount += item.quantity;
      return result;
    },
    { cost: 0, value: 0, weight: 0, barCount: 0, ornamentCount: 0, hasMissingPrice: false },
  );
}
