import { useState, useCallback } from 'react';
import AlertFeed from './components/AlertFeed';
import SidePanel from './components/SidePanel';
import ChartsPage from './components/ChartsPage';
import ResolvedPage from './components/ResolvedPage';
import StatsBar from './components/StatsBar';
import Sidebar from './components/Sidebar';
import ToastContainer from './components/ToastContainer';
import DatasetPage from './components/DatasetPage';
import { useStats, useAnomalies } from './hooks';
import { useToast } from './utils';
import { api } from './api';

export default function App() {
  const [page, setPage]             = useState('alerts');
  const [selectedId, setSelectedId] = useState(null);
  const [severityFilter, setSev]    = useState(null);
  const [runningPipeline, setRunning] = useState(false);

  const { toasts, add: addToast } = useToast();
  const { data: stats, loading: statsLoading, refetch: refetchStats } = useStats();
  const { data: anomaliesData, loading: alertsLoading, refetch: refetchAlerts } = useAnomalies({
    status: 'open',
    severity: severityFilter || undefined,
    limit: 100,
  });

  const openCount = stats?.anomalies?.open_count ?? anomaliesData?.total ?? 0;
  const moneyAtRisk = stats?.anomalies?.total_money_at_risk ?? 0;

  const handleActionDone = useCallback((action) => {
    addToast(`✅ Action applied: "${action}"`, 'success');
    setSelectedId(null);
    refetchAlerts();
    refetchStats();
  }, [addToast, refetchAlerts, refetchStats]);

  const handleRunPipeline = useCallback(async () => {
    setRunning(true);
    addToast('🧠 Running ML pipeline…', 'info');
    try {
      const res = await api.runPipeline();
      addToast(`✅ Pipeline complete — ${res.anomalies_detected} anomalies detected`, 'success');
      refetchAlerts();
      refetchStats();
    } catch {
      addToast('⚠️ Backend offline — showing demo data', 'error');
    } finally {
      setRunning(false);
    }
  }, [addToast, refetchAlerts, refetchStats]);

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <Sidebar
        page={page}
        onNavigate={setPage}
        openCount={openCount}
        onRunPipeline={handleRunPipeline}
        runningPipeline={runningPipeline}
      />

      {/* Top bar */}
      <div className="topbar">
        <div>
          <div className="topbar-title">
            {page === 'alerts'   ? '🚨 Alert Feed'     : ''}
            {page === 'charts'   ? '📊 Analytics'      : ''}
            {page === 'resolved' ? '✅ Resolved Issues' : ''}
            {page === 'dataset'  ? '🗂️ Dataset & Model' : ''}
          </div>
          <div className="topbar-subtitle">
            {page === 'alerts' ? 'Ranked by Cost of Inaction — act on the top items first' : ''}
            {page === 'charts' ? 'Revenue, campaigns, returns & inventory health' : ''}
            {page === 'resolved' ? 'Issues that have been actioned' : ''}
            {page === 'dataset' ? 'Upload your data and train the anomaly detection model' : ''}
          </div>
        </div>
        <div className="topbar-spacer" />
        {page === 'alerts' && openCount > 0 && (
          <div className="topbar-badge">
            <span className="pulse-dot" />
            {openCount} active alerts
          </div>
        )}
        <span className="topbar-last-scan">
          Last scan: {new Date().toLocaleTimeString()}
        </span>
      </div>

      {/* Main content */}
      <div className="main-content">
        {/* Stats always visible on alerts page */}
        {page === 'alerts' && (
          <StatsBar stats={stats} loading={statsLoading} moneyAtRisk={moneyAtRisk} />
        )}

        {page === 'alerts' && (
          <div className="two-col">
            <div>
              <div className="section-header">
                <h2>Money Leaks — Prioritized</h2>
                <span className="section-header-count">{anomaliesData?.total ?? 0} open</span>
                <div className="section-spacer" />
                <div className="filter-row">
                  {['critical','high','medium','low'].map(s => (
                    <button
                      key={s}
                      className={`filter-btn ${s} ${severityFilter === s ? 'active' : ''}`}
                      onClick={() => setSev(severityFilter === s ? null : s)}
                    >
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <AlertFeed
                items={anomaliesData?.items ?? []}
                loading={alertsLoading}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </div>
            <SidePanel
              anomalyId={selectedId}
              onActionDone={handleActionDone}
            />
          </div>
        )}

        {page === 'charts'   && <ChartsPage />}
        {page === 'resolved' && <ResolvedPage />}
        {page === 'dataset'  && (
          <DatasetPage onProcessed={() => { refetchAlerts(); refetchStats(); }} />
        )}
      </div>

      <ToastContainer toasts={toasts} />
    </div>
  );
}
