import { fmt, dupKey } from '@/lib/utils';
import { MONTHS } from '@/lib/constants';

export default function BillsTable({
  filtered,
  dupKeys,
  reviewed,
  onMarkReviewed,
  onSelectBill,
  activeDups,
  bannerDismissed,
  onDismissBanner,
  activeTab,
  monthIndex,
  year,
}) {
  return (
    <>
      {activeDups.length > 0 && !bannerDismissed && (
        <div className="dup-banner">
          <span>⚠ {activeDups.length} possible duplicate {activeDups.length === 1 ? 'bill' : 'bills'} detected this month. Review before logging to QuickBooks.</span>
          <button className="dup-banner-dismiss" onClick={onDismissBanner}>✕</button>
        </div>
      )}

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
            {filtered.map(bill => {
              const isDup = dupKeys.has(dupKey(bill)) && !reviewed.has(bill.id);
              return (
                <div
                  key={bill.id}
                  className={`table-row ${isDup ? 'dup-row' : ''}`}
                  onClick={() => onSelectBill(bill)}
                >
                  <span className="td-property">{bill.property}</span>
                  <span className="td">{bill.unit}</span>
                  <span className="td mono amount">{fmt(bill.amount)}</span>
                  <span className="td mono">{bill.due}</span>
                  <span className="td mono">·····{bill.account}</span>
                  <span className="td">
                    {isDup ? (
                      <div className="dup-cell">
                        <span className="dup-badge">⚠ Possible duplicate</span>
                        <button
                          className="btn-reviewed"
                          onClick={e => { e.stopPropagation(); onMarkReviewed(bill.id); }}
                        >
                          Mark as reviewed
                        </button>
                      </div>
                    ) : (
                      <span className={`status-badge ${bill.status}`}>{bill.status}</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
