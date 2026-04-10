'use client';

import { useState, useEffect } from 'react';
import { MOCK_BILLS_INITIAL } from '@/data/mockBills';
import { dupKey } from '@/lib/utils';
import TopBar          from '@/components/TopBar';
import TabNav          from '@/components/TabNav';
import StatsRow        from '@/components/StatsRow';
import FiltersBar      from '@/components/FiltersBar';
import BillsTable      from '@/components/BillsTable';
import BillDetailModal from '@/components/BillDetailModal';
import AddBillModal    from '@/components/AddBillModal';
import AnalyticsModal  from '@/components/AnalyticsModal';

const DUE_MONTH_MAP = { Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12' };

export default function Dashboard() {
  const [bills,           setBills]           = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [activeTab,       setActiveTab]       = useState('electricity');
  const [monthIndex,      setMonthIndex]      = useState(3);
  const [year,            setYear]            = useState(2026);
  const [search,          setSearch]          = useState('');
  const [statusFilter,    setStatusFilter]    = useState('all');
  const [selectedBill,    setSelectedBill]    = useState(null);
  const [darkMode,        setDarkMode]        = useState(false);
  const [toast,           setToast]           = useState(false);
  const [toastMsg,        setToastMsg]        = useState('');
  const [reviewed,        setReviewed]        = useState(new Set());
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [analyticsOpen,   setAnalyticsOpen]   = useState(false);
  const [addOpen,         setAddOpen]         = useState(false);
  const [syncing,         setSyncing]         = useState(false);
  const [lastSynced,      setLastSynced]      = useState('');

  useEffect(() => {
    fetch('/api/bills')
      .then(r => r.json())
      .then(data => {
        if (data.ok) setBills(data.bills);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const showToast = (msg) => {
    setToastMsg(msg);
    setToast(true);
    setTimeout(() => setToast(false), 4000);
  };

  const toggleDark = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.body.classList.toggle('dark', next);
  };

  const prevMonth = () => {
    if (monthIndex === 0) { setMonthIndex(11); setYear(y => y - 1); }
    else setMonthIndex(m => m - 1);
  };
  const nextMonth = () => {
    if (monthIndex === 11) { setMonthIndex(0); setYear(y => y + 1); }
    else setMonthIndex(m => m + 1);
  };

  const exportCSV = () => {
    const monthNum = String(monthIndex + 1).padStart(2, '0');
    const rows = filtered.map(b => {
      const [mon, day] = b.due.split(' ');
      const dateStr = `${DUE_MONTH_MAP[mon]}/${String(day).padStart(2, '0')}/${year}`;
      const type = b.type.charAt(0).toUpperCase() + b.type.slice(1);
      const desc = `${type} | ${b.unit} | ${b.property} | Acct \u00B7\u00B7\u00B7${b.account}`;
      return `${dateStr},"${desc}",-${b.amount.toFixed(2)}`;
    });
    const csv = ['Date,Description,Amount', ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quickbooks-utilities-${year}-${monthNum}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('CSV ready — import into QuickBooks via Transactions → Upload from file');
  };

  const handleAddBill = (newBill) => {
    setBills(prev => [...prev, newBill]);
    showToast('Expense added successfully');
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res  = await fetch('/api/sync');
      const data = await res.json();
      if (data.ok) {
        // Recargar facturas después del sync
        const billsRes  = await fetch('/api/bills');
        const billsData = await billsRes.json();
        if (billsData.ok) setBills(billsData.bills);

        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        setLastSynced(`today ${timeStr}`);

        if (data.saved > 0) showToast(`Sync complete — ${data.saved} new bill${data.saved !== 1 ? 's' : ''} added`);
        else showToast('Sync complete — no new bills found');
      } else {
        showToast('Sync failed — check connection');
      }
    } catch {
      showToast('Sync failed — check connection');
    } finally {
      setSyncing(false);
    }
  };

  const dupCounts = {};
  bills.forEach(b => { const k = dupKey(b); dupCounts[k] = (dupCounts[k] || 0) + 1; });
  const dupKeys   = new Set(Object.entries(dupCounts).filter(([, c]) => c > 1).map(([k]) => k));
  const markReviewed = (id) => setReviewed(prev => new Set([...prev, id]));

  const tabBills   = bills.filter(b => b.type === activeTab);
  const monthBills = tabBills.filter(b => b.dueMonth === monthIndex && b.dueYear === year);
  const filtered   = monthBills.filter(b => {
    const matchMonth  = b.dueMonth === monthIndex && b.dueYear === year;
    const matchSearch = search === '' ||
      b.property.toLowerCase().includes(search.toLowerCase()) ||
      b.unit.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || b.status === statusFilter;
    return matchMonth && matchSearch && matchStatus;
  });
  const activeDups = filtered.filter(b => dupKeys.has(dupKey(b)) && !reviewed.has(b.id));

  if (loading) return (
    <div className="page-wrap" style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh' }}>
      <p style={{ color:'var(--text-muted)', fontFamily:'var(--font-serif)' }}>Cargando facturas…</p>
    </div>
  );

  return (
    <div className="page-wrap">
      <TopBar
        exportCSV={exportCSV}
        onAnalytics={() => setAnalyticsOpen(true)}
        onAddExpense={() => setAddOpen(true)}
        toggleDark={toggleDark}
        onSync={handleSync}
        syncing={syncing}
        lastSynced={lastSynced}
      />
      <TabNav
        activeTab={activeTab}
        onTabChange={tab => { setActiveTab(tab); setBannerDismissed(false); }}
        bills={bills}
        monthIndex={monthIndex}
        year={year}
      />
      <StatsRow tabBills={monthBills} />
      <FiltersBar
        monthIndex={monthIndex}
        year={year}
        onPrev={prevMonth}
        onNext={nextMonth}
        search={search}
        onSearch={setSearch}
        statusFilter={statusFilter}
        onStatusFilter={setStatusFilter}
      />
      <BillsTable
        filtered={filtered}
        dupKeys={dupKeys}
        reviewed={reviewed}
        onMarkReviewed={markReviewed}
        onSelectBill={setSelectedBill}
        activeDups={activeDups}
        bannerDismissed={bannerDismissed}
        onDismissBanner={() => setBannerDismissed(true)}
        activeTab={activeTab}
        monthIndex={monthIndex}
        year={year}
      />

      <div className={`toast ${toast ? 'show' : ''}`}>{toastMsg}</div>

      <BillDetailModal
        bill={selectedBill}
        onClose={() => setSelectedBill(null)}
        year={year}
      />
      <AddBillModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSave={handleAddBill}
      />
      <AnalyticsModal
        open={analyticsOpen}
        onClose={() => setAnalyticsOpen(false)}
      />
    </div>
  );
}
