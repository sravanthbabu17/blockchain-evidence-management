import React, { useState } from 'react';

export default function Filters({ onFilter }) {
  const [search, setSearch] = useState('');
  const [sort, setSort]     = useState('newest');
  const [status, setStatus] = useState('all');

  const handle = (newSearch, newStatus, newSort) => {
    onFilter({ search: newSearch, status: newStatus, sort: newSort });
  };

  return (
    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
      <input
        type="text"
        placeholder="🔍  Search by vehicle ID..."
        value={search}
        onChange={e => { setSearch(e.target.value); handle(e.target.value, status, sort); }}
        style={{ flex: '1', minWidth: '200px', maxWidth: '320px' }}
      />
      <select
        value={status}
        onChange={e => { setStatus(e.target.value); handle(search, e.target.value, sort); }}
        style={{ minWidth: '160px' }}
      >
        <option value="all">All Statuses</option>
        <option value="pending">⏳ Pending</option>
        <option value="assigned">🔵 Assigned</option>
        <option value="investigating">🟣 Investigating</option>
        <option value="verified">✅ Verified</option>
        <option value="closed">⚫ Closed</option>
      </select>
      <select
        value={sort}
        onChange={e => { setSort(e.target.value); handle(search, status, e.target.value); }}
        style={{ minWidth: '160px' }}
      >
        <option value="newest">🕒 Newest First</option>
        <option value="oldest">⌛ Oldest First</option>
      </select>
      {(search || status !== 'all' || sort !== 'newest') && (
        <button
          className="btn-ghost"
          onClick={() => { setSearch(''); setStatus('all'); setSort('newest'); handle('', 'all', 'newest'); }}
        >
          ✕ Clear
        </button>
      )}
    </div>
  );
}