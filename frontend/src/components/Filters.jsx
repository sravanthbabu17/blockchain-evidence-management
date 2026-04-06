import { useState } from "react";

export default function Filters({ onFilter }) {
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("");

    const handleFilter = () => {
        onFilter({ search, status });
    };

    return (
        <div style={{ display: "flex", gap: "10px" }}>
            <input
                placeholder="Search Vehicle ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                    flex: 1,
                    padding: '10px 15px',
                    borderRadius: '8px',
                    border: '1px solid #ddd',
                    fontSize: '14px'
                }}
            />

            <select 
                onChange={(e) => setStatus(e.target.value)}
                style={{
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #ddd',
                    background: '#fff',
                    fontSize: '14px'
                }}
            >
                <option value="">Show All Status</option>
                <option value="valid">🟢 Verified</option>
                <option value="tampered">🔴 Tampered</option>
            </select>

            <button 
                onClick={handleFilter}
                style={{
                    padding: '10px 25px',
                    background: '#007bff',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 600
                }}
            >
                Apply
            </button>
        </div>
    );
}