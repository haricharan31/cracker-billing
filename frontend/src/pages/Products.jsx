import { useState, useEffect } from 'react';
import api from '../services/api';

const CATEGORIES = ['standard', 'vadivel', 'others', 'sparklers', 'guns'];

function ProductModal({ product, initialCategory = 'standard', onClose, onSave }) {
  const [form, setForm] = useState(
    product || { category: initialCategory, item_name: '', boxes_per_case: 12, price_per_box: '', company_name: '' }
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
      if (product) {
        await api.put(`/products/${product.id}`, form);
      } else {
        await api.post('/products', form);
      }
      onSave();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>{product ? 'Edit Product' : 'Add Product'}</h2>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Category *</label>
            <select name="category" value={form.category} onChange={handleChange} disabled={!!product}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Item Name *</label>
            <input name="item_name" value={form.item_name} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>Boxes Per Case</label>
            <input type="number" name="boxes_per_case" value={form.boxes_per_case} onChange={handleChange} min={1} />
          </div>
          <div className="form-group">
            <label>Price Per Box (₹)</label>
            <input type="number" name="price_per_box" value={form.price_per_box} onChange={handleChange} min={0} step="0.01" />
          </div>
          {form.category === 'others' && (
            <div className="form-group">
              <label>Company Name</label>
              <input name="company_name" value={form.company_name || ''} onChange={handleChange} placeholder="e.g. Standard Fireworks" />
            </div>
          )}
          {product && (
            <div className="form-group">
              <label>Item Code</label>
              <input value={form.item_code || ''} disabled style={{ background: '#f1f5f9' }} />
            </div>
          )}
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

export default function Products() {
  const [products, setProducts] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);

  useEffect(() => { fetchProducts(); }, [filter]);

  async function fetchProducts() {
    try {
      const url = '/products' + (filter ? `?category=${filter}` : '');
      const res = await api.get(url);
      setProducts(res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Deactivate this product?')) return;
    try {
      await api.delete(`/products/${id}`);
      fetchProducts();
    } catch {
      // ignore
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Products</h1>
        <button className="btn btn-primary" onClick={() => setModal('add')}>+ Add Product</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {['', ...CATEGORIES].map(c => (
          <button
            key={c}
            className={`btn btn-sm ${filter === c ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter(c)}
          >
            {c || 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-muted">Loading...</p>
      ) : (
        <div className="table-wrap card">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Item Name</th>
                <th>Category</th>
                <th>Boxes/Case</th>
                <th>Price/Box</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr><td colSpan={6} className="text-muted" style={{ textAlign: 'center', padding: 20 }}>No products found</td></tr>
              ) : products.map(p => (
                <tr key={p.id}>
                  <td><code style={{ fontSize: 12 }}>{p.item_code}</code></td>
                  <td>{p.item_name}</td>
                  <td><span className="badge badge-pending" style={{ textTransform: 'capitalize' }}>{p.category}</span></td>
                  <td>{p.boxes_per_case}</td>
                  <td>₹{Number(p.price_per_box).toFixed(2)}</td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-sm btn-secondary" onClick={() => setModal(p)}>Edit</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(p.id)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <ProductModal
          product={modal === 'add' ? null : modal}
          initialCategory={filter || 'standard'}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); fetchProducts(); }}
        />
      )}
    </div>
  );
}
