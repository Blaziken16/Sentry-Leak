import { formatCurrency } from '../utils';

export default function StatsBar({ stats, loading, moneyAtRisk }) {
  const s = stats;

  const cards = [
    {
      label: 'Money at Risk',
      value: formatCurrency(moneyAtRisk),
      sub: 'Estimated 30-day loss if unaddressed',
      variant: 'danger',
      icon: '💸',
    },
    {
      label: 'Open Alerts',
      value: s?.anomalies?.open_count ?? '—',
      sub: `${s?.anomalies?.by_severity?.critical?.count ?? 0} critical · ${s?.anomalies?.by_severity?.high?.count ?? 0} high`,
      variant: 'warning',
      icon: '🚨',
    },
    {
      label: 'Total Revenue',
      value: formatCurrency(s?.transactions?.total_revenue),
      sub: `${s?.transactions?.total?.toLocaleString() ?? '—'} transactions`,
      variant: 'info',
      icon: '📈',
    },
    {
      label: 'Avg ROAS',
      value: s?.campaigns?.avg_roas ? `${s.campaigns.avg_roas}x` : '—',
      sub: `${s?.campaigns?.total ?? '—'} active campaigns`,
      variant: 'success',
      icon: '🎯',
    },
  ];

  return (
    <div className="stats-grid">
      {cards.map(c => (
        <div key={c.label} className={`stat-card ${c.variant}`}>
          <div className="stat-card-icon">{c.icon}</div>
          <div className="stat-card-label">{c.label}</div>
          <div className={`stat-card-value ${c.variant}`}>
            {loading ? <span style={{ opacity: 0.3 }}>···</span> : c.value}
          </div>
          <div className="stat-card-sub">{loading ? '' : c.sub}</div>
        </div>
      ))}
    </div>
  );
}
