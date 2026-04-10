'use client';

import { useState, useRef, useEffect } from 'react';
import { PROPERTY_MONTHLY, ANALYTICS_PROPERTIES, ALL_MONTH_KEYS } from '@/data/mockBills';
import { fmt, sumRangeByDate } from '@/lib/utils';
import { IconCalendar, IconChart } from './Icons';

/* ── helpers ── */
const MO_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MO_LONG  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DOW      = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function nextCal(m) { return m.month === 12 ? { year: m.year+1, month: 1 }  : { year: m.year, month: m.month+1 }; }
function prevCal(m) { return m.month === 1  ? { year: m.year-1, month: 12 } : { year: m.year, month: m.month-1 }; }
function calKey(m)  { return `${m.year}-${String(m.month).padStart(2,'0')}`; }
function fmtDs(ds) {
  if (!ds) return '';
  const [, m, d] = ds.split('-').map(Number);
  return `${MO_SHORT[m-1]} ${d}`;
}

/* ── single month panel (all layout via inline style to bypass CSS conflicts) ── */
function CalPanel({ year, month, startDate, endDate, hoverDate, selecting, onDayClick, onDayHover }) {
  const monthKey     = `${year}-${String(month).padStart(2,'0')}`;
  const isAvailMonth = ALL_MONTH_KEYS.includes(monthKey);
  const daysInMonth  = new Date(year, month, 0).getDate();
  const firstDOW     = new Date(year, month-1, 1).getDay(); // 0=Sun

  // Determine visual range (includes hover preview)
  const effectiveEnd = (selecting === 'end' && hoverDate) ? hoverDate : endDate;
  const [rA, rB] = (startDate && effectiveEnd)
    ? startDate <= effectiveEnd ? [startDate, effectiveEnd] : [effectiveEnd, startDate]
    : [startDate, null];

  // Build cell array: nulls for blank leading slots, then 1..daysInMonth
  const cells = [];
  for (let i = 0; i < firstDOW; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div style={{ flex: 1, padding: '0 14px', minWidth: 210 }}>

      {/* Month title */}
      <div style={{
        fontFamily: "'Playfair Display', serif",
        fontSize: 13, fontWeight: 600,
        textAlign: 'center', marginBottom: 10,
        color: 'var(--text)',
      }}>
        {MO_LONG[month-1]} {year}
      </div>

      {/* Day-of-week header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 2, marginBottom: 4,
      }}>
        {DOW.map(d => (
          <span key={d} style={{
            fontFamily: "'Inconsolata', monospace",
            fontSize: 10, color: 'var(--text3)',
            textAlign: 'center',
          }}>{d}</span>
        ))}
      </div>

      {/* Days */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {cells.map((d, i) => {
          if (d === null) return <span key={`e${i}`} />;

          const ds      = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
          const isSel   = ds === startDate || ds === endDate;
          const inRange = rA && rB && ds > rA && ds < rB;
          const isRS    = ds === rA && rB && rA !== rB;
          const isRE    = ds === rB && rA && rA !== rB;
          const isOff   = !isAvailMonth;

          // Compute styles dynamically — no reliance on CSS classes
          let bg           = 'transparent';
          let color        = 'var(--text2)';
          let border       = '1px solid transparent';
          let borderRadius = '4px';
          let fontWeight   = 'normal';

          if (isSel) {
            bg = 'var(--accent)'; color = 'var(--surface)';
            border = '1px solid var(--accent)'; fontWeight = '700';
          } else if (inRange || isRS || isRE) {
            bg = 'var(--surface2)'; color = 'var(--text)';
            borderRadius = isRS ? '4px 0 0 4px' : isRE ? '0 4px 4px 0' : '0';
          }

          return (
            <button
              key={ds}
              onClick={() => !isOff && onDayClick(ds)}
              onMouseEnter={() => !isOff && onDayHover(ds)}
              onMouseLeave={() => onDayHover(null)}
              disabled={isOff}
              style={{
                fontFamily: "'Inconsolata', monospace",
                fontSize: 12, padding: '6px 2px',
                border, borderRadius, background: bg,
                cursor: isOff ? 'not-allowed' : 'pointer',
                color: isOff ? 'var(--text3)' : color,
                opacity: isOff ? 0.2 : 1,
                fontWeight, textAlign: 'center',
                transition: 'all 0.1s', lineHeight: 1,
              }}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── main component ── */
export default function AnalyticsModal({ open, onClose }) {
  const [analyticsProp, setAnalyticsProp] = useState(null);
  const [propDropOpen,  setPropDropOpen]  = useState(false);
  const [propSearch,    setPropSearch]    = useState('');
  const [calOpen,       setCalOpen]       = useState(false);
  const [calStartDate,  setCalStartDate]  = useState('2026-02-01');
  const [calEndDate,    setCalEndDate]    = useState('2026-04-30');
  const [calSelecting,  setCalSelecting]  = useState('start');
  const [calHover,      setCalHover]      = useState(null);
  const [calMonth,      setCalMonth]      = useState({ year: 2026, month: 3 }); // left panel
  const calRef = useRef(null);

  // Close calendar on outside click
  useEffect(() => {
    if (!calOpen) return;
    const h = (e) => { if (calRef.current && !calRef.current.contains(e.target)) setCalOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [calOpen]);

  const rightCalMonth = nextCal(calMonth);
  const canGoPrev     = calKey(calMonth) > ALL_MONTH_KEYS[0];
  const canGoNext     = calKey(rightCalMonth) < ALL_MONTH_KEYS[ALL_MONTH_KEYS.length - 1];

  const handleDayClick = (ds) => {
    if (calSelecting === 'start') {
      setCalStartDate(ds); setCalEndDate(null); setCalSelecting('end');
    } else {
      if (ds >= calStartDate) {
        setCalEndDate(ds); setCalOpen(false); setCalSelecting('start');
      } else {
        // Clicked before start → restart selection
        setCalStartDate(ds); setCalEndDate(null);
      }
    }
  };

  const effectiveEnd   = calEndDate || calStartDate;
  const propData       = analyticsProp ? PROPERTY_MONTHLY[analyticsProp] : null;
  const analyticsStats = (propData && calStartDate) ? {
    electricity: sumRangeByDate(propData.electricity, calStartDate, effectiveEnd),
    internet:    sumRangeByDate(propData.internet,    calStartDate, effectiveEnd),
    gas:         sumRangeByDate(propData.gas,         calStartDate, effectiveEnd),
    rent:        sumRangeByDate(propData.rent,        calStartDate, effectiveEnd),
    insurance:   sumRangeByDate(propData.insurance,   calStartDate, effectiveEnd),
  } : null;

  const dayCount = (calStartDate && calEndDate)
    ? Math.floor((new Date(calEndDate) - new Date(calStartDate)) / 86400000) + 1
    : calStartDate ? 1 : 0;

  const filteredProps   = ANALYTICS_PROPERTIES.filter(p => p.toLowerCase().includes(propSearch.toLowerCase()));
  const dateRangeLabel  = calEndDate
    ? `${fmtDs(calStartDate)} – ${fmtDs(calEndDate)}, ${calStartDate.slice(0,4)}`
    : calStartDate ? `${fmtDs(calStartDate)} – pick end…` : 'Select date range';

  return (
    <div
      className={`overlay ${open ? 'show' : ''}`}
      onClick={e => { if (e.target.classList.contains('overlay')) onClose(); }}
    >
      {open && (
        <div className="modal an-modal">

          {/* ── Header ── */}
          <div className="an-header">
            <div>
              <h2>Property Analytics</h2>
              <p>
                {dayCount > 0 ? `${dayCount} ${dayCount === 1 ? 'day' : 'days'} selected` : 'No date range selected'}
                {' · '}
                {analyticsProp ? analyticsProp.split(',')[0] : 'No property selected'}
              </p>
            </div>
            <button className="an-close" onClick={onClose}>✕</button>
          </div>

          {/* ── Controls ── */}
          <div className="an-controls">

            {/* Date range picker */}
            <div className="an-date-wrap" ref={calRef}>
              <button
                className="an-date-btn"
                onClick={() => { setCalOpen(v => !v); if (!calOpen) setCalSelecting('start'); }}
              >
                <IconCalendar />
                <span className="mono">{dateRangeLabel}</span>
                <span className="an-chevron">▾</span>
              </button>

              {calOpen && (
                <div className="an-cal-popup">
                  {/* Two-month calendar */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>

                    {/* ‹ Prev */}
                    <button
                      className="an-cal-nav"
                      style={{ marginTop: 22, flexShrink: 0 }}
                      onClick={() => setCalMonth(m => prevCal(m))}
                      disabled={!canGoPrev}
                    >‹</button>

                    {/* Left month */}
                    <CalPanel
                      year={calMonth.year} month={calMonth.month}
                      startDate={calStartDate} endDate={calEndDate}
                      hoverDate={calHover} selecting={calSelecting}
                      onDayClick={handleDayClick} onDayHover={setCalHover}
                    />

                    {/* Divider */}
                    <div style={{ width: 1, background: 'var(--border)', alignSelf: 'stretch', flexShrink: 0, margin: '0 4px' }} />

                    {/* Right month */}
                    <CalPanel
                      year={rightCalMonth.year} month={rightCalMonth.month}
                      startDate={calStartDate} endDate={calEndDate}
                      hoverDate={calHover} selecting={calSelecting}
                      onDayClick={handleDayClick} onDayHover={setCalHover}
                    />

                    {/* › Next */}
                    <button
                      className="an-cal-nav"
                      style={{ marginTop: 22, flexShrink: 0 }}
                      onClick={() => setCalMonth(m => nextCal(m))}
                      disabled={!canGoNext}
                    >›</button>
                  </div>

                  {/* Footer */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)',
                  }}>
                    <span style={{ fontFamily: "'Lora', serif", fontSize: 11, color: 'var(--text3)', fontStyle: 'italic' }}>
                      {calSelecting === 'start' ? 'Click to set start date' : 'Now click end date'}
                    </span>
                    <button
                      className="btn"
                      style={{ fontSize: 11, padding: '3px 10px' }}
                      onClick={() => {
                        setCalStartDate('2026-02-01'); setCalEndDate('2026-04-30');
                        setCalSelecting('start'); setCalOpen(false);
                      }}
                    >Reset</button>
                  </div>
                </div>
              )}
            </div>

            {/* Property selector */}
            <div className="an-prop-wrap">
              <button className="an-prop-btn" onClick={() => setPropDropOpen(v => !v)}>
                <span>{analyticsProp ? analyticsProp.split(',')[0] : 'Select property'}</span>
                <span className="an-chevron">▾</span>
              </button>
              {propDropOpen && (
                <div className="an-prop-drop">
                  <div className="an-prop-search-wrap">
                    <input
                      className="an-prop-search" placeholder="Search…"
                      value={propSearch} onChange={e => setPropSearch(e.target.value)} autoFocus
                    />
                  </div>
                  <div className="an-prop-list">
                    {filteredProps.map(p => (
                      <button
                        key={p}
                        className={`an-prop-item ${analyticsProp === p ? 'selected' : ''}`}
                        onClick={() => { setAnalyticsProp(p); setPropDropOpen(false); setPropSearch(''); }}
                      >{p}</button>
                    ))}
                    {filteredProps.length === 0 && <div className="an-prop-empty">No properties found</div>}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Content ── */}
          {!analyticsProp ? (
            <div className="an-empty">
              <IconChart />
              <p>Select a property to view its utility spend</p>
            </div>
          ) : (
            <div className="an-cards">
              {[
                { key: 'electricity', label: 'Electricity' },
                { key: 'internet',    label: 'Internet'    },
                { key: 'gas',         label: 'Gas'         },
                { key: 'rent',        label: 'Rent'        },
                { key: 'insurance',   label: 'Insurance'   },
              ].map(({ key, label }) => {
                const val = analyticsStats ? analyticsStats[key] : 0;
                return (
                  <div key={key} className="an-card">
                    <div className="stat-label">{label}</div>
                    <div className={`stat-value ${val === 0 ? 'faint' : ''}`}>
                      {val > 0 ? fmt(val) : '—'}
                    </div>
                    <div className="stat-sub">
                      {val > 0 ? `${dayCount} ${dayCount === 1 ? 'day' : 'days'}` : 'not applicable'}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}
    </div>
  );
}
