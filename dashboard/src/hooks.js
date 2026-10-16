import { useState, useEffect, useCallback } from 'react';
import { api } from './api';

// ── useStats ─────────────────────────────────────────────────────────────────
export function useStats() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const d = await api.stats();
      setData(d);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, error, refetch: fetch };
}

// ── useAnomalies ──────────────────────────────────────────────────────────────
export function useAnomalies(params = {}) {
  const [data, setData] = useState({ total: 0, items: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const d = await api.anomalies(params);
      setData(d);
    } catch (e) {
      setError(e.message);
      // Use mock data when backend is offline
      setData(MOCK_ANOMALIES);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(params)]);

  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, error, refetch: fetch };
}

// ── useAnomaly ────────────────────────────────────────────────────────────────
export function useAnomaly(id) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) { setData(null); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.anomaly(id)
      .then(d => { if (!cancelled) setData(d); })
      .catch(e => {
        if (!cancelled) {
          setError(e.message);
          // Fall back to mock
          const item = MOCK_ANOMALIES.items.find(a => a.anomaly_id === id);
          if (item) setData(item);
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  return { data, loading, error };
}

// ── useCharts ─────────────────────────────────────────────────────────────────
export function useRevenueTrend() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.revenueTrend()
      .then(setData)
      .catch(() => setData(MOCK_REVENUE))
      .finally(() => setLoading(false));
  }, []);
  return { data, loading };
}

export function useCampaignPerf() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.campaignPerf()
      .then(setData)
      .catch(() => setData(MOCK_CAMPAIGNS))
      .finally(() => setLoading(false));
  }, []);
  return { data, loading };
}

export function useReturnReasons() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.returnReasons()
      .then(setData)
      .catch(() => setData(MOCK_RETURNS))
      .finally(() => setLoading(false));
  }, []);
  return { data, loading };
}

export function useInventoryHealth() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.inventoryHealth()
      .then(setData)
      .catch(() => setData(MOCK_INVENTORY))
      .finally(() => setLoading(false));
  }, []);
  return { data, loading };
}

// ── Mock data for offline/demo mode ──────────────────────────────────────────
export const MOCK_ANOMALIES = {
  total: 7,
  items: [
    {
      anomaly_id: 1, anomaly_type: 'campaign_ctr_collapse', severity: 'critical',
      title: 'CTR Collapse: Google Ads Campaign #7',
      description: 'Campaign has a CTR of 0.20% — far below normal. Current ROAS: 0.18x. Continuing to run wastes budget with zero return.',
      cost_of_inaction: 12400, related_id: 'CAM0007', related_table: 'campaigns',
      status: 'open', detected_at: '2024-09-15T10:30:00',
      evidence: { ctr: 0.002, cvr: 0.01, roas: 0.18, spend: 26571, budget: 38000, impressions: 380000, clicks: 760, conversions: 7, channel: 'Google Ads', suggested_action: 'Pause Campaign' },
    },
    {
      anomaly_id: 2, anomaly_type: 'overstock_dead_inventory', severity: 'critical',
      title: 'Overstock Alert: Electronics Item #42',
      description: 'Electronics Item #42 has 487 units with ~312 days of stock remaining. Holding costs are accumulating daily.',
      cost_of_inaction: 8930, related_id: 'P0042', related_table: 'products',
      status: 'open', detected_at: '2024-09-14T08:00:00',
      evidence: { qty_on_hand: 487, days_of_stock: 312, daily_holding_cost: 297, total_sold_ytd: 23, unit_cost: 342, list_price: 622, category: 'Electronics', suggested_action: 'Discount Inventory' },
    },
    {
      anomaly_id: 3, anomaly_type: 'return_rate_spike', severity: 'high',
      title: 'Return Spike: Apparel Item #88',
      description: "Apparel Item #88 has a 43% return rate (38 of 88 orders). Top reasons: Size/fit issue, Not as described.",
      cost_of_inaction: 5140, related_id: 'P0088', related_table: 'products',
      status: 'open', detected_at: '2024-09-13T14:22:00',
      evidence: { return_rate: 0.43, returns: 38, total_transactions: 88, returned_revenue: 34266, return_reasons: 'Size/fit issue,Not as described', category: 'Apparel', suggested_action: 'Investigate Quality' },
    },
    {
      anomaly_id: 4, anomaly_type: 'campaign_ctr_collapse', severity: 'high',
      title: 'CTR Collapse: Meta Ads Campaign #23',
      description: 'Campaign has a CTR of 0.31% — far below normal. Current ROAS: 0.42x. Budget is being wasted on non-converting traffic.',
      cost_of_inaction: 7200, related_id: 'CAM0023', related_table: 'campaigns',
      status: 'open', detected_at: '2024-09-12T09:15:00',
      evidence: { ctr: 0.0031, cvr: 0.012, roas: 0.42, spend: 17280, budget: 22000, impressions: 280000, clicks: 868, conversions: 10, channel: 'Meta Ads', suggested_action: 'Pause Campaign' },
    },
    {
      anomaly_id: 5, anomaly_type: 'revenue_drop', severity: 'high',
      title: 'Revenue Drop: Week 2024-32',
      description: 'Week 2024-32 revenue dropped 38% below the 4-week rolling average. Expected $84,200, got $52,204.',
      cost_of_inaction: 127984, related_id: '2024-32', related_table: 'transactions',
      status: 'open', detected_at: '2024-08-12T00:00:00',
      evidence: { week: '2024-32', actual_revenue: 52204, expected_revenue: 84200, pct_drop: -0.38, transaction_count: 312, suggested_action: 'Investigate Cause' },
    },
    {
      anomaly_id: 6, anomaly_type: 'discount_abuse', severity: 'medium',
      title: 'Discount Abuse: Customer 00471',
      description: 'Customer C00471 (VIP) averages 28% discount across 14 orders, costing $2,840 in foregone revenue.',
      cost_of_inaction: 2840, related_id: 'C00471', related_table: 'customers',
      status: 'open', detected_at: '2024-09-10T11:00:00',
      evidence: { avg_discount: 0.28, total_discount_taken: 2840, total_spent: 7300, transaction_count: 14, segment: 'VIP', suggested_action: 'Review Discount Policy' },
    },
    {
      anomaly_id: 7, anomaly_type: 'overstock_dead_inventory', severity: 'medium',
      title: 'Overstock Alert: Home & Kitchen Item #156',
      description: 'Home & Kitchen Item #156 has 421 units with ~198 days of stock. Monthly holding cost accumulating.',
      cost_of_inaction: 3210, related_id: 'P0156', related_table: 'products',
      status: 'open', detected_at: '2024-09-09T07:30:00',
      evidence: { qty_on_hand: 421, days_of_stock: 198, daily_holding_cost: 107, total_sold_ytd: 31, unit_cost: 127, list_price: 231, category: 'Home & Kitchen', suggested_action: 'Discount Inventory' },
    },
  ],
};

export const MOCK_REVENUE = [
  { month: '2024-01', revenue: 68420, transactions: 312, returns: 48 },
  { month: '2024-02', revenue: 72100, transactions: 341, returns: 52 },
  { month: '2024-03', revenue: 81500, transactions: 389, returns: 61 },
  { month: '2024-04', revenue: 78900, transactions: 367, returns: 59 },
  { month: '2024-05', revenue: 91200, transactions: 421, returns: 71 },
  { month: '2024-06', revenue: 87600, transactions: 408, returns: 68 },
  { month: '2024-07', revenue: 94300, transactions: 443, returns: 74 },
  { month: '2024-08', revenue: 52200, transactions: 312, returns: 98 },
  { month: '2024-09', revenue: 83100, transactions: 391, returns: 65 },
];

export const MOCK_CAMPAIGNS = [
  { campaign_id: 'CAM0001', name: 'Email Campaign #1', channel: 'Email', spend: 4200, roas: 4.2, ctr: 0.048, conversions: 312, status: 'active' },
  { campaign_id: 'CAM0005', name: 'SEO Campaign #5', channel: 'SEO', spend: 8100, roas: 3.8, ctr: 0.062, conversions: 241, status: 'active' },
  { campaign_id: 'CAM0012', name: 'Google Ads #12', channel: 'Google Ads', spend: 12400, roas: 2.9, ctr: 0.034, conversions: 188, status: 'active' },
  { campaign_id: 'CAM0007', name: 'Google Ads #7', channel: 'Google Ads', spend: 26571, roas: 0.18, ctr: 0.002, conversions: 7, status: 'active' },
  { campaign_id: 'CAM0023', name: 'Meta Ads #23', channel: 'Meta Ads', spend: 17280, roas: 0.42, ctr: 0.003, conversions: 10, status: 'active' },
];

export const MOCK_RETURNS = [
  { return_reason: 'Size/fit issue', count: 142, revenue_lost: 18420 },
  { return_reason: 'Defective product', count: 98, revenue_lost: 14200 },
  { return_reason: 'Not as described', count: 87, revenue_lost: 11800 },
  { return_reason: 'Changed mind', count: 64, revenue_lost: 8100 },
  { return_reason: 'Wrong item shipped', count: 41, revenue_lost: 5900 },
  { return_reason: 'Arrived too late', count: 29, revenue_lost: 3200 },
];

export const MOCK_INVENTORY = [
  { category: 'Electronics', products: 38, total_stock: 4821, stock_value: 1642000 },
  { category: 'Apparel', products: 42, total_stock: 8234, stock_value: 412000 },
  { category: 'Home & Kitchen', products: 35, total_stock: 6120, stock_value: 734000 },
  { category: 'Beauty', products: 28, total_stock: 3890, stock_value: 194000 },
  { category: 'Sports', products: 31, total_stock: 5240, stock_value: 627000 },
  { category: 'Books', products: 26, total_stock: 12400, stock_value: 124000 },
];
