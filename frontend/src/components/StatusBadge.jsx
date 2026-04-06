import React from 'react';

/**
 * Premium StatusBadge component for Forensic Workflow stages.
 * Supports: pending, assigned, investigating, verified, closed
 */
export default function StatusBadge({ status = "pending" }) {
    const config = {
        pending: {
            bg: "#fff3cd",
            text: "#856404",
            border: "#ffeeba",
            icon: "⏳",
            label: "Pending"
        },
        assigned: {
            bg: "#cfe2ff",
            text: "#084298",
            border: "#b6d4fe",
            icon: "🛡️",
            label: "Assigned"
        },
        investigating: {
            bg: "#fff3cd", // Using a warm yellow/orange
            text: "#664d03",
            border: "#ffecb5",
            icon: "🔍",
            label: "Investigating"
        },
        verified: {
            bg: "#d1e7dd",
            text: "#0f5132",
            border: "#badbcc",
            icon: "✅",
            label: "Verified"
        },
        closed: {
            bg: "#e2e3e5",
            text: "#41464b",
            border: "#d3d3d4",
            icon: "📁",
            label: "Closed"
        }
    };

    const style = config[status.toLowerCase()] || config.pending;

    return (
        <span style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "5px 12px",
            borderRadius: "20px",
            background: style.bg,
            color: style.text,
            fontSize: "11px",
            fontWeight: "700",
            border: `1px solid ${style.border}`,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
        }}>
            <span>{style.icon}</span>
            {style.label}
        </span>
    );
}