import { ALL_MONTH_KEYS, ALL_MONTH_LABELS } from '@/data/mockBills';

export function fmt(n) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatMonthKey(key) {
  if (!key) return '';
  const [y, m] = key.split('-');
  return `${ALL_MONTH_LABELS[parseInt(m) - 1]} ${y}`;
}

export function sumRange(arr, startKey, endKey) {
  let total = 0;
  ALL_MONTH_KEYS.forEach((k, i) => {
    if (k >= startKey && k <= endKey) total += (arr[i] || 0);
  });
  return total;
}

// Day-level range sum with proration for partial months
export function sumRangeByDate(arr, startDate, endDate) {
  if (!startDate || !endDate) return 0;
  let total = 0;
  ALL_MONTH_KEYS.forEach((monthKey, i) => {
    const [y, m] = monthKey.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const monthFirst  = `${monthKey}-01`;
    const monthLast   = `${monthKey}-${String(daysInMonth).padStart(2, '0')}`;
    if (monthLast < startDate || monthFirst > endDate) return;
    const overlapStart = startDate > monthFirst ? startDate : monthFirst;
    const overlapEnd   = endDate   < monthLast  ? endDate   : monthLast;
    const days = Math.floor((new Date(overlapEnd) - new Date(overlapStart)) / 86400000) + 1;
    total += (arr[i] || 0) * (days / daysInMonth);
  });
  return Math.round(total);
}

export function dupKey(b) {
  return `${b.type}|${b.account}|${b.property}|${b.unit}`;
}
