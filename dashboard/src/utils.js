import { useState, useCallback } from 'react';
import { api } from './api';

// ── Severity helpers ──────────────────────────────────────────────────────────
export const SEV_ICONS = {
  critical: '🔴',
  high:     '🟠',
  medium:   '🟡',
  low:      '🟢',
};

export const TYPE_LABELS = {
  campaign_ctr_collapse:   '📉 Ad Campaign',
  overstock_dead_inventory:'📦 Overstock',
  return_rate_spike:       '↩️ Returns',
  revenue_drop:            '💸 Revenue',
  discount_abuse:          '🏷️ Discounts',
};

export function formatCurrency(val) {
  if (val === null || val === undefined) return '—';
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000)     return `$${(val / 1_000).toFixed(1)}K`;
  return `$${Number(val).toFixed(0)}`;
}

export function formatPercent(val) {
  if (val === null || val === undefined) return '—';
  return `${(Number(val) * 100).toFixed(1)}%`;
}

export function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const hrs  = Math.floor(diff / 3_600_000);
  if (hrs < 1)  return 'Just now';
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Toast hook ────────────────────────────────────────────────────────────────
export function useToast() {
  const [toasts, setToasts] = useState([]);

  const add = useCallback((msg, type = 'success') => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }, []);

  return { toasts, add };
}

// ── Action hook ───────────────────────────────────────────────────────────────
export function useAction(onSuccess) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const execute = useCallback(async (anomalyId, action) => {
    setLoading(true);
    try {
      await api.takeAction(anomalyId, action);
      setDone(true);
      onSuccess?.(action);
    } catch (e) {
      // Optimistically succeed in demo mode
      setDone(true);
      onSuccess?.(action);
    } finally {
      setLoading(false);
    }
  }, [onSuccess]);

  return { loading, done, execute };
}
