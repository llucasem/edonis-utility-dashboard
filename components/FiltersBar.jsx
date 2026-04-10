import { MONTHS } from '@/lib/constants';

export default function FiltersBar({ monthIndex, year, onPrev, onNext, search, onSearch, statusFilter, onStatusFilter }) {
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
        placeholder="Search by property or address…"
        value={search}
        onChange={e => onSearch(e.target.value)}
      />
      <select
        className="filter-select"
        value={statusFilter}
        onChange={e => onStatusFilter(e.target.value)}
      >
        <option value="all">All statuses</option>
        <option value="pending">Pending</option>
        <option value="paid">Paid</option>
        <option value="overdue">Overdue</option>
      </select>
    </div>
  );
}
