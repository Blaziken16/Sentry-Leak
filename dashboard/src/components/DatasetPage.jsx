import { useEffect, useRef, useState } from 'react';
import { api } from '../api';

const FILES = ['products.csv', 'customers.csv', 'campaigns.csv', 'inventory.csv', 'transactions.csv'];

export default function DatasetPage({ onProcessed }) {
  const inputRef = useRef(null);
  const [selected, setSelected] = useState([]);
  const [dataset, setDataset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(null);

  const refresh = () => api.dataset().then(setDataset).catch(error => setMessage({ type: 'error', text: error.message }));
  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  const chooseFiles = event => {
    const files = Array.from(event.target.files || []);
    setSelected(files);
    setMessage(null);
  };

  const upload = async () => {
    if (!selected.length) return;
    setUploading(true);
    setMessage(null);
    try {
      const result = await api.uploadDataset(selected);
      setMessage({ type: 'success', text: `${result.message}. ${result.anomalies_detected} open alerts found.` });
      setSelected([]);
      if (inputRef.current) inputRef.current.value = '';
      setDataset({ ready: true, files: result.files });
      onProcessed?.();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="dataset-page">
      <div className="dataset-hero">
        <div>
          <div className="dataset-kicker">MODEL WORKSPACE</div>
          <h2>Train on your own retail data</h2>
          <p>Upload CSV files, replace the active dataset, and run all five anomaly detectors in one step.</p>
        </div>
        <div className="dataset-status">
          <span className={`status-dot ${dataset?.ready ? 'ready' : ''}`} />
          {loading ? 'Checking dataset…' : dataset?.ready ? 'Dataset ready' : 'No dataset loaded'}
        </div>
      </div>

      <div className="dataset-upload-card">
        <div className="upload-icon">↑</div>
        <h3>Upload CSV files</h3>
        <p>Upload transactions.csv, products.csv, and customers.csv. Campaigns and inventory are optional.</p>
        <input ref={inputRef} type="file" accept=".csv,text/csv" multiple onChange={chooseFiles} />
        <button className="choose-files-btn" onClick={() => inputRef.current?.click()}>
          Choose CSV files
        </button>
        {selected.length > 0 && (
          <div className="selected-files">
            {selected.map(file => <span key={file.name}>📄 {file.name}</span>)}
          </div>
        )}
        <button className="upload-submit-btn" disabled={!selected.length || uploading} onClick={upload}>
          {uploading ? '⏳ Uploading and training…' : '🧠 Upload & train model'}
        </button>
        {message && <div className={`dataset-message ${message.type}`}>{message.text}</div>}
      </div>

      <div className="dataset-lower-grid">
        <div className="dataset-card">
          <h3>Active dataset</h3>
          <p className="dataset-card-sub">Rows currently used by the model</p>
          <div className="dataset-counts">
            {FILES.map(file => (
              <div className="dataset-count" key={file}>
                <span>{file.replace('.csv', '')}</span>
                <strong>{dataset?.files?.[file.replace('.csv', '')] ?? 0}</strong>
              </div>
            ))}
          </div>
        </div>
        <div className="dataset-card">
          <h3>Expected file names</h3>
          <p className="dataset-card-sub">Column names are case-insensitive; ID columns are required.</p>
          <ul className="schema-list">
            <li><b>transactions.csv</b> — transaction_id, customer_id, product_id, net_revenue, status</li>
            <li><b>products.csv</b> — product_id, name, category, unit_cost, list_price</li>
            <li><b>customers.csv</b> — customer_id, segment</li>
            <li><b>campaigns.csv</b> — campaign_id, impressions, clicks, conversions, spend</li>
            <li><b>inventory.csv</b> — inventory_id, product_id, qty_on_hand</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
