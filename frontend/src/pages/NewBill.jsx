import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { EMPTY_ITEM, calcItemTotal, ItemSection } from '../components/BillItemSection';

export default function NewBill() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [settings, setSettings] = useState({ hamali_rate: 11 });
  const [customerId, setCustomerId] = useState('');
  const [billDate, setBillDate] = useState(new Date().toISOString().slice(0, 10));
  const [amountPaidBefore, setAmountPaidBefore] = useState('');
  const [amountPaidDate, setAmountPaidDate] = useState(new Date().toISOString().slice(0, 10));
  const [hamaliOverride, setHamaliOverride] = useState('');
  const [hamaliManuallyEdited, setHamaliManuallyEdited] = useState(false);
  const [totalCasesOverride, setTotalCasesOverride] = useState('');
  const [totalCasesManuallyEdited, setTotalCasesManuallyEdited] = useState(false);
  const [standardItems, setStandardItems] = useState([]);
  const [vedivelItems, setVedivelItems] = useState([]);
  const [othersItems, setOthersItems] = useState([]);
  const [sparklersItems, setSparklersItems] = useState([]);
  const [gunsItems, setGunsItems] = useState([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);
  const [newCustomer, setNewCustomer] = useState(false);
  const [newCustForm, setNewCustForm] = useState({ shop_name: '', customer_name: '', phone: '', location: '' });
  const [custSearch, setCustSearch] = useState('');
  const [rpCount, setRpCount] = useState('');

  useEffect(() => {
    api.get('/customers').then(r => setCustomers(r.data)).catch(() => {});
    api.get('/settings').then(r => {
      const map = {};
      r.data.forEach(s => { map[s.key] = s.value; });
      setSettings(map);
    }).catch(() => {});
  }, []);

  const allItems = [...standardItems, ...vedivelItems, ...othersItems, ...sparklersItems, ...gunsItems];
  const itemsCases = allItems.reduce((s, it) => s + (parseFloat(it.cases) || 0), 0);
  const totalCases = totalCasesManuallyEdited ? (parseFloat(totalCasesOverride) || 0) : itemsCases;
  const standardSubtotal = standardItems.reduce((s, it) => s + (it.total_amount || 0), 0);
  const vedivelSubtotal = vedivelItems.reduce((s, it) => s + (it.total_amount || 0), 0);
  const othersSubtotal = othersItems.reduce((s, it) => s + (it.total_amount || 0), 0);
  const sparklersSubtotal = sparklersItems.reduce((s, it) => s + (it.total_amount || 0), 0);
  const gunsSubtotal = gunsItems.reduce((s, it) => s + (it.total_amount || 0), 0);
  const autoHamali = totalCases * parseFloat(settings.hamali_rate || 11);
  const hamaliAmt = hamaliManuallyEdited ? (parseFloat(hamaliOverride) || 0) : autoHamali;
  const paid = parseFloat(amountPaidBefore) || 0;
  const grandTotal = standardSubtotal + vedivelSubtotal + othersSubtotal + sparklersSubtotal + gunsSubtotal + hamaliAmt - paid;

  const filteredCustomers = custSearch
    ? customers.filter(c => c.shop_name.toLowerCase().includes(custSearch.toLowerCase()) || c.customer_name.toLowerCase().includes(custSearch.toLowerCase()))
    : customers;

  async function handleCreateCustomer() {
    if (!newCustForm.shop_name || !newCustForm.customer_name) {
      alert('Shop name and customer name required');
      return;
    }
    try {
      const res = await api.post('/customers', newCustForm);
      setCustomers(c => [...c, res.data]);
      setCustomerId(String(res.data.id));
      setNewCustomer(false);
      setNewCustForm({ shop_name: '', customer_name: '', phone: '', location: '' });
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create customer');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!customerId) { setError('Please select a customer'); return; }
    if (allItems.length === 0) { setError('Add at least one item'); return; }

    const items = allItems.map(it => ({
      category: it.category,
      product_id: it.product_id || null,
      item_name: it.item_name,
      company_name: it.company_name || null,
      serial_number: it.serial_number,
      cases: parseFloat(it.cases) || 0,
      boxes: parseFloat(it.boxes) || 0,
      rate_per_box: parseFloat(it.rate_per_box) || 0,
      discount_percent: parseFloat(it.discount_percent) || 0,
    }));

    setSubmitting(true);
    try {
      const res = await api.post('/bills', {
        customer_id: parseInt(customerId),
        bill_date: billDate,
        items,
        amount_paid_before: paid,
        amount_paid_date: paid > 0 ? amountPaidDate : null,
        hamali_override: hamaliManuallyEdited
          ? (parseFloat(hamaliOverride) || null)
          : (totalCasesManuallyEdited ? autoHamali : null),
        rp_count: rpCount !== '' ? parseInt(rpCount) || null : null,
      });
      setSuccess(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create bill');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    const tunnelBase = localStorage.getItem('tunnel_url') || import.meta.env.VITE_PUBLIC_URL || window.location.origin;
    const approvalUrl = `${tunnelBase}/approval/${success.approval_token}`;
    const selectedCustomer = customers.find(c => String(c.id) === customerId);
    const shopName = selectedCustomer?.shop_name || '';
    const ownerPhone = settings.owner_phone || '';
    const waMessage = `New Bill for approval!\nBill No: ${success.bill_number}\nCustomer: ${shopName}\nGrand Total: Rs.${Number(success.grand_total).toFixed(2)}\nReview and approve: ${approvalUrl}`;

    function sendWhatsApp() {
      if (!ownerPhone) {
        alert('Owner WhatsApp number not set. Go to Settings to add it.');
        return;
      }
      window.open(
        `https://wa.me/91${ownerPhone}?text=${encodeURIComponent(waMessage)}`,
        '_blank'
      );
    }

    return (
      <div>
        <h1>Bill Created</h1>
        <div className="alert alert-success">
          Bill <strong>{success.bill_number}</strong> created successfully!
        </div>
        <div className="card" style={{ marginBottom: 16 }}>
          <p><strong>Grand Total:</strong> ₹{Number(success.grand_total).toFixed(2)}</p>
          <p><strong>Status:</strong> Pending approval</p>
          <p><strong>Approval Link:</strong></p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
            <input
              readOnly
              value={approvalUrl}
              style={{ flex: 1, padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 13, background: '#f8fafc' }}
            />
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() => {
                navigator.clipboard.writeText(approvalUrl);
                alert('Link copied!');
              }}
            >Copy</button>
          </div>

          <button
            type="button"
            onClick={sendWhatsApp}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: '#25d366', color: '#fff', border: 'none',
              borderRadius: 6, padding: '10px 18px', fontSize: 14,
              fontWeight: 600, cursor: 'pointer', marginBottom: 12,
            }}
          >
            <span style={{ fontSize: 18 }}>📲</span>
            Send to Owner via WhatsApp
          </button>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 6, padding: '10px 14px', fontSize: 13, color: '#92400e' }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
            <span>Make sure <strong>Cloudflare Tunnel</strong> is running so the owner can open the approval link from their phone.</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-primary" onClick={() => {
            setSuccess(null);
            setCustomerId(''); setStandardItems([]); setVedivelItems([]); setOthersItems([]);
            setSparklersItems([]); setGunsItems([]);
            setAmountPaidBefore(''); setAmountPaidDate(new Date().toISOString().slice(0, 10));
            setHamaliOverride(''); setHamaliManuallyEdited(false);
            setTotalCasesOverride(''); setTotalCasesManuallyEdited(false);
            setRpCount('');
          }}>New Bill</button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/pending-bills')}>View Pending Bills</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1>New Bill</h1>
      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        {/* Customer & Date */}
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>Bill Details</h3>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: 2, minWidth: 200 }}>
              <label>Customer *</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <input
                  type="text"
                  placeholder="Search customer..."
                  value={custSearch}
                  onChange={e => setCustSearch(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button type="button" className="btn btn-sm btn-secondary" onClick={() => setNewCustomer(v => !v)}>
                  {newCustomer ? 'Cancel' : '+ New'}
                </button>
              </div>
              <select value={customerId} onChange={e => setCustomerId(e.target.value)} required={!newCustomer}>
                <option value="">-- Select Customer --</option>
                {filteredCustomers.map(c => (
                  <option key={c.id} value={c.id}>{c.shop_name} — {c.customer_name}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: 140 }}>
              <label>Bill Date</label>
              <input type="date" value={billDate} onChange={e => setBillDate(e.target.value)} />
            </div>
          </div>

          {newCustomer && (
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: 14, marginTop: 8 }}>
              <h3 style={{ marginBottom: 10 }}>New Customer</h3>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div className="form-group" style={{ flex: 1, minWidth: 160 }}>
                  <label>Shop Name *</label>
                  <input value={newCustForm.shop_name} onChange={e => setNewCustForm(f => ({ ...f, shop_name: e.target.value }))} />
                </div>
                <div className="form-group" style={{ flex: 1, minWidth: 160 }}>
                  <label>Customer Name *</label>
                  <input value={newCustForm.customer_name} onChange={e => setNewCustForm(f => ({ ...f, customer_name: e.target.value }))} />
                </div>
                <div className="form-group" style={{ flex: 1, minWidth: 120 }}>
                  <label>Phone</label>
                  <input value={newCustForm.phone} onChange={e => setNewCustForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div className="form-group" style={{ flex: 1, minWidth: 160 }}>
                  <label>Location</label>
                  <input value={newCustForm.location} onChange={e => setNewCustForm(f => ({ ...f, location: e.target.value }))} />
                </div>
              </div>
              <button type="button" className="btn btn-sm btn-primary" onClick={handleCreateCustomer}>Create & Select</button>
            </div>
          )}
        </div>

        {/* Item sections */}
        <ItemSection category="standard" label="Standard Fireworks" items={standardItems} onItemsChange={setStandardItems} />
        <ItemSection category="vadivel" label="Vadivel Fireworks" items={vedivelItems} onItemsChange={setVedivelItems} />
        <ItemSection category="others" label="Others" items={othersItems} onItemsChange={setOthersItems} />
        <ItemSection category="sparklers" label="Sparklers" items={sparklersItems} onItemsChange={setSparklersItems} />
        <ItemSection category="guns" label="Guns" items={gunsItems} onItemsChange={setGunsItems} />

        {/* Totals */}
        <div className="card" style={{ maxWidth: 400, marginLeft: 'auto' }}>
          <h3>Bill Summary</h3>
          {standardSubtotal > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span>Standard Subtotal:</span><span>₹{standardSubtotal.toFixed(2)}</span></div>}
          {vedivelSubtotal > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span>Vadivel Subtotal:</span><span>₹{vedivelSubtotal.toFixed(2)}</span></div>}
          {othersSubtotal > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span>Others Subtotal:</span><span>₹{othersSubtotal.toFixed(2)}</span></div>}
          {sparklersSubtotal > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span>Sparklers Subtotal:</span><span>₹{sparklersSubtotal.toFixed(2)}</span></div>}
          {gunsSubtotal > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span>Guns Subtotal:</span><span>₹{gunsSubtotal.toFixed(2)}</span></div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span>Total Cases:</span>
            <input
              type="number" min={0}
              value={totalCasesManuallyEdited ? totalCasesOverride : itemsCases}
              onChange={e => { setTotalCasesOverride(e.target.value); setTotalCasesManuallyEdited(true); }}
              style={{ width: 90, padding: '4px 8px', border: `1px solid ${totalCasesManuallyEdited ? '#f59e0b' : '#cbd5e1'}`, borderRadius: 4, fontSize: 13, textAlign: 'right' }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              Hamali:
              {hamaliManuallyEdited && (
                <button
                  type="button"
                  onClick={() => { setHamaliManuallyEdited(false); setHamaliOverride(''); }}
                  style={{ fontSize: 11, padding: '1px 6px', border: '1px solid #94a3b8', borderRadius: 3, background: '#f1f5f9', color: '#475569', cursor: 'pointer' }}
                >Auto</button>
              )}
            </span>
            <input
              type="number" min={0} step="0.01"
              value={hamaliManuallyEdited ? hamaliOverride : autoHamali.toFixed(2)}
              onChange={e => { setHamaliOverride(e.target.value); setHamaliManuallyEdited(true); }}
              style={{ width: 90, padding: '4px 8px', border: `1px solid ${hamaliManuallyEdited ? '#f59e0b' : '#cbd5e1'}`, borderRadius: 4, fontSize: 13, textAlign: 'right' }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span>Amount Paid Before:</span>
            <input
              type="number" min={0} step="0.01"
              value={amountPaidBefore}
              onChange={e => setAmountPaidBefore(e.target.value)}
              placeholder="0"
              style={{ width: 90, padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 13, textAlign: 'right' }}
            />
          </div>
          {parseFloat(amountPaidBefore) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: '#64748b' }}>Payment Date:</span>
              <input
                type="date"
                value={amountPaidDate}
                onChange={e => setAmountPaidDate(e.target.value)}
                style={{ padding: '3px 6px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 12 }}
              />
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span>Total RP:</span>
            <input
              type="number" min={0}
              value={rpCount}
              onChange={e => setRpCount(e.target.value)}
              placeholder="optional"
              style={{ width: 90, padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 13, textAlign: 'right' }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 16, borderTop: '1px solid #e2e8f0', paddingTop: 10, marginTop: 6 }}>
            <span>Grand Total:</span>
            <span>₹{Math.round(grandTotal)}</span>
          </div>
        </div>

        <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
          <button type="submit" className="btn btn-primary" disabled={submitting} style={{ padding: '10px 28px' }}>
            {submitting ? 'Creating Bill...' : 'Create Bill'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/')}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
