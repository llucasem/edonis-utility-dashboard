import { MONTHS } from '@/lib/constants';

export default function FiltersBar({ monthIndex, year, onPrev, onNext, search, onSearch }) {
  return (
    <div className="filters-bar">
      <div className="month-picker">
        <button className="nav-btn" onClick={onPrev}>‹</button>
        <span className="month-label">{MONTHS[monthIndex]} {year}</span>
        <button className="nav-btn" onClick={onNext}>›</button>
      </div>
      <input
        className="search-input"
        type="text"
        placeholder="Search by property, address or amount (e.g. 61.25)…"
        value={search}
        onChange={e => onSearch(e.target.value)}
      />
    </div>
  );
}
