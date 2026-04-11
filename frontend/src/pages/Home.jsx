import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function Home() {
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchCounts() {
      try {
        const res = await api.get('/bills');
        const bills = res.data;
        setCounts({
          pending: bills.filter(b => b.status === 'pending').length,
          approved: bills.filter(b => b.status === 'approved').length,
          rejected: bills.filter(b => b.status === 'rejected').length,
        });
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    fetchCounts();
  }, []);

  return (
    <div>
      <h1>Dashboard</h1>
      {loading ? (
        <p className="text-muted">Loading...</p>
      ) : (
        <div className="home-cards">
          <div className="home-card orange" onClick={() => navigate('/pending-bills')}>
            <div className="card-count">{counts.pending}</div>
            <div className="card-label">Pending Bills</div>
          </div>
          <div className="home-card green" onClick={() => navigate('/approved-bills')}>
            <div className="card-count">{counts.approved}</div>
            <div className="card-label">Approved Bills</div>
          </div>
          <div className="home-card" onClick={() => navigate('/new-bill')}>
            <div className="card-count">+</div>
            <div className="card-label">New Bill</div>
          </div>
          {counts.rejected > 0 && (
            <div className="home-card" style={{ borderColor: '#dc2626' }} onClick={() => navigate('/pending-bills')}>
              <div className="card-count" style={{ color: '#dc2626' }}>{counts.rejected}</div>
              <div className="card-label">Rejected Bills</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
