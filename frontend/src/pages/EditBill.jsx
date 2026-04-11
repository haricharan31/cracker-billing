import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { EMPTY_ITEM, ItemSection } from '../components/BillItemSection';

function toFormItem(item) {
  return {
    ...EMPTY_ITEM(item.category, item.serial_number),
    product_id: item.product_id || null,
    item_name: item.item_name || '',
    company_name: item.company_name || '',
    cases: String(item.cases ?? ''),
    boxes: String(item.boxes ?? ''),
    boxes_per_case: '',
    rate_per_box: String(item.rate_per_box ?? ''),
    discount_percent: item.discount_percent ?? 0,
    total_amount: parseFloat(item.total_amount) || 0,
    serial_number: item.serial_number,
  };
}

export default function EditBill() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isResubmit = searchParams.get('resubmit') === 'true';

  const [loading, setLoading] = useState(true);
  const [billNumber, setBillNumber] = useState('');
  const [customers, setCustomers] = useState([]);
  const [settings, setSettings] = useState({ hamali_rate: 11 });
  const [customerId, setCustomerId] = useState('');
  const [billDate, setBillDate] = useState('');
  const [amountPaidBefore, setAmountPaidBefore] = useState('');
  const [hamaliOverride, setHamaliOverride] = useState('');
  const [standardItems, setStandardItems] = useState([]);
  const [vedivelItems, setVedivelItems] = useState([]);
  const [othersItems, setOthersItems] = useState([]);
  const [sparklersItems, setSparklersItems] = useState([]);
  const [gunsItems, setGunsItems] = useState([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resubmitSuccess, setResubmitSuccess] = useState(null); // holds response data after resubmit

  useEffect(() => {
    Promise.all([
      api.get(`/bills/${id}`),
      api.get('/customers'),
      api.get('/settings'),
    ]).then(([billRes, custRes, settingsRes]) => {
      const bill = billRes.data;
      const settingsMap = {};
      settingsRes.data.forEach(s => { settingsMap[s.key] = s.value; });

      setBillNumber(bill.bill_number);
      setCustomerId(String(bill.customer_id));
      setBillDate(bill.bill_date?.slice(0, 10) || '');
      setAmountPaidBefore(String(bill.amount_paid_before ?? ''));
      setCustomers(custRes.data);
      setSettings(settingsMap);

      // Detect manual hamali override
      const autoHamali = (bill.total_cases || 0) * parseFloat(settingsMap.hamali_rate || 11);
      if (Math.abs(parseFloat(bill.hamali_amount) - autoHamali) > 0.01) {
        setHamaliOverride(String(bill.hamali_amount));
      }

      const allItems = bill.items || [];
      setStandardItems(allItems.filter(i => i.category === 'standard').map(toFormItem));
      setVedivelItems(allItems.filter(i => i.category === 'vadivel').map(toFormItem));
      setOthersItems(allItems.filter(i => i.category === 'others').map(toFormItem));
      setSparklersItems(allItems.filter(i => i.category === 'sparklers').map(toFormItem));
      setGunsItems(allItems.filter(i => i.category === 'guns').map(toFormItem));
    }).catch(() => {
      setError('Failed to load bill. It may have been deleted.');
    }).finally(() => setLoading(false));
  }, [id]);

  const allItems = [...standardItems, ...vedivelItems, ...othersItems, ...sparklersItems, ...gunsItems];
  const totalCases = allItems.reduce((s, it) => s + (parseFloat(it.cases) || 0), 0);
  const standardSubtotal = standardItems.reduce((s, it) => s + (it.total_amount || 0), 0);
  const vedivelSubtotal = vedivelItems.reduce((s, it) => s + (it.total_amount || 0), 0);
  const othersSubtotal = othersItems.reduce((s, it) => s + (it.total_amount || 0), 0);
  const sparklersSubtotal = sparklersItems.reduce((s, it) => s + (it.total_amount || 0), 0);
  const gunsSubtotal = gunsItems.reduce((s, it) => s + (it.total_amount || 0), 0);
  const hamaliAmt = hamaliOverride !== '' ? parseFloat(hamaliOverride) || 0 : totalCases * parseFloat(settings.hamali_rate || 11);
  const paid = parseFloat(amountPaidBefore) || 0;
  const grandTotal = standardSubtotal + vedivelSubtotal + othersSubtotal + sparklersSubtotal + gunsSubtotal + hamaliAmt - paid;

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

    const payload = {
      customer_id: parseInt(customerId),
      bill_date: billDate,
      items,
      amount_paid_before: paid,
      hamali_override: hamaliOverride !== '' ? parseFloat(hamaliOverride) : null,
    };

    setSubmitting(true);
    try {
      const endpoint = isResubmit ? `/bills/${id}/resubmit` : `/bills/${id}`;
      const res = await api.put(endpoint, payload);

      if (isResubmit) {
        // Auto-open WhatsApp with new approval link
        const token = res.data.approval_token;
        const tunnelBase = localStorage.getItem('tunnel_url') || import.meta.env.VITE_PUBLIC_URL || window.location.origin;
        const approvalUrl = `${tunnelBase}/approval/${token}`;
        const shopName = customers.find(c => String(c.id) === customerId)?.shop_name || '';
        const ownerPhone = settings.owner_phone || '';
        const msg = `Bill resubmitted for approval!\nBill No: ${res.data.bill_number}\nCustomer: ${shopName}\nGrand Total: Rs.${Number(res.data.grand_total).toFixed(2)}\nReview and approve: ${approvalUrl}`;
        if (ownerPhone) {
          window.open(`https://wa.me/91${ownerPhone}?text=${encodeURIComponent(msg)}`, '_blank');
        }
        setResubmitSuccess({ ...res.data, approvalUrl, shopName });
      } else {
        navigate('/pending-bills');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update bill');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div><p className="text-muted">Loading bill...</p></div>;

  if (resubmitSuccess) {
    return (
      <div>
        <h1>Bill Resubmitted</h1>
        <div className="alert alert-success">
          Bill <strong>{resubmitSuccess.bill_number}</strong> resubmitted successfully!
        </div>
        <div className="card" style={{ marginBottom: 16 }}>
          <p><strong>Grand Total:</strong> ₹{Number(resubmitSuccess.grand_total).toFixed(2)}</p>
          <p><strong>Status:</strong> Pending approval</p>
          <p><strong>Approval Link:</strong></p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
            <input
              readOnly
              value={resubmitSuccess.approvalUrl}
              style={{ flex: 1, padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 13, background: '#f8fafc' }}
            />
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() => { navigator.clipboard.writeText(resubmitSuccess.approvalUrl); alert('Link copied!'); }}
            >Copy</button>
          </div>
          <button
            type="button"
            onClick={() => {
              const ownerPhone = settings.owner_phone || '';
              if (!ownerPhone) { alert('Owner WhatsApp number not set in Settings.'); return; }
              const msg = `Bill resubmitted for approval!\nBill No: ${resubmitSuccess.bill_number}\nCustomer: ${resubmitSuccess.shopName}\nGrand Total: Rs.${Number(resubmitSuccess.grand_total).toFixed(2)}\nReview and approve: ${resubmitSuccess.approvalUrl}`;
              window.open(`https://wa.me/91${ownerPhone}?text=${encodeURIComponent(msg)}`, '_blank');
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#25d366', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            <span style={{ fontSize: 18 }}>📲</span>
            Resend to Owner via WhatsApp
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/pending-bills')}>View Pending Bills</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1>{isResubmit ? `Resubmit Bill ${billNumber}` : `Edit Bill ${billNumber}`}</h1>
      </div>
      <div className="alert" style={{ background: isResubmit ? '#fef2f2' : '#fef9c3', border: `1px solid ${isResubmit ? '#fca5a5' : '#fde68a'}`, color: isResubmit ? '#b91c1c' : '#92400e', borderRadius: 6, padding: '10px 16px', marginBottom: 16, fontSize: 13 }}>
        {isResubmit
          ? <>This bill was <strong>rejected</strong>. Make the necessary changes and resubmit — a new approval link will be sent to the owner.</>
          : <>Saving will reset bill status to <strong>pending</strong> and generate a new approval link.</>
        }
      </div>
      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>Bill Details</h3>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: 2, minWidth: 200 }}>
              <label>Customer *</label>
              <select value={customerId} onChange={e => setCustomerId(e.target.value)} required>
                <option value="">-- Select Customer --</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.shop_name} — {c.customer_name}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: 140 }}>
              <label>Bill Date</label>
              <input type="date" value={billDate} onChange={e => setBillDate(e.target.value)} />
            </div>
          </div>
        </div>

        <ItemSection category="standard" label="Standard Fireworks" items={standardItems} onItemsChange={setStandardItems} />
        <ItemSection category="vadivel" label="Vadivel Fireworks" items={vedivelItems} onItemsChange={setVedivelItems} />
        <ItemSection category="others" label="Others" items={othersItems} onItemsChange={setOthersItems} />
        <ItemSection category="sparklers" label="Sparklers" items={sparklersItems} onItemsChange={setSparklersItems} />
        <ItemSection category="guns" label="Guns" items={gunsItems} onItemsChange={setGunsItems} />

        <div className="card" style={{ maxWidth: 400, marginLeft: 'auto' }}>
          <h3>Bill Summary</h3>
          {standardSubtotal > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span>Standard Subtotal:</span><span>₹{standardSubtotal.toFixed(2)}</span></div>}
          {vedivelSubtotal > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span>Vadivel Subtotal:</span><span>₹{vedivelSubtotal.toFixed(2)}</span></div>}
          {othersSubtotal > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span>Others Subtotal:</span><span>₹{othersSubtotal.toFixed(2)}</span></div>}
          {sparklersSubtotal > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span>Sparklers Subtotal:</span><span>₹{sparklersSubtotal.toFixed(2)}</span></div>}
          {gunsSubtotal > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span>Guns Subtotal:</span><span>₹{gunsSubtotal.toFixed(2)}</span></div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span>Total Cases:</span><span>{totalCases}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span>Hamali (₹{settings.hamali_rate}/case):</span>
            <input
              type="number" min={0} step="0.01"
              value={hamaliOverride}
              onChange={e => setHamaliOverride(e.target.value)}
              placeholder={hamaliAmt.toFixed(2)}
              style={{ width: 90, padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 13, textAlign: 'right' }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span>Amount Paid Before:</span>
            <input
              type="number" min={0} step="0.01"
              value={amountPaidBefore}
              onChange={e => setAmountPaidBefore(e.target.value)}
              placeholder="0"
              style={{ width: 90, padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 13, textAlign: 'right' }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 16, borderTop: '1px solid #e2e8f0', paddingTop: 10, marginTop: 6 }}>
            <span>Grand Total:</span>
            <span>₹{grandTotal.toFixed(2)}</span>
          </div>
        </div>

        <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
          <button type="submit" className="btn btn-primary" disabled={submitting} style={{ padding: '10px 28px' }}>
            {submitting ? (isResubmit ? 'Resubmitting...' : 'Saving...') : (isResubmit ? 'Resubmit Bill' : 'Save Bill')}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
