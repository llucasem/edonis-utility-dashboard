import { fmt } from '@/lib/utils';

export default function BillDetailModal({ bill, onClose, year }) {
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
