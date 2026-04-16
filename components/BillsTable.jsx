import { fmt } from '@/lib/utils';

const SERVICES = ['electricity', 'internet', 'gas'];
const SERVICE_LABELS = { electricity: 'Electricity', internet: 'Internet', gas: 'Gas' };
const EMPTY_VALUES = ['', '—', 'n/a', 'unknown', '(no address)'];

function normalizeUnit(unit) {
  return (unit || '')
    .replace(/^apt\.?\s*/i, '')
    .replace(/^#\s*/, '')
    .trim();
}

function isMapped(b) {
  return b.property && !EMPTY_VALUES.includes(b.property.trim().toLowerCase());
}

export default function BillsTable({ filtered, onSelectBill, onAssignBill }) {
  // Separate mapped vs unmapped bills
  const mapped   = filtered.filter(isMapped);
  const unmapped = filtered.filter(b => !isMapped(b));

  // Build property+unit rows from mapped bills
  const rowMap = new Map();
  for (const bill of mapped) {
    const key = `${bill.property}|||${normalizeUnit(bill.unit)}`;
    if (!rowMap.has(key)) {
      rowMap.set(key, { property: bill.property, unit: normalizeUnit(bill.unit), bills: {} });
    }
    const type = bill.type;
    if (SERVICES.includes(type)) {
      // Keep first bill found for each service (duplicates in same month are rare)
      if (!rowMap.get(key).bills[type]) {
        rowMap.get(key).bills[type] = bill;
      }
    }
  }

  // Sort rows: alphabetically by property, then by unit
  const rows = Array.from(rowMap.values()).sort((a, b) => {
    const pa = a.property.toLowerCase();
    const pb = b.property.toLowerCase();
    if (pa !== pb) return pa < pb ? -1 : 1;
    return (a.unit || '').localeCompare(b.unit || '', undefined, { numeric: true });
  });

  // Column totals
  const colTotals = {};
  for (const svc of SERVICES) {
    colTotals[svc] = rows.reduce((s, r) => s + (r.bills[svc]?.amount || 0), 0);
  }
  const grandTotal = SERVICES.reduce((s, svc) => s + colTotals[svc], 0);

  if (rows.length === 0 && unmapped.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">No entries found</div>
        <p>No bills found for this month</p>
      </div>
    );
  }

  return (
    <div>
      {rows.length > 0 && (
        <div className="property-matrix">
          {/* Header */}
          <div className="matrix-header">
            <span className="th">Property</span>
            <span className="th">Unit</span>
            {SERVICES.map(svc => (
              <span key={svc} className="th">{SERVICE_LABELS[svc]}</span>
            ))}
            <span className="th" style={{ textAlign: 'right' }}>Total</span>
          </div>

          {/* Data rows */}
          {rows.map((row, i) => {
            const rowTotal = SERVICES.reduce((s, svc) => s + (row.bills[svc]?.amount || 0), 0);
            return (
              <div key={i} className="matrix-row">
                <span className="td-property">{row.property}</span>
                <span className="td mono">{row.unit || '—'}</span>
                {SERVICES.map(svc => {
                  const bill = row.bills[svc];
                  if (!bill) return (
                    <span key={svc} className="matrix-cell-empty">—</span>
                  );
                  return (
                    <span
                      key={svc}
                      className="matrix-cell"
                      onClick={() => onSelectBill(bill)}
                    >
                      <span className="matrix-cell-amount">{fmt(bill.amount)}</span>
                      <span className="matrix-cell-account">·····{bill.account}</span>
                    </span>
                  );
                })}
                <span className="matrix-row-total">{rowTotal > 0 ? fmt(rowTotal) : '—'}</span>
              </div>
            );
          })}

          {/* Totals row */}
          <div className="matrix-total-row">
            <span>Total</span>
            <span></span>
            {SERVICES.map(svc => (
              <span key={svc} className="mono">{colTotals[svc] > 0 ? fmt(colTotals[svc]) : '—'}</span>
            ))}
            <span className="mono" style={{ textAlign: 'right' }}>{fmt(grandTotal)}</span>
          </div>
        </div>
      )}

      {/* Unmapped bills section */}
      {unmapped.length > 0 && (
        <div className="matrix-unmapped">
          <div className="matrix-unmapped-title">
            Unassigned ({unmapped.length} {unmapped.length === 1 ? 'bill' : 'bills'} — click a row to assign it to a property)
          </div>
          {unmapped.map(bill => (
            <div
              key={bill.id}
              className="matrix-unmapped-row"
              onClick={() => onAssignBill ? onAssignBill(bill) : onSelectBill(bill)}
              title="Click to assign to a property"
            >
              <span className="matrix-unmapped-type">{bill.type}</span>
              <span className="mono">·····{bill.account}</span>
              <span className="mono">{fmt(bill.amount)}</span>
              <span className="matrix-unmapped-due">{bill.due}</span>
              <span style={{ color: 'var(--accent)', fontSize: 11, marginLeft: 'auto' }}>+ Assign →</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
