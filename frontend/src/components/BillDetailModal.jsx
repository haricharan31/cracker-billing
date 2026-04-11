import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { pdf } from '@react-pdf/renderer';
import { BillPDFDocument } from './BillPDF';
import api from '../services/api';

const thS = { padding: '6px 8px', fontWeight: 600, color: '#64748b', textAlign: 'left', whiteSpace: 'nowrap', borderBottom: '1px solid #e2e8f0' };
const tdS = { padding: '6px 8px', borderBottom: '1px solid #f1f5f9' };

function ItemTable({ items, showCompany }) {
  if (!items || items.length === 0) return null;
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 4 }}>
      <thead>
        <tr style={{ background: '#f8fafc' }}>
          <th style={thS}>#</th>
          <th style={thS}>Item Name</th>
          {showCompany && <th style={thS}>Company</th>}
          <th style={thS}>Cases</th>
          <th style={thS}>Boxes</th>
          <th style={thS}>Rate/Box</th>
          <th style={thS}>Disc%</th>
          <th style={{ ...thS, textAlign: 'right' }}>Rate After Disc</th>
          <th style={{ ...thS, textAlign: 'right' }}>Total</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, i) => {
          const rate = Number(item.rate_per_box) || 0;
          const disc = Number(item.discount_percent) || 0;
          const rateAfterDisc = rate * (1 + disc / 100);
          return (
            <tr key={i}>
              <td style={tdS}>{item.serial_number}</td>
              <td style={tdS}>{item.item_name}</td>
              {showCompany && <td style={tdS}>{item.company_name || '-'}</td>}
              <td style={tdS}>{item.cases}</td>
              <td style={tdS}>{item.boxes}</td>
              <td style={tdS}>₹{rate.toFixed(2)}</td>
              <td style={tdS}>{disc.toFixed(1)}%</td>
              <td style={{ ...tdS, textAlign: 'right' }}>₹{rateAfterDisc.toFixed(2)}</td>
              <td style={{ ...tdS, textAlign: 'right', fontWeight: 600 }}>₹{Number(item.total_amount).toFixed(2)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function SummaryRow({ label, value, bold, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontWeight: bold ? 700 : 400, color: color || 'inherit' }}>
      <span>{label}:</span><span>{value}</span>
    </div>
  );
}

const inputStyle = { width: 100, padding: '3px 7px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 13, textAlign: 'right' };

export default function BillDetailModal({ bill, onClose, onDelete, onSave, onApproveReject, showDelete, isAdmin, showPDF }) {
  const navigate = useNavigate();

  const [editTotalCases, setEditTotalCases] = useState(String(bill.total_cases ?? ''));
  const [editHamali, setEditHamali] = useState(String(Number(bill.hamali_amount).toFixed(2)));
  const [editRpCount, setEditRpCount] = useState(bill.rp_count != null ? String(bill.rp_count) : '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectComment, setRejectComment] = useState('');

  const standard = (bill.items || []).filter(i => i.category === 'standard');
  const vadivel = (bill.items || []).filter(i => i.category === 'vadivel');
  const others = (bill.items || []).filter(i => i.category === 'others');
  const sparklers = (bill.items || []).filter(i => i.category === 'sparklers');
  const guns = (bill.items || []).filter(i => i.category === 'guns');

  const previewGrandTotal =
    Number(bill.standard_subtotal) +
    Number(bill.vadivel_subtotal) +
    Number(bill.others_subtotal) +
    Number(bill.sparklers_subtotal || 0) +
    Number(bill.guns_subtotal || 0) +
    (parseFloat(editHamali) || 0) -
    Number(bill.amount_paid_before);

  function handleDelete() {
    if (!window.confirm(`Delete bill ${bill.bill_number}? This cannot be undone.`)) return;
    api.delete(`/bills/${bill.id}`)
      .then(() => { onDelete && onDelete(bill.id); onClose(); })
      .catch(err => alert(err.response?.data?.error || 'Delete failed'));
  }

  async function handleSave() {
    setSaveError('');
    setSaving(true);
    try {
      const res = await api.patch(`/bills/${bill.id}`, {
        total_cases: parseFloat(editTotalCases) || 0,
        hamali_amount: parseFloat(editHamali) || 0,
        rp_count: editRpCount !== '' ? parseInt(editRpCount) || null : null,
      });
      onSave && onSave(res.data);
    } catch (err) {
      setSaveError(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove() {
    setApproving(true);
    try {
      await api.put(`/approval/${bill.approval_token}/approve`);
      onApproveReject && onApproveReject('approved');
      onClose();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to approve');
    } finally {
      setApproving(false);
    }
  }

  async function handleReject() {
    setRejecting(true);
    try {
      await api.put(`/approval/${bill.approval_token}/reject`, { rejection_comment: rejectComment });
      onApproveReject && onApproveReject('rejected');
      onClose();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to reject');
    } finally {
      setRejecting(false);
    }
  }

  async function handleDownloadPDF() {
    try {
      const blob = await pdf(<BillPDFDocument bill={bill} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${bill.bill_number}-${(bill.shop_name || 'bill').replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('PDF Error: ' + (err?.message || String(err)));
    }
  }

  async function handlePreviewPDF() {
    try {
      const blob = await pdf(<BillPDFDocument bill={bill} />).toBlob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      alert('PDF preview error: ' + (err?.message || String(err)));
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        overflowY: 'auto', padding: '32px 16px',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: '#fff', borderRadius: 10, width: '100%', maxWidth: 880,
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)', padding: '28px 32px',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22 }}>Bill #{bill.bill_number}</h2>
            <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
              Date: {bill.bill_date?.slice(0, 10)}
            </div>
          </div>
          <span className={`badge badge-${bill.status}`} style={{ fontSize: 13 }}>{bill.status}</span>
        </div>

        {/* Customer info */}
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', background: '#f8fafc', borderRadius: 8, padding: '12px 16px', marginBottom: 22, border: '1px solid #e2e8f0' }}>
          <div>
            <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>Shop</div>
            <div style={{ fontWeight: 700 }}>{bill.shop_name}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>Customer</div>
            <div>{bill.customer_name}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>Location</div>
            <div>{bill.location || '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>Phone</div>
            <div>{bill.phone || '—'}</div>
          </div>
        </div>

        {/* Items by category */}
        {standard.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, color: '#1e293b', borderBottom: '2px solid #e2e8f0', paddingBottom: 4 }}>Standard Fireworks</div>
            <ItemTable items={standard} showCompany={false} />
            <div style={{ textAlign: 'right', fontWeight: 600, color: '#475569', fontSize: 13, marginTop: 4 }}>
              Subtotal: ₹{Number(bill.standard_subtotal).toFixed(2)}
            </div>
          </div>
        )}

        {vadivel.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, color: '#1e293b', borderBottom: '2px solid #e2e8f0', paddingBottom: 4 }}>Vadivel Fireworks</div>
            <ItemTable items={vadivel} showCompany={false} />
            <div style={{ textAlign: 'right', fontWeight: 600, color: '#475569', fontSize: 13, marginTop: 4 }}>
              Subtotal: ₹{Number(bill.vadivel_subtotal).toFixed(2)}
            </div>
          </div>
        )}

        {others.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, color: '#1e293b', borderBottom: '2px solid #e2e8f0', paddingBottom: 4 }}>Others</div>
            <ItemTable items={others} showCompany={true} />
            <div style={{ textAlign: 'right', fontWeight: 600, color: '#475569', fontSize: 13, marginTop: 4 }}>
              Subtotal: ₹{Number(bill.others_subtotal).toFixed(2)}
            </div>
          </div>
        )}

        {sparklers.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, color: '#1e293b', borderBottom: '2px solid #e2e8f0', paddingBottom: 4 }}>Sparklers</div>
            <ItemTable items={sparklers} showCompany={false} />
            <div style={{ textAlign: 'right', fontWeight: 600, color: '#475569', fontSize: 13, marginTop: 4 }}>
              Subtotal: ₹{Number(bill.sparklers_subtotal || 0).toFixed(2)}
            </div>
          </div>
        )}

        {guns.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, color: '#1e293b', borderBottom: '2px solid #e2e8f0', paddingBottom: 4 }}>Guns</div>
            <ItemTable items={guns} showCompany={false} />
            <div style={{ textAlign: 'right', fontWeight: 600, color: '#475569', fontSize: 13, marginTop: 4 }}>
              Subtotal: ₹{Number(bill.guns_subtotal || 0).toFixed(2)}
            </div>
          </div>
        )}

        {/* Totals summary */}
        <div style={{ borderTop: '2px solid #e2e8f0', paddingTop: 16, marginTop: 8 }}>
          <div style={{ maxWidth: 340, marginLeft: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <span>Total Cases:</span>
              <input
                type="number" min={0}
                value={editTotalCases}
                onChange={e => setEditTotalCases(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <span>Hamali:</span>
              <input
                type="number" min={0} step="0.01"
                value={editHamali}
                onChange={e => setEditHamali(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <span>Total RP:</span>
              <input
                type="number" min={0}
                value={editRpCount}
                onChange={e => setEditRpCount(e.target.value)}
                placeholder="optional"
                style={inputStyle}
              />
            </div>
            <SummaryRow
              label={`Amount Paid Before${bill.amount_paid_date ? ` (${String(bill.amount_paid_date).slice(0, 10)})` : ''}`}
              value={`₹${Number(bill.amount_paid_before).toFixed(2)}`}
            />
            <div style={{ borderTop: '1px solid #e2e8f0', marginTop: 8, paddingTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontWeight: 700 }}>
                <span>Grand Total:</span>
                <span>₹{previewGrandTotal.toFixed(2)}</span>
              </div>
              <SummaryRow
                label="Balance Due"
                value={`₹${Number(bill.balance_due).toFixed(2)}`}
                bold
                color={Number(bill.balance_due) > 0 ? '#dc2626' : '#16a34a'}
              />
            </div>
            {saveError && <div style={{ color: '#dc2626', fontSize: 12, marginTop: 6 }}>{saveError}</div>}
          </div>
        </div>

        {/* Admin approve/reject */}
        {isAdmin && bill.status === 'pending' && bill.approval_token && (
          <div style={{ marginTop: 20, borderTop: '2px solid #e2e8f0', paddingTop: 16 }}>
            {!showRejectInput ? (
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  className="btn btn-sm"
                  style={{ background: '#dcfce7', color: '#16a34a', border: '1px solid #86efac', flex: 1, padding: '8px 0' }}
                  onClick={handleApprove}
                  disabled={approving || rejecting}
                >
                  {approving ? 'Approving...' : 'Approve Bill'}
                </button>
                <button
                  className="btn btn-sm"
                  style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', flex: 1, padding: '8px 0' }}
                  onClick={() => setShowRejectInput(true)}
                  disabled={approving || rejecting}
                >
                  Reject Bill
                </button>
              </div>
            ) : (
              <div>
                <textarea
                  value={rejectComment}
                  onChange={e => setRejectComment(e.target.value)}
                  placeholder="Rejection reason (optional)"
                  rows={2}
                  style={{ width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 13, marginBottom: 8, resize: 'vertical', boxSizing: 'border-box' }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-sm btn-secondary" onClick={() => { setShowRejectInput(false); setRejectComment(''); }}>Cancel</button>
                  <button
                    className="btn btn-sm"
                    style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5' }}
                    onClick={handleReject}
                    disabled={rejecting}
                  >
                    {rejecting ? 'Rejecting...' : 'Confirm Rejection'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PDF buttons — approved bills only */}
        {showPDF && (
          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-sm btn-primary" onClick={handleDownloadPDF}>
              Download PDF
            </button>
            <button type="button" className="btn btn-sm btn-secondary" onClick={handlePreviewPDF}>
              Preview PDF
            </button>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9', paddingTop: 16 }}>
          {showDelete && (
            <button
              className="btn btn-sm"
              style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5' }}
              onClick={handleDelete}
            >
              Delete
            </button>
          )}
          <button className="btn btn-sm btn-secondary" onClick={() => navigate(`/edit-bill/${bill.id}`)}>
            Edit
          </button>
          <button className="btn btn-sm btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button className="btn btn-sm btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
