import { api } from '../api';

export default function Sidebar({ page, onNavigate, openCount, onRunPipeline, runningPipeline }) {
  return (
    <nav className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">📡</div>
        <div>
          <div className="sidebar-logo-text">RetailIQ</div>
          <div className="sidebar-logo-sub">Intelligence Engine</div>
        </div>
      </div>

      <div className="sidebar-section-label">Monitor</div>

      <button
        className={`sidebar-nav-item ${page === 'alerts' ? 'active' : ''}`}
        onClick={() => onNavigate('alerts')}
      >
        🚨 Alert Feed
        {openCount > 0 && <span className="sidebar-badge">{openCount}</span>}
      </button>

      <button
        className={`sidebar-nav-item ${page === 'charts' ? 'active' : ''}`}
        onClick={() => onNavigate('charts')}
      >
        📊 Analytics
      </button>

      <button
        className={`sidebar-nav-item ${page === 'resolved' ? 'active' : ''}`}
        onClick={() => onNavigate('resolved')}
      >
        ✅ Resolved
      </button>

      <div className="sidebar-section-label" style={{ marginTop: 8 }}>Data</div>
      <button className="sidebar-nav-item" onClick={() => window.open('http://localhost:8000/docs', '_blank')}>
        📖 API Docs
      </button>

      <div className="sidebar-footer">
        <button
          className="sidebar-run-btn"
          onClick={onRunPipeline}
          disabled={runningPipeline}
        >
          {runningPipeline ? '⏳ Scanning...' : '🧠 Run ML Scan'}
        </button>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
          Isolation Forest · 5 detectors
        </div>
      </div>
    </nav>
  );
}
