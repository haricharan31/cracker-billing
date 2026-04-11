import { useState, useEffect } from 'react';
import api from '../services/api';

function CustomerModal({ customer, onClose, onSave, onNotFound }) {
  const [form, setForm] = useState(
    customer || { shop_name: '', customer_name: '', phone: '', location: '' }
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (customer) {
        await api.put(`/customers/${customer.id}`, form);
      } else {
        await api.post('/customers', form);
      }
      onSave();
    } catch (err) {
      if (err.response?.status === 404 && onNotFound) {
        onNotFound(customer?.id);
      } else {
        setError(err.response?.data?.error || 'Failed to save');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>{customer ? 'Edit Customer' : 'Add Customer'}</h2>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Shop Name *</label>
            <input name="shop_name" value={form.shop_name} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>Customer Name *</label>
            <input name="customer_name" value={form.customer_name} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>Phone</label>
            <input name="phone" value={form.phone || ''} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Location</label>
            <textarea name="location" value={form.location || ''} onChange={handleChange} rows={2} />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | 'add' | customer object
  const [deleteMsg, setDeleteMsg] = useState('');

  useEffect(() => { fetchCustomers(); }, []);

  async function fetchCustomers() {
    try {
      const res = await api.get('/customers' + (search ? `?search=${encodeURIComponent(search)}` : ''));
      setCustomers(res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e) {
    e.preventDefault();
    fetchCustomers();
  }

  async function handleDelete(c) {
    if (!window.confirm(`Are you sure you want to delete this customer?\n\n${c.shop_name} — ${c.customer_name}`)) return;
    try {
      await api.delete(`/customers/${c.id}`);
      setCustomers(prev => prev.filter(x => x.id !== c.id));
      setDeleteMsg(`Customer "${c.shop_name}" deleted successfully.`);
      setTimeout(() => setDeleteMsg(''), 4000);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete customer');
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Customers</h1>
        <button className="btn btn-primary" onClick={() => setModal('add')}>+ Add Customer</button>
      </div>

      {deleteMsg && <div className="alert alert-success">{deleteMsg}</div>}

      <form className="search-bar" onSubmit={handleSearch} style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          placeholder="Search by name or phone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button type="submit" className="btn btn-secondary btn-sm">Search</button>
      </form>

      {loading ? (
        <p className="text-muted">Loading...</p>
      ) : (
        <div className="table-wrap card">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Shop Name</th>
                <th>Customer Name</th>
                <th>Phone</th>
                <th>Location</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr><td colSpan={6} className="text-muted" style={{ textAlign: 'center', padding: 20 }}>No customers found</td></tr>
              ) : customers.map((c, i) => (
                <tr key={c.id}>
                  <td className="text-muted">{i + 1}</td>
                  <td><strong>{c.shop_name}</strong></td>
                  <td>{c.customer_name}</td>
                  <td>{c.phone || '-'}</td>
                  <td>{c.location || '-'}</td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-sm btn-secondary" onClick={() => setModal(c)}>Edit</button>
                    <button
                      className="btn btn-sm"
                      style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5' }}
                      onClick={() => handleDelete(c)}
                    >Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <CustomerModal
          customer={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); fetchCustomers(); }}
          onNotFound={id => {
            setModal(null);
            setCustomers(prev => prev.filter(x => x.id !== id));
            setDeleteMsg('This customer has been deleted.');
            setTimeout(() => setDeleteMsg(''), 4000);
          }}
        />
      )}
    </div>
  );
}
