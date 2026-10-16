import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { useRevenueTrend, useCampaignPerf, useReturnReasons, useInventoryHealth } from '../hooks';
import { formatCurrency } from '../utils';

const COLORS = ['#4f8ef7', '#8b5cf6', '#22d3ee', '#10b981', '#f59e0b', '#ef4444'];

export default function ChartsPage() {
  const { data: revenue }   = useRevenueTrend();
  const { data: campaigns } = useCampaignPerf();
  const { data: returns }   = useReturnReasons();
  const { data: inventory } = useInventoryHealth();

  return (
    <div className="charts-grid">
      {/* Revenue Trend */}
      <div className="chart-card" style={{ gridColumn: 'span 2' }}>
        <div className="chart-card-title">📈 Revenue Trend</div>
        <div className="chart-card-sub">Monthly net revenue vs returns volume</div>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={revenue} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#4f8ef7" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#4f8ef7" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="retGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={v => `$${(v/1000).toFixed(0)}K`} />
            <Tooltip
              contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
              formatter={(v, n) => [n === 'revenue' ? formatCurrency(v) : v, n === 'revenue' ? 'Revenue' : 'Returns']}
            />
            <Area type="monotone" dataKey="revenue" stroke="#4f8ef7" fill="url(#revGrad)" strokeWidth={2} />
            <Area type="monotone" dataKey="returns" stroke="#ef4444" fill="url(#retGrad)" strokeWidth={2} yAxisId={0} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Campaign ROAS */}
      <div className="chart-card">
        <div className="chart-card-title">🎯 Campaign ROAS</div>
        <div className="chart-card-sub">Return on ad spend by campaign (anomalies in red)</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={campaigns.slice(0, 8)} layout="vertical" margin={{ left: 0, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
            <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 9, fill: 'var(--text-muted)' }} />
            <Tooltip
              contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}
              formatter={v => [`${v}x`, 'ROAS']}
            />
            <Bar dataKey="roas" radius={[0, 4, 4, 0]}>
              {campaigns.slice(0, 8).map((c, i) => (
                <Cell key={i} fill={c.roas < 1 ? '#ef4444' : c.roas < 2 ? '#f97316' : '#4f8ef7'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Return Reasons */}
      <div className="chart-card">
        <div className="chart-card-title">↩️ Return Reasons</div>
        <div className="chart-card-sub">Why customers are returning products</div>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={returns}
              dataKey="count"
              nameKey="return_reason"
              cx="50%" cy="50%"
              outerRadius={80}
              label={({ return_reason, percent }) => `${(percent * 100).toFixed(0)}%`}
              labelLine={false}
            >
              {returns.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip
              contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}
              formatter={(v, n) => [v, n]}
            />
            <Legend
              formatter={val => <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{val}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Inventory Value */}
      <div className="chart-card" style={{ gridColumn: 'span 2' }}>
        <div className="chart-card-title">📦 Inventory Value by Category</div>
        <div className="chart-card-sub">Total stock value at cost — large bars may indicate overstock risk</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={inventory} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="category" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={v => `$${(v/1000).toFixed(0)}K`} />
            <Tooltip
              contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}
              formatter={v => [formatCurrency(v), 'Stock Value']}
            />
            <Bar dataKey="stock_value" fill="#8b5cf6" radius={[4, 4, 0, 0]}>
              {inventory.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
