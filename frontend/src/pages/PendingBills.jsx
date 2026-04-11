import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import BillDetailModal from '../components/BillDetailModal';
import { useAuth } from '../context/AuthContext';

export default function PendingBills() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBill, setSelectedBill] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => { fetchBills(); }, []);

  async function fetchBills() {
    try {
      const res = await api.get('/bills');
      setBills(res.data.filter(b => b.status === 'pending' || b.status === 'rejected'));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function openBill(id) {
    setModalLoading(true);
    try {
      const res = await api.get(`/bills/${id}`);
      setSelectedBill(res.data);
    } catch (err) {
      if (err.response?.status === 404) {
        setBills(prev => prev.filter(b => b.id !== id));
        alert('This record has been deleted.');
      } else {
        alert('Failed to load bill details');
      }
    } finally {
      setModalLoading(false);
    }
  }

  function copyLink(e, token) {
    e.stopPropagation();
    const link = `${window.location.origin}/approval/${token}`;
    navigator.clipboard.writeText(link).catch(() => {});
    alert('Approval link copied to clipboard');
  }

  return (
    <div>
      <div className="page-header">
        <h1>Pending & Rejected Bills</h1>
      </div>

      {modalLoading && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)',
          zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ background: '#fff', padding: '24px 40px', borderRadius: 8, fontSize: 15 }}>Loading...</div>
        </div>
      )}

      {selectedBill && (
        <BillDetailModal
          bill={selectedBill}
          showDelete={true}
          isAdmin={isAdmin}
          onClose={() => setSelectedBill(null)}
          onDelete={id => setBills(prev => prev.filter(b => b.id !== id))}
          onSave={updated => {
            setBills(prev => prev.map(b => b.id === updated.id ? { ...b, ...updated } : b));
            setSelectedBill(updated);
          }}
          onApproveReject={() => { fetchBills(); setSelectedBill(null); }}
        />
      )}

      {loading ? (
        <p className="text-muted">Loading...</p>
      ) : bills.length === 0 ? (
        <div className="card"><p className="text-muted">No pending or rejected bills.</p></div>
      ) : (
        <div className="table-wrap card">
          <table>
            <thead>
              <tr>
                <th>Bill No.</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Grand Total</th>
                <th>Status</th>
                <th>Rejection Reason</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bills.map(bill => (
                <tr
                  key={bill.id}
                  onClick={() => openBill(bill.id)}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}
                >
                  <td><strong>{bill.bill_number}</strong></td>
                  <td>{bill.bill_date?.slice(0, 10)}</td>
                  <td>
                    <div>{bill.shop_name}</div>
                    <div className="text-muted">{bill.customer_name}</div>
                  </td>
                  <td>₹{Number(bill.grand_total).toFixed(2)}</td>
                  <td>
                    <span className={`badge badge-${bill.status}`}>{bill.status}</span>
                  </td>
                  <td>
                    {bill.rejection_comment ? (
                      <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 4, padding: '4px 8px', fontSize: 12, color: '#b91c1c', maxWidth: 220 }}>
                        {bill.rejection_comment}
                      </div>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {bill.status === 'pending' && bill.approval_token && (
                        <button className="btn btn-sm btn-secondary" onClick={e => copyLink(e, bill.approval_token)}>
                          Copy Link
                        </button>
                      )}
                      {bill.status === 'rejected' && (
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => navigate(`/edit-bill/${bill.id}?resubmit=true`)}
                        >
                          Edit &amp; Resubmit
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
