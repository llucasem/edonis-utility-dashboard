'use client';

import { useState, useEffect } from 'react';

const TYPE_LABELS = {
  electricity: 'Electricity',
  gas:         'Gas',
  internet:    'Internet',
  water:       'Water',
  rent:        'Rent',
  insurance:   'Insurance',
  other:       'Other',
};

export default function AdminMappings() {
  const [unmapped,  setUnmapped]  = useState([]);
  const [mappings,  setMappings]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [form,      setForm]      = useState({});   // { [key]: { property, unit, provider } }
  const [saving,    setSaving]    = useState({});   // { [key]: true/false }
  const [saved,     setSaved]     = useState({});   // { [key]: '3 bills updated' }
  const [error,     setError]     = useState({});

  const load = async () => {
    setLoading(true);
    const [u, m] = await Promise.all([
      fetch('/api/account-mappings/unmapped').then(r => r.json()),
      fetch('/api/account-mappings').then(r => r.json()),
    ]);
    if (u.ok) setUnmapped(u.accounts);
    if (m.ok) setMappings(m.mappings);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const key = (a) => `${a.utility_type}__${a.account_last4}`;

  const handleSave = async (account) => {
    const k = key(account);
    const f = form[k] || {};
    if (!f.property?.trim()) {
      setError(prev => ({ ...prev, [k]: 'Property address is required' }));
      return;
    }
    setSaving(prev => ({ ...prev, [k]: true }));
    setError(prev => ({ ...prev, [k]: '' }));

    try {
      const res  = await fetch('/api/account-mappings', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          utility_type:     account.utility_type,
          account_last4:    account.account_last4,
          provider:         f.provider || '',
          property_address: f.property.trim(),
          unit:             f.unit?.trim() || null,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setSaved(prev => ({ ...prev, [k]: `Saved · ${data.billsUpdated} bill${data.billsUpdated !== 1 ? 's' : ''} updated` }));
        // Recargar para reflejar el cambio
        await load();
      } else {
        setError(prev => ({ ...prev, [k]: data.error }));
      }
    } catch {
      setError(prev => ({ ...prev, [k]: 'Network error' }));
    } finally {
      setSaving(prev => ({ ...prev, [k]: false }));
    }
  };

  const setField = (k, field, value) =>
    setForm(prev => ({ ...prev, [k]: { ...prev[k], [field]: value } }));

  return (
    <div className="page-wrap">
      <div className="topbar">
        <div className="brand">
          <h1>TDM Utilities</h1>
          <span className="tag">Admin</span>
        </div>
        <div className="topbar-right">
          <a href="/" className="btn">← Back to dashboard</a>
        </div>
      </div>

      <div style={{ padding: '32px 24px', maxWidth: 900, margin: '0 auto' }}>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, marginBottom: 8 }}>
          Account Mappings
        </h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: 32, fontSize: 14 }}>
          Map utility account numbers to their property addresses. This only needs to be done once per account.
          All existing and future bills for that account will be updated automatically.
        </p>

        {/* Cuentas sin mapear */}
        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, marginBottom: 16 }}>
          Unmapped accounts {!loading && <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>({unmapped.length})</span>}
        </h3>

        {loading ? (
          <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
        ) : unmapped.length === 0 ? (
          <div className="empty-state" style={{ margin: '24px 0' }}>
            <p>All accounts have been mapped.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 48 }}>
            {unmapped.map(account => {
              const k = key(account);
              return (
                <div key={k} className="modal-card" style={{ padding: 20, borderRadius: 8 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', marginBottom: 14, flexWrap: 'wrap' }}>
                    <span className={`status-badge ${account.utility_type}`} style={{ textTransform: 'capitalize' }}>
                      {TYPE_LABELS[account.utility_type] || account.utility_type}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14 }}>
                      Account ···{account.account_last4}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                      {account.bill_count} bill{account.bill_count !== '1' ? 's' : ''}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 12, fontStyle: 'italic' }}>
                      e.g. "{account.email_subject}"
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                    <div>
                      <label className="form-label">Provider (optional)</label>
                      <input
                        className="form-input"
                        placeholder="e.g. ConEd, SCE, LADWP"
                        value={form[k]?.provider || ''}
                        onChange={e => setField(k, 'provider', e.target.value)}
                      />
                    </div>
                    <div style={{ gridColumn: 'span 1' }}>
                      <label className="form-label">Property address *</label>
                      <input
                        className="form-input"
                        placeholder="e.g. 123 Main St, New York, NY"
                        value={form[k]?.property || ''}
                        onChange={e => setField(k, 'property', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="form-label">Unit (optional)</label>
                      <input
                        className="form-input"
                        placeholder="e.g. Apt 4B"
                        value={form[k]?.unit || ''}
                        onChange={e => setField(k, 'unit', e.target.value)}
                      />
                    </div>
                  </div>

                  {error[k] && <p style={{ color: '#e53e3e', fontSize: 13, marginBottom: 8 }}>{error[k]}</p>}
                  {saved[k] && <p style={{ color: 'var(--accent)', fontSize: 13, marginBottom: 8 }}>✓ {saved[k]}</p>}

                  <button
                    className="btn primary"
                    onClick={() => handleSave(account)}
                    disabled={saving[k]}
                  >
                    {saving[k] ? 'Saving…' : 'Save mapping'}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Mappings ya existentes */}
        {mappings.length > 0 && (
          <>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, marginBottom: 16 }}>
              Saved mappings <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>({mappings.length})</span>
            </h3>
            <div className="table-wrap">
              <div className="table-header" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr' }}>
                <span className="th">Type</span>
                <span className="th">Provider</span>
                <span className="th">Account</span>
                <span className="th">Property</span>
                <span className="th">Unit</span>
              </div>
              {mappings.map(m => (
                <div key={m.id} className="table-row" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr' }}>
                  <span className="td" style={{ textTransform: 'capitalize' }}>{TYPE_LABELS[m.utility_type] || m.utility_type}</span>
                  <span className="td">{m.provider || '—'}</span>
                  <span className="td mono">···{m.account_last4}</span>
                  <span className="td">{m.property_address}</span>
                  <span className="td">{m.unit || '—'}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
