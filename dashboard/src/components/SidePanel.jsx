import { useState } from 'react';
import { useAnomaly } from '../hooks';
import { formatCurrency, formatPercent, useAction, SEV_ICONS } from '../utils';

export default function SidePanel({ anomalyId, onActionDone }) {
  const { data, loading, error } = useAnomaly(anomalyId);
  const [actionDone, setActionDone] = useState(false);

  const { loading: acting, execute: doAction } = useAction((action) => {
    setActionDone(true);
    onActionDone?.(action);
  });

  // Reset when anomaly changes
  if (!anomalyId) {
    return (
      <div className="side-panel">
        <div className="empty-panel" style={{ padding: '80px 20px' }}>
          <div className="empty-panel-icon">👆</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
            Select an alert to investigate
          </div>
          <div className="empty-panel-text">
            Click any card in the feed to see evidence and take action
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="side-panel">
        <div className="side-panel-header">
          <div style={{ height: 16, width: '70%', background: 'var(--bg-glass)', borderRadius: 4 }} />
        </div>
        <div className="side-panel-body">
          <div style={{ height: 80, background: 'var(--bg-glass)', borderRadius: 8, marginBottom: 12 }} />
          <div style={{ height: 120, background: 'var(--bg-glass)', borderRadius: 8 }} />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const ev = data.evidence || {};
  const sev = data.severity || 'medium';
  const suggestedAction = ev.suggested_action || 'Investigate';
  const icon = SEV_ICONS[sev];

  const evidenceEntries = Object.entries(ev)
    .filter(([k]) => k !== 'suggested_action')
    .map(([k, v]) => ({
      key: k.replace(/_/g, ' '),
      val: formatEvidenceValue(k, v),
    }));

  return (
    <div className="side-panel">
      <div className="side-panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span className={`sev-badge ${sev}`}>{icon} {sev}</span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            #{data.anomaly_id}
          </span>
        </div>
        <div className="side-panel-title">{data.title}</div>
        <div className="side-panel-sub">
          {data.anomaly_type?.replace(/_/g, ' ')} · {data.related_table}
        </div>
      </div>

      <div className="side-panel-body">
        {/* Cost of Inaction */}
        <div className="coi-block">
          <div className="coi-block-label">💸 Cost of Inaction</div>
          <div className="coi-block-value">{formatCurrency(data.cost_of_inaction)}</div>
          <div className="coi-block-sub">Estimated 30-day loss if no action taken</div>
        </div>

        {/* Description */}
        <div className="evidence-section">
          <div className="evidence-label">🔍 What happened</div>
          <div className="evidence-desc">{data.description}</div>
        </div>

        {/* Evidence */}
        {evidenceEntries.length > 0 && (
          <div className="evidence-section">
            <div className="evidence-label">📊 Evidence</div>
            <div className="evidence-grid">
              {evidenceEntries.map(({ key, val }) => (
                <div key={key} className="evidence-item">
                  <div className="evidence-item-key">{key}</div>
                  <div className="evidence-item-val">{val}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Related entity quick info */}
        {data.related_entity && <RelatedEntityCard entity={data.related_entity} table={data.related_table} />}

        {/* Action Button */}
        <div style={{ marginTop: 20 }}>
          {actionDone ? (
            <button className="action-btn success" disabled>
              ✅ Action Applied Successfully
            </button>
          ) : (
            <button
              className="action-btn"
              onClick={() => doAction(data.anomaly_id, suggestedAction)}
              disabled={acting}
              id={`action-btn-${data.anomaly_id}`}
            >
              {acting ? '⏳ Applying...' : `⚡ ${suggestedAction}`}
            </button>
          )}
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', marginTop: 6 }}>
            This will mark the alert as resolved
          </div>
        </div>

        {/* Recent transactions for product issues */}
        {data.recent_transactions?.length > 0 && (
          <div className="evidence-section" style={{ marginTop: 16 }}>
            <div className="evidence-label">🧾 Recent Transactions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
              {data.recent_transactions.slice(0, 8).map(t => (
                <div key={t.transaction_id} style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '6px 10px', background: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-sm)', fontSize: 11,
                }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{t.transaction_date?.slice(0, 10)}</span>
                  <span style={{ color: t.status === 'returned' ? 'var(--sev-critical)' : 'var(--text-primary)', fontWeight: 500 }}>
                    {t.status}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                    {formatCurrency(t.net_revenue)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RelatedEntityCard({ entity, table }) {
  if (table === 'campaigns') {
    return (
      <div className="evidence-section">
        <div className="evidence-label">📡 Campaign Details</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <InfoRow label="Name"    val={entity.name} />
          <InfoRow label="Channel" val={entity.channel} />
          <InfoRow label="Status"  val={entity.status} />
          <InfoRow label="Budget"  val={formatCurrency(entity.budget)} />
          <InfoRow label="Spend"   val={formatCurrency(entity.spend)} />
        </div>
      </div>
    );
  }
  if (table === 'products') {
    return (
      <div className="evidence-section">
        <div className="evidence-label">📦 Product Details</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <InfoRow label="Category"  val={entity.category} />
          <InfoRow label="List Price" val={formatCurrency(entity.list_price)} />
          <InfoRow label="Unit Cost"  val={formatCurrency(entity.unit_cost)} />
          <InfoRow label="Stock"      val={entity.stock_qty} />
        </div>
      </div>
    );
  }
  return null;
}

function InfoRow({ label, val }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontWeight: 500 }}>{val}</span>
    </div>
  );
}

function formatEvidenceValue(key, val) {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'number') {
    if (key.includes('rate') || key.includes('pct') || key.includes('ctr') || key.includes('cvr')) {
      return formatPercent(val);
    }
    if (key.includes('revenue') || key.includes('cost') || key.includes('spend') || key.includes('budget') || key.includes('price')) {
      return formatCurrency(val);
    }
    if (key.includes('roas')) return `${val.toFixed(2)}x`;
    return Number.isInteger(val) ? val.toLocaleString() : val.toFixed(2);
  }
  return String(val);
}
