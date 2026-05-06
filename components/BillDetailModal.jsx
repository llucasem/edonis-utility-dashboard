import { fmt } from '@/lib/utils';

export default function BillDetailModal({ bill, onClose, year, match }) {
  return (
    <div
      className={`overlay ${bill ? 'show' : ''}`}
      onClick={e => { if (e.target.classList.contains('overlay')) onClose(); }}
    >
      {bill && (
        <div className="modal">
          <div className="modal-header">
            <h2>{bill.property}</h2>
            <p>{bill.unit} · {bill.type.charAt(0).toUpperCase() + bill.type.slice(1)}</p>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Account</label>
              <span className="form-value">·····{bill.account}</span>
            </div>
            <div className="form-group">
              <label>Amount due</label>
              <span className="form-value">{fmt(bill.amount)}</span>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Due date</label>
              <span className="form-value">{bill.due}, {year}</span>
            </div>
            <div className="form-group">
              <label>Status</label>
              <span className="form-value">
                <span className={`status-badge ${bill.status}`}>{bill.status}</span>
              </span>
            </div>
          </div>

          {match && (
            <div className="qb-match-block">
              <label>QuickBooks match</label>
              {match.count === 0 && (
                <p className="qb-match-empty">No matching transaction found in QuickBooks (±15 days).</p>
              )}
              {match.count >= 1 && (
                <>
                  {match.count > 1 && (
                    <p className="qb-match-warn">⚠ {match.count} possible matches — review manually.</p>
                  )}
                  <ul className="qb-match-list">
                    {match.matches.map(m => (
                      <li key={`${m.type}-${m.id}`}>
                        <span className="qb-match-date">{m.date}</span>
                        <span className="qb-match-amount">{fmt(m.amount)}</span>
                        <span className="qb-match-payee">{m.payee || m.account || '—'}</span>
                        <span className="qb-match-type">{m.type}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          <div className="modal-footer">
            <button className="btn" onClick={onClose}>Close</button>
            {bill.gmailLink && (
              <a className="btn" href={bill.gmailLink} target="_blank" rel="noopener noreferrer">
                View email →
              </a>
            )}
            {bill.status !== 'paid' && <button className="btn primary">Mark as paid</button>}
          </div>
        </div>
      )}
    </div>
  );
}
