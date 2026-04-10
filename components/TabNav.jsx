import { TABS } from '@/lib/constants';

export default function TabNav({ activeTab, onTabChange, bills, monthIndex, year }) {
  return (
    <div className="tabs-bar">
      {TABS.map(t => (
        <button
          key={t.key}
          className={`tab ${activeTab === t.key ? 'active' : ''}`}
          onClick={() => onTabChange(t.key)}
        >
          {t.label}
          <span className="tab-count">
            ({bills.filter(b => b.type === t.key && b.dueMonth === monthIndex && b.dueYear === year).length})
          </span>
        </button>
      ))}
    </div>
  );
}
