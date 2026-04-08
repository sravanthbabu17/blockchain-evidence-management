import React from 'react';
import { MapContainer, TileLayer, Popup, CircleMarker } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix leaflet default icon in webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const STATUS_COLORS = {
  pending:       '#f59e0b',
  assigned:      '#3b82f6',
  investigating: '#8b5cf6',
  verified:      '#10b981',
  closed:        '#94a3b8',
};

export default function AccidentMap({ records }) {
  const navigate = useNavigate();

  // Only records with valid GPS
  const mapped = records.filter(r => {
    const lat = r.gps?.lat || r.evidenceData?.gps?.lat;
    const lon = r.gps?.lon || r.evidenceData?.gps?.lon;
    return lat && lon && lat !== 0 && lon !== 0;
  }).map(r => ({
    ...r,
    lat: r.gps?.lat || r.evidenceData?.gps?.lat,
    lon: r.gps?.lon || r.evidenceData?.gps?.lon,
  }));

  // Center on first valid record, or default to India
  const center = mapped.length > 0
    ? [mapped[0].lat, mapped[0].lon]
    : [17.385, 78.4867];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {mapped.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)', background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🗺️</div>
          <p>No GPS coordinates available in visible records.</p>
        </div>
      ) : (
        <>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Showing <strong style={{ color: 'var(--text)' }}>{mapped.length}</strong> of {records.length} cases with GPS coordinates
          </div>
          <div style={{ height: '520px', borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border)' }}>
            <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap contributors'
              />
              {mapped.map((record, i) => {
                const color = STATUS_COLORS[record.status] || '#3b82f6';
                return (
                  <CircleMarker
                    key={record.id || i}
                    center={[record.lat, record.lon]}
                    radius={10}
                    pathOptions={{ color, fillColor: color, fillOpacity: 0.8, weight: 2 }}
                    eventHandlers={{ click: () => navigate(`/case/${record.id}`, { state: record }) }}
                  >
                    <Popup>
                      <div style={{ minWidth: '180px', fontFamily: 'Inter, sans-serif' }}>
                        <div style={{ fontWeight: 800, fontSize: '14px', marginBottom: '6px' }}>
                          {record.vehicle_id || record.vehicleId}
                        </div>
                        <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }}>
                          {new Date(record.timestamp).toLocaleString()}
                        </div>
                        <div style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '10px', background: color + '22', color, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>
                          {record.status}
                        </div>
                        <br />
                        <button
                          onClick={() => navigate(`/case/${record.id}`, { state: record })}
                          style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '5px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', width: '100%' }}
                        >
                          Open Case →
                        </button>
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}
            </MapContainer>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {Object.entries(STATUS_COLORS).map(([status, color]) => (
              <div key={status} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
                <span style={{ textTransform: 'capitalize' }}>{status}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
