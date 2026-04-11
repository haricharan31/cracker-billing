import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { pdf } from '@react-pdf/renderer';
import { BillPDFDocument } from '../components/BillPDF';
import api from '../services/api';

export default function ApprovalPage() {
  const { token } = useParams();
  const [bill, setBill] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | loaded | error | expired | done
  const [errorMsg, setErrorMsg] = useState('');
  const [rejectionComment, setRejectionComment] = useState('');
  const [actionResult, setActionResult] = useState('');
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get(`/approval/${token}`);
        setBill(res.data);
        setStatus('loaded');
      } catch (err) {
        if (err.response?.status === 410) {
          setStatus('expired');
        } else {
          setStatus('error');
          setErrorMsg(err.response?.data?.error || 'Invalid link');
        }
      }
    }
    load();
  }, [token]);

  async function handleApprove() {
    setSubmitting(true);
    try {
      await api.put(`/approval/${token}/approve`);
      setActionResult('approved');
      setStatus('done');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to approve');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDownloadPDF() {
    try {
      const blob = await pdf(<BillPDFDocument bill={bill} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${bill.bill_number}-${(bill.shop_name || 'bill').replace(/\s+/g, '_')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('PDF Error: ' + (err?.message || String(err)));
    }
  }

  async function handleReject() {
    setSubmitting(true);
    try {
      await api.put(`/approval/${token}/reject`, { rejection_comment: rejectionComment });
      setActionResult('rejected');
      setStatus('done');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to reject');
    } finally {
      setSubmitting(false);
    }
  }

  const pageStyle = { maxWidth: 700, margin: '0 auto', padding: 24, fontFamily: 'Segoe UI, sans-serif', fontSize: 14 };

  if (status === 'loading') return <div style={pageStyle}><p>Loading bill details...</p></div>;
  if (status === 'expired') return <div style={pageStyle}><div className="alert alert-error">This approval link has expired. Please ask the operator to resubmit the bill.</div></div>;
  if (status === 'error') return <div style={pageStyle}><div className="alert alert-error">{errorMsg}</div></div>;

  if (status === 'done' && actionResult === 'approved') {
    return (
      <div style={pageStyle}>
        <div style={{ textAlign: 'center', padding: '32px 0 24px' }}>
          <div style={{ fontSize: 64, marginBottom: 12 }}>✅</div>
          <h2 style={{ color: '#16a34a', margin: '0 0 8px' }}>Bill Approved!</h2>
          <p style={{ color: '#64748b', margin: 0, fontSize: 15 }}>
            Bill <strong>{bill.bill_number}</strong> for <strong>{bill.shop_name}</strong>
          </p>
          <p style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: '16px 0' }}>
            Grand Total: ₹{Number(bill.grand_total).toFixed(2)}
          </p>
          <button
            onClick={handleDownloadPDF}
            style={{
              background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8,
              padding: '14px 36px', fontSize: 16, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Download Invoice PDF
          </button>
        </div>
      </div>
    );
  }

  if (status === 'done' && actionResult === 'rejected') {
    return (
      <div style={pageStyle}>
        <div style={{ textAlign: 'center', padding: '32px 0 24px' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>❌</div>
          <h2 style={{ color: '#dc2626', margin: '0 0 8px' }}>Bill Rejected</h2>
          <p style={{ color: '#64748b', margin: '0 0 12px', fontSize: 15 }}>
            Bill <strong>{bill.bill_number}</strong> has been rejected. The operator will be notified.
          </p>
          {rejectionComment && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, padding: '10px 16px', fontSize: 14, color: '#7f1d1d', marginTop: 8, textAlign: 'left' }}>
              <strong>Reason:</strong> {rejectionComment}
            </div>
          )}
        </div>
      </div>
    );
  }

  const categoryItems = (cat) => bill.items?.filter(i => i.category === cat) || [];
  const hasStandard = categoryItems('standard').length > 0;
  const hasVadivel = categoryItems('vadivel').length > 0;
  const hasOthers = categoryItems('others').length > 0;
  const hasSparklers = categoryItems('sparklers').length > 0;
  const hasGuns = categoryItems('guns').length > 0;

  return (
    <div style={pageStyle}>
      <h2 style={{ color: '#1e293b' }}>Bill Approval — {bill.bill_number}</h2>
      <p style={{ color: '#64748b', marginBottom: 16 }}>
        Date: {bill.bill_date?.slice(0, 10)} &nbsp;|&nbsp; Status: <strong>{bill.status}</strong>
      </p>

      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: 16, marginBottom: 16 }}>
        <div><strong>Customer:</strong> {bill.shop_name} ({bill.customer_name})</div>
        {bill.phone && <div><strong>Phone:</strong> {bill.phone}</div>}
        {bill.location && <div><strong>Location:</strong> {bill.location}</div>}
      </div>

      {hasStandard && (
        <>
          <h3>Standard Fireworks</h3>
          <ItemTable items={categoryItems('standard')} />
          <div style={{ textAlign: 'right', marginBottom: 12 }}>Subtotal: <strong>₹{Number(bill.standard_subtotal).toFixed(2)}</strong></div>
        </>
      )}
      {hasVadivel && (
        <>
          <h3>Vadivel Fireworks</h3>
          <ItemTable items={categoryItems('vadivel')} />
          <div style={{ textAlign: 'right', marginBottom: 12 }}>Subtotal: <strong>₹{Number(bill.vadivel_subtotal).toFixed(2)}</strong></div>
        </>
      )}
      {hasOthers && (
        <>
          <h3>Others</h3>
          <ItemTable items={categoryItems('others')} showCompany />
          <div style={{ textAlign: 'right', marginBottom: 12 }}>Subtotal: <strong>₹{Number(bill.others_subtotal).toFixed(2)}</strong></div>
        </>
      )}
      {hasSparklers && (
        <>
          <h3>Sparklers</h3>
          <ItemTable items={categoryItems('sparklers')} />
          <div style={{ textAlign: 'right', marginBottom: 12 }}>Subtotal: <strong>₹{Number(bill.sparklers_subtotal || 0).toFixed(2)}</strong></div>
        </>
      )}
      {hasGuns && (
        <>
          <h3>Guns</h3>
          <ItemTable items={categoryItems('guns')} />
          <div style={{ textAlign: 'right', marginBottom: 12 }}>Subtotal: <strong>₹{Number(bill.guns_subtotal || 0).toFixed(2)}</strong></div>
        </>
      )}

      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span>Total Cases:</span><span>{bill.total_cases}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span>Hamali:</span><span>₹{Number(bill.hamali_amount).toFixed(2)}</span>
        </div>
        {Number(bill.amount_paid_before) > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span>Amount Paid Before:</span><span>- ₹{Number(bill.amount_paid_before).toFixed(2)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700, borderTop: '1px solid #e2e8f0', paddingTop: 8 }}>
          <span>Grand Total:</span><span>₹{Number(bill.grand_total).toFixed(2)}</span>
        </div>
      </div>

      {bill.status === 'pending' && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            className="btn btn-success"
            style={{ flex: 1, padding: '12px 20px', fontSize: 15 }}
            onClick={handleApprove}
            disabled={submitting}
          >
            Approve Bill
          </button>
          <button
            className="btn btn-danger"
            style={{ flex: 1, padding: '12px 20px', fontSize: 15 }}
            onClick={() => setShowRejectBox(true)}
            disabled={submitting}
          >
            Reject Bill
          </button>
        </div>
      )}

      {showRejectBox && (
        <div style={{ marginTop: 16 }}>
          <div className="form-group">
            <label>Rejection Reason (optional)</label>
            <textarea
              value={rejectionComment}
              onChange={e => setRejectionComment(e.target.value)}
              rows={3}
              placeholder="Enter reason for rejection..."
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => setShowRejectBox(false)}>Cancel</button>
            <button className="btn btn-danger" onClick={handleReject} disabled={submitting}>
              {submitting ? 'Rejecting...' : 'Confirm Rejection'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ItemTable({ items, showCompany }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 8 }}>
      <thead>
        <tr style={{ background: '#f1f5f9' }}>
          <th style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>#</th>
          <th style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Item</th>
          {showCompany && <th style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Company</th>}
          <th style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 600, color: '#475569' }}>Cases</th>
          <th style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 600, color: '#475569' }}>Boxes</th>
          <th style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 600, color: '#475569' }}>Rate/Box</th>
          <th style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 600, color: '#475569' }}>Disc%</th>
          <th style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 600, color: '#475569' }}>Rate After Disc</th>
          <th style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 600, color: '#475569' }}>Total</th>
        </tr>
      </thead>
      <tbody>
        {items.map(item => {
          const rate = Number(item.rate_per_box) || 0;
          const disc = Number(item.discount_percent) || 0;
          const rateAfterDisc = rate * (1 + disc / 100);
          return (
            <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '7px 10px' }}>{item.serial_number}</td>
              <td style={{ padding: '7px 10px' }}>{item.item_name}</td>
              {showCompany && <td style={{ padding: '7px 10px' }}>{item.company_name || '-'}</td>}
              <td style={{ padding: '7px 10px', textAlign: 'right' }}>{item.cases}</td>
              <td style={{ padding: '7px 10px', textAlign: 'right' }}>{item.boxes}</td>
              <td style={{ padding: '7px 10px', textAlign: 'right' }}>₹{rate.toFixed(2)}</td>
              <td style={{ padding: '7px 10px', textAlign: 'right' }}>{disc.toFixed(1)}%</td>
              <td style={{ padding: '7px 10px', textAlign: 'right' }}>₹{rateAfterDisc.toFixed(2)}</td>
              <td style={{ padding: '7px 10px', textAlign: 'right' }}><strong>₹{Number(item.total_amount).toFixed(2)}</strong></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
