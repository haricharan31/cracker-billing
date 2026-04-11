import { useState, useEffect } from 'react';
import api from '../services/api';
import BillDetailModal from '../components/BillDetailModal';

export default function ApprovedBills() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBill, setSelectedBill] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    async function fetchBills() {
      try {
        const res = await api.get('/bills?status=approved');
        setBills(res.data);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    fetchBills();
  }, []);

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

  return (
    <div>
      <div className="page-header">
        <h1>Approved Bills</h1>
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
          showDelete={false}
          showPDF={true}
          onClose={() => setSelectedBill(null)}
          onSave={updated => {
            setBills(prev => prev.map(b => b.id === updated.id ? { ...b, ...updated } : b));
            setSelectedBill(updated);
          }}
        />
      )}

      {loading ? (
        <p className="text-muted">Loading...</p>
      ) : bills.length === 0 ? (
        <div className="card"><p className="text-muted">No approved bills yet.</p></div>
      ) : (
        <div className="table-wrap card">
          <table>
            <thead>
              <tr>
                <th>Bill No.</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Standard</th>
                <th>Vadivel</th>
                <th>Others</th>
                <th>Hamali</th>
                <th>Grand Total</th>
                <th>Balance Due</th>
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
                  <td>₹{Number(bill.standard_subtotal).toFixed(2)}</td>
                  <td>₹{Number(bill.vadivel_subtotal).toFixed(2)}</td>
                  <td>₹{Number(bill.others_subtotal).toFixed(2)}</td>
                  <td>₹{Number(bill.hamali_amount).toFixed(2)}</td>
                  <td><strong>₹{Number(bill.grand_total).toFixed(2)}</strong></td>
                  <td style={{ color: Number(bill.balance_due) > 0 ? '#dc2626' : '#16a34a' }}>
                    ₹{Number(bill.balance_due).toFixed(2)}
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
