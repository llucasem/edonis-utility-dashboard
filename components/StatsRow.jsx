import { fmt } from '@/lib/utils';

export default function StatsRow({ tabBills }) {
  const totalDue     = tabBills.reduce((s, b) => s + b.amount, 0);
  const overdueBills = tabBills.filter(b => b.status === 'overdue');
  const overdueAmt   = overdueBills.reduce((s, b) => s + b.amount, 0);
  const paidBills    = tabBills.filter(b => b.status === 'paid');
  const paidAmt      = paidBills.reduce((s, b) => s + b.amount, 0);

  return (
    <div className="stats-row">
      <div className="stat-card">
        <div className="stat-label">Total this month</div>
        <div className="stat-value">{fmt(totalDue)}</div>
        <div className="stat-sub">{tabBills.length} bills recorded</div>
      </div>
      <div className="stat-card">
        <div className="stat-label">Overdue</div>
        <div className={`stat-value ${overdueAmt > 0 ? '' : 'faint'}`}>
          {overdueAmt > 0 ? fmt(overdueAmt) : '—'}
        </div>
        <div className="stat-sub">{overdueBills.length} {overdueBills.length === 1 ? 'bill' : 'bills'} past due</div>
      </div>
      <div className="stat-card">
        <div className="stat-label">Paid</div>
        <div className={`stat-value ${paidAmt > 0 ? 'muted' : 'faint'}`}>{fmt(paidAmt)}</div>
        <div className="stat-sub">{paidBills.length} {paidBills.length === 1 ? 'bill' : 'bills'} settled</div>
      </div>
    </div>
  );
}
