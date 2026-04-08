import React, { useState } from 'react';

export default function Filters({ onFilter }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');

  const handle = (newSearch, newStatus) => {
    onFilter({ search: newSearch, status: newStatus });
  };

  return (
    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
      <input
        type="text"
        placeholder="🔍  Search by vehicle ID..."
        value={search}
        onChange={e => { setSearch(e.target.value); handle(e.target.value, status); }}
        style={{ flex: '1', minWidth: '200px', maxWidth: '320px' }}
      />
      <select
        value={status}
        onChange={e => { setStatus(e.target.value); handle(search, e.target.value); }}
        style={{ minWidth: '160px' }}
      >
        <option value="all">All Statuses</option>
        <option value="pending">⏳ Pending</option>
        <option value="assigned">🔵 Assigned</option>
        <option value="investigating">🟣 Investigating</option>
        <option value="verified">✅ Verified</option>
        <option value="closed">⚫ Closed</option>
      </select>
      {(search || status !== 'all') && (
        <button
          className="btn-ghost"
          onClick={() => { setSearch(''); setStatus('all'); handle('', 'all'); }}
        >
          ✕ Clear
        </button>
      )}
    </div>
  );
}