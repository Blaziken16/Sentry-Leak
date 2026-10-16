// API client for the FastAPI backend
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

async function request(path, options = {}) {
  const headers = options.body instanceof FormData
    ? { ...options.headers }
    : { 'Content-Type': 'application/json', ...options.headers };
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  health: () => request('/health'),
  stats: () => request('/api/stats'),
  anomalies: (params = {}) => {
    const q = new URLSearchParams();
    if (params.status)   q.set('status', params.status);
    if (params.severity) q.set('severity', params.severity);
    if (params.type)     q.set('anomaly_type', params.type);
    if (params.limit)    q.set('limit', params.limit);
    if (params.offset)   q.set('offset', params.offset);
    return request(`/api/anomalies?${q}`);
  },
  anomaly: (id) => request(`/api/anomalies/${id}`),
  takeAction: (id, action, notes) =>
    request(`/api/anomalies/${id}/action`, {
      method: 'POST',
      body: JSON.stringify({ action, notes }),
    }),
  runPipeline: () => request('/api/pipeline/run', { method: 'POST' }),
  dataset: () => request('/api/dataset'),
  uploadDataset: (files) => {
    const body = new FormData();
    files.forEach(file => body.append('files', file));
    return request('/api/dataset/upload', {
      method: 'POST',
      headers: {},
      body,
    });
  },
  revenueTrend: () => request('/api/charts/revenue-trend'),
  campaignPerf: () => request('/api/charts/campaign-performance'),
  returnReasons: () => request('/api/charts/return-reasons'),
  inventoryHealth: () => request('/api/charts/inventory-health'),
};
