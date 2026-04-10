'use client';

import { useState } from 'react';
import { UTILITY_TYPES } from '@/lib/constants';
import { ANALYTICS_PROPERTIES } from '@/data/mockBills';

const EMPTY_FORM = {
  type:     'electricity',
  property: ANALYTICS_PROPERTIES[0] || '',
  unit:     '',
  account:  '',
  amount:   '',
  due:      '',
  status:   'pending',
};

export default function AddBillModal({ open, onClose, onSave }) {
  const [addForm, setAddForm] = useState(EMPTY_FORM);
  const [addError, setAddError] = useState('');

  const handleSave = () => {
    if (!addForm.amount || !addForm.due || !addForm.property) {
      setAddError('Please fill in property, amount, and due date.');
      return;
    }
    const parsedAmount = parseFloat(addForm.amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setAddError('Amount must be a positive number.');
      return;
    }
    let dueFormatted = addForm.due;
    if (addForm.due.includes('-')) {
      const d = new Date(addForm.due + 'T12:00:00');
      const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
      dueFormatted = `${mon} ${d.getDate()}`;
    }
    const newBill = {
      id:       Date.now(),
      type:     addForm.type,
      property: addForm.property,
      unit:     addForm.unit    || '—',
      account:  addForm.account || '0000',
      amount:   parsedAmount,
      due:      dueFormatted,
      status:   addForm.status,
    };
    onSave(newBill);
    setAddForm(EMPTY_FORM);
    setAddError('');
    onClose();
  };

  const handleClose = () => {
    setAddForm(EMPTY_FORM);
    setAddError('');
    onClose();
  };

  return (
    <div
      className={`overlay ${open ? 'show' : ''}`}
      onClick={e => { if (e.target.classList.contains('overlay')) handleClose(); }}
    >
      {open && (
        <div className="modal">
          <div className="modal-header">
            <h2>Add expense manually</h2>
            <p>This bill will appear in the corresponding utility tab</p>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Utility type</label>
              <select
                className="field-select"
                value={addForm.type}
                onChange={e => setAddForm(f => ({ ...f, type: e.target.value }))}
              >
                {UTILITY_TYPES.map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Status</label>
              <select
                className="field-select"
                value={addForm.status}
                onChange={e => setAddForm(f => ({ ...f, status: e.target.value }))}
              >
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Property *</label>
            <select
              className="field-select full"
              value={addForm.property}
              onChange={e => setAddForm(f => ({ ...f, property: e.target.value }))}
            >
              {ANALYTICS_PROPERTIES.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Unit</label>
              <input
                className="field-input"
                type="text"
                placeholder="e.g. Unit 4B"
                value={addForm.unit}
                onChange={e => setAddForm(f => ({ ...f, unit: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>Account (last 4 digits)</label>
              <input
                className="field-input mono"
                type="text"
                maxLength={4}
                placeholder="e.g. 7235"
                value={addForm.account}
                onChange={e => setAddForm(f => ({ ...f, account: e.target.value.replace(/\D/, '') }))}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Amount due *</label>
              <input
                className="field-input mono"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={addForm.amount}
                onChange={e => setAddForm(f => ({ ...f, amount: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>Due date *</label>
              <input
                className="field-input"
                type="date"
                value={addForm.due}
                onChange={e => setAddForm(f => ({ ...f, due: e.target.value }))}
              />
            </div>
          </div>

          {addError && <p className="form-error">{addError}</p>}

          <div className="modal-footer">
            <button className="btn" onClick={handleClose}>Cancel</button>
            <button className="btn primary" onClick={handleSave}>Save expense</button>
          </div>
        </div>
      )}
    </div>
  );
}
