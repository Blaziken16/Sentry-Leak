import { formatCurrency, timeAgo, TYPE_LABELS, SEV_ICONS } from '../utils';

export default function AlertFeed({ items, loading, selectedId, onSelect }) {
  if (loading) {
    return (
      <div className="alert-feed">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="empty-panel">
        <div className="empty-panel-icon">🎉</div>
        <div style={{ fontSize: 15, fontWeight: 600 }}>No open alerts!</div>
        <div className="empty-panel-text">All money leaks have been addressed. Run a new ML scan to refresh.</div>
      </div>
    );
  }

  return (
    <div className="alert-feed">
      {items.map((item, idx) => (
        <AlertCard
          key={item.anomaly_id}
          item={item}
          rank={idx + 1}
          selected={selectedId === item.anomaly_id}
          onClick={() => onSelect(item.anomaly_id)}
        />
      ))}
    </div>
  );
}

function AlertCard({ item, rank, selected, onClick }) {
  const sev = item.severity || 'medium';
  const icon = SEV_ICONS[sev] || '🟡';
  const typeLabel = TYPE_LABELS[item.anomaly_type] || item.anomaly_type;

  return (
    <div
      className={`alert-card sev-${sev} ${selected ? 'selected' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      id={`alert-${item.anomaly_id}`}
    >
      <div className="alert-card-accent" />
      <div className="alert-sev-icon">{icon}</div>

      <div className="alert-card-body">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            #{rank}
          </span>
          <div className="alert-card-title">{item.title}</div>
        </div>
        <div className="alert-card-desc">{item.description}</div>
        <div className="alert-card-meta">
          <span className="alert-type-pill">{typeLabel}</span>
          <span style={{ padding: '1px 6px' }}
            data-sev={sev}
            className={`sev-badge ${sev}`}
          >
            {sev}
          </span>
          <span className="alert-time">{timeAgo(item.detected_at)}</span>
        </div>
      </div>

      <div className="alert-card-coi">
        <div className="coi-label">Cost if ignored</div>
        <div className="coi-value">{formatCurrency(item.cost_of_inaction)}</div>
        <div className="coi-sub">/30 days</div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="alert-card" style={{ cursor: 'default', animation: 'none' }}>
      <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--bg-glass)' }} />
      <div style={{ flex: 1 }}>
        <div style={{ height: 14, width: '60%', background: 'var(--bg-glass)', borderRadius: 4, marginBottom: 8 }} />
        <div style={{ height: 10, width: '90%', background: 'var(--bg-glass)', borderRadius: 4, marginBottom: 4 }} />
        <div style={{ height: 10, width: '70%', background: 'var(--bg-glass)', borderRadius: 4 }} />
      </div>
      <div style={{ width: 60, textAlign: 'right' }}>
        <div style={{ height: 22, width: '100%', background: 'var(--bg-glass)', borderRadius: 4 }} />
      </div>
    </div>
  );
}
