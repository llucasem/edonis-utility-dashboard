import { fmt } from '@/lib/utils';
import { MONTHS } from '@/lib/constants';

export default function BillsTable({
  filtered,
  onSelectBill,
  activeTab,
  monthIndex,
  year,
}) {
  return (
    <>
      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">No entries found</div>
          <p>No {activeTab} bills for {MONTHS[monthIndex]} {year}</p>
          <button className="btn primary">↻ Sync emails</button>
        </div>
      ) : (
        <div className="table-wrap">
          <div className="table-header">
            <span className="th">Property</span>
            <span className="th">Unit</span>
            <span className="th">Amount</span>
            <span className="th">Due date</span>
            <span className="th">Account</span>
            <span className="th">Status</span>
          </div>
          <div>
            {filtered.map(bill => (
              <div
                key={bill.id}
                className="table-row"
                onClick={() => onSelectBill(bill)}
              >
                <span className="td-property">{bill.property}</span>
                <span className="td">{bill.unit}</span>
                <span className="td mono amount">{fmt(bill.amount)}</span>
                <span className="td mono">{bill.due}</span>
                <span className="td mono">·····{bill.account}</span>
                <span className="td">
                  <span className={`status-badge ${bill.status}`}>{bill.status}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
