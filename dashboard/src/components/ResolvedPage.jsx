import { useAnomalies } from '../hooks';
import { formatCurrency, timeAgo, TYPE_LABELS } from '../utils';

export default function ResolvedPage() {
  const { data, loading } = useAnomalies({ status: 'resolved', limit: 50 });
  const items = data?.items ?? [];

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
      <div className="spinner" />
    </div>
  );

  if (!items.length) return (
    <div className="empty-panel" style={{ paddingTop: 80 }}>
      <div className="empty-panel-icon">📋</div>
      <div style={{ fontSize: 14, fontWeight: 600 }}>No resolved issues yet</div>
      <div className="empty-panel-text">Resolved alerts will appear here after you take action.</div>
    </div>
  );

  const totalSaved = items.reduce((sum, i) => sum + (i.cost_of_inaction || 0), 0);

  return (
    <div>
      {/* Summary */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
        <div className="stat-card success" style={{ flex: '0 0 auto', minWidth: 180 }}>
          <div className="stat-card-label">Issues Resolved</div>
          <div className="stat-card-value success">{items.length}</div>
          <div className="stat-card-sub">Total actions taken</div>
        </div>
        <div className="stat-card info" style={{ flex: '0 0 auto', minWidth: 220 }}>
          <div className="stat-card-label">Revenue Protected</div>
          <div className="stat-card-value info">{formatCurrency(totalSaved)}</div>
          <div className="stat-card-sub">Estimated savings from resolved alerts</div>
        </div>
      </div>

      {/* List */}
      <div className="alert-feed">
        {items.map(item => (
          <ResolvedCard key={item.anomaly_id} item={item} />
        ))}
      </div>
    </div>
  );
}

function ResolvedCard({ item }) {
  return (
    <div className="alert-card" style={{ cursor: 'default', opacity: 0.7 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(16,185,129,0.1)', display: 'grid', placeItems: 'center', fontSize: 16 }}>
        ✅
      </div>
      <div className="alert-card-body">
        <div className="alert-card-title">{item.title}</div>
        <div className="alert-card-desc">{item.action_taken || 'Action taken'}</div>
        <div className="alert-card-meta">
          <span className="alert-type-pill">{TYPE_LABELS[item.anomaly_type] || item.anomaly_type}</span>
          <span className="resolved-chip">✓ resolved</span>
          <span className="alert-time">{timeAgo(item.resolved_at)}</span>
        </div>
      </div>
      <div className="alert-card-coi">
        <div className="coi-label">Saved</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent-green)', letterSpacing: -0.5 }}>
          {formatCurrency(item.cost_of_inaction)}
        </div>
      </div>
    </div>
  );
}
