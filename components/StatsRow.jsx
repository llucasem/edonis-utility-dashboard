import { fmt } from '@/lib/utils';

export default function StatsRow({ monthBills, prevMonthBills }) {
  const total     = monthBills.reduce((s, b) => s + b.amount, 0);
  const prevTotal = prevMonthBills.reduce((s, b) => s + b.amount, 0);

  let pctChange = null;
  let pctLabel  = '—';
  let pctColor  = 'faint';

  if (prevTotal > 0) {
    pctChange = ((total - prevTotal) / prevTotal) * 100;
    const sign = pctChange >= 0 ? '+' : '';
    pctLabel   = `${sign}${pctChange.toFixed(1)}%`;
    pctColor   = pctChange > 0 ? 'stat-up' : 'stat-down';
  }

  return (
    <div className="stats-row">
      <div className="stat-card">
        <div className="stat-label">Total this month</div>
        <div className="stat-value">{fmt(total)}</div>
        <div className="stat-sub">{monthBills.length} {monthBills.length === 1 ? 'bill' : 'bills'} recorded</div>
      </div>
      <div className="stat-card">
        <div className="stat-label">Bills this month</div>
        <div className="stat-value">{monthBills.length}</div>
        <div className="stat-sub">{prevMonthBills.length} last month</div>
      </div>
      <div className="stat-card">
        <div className="stat-label">vs last month</div>
        <div className={`stat-value ${pctColor}`}>{pctLabel}</div>
        <div className="stat-sub">{prevTotal > 0 ? fmt(prevTotal) + ' last month' : 'No data for last month'}</div>
      </div>
    </div>
  );
}
