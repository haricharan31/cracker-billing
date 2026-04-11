import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const SETTING_LABELS = {
  hamali_rate: 'Hamali Rate (₹ per case)',
  bill_prefix: 'Bill Number Prefix',
  business_name: 'Business Name',
  owner_phone: 'Owner WhatsApp Number (10 digits, no +91)',
  operator_phone: 'Operator WhatsApp Number (10 digits, no +91)',
};

const REQUIRED_SETTING_KEYS = Object.keys(SETTING_LABELS);

export default function Settings() {
  const { isAdmin } = useAuth();
  const [settings, setSettings] = useState([]);
  const [editing, setEditing] = useState({});
  const [saved, setSaved] = useState('');
  const [loading, setLoading] = useState(true);
  const [clearConfirm, setClearConfirm] = useState('');
  const [clearLoading, setClearLoading] = useState(false);
  const [clearMsg, setClearMsg] = useState('');
  const [tunnelUrl, setTunnelUrl] = useState(() => localStorage.getItem('tunnel_url') || '');
  const [tunnelSaved, setTunnelSaved] = useState(false);
  const [tunnelDetecting, setTunnelDetecting] = useState(false);
  const [tunnelDetectError, setTunnelDetectError] = useState('');

  useEffect(() => { fetchSettings(); }, []);

  async function fetchSettings() {
    try {
      const res = await api.get('/settings');
      const dbKeys = res.data.map(s => s.key);
      const full = [...res.data];
      // Ensure all required setting keys appear even if not yet in DB
      for (const k of REQUIRED_SETTING_KEYS) {
        if (!dbKeys.includes(k)) full.push({ key: k, value: '' });
      }
      setSettings(full);
      const vals = {};
      full.forEach(s => { vals[s.key] = s.value || ''; });
      setEditing(vals);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(key) {
    try {
      await api.put('/settings', { key, value: editing[key] });
      setSaved(key);
      setTimeout(() => setSaved(''), 2000);
    } catch {
      // ignore
    }
  }

  async function handleClearBills() {
    if (clearConfirm !== 'DELETE') return;
    setClearLoading(true);
    try {
      const res = await api.delete('/bills/clear-all');
      setClearMsg(`Done. ${res.data.count} bill(s) cleared.`);
      setClearConfirm('');
      setTimeout(() => setClearMsg(''), 6000);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to clear bills');
    } finally {
      setClearLoading(false);
    }
  }

  return (
    <div>
      <h1>Settings</h1>
      {loading ? (
        <p className="text-muted">Loading...</p>
      ) : (
        <div className="card" style={{ maxWidth: 500 }}>
          {settings.map(s => (
            <div key={s.key} className="form-group">
              <label>{SETTING_LABELS[s.key] || s.key}</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={editing[s.key] ?? ''}
                  onChange={e => setEditing(v => ({ ...v, [s.key]: e.target.value }))}
                />
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => handleSave(s.key)}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {saved === s.key ? 'Saved!' : 'Save'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Tunnel URL ── */}
      <div style={{ marginTop: 24, maxWidth: 500, background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: 20 }}>
        <h3 style={{ color: '#166534', marginTop: 0, marginBottom: 8 }}>Cloudflare Tunnel URL</h3>

        {/* Warning if not set */}
        {!tunnelUrl && (
          <div style={{ background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 13, color: '#c2410c', fontWeight: 600 }}>
            ⚠️ Tunnel URL not set — WhatsApp links will not work for owner
          </div>
        )}

        {/* Currently saved URL */}
        {tunnelUrl && (
          <div style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 13, color: '#166534' }}>
            ✓ Current URL: <strong style={{ wordBreak: 'break-all' }}>{tunnelUrl}</strong>
          </div>
        )}

        {/* Instructions */}
        <p style={{ color: '#374151', fontSize: 13, marginBottom: 12, lineHeight: 1.5 }}>
          <strong>Every morning:</strong> Start <code>start-all.bat</code>, then either click <strong>Auto-detect</strong> (reads from the tunnel window automatically) — or copy the <code>https://xxxx.trycloudflare.com</code> URL from the terminal and paste it below. Takes 10 seconds.
        </p>

        <button
          className="btn btn-primary"
          style={{ width: '100%', marginBottom: 12, fontSize: 14 }}
          disabled={tunnelDetecting}
          onClick={async () => {
            setTunnelDetecting(true);
            setTunnelDetectError('');
            try {
              const res = await api.get('/settings/tunnel-url');
              const val = res.data.url;
              localStorage.setItem('tunnel_url', val);
              setTunnelUrl(val);
              setTunnelSaved(true);
              setTimeout(() => setTunnelSaved(false), 3000);
            } catch (err) {
              setTunnelDetectError(err.response?.data?.error || 'Could not detect tunnel URL — is the tunnel running?');
            } finally {
              setTunnelDetecting(false);
            }
          }}
        >
          {tunnelDetecting ? 'Detecting...' : tunnelSaved ? '✓ URL Detected & Saved!' : '⚡ Auto-detect Tunnel URL'}
        </button>

        {tunnelDetectError && (
          <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 10 }}>{tunnelDetectError}</div>
        )}

        <p style={{ color: '#6b7280', fontSize: 12, marginBottom: 6, marginTop: 0 }}>Or paste manually:</p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            value={tunnelUrl}
            onChange={e => { setTunnelUrl(e.target.value); setTunnelSaved(false); }}
            placeholder="https://xxxx.trycloudflare.com"
            style={{ flex: 1, fontSize: 13 }}
          />
          <button
            className="btn btn-sm btn-primary"
            style={{ whiteSpace: 'nowrap' }}
            onClick={() => {
              const val = tunnelUrl.trim().replace(/\/$/, '');
              localStorage.setItem('tunnel_url', val);
              setTunnelUrl(val);
              setTunnelSaved(true);
              setTimeout(() => setTunnelSaved(false), 2000);
            }}
          >
            {tunnelSaved ? 'Saved!' : 'Save'}
          </button>
          {tunnelUrl && (
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => { setTunnelUrl(''); localStorage.removeItem('tunnel_url'); setTunnelSaved(false); }}
            >Clear</button>
          )}
        </div>
      </div>

      {isAdmin && (
        <div style={{
          marginTop: 32,
          maxWidth: 500,
          border: '1px solid #fca5a5',
          borderRadius: 8,
          padding: 20,
          background: '#fff5f5',
        }}>
          <h3 style={{ color: '#dc2626', marginTop: 0, marginBottom: 8 }}>Danger Zone — Season Reset</h3>
          <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>
            Permanently deletes ALL bills and bill items. Use this at the start of a new season only.
            Products and customers will not be affected.
          </p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              placeholder='Type "DELETE" to confirm'
              value={clearConfirm}
              onChange={e => setClearConfirm(e.target.value)}
              style={{ flex: 1 }}
            />
            <button
              className="btn btn-danger"
              disabled={clearConfirm !== 'DELETE' || clearLoading}
              onClick={handleClearBills}
              style={{ whiteSpace: 'nowrap' }}
            >
              {clearLoading ? 'Clearing...' : 'Clear All Bills'}
            </button>
          </div>
          {clearMsg && (
            <div className="alert alert-success" style={{ marginTop: 12, marginBottom: 0 }}>{clearMsg}</div>
          )}
        </div>
      )}
    </div>
  );
}
