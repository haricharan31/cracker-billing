import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '../services/api';

export const EMPTY_ITEM = (category, serial) => ({
  category,
  product_id: null,
  item_name: '',
  company_name: '',
  cases: '',
  boxes: '',
  boxes_per_case: '',
  rate_per_box: '',
  discount_percent: 0,
  total_amount: 0,
  serial_number: serial,
  _key: Math.random(),
});

export function calcItemTotal(item) {
  const boxes = parseFloat(item.boxes) || 0;
  const rate = parseFloat(item.rate_per_box) || 0;
  const disc = parseFloat(item.discount_percent) || 0;
  return parseFloat((boxes * rate * (1 + disc / 100)).toFixed(2));
}

function ItemRow({ item, onUpdate, onRemove, category }) {
  const [suggestions, setSuggestions] = useState([]);
  const [dropdownRect, setDropdownRect] = useState(null);
  const searchTimer = useRef(null);
  const blurTimer = useRef(null);
  const inputRef = useRef(null);
  const latestItemRef = useRef(item);
  useEffect(() => { latestItemRef.current = item; }, [item]);

  function refreshDropdownPos() {
    if (inputRef.current) {
      const r = inputRef.current.getBoundingClientRect();
      setDropdownRect({ top: r.bottom + 2, left: r.left, width: r.width });
    }
  }

  // Cases ↔ Boxes two-way auto-calc
  function handleFieldChange(field, value) {
    const updated = { ...item, [field]: value };
    const bpc = parseFloat(item.boxes_per_case) || 0;

    if (field === 'cases' && bpc > 0) {
      // cases → boxes
      updated.boxes = String((parseFloat(value) || 0) * bpc);
    } else if (field === 'boxes' && bpc > 0) {
      // boxes → cases (floor, boxes field stays as-is for total calc)
      updated.cases = String(Math.floor((parseFloat(value) || 0) / bpc));
    }

    updated.total_amount = calcItemTotal(updated);
    onUpdate(updated);
  }

  function handleNameInput(val) {
    // Propagate item_name change immediately
    const updated = { ...item, item_name: val };
    updated.total_amount = calcItemTotal(updated);
    onUpdate(updated);

    clearTimeout(searchTimer.current);
    if (val.length < 2) { setSuggestions([]); return; }

    refreshDropdownPos();
    searchTimer.current = setTimeout(async () => {
      try {
        const url = `/products/search?q=${encodeURIComponent(val)}&category=${encodeURIComponent(category)}`;
        const res = await api.get(url);
        setSuggestions(res.data);
        refreshDropdownPos();
      } catch {
        setSuggestions([]);
      }
    }, 200);
  }

  function selectProduct(prod) {
    clearTimeout(blurTimer.current);
    const updated = {
      ...item,
      product_id: prod.id,
      item_name: prod.item_name,
      rate_per_box: String(prod.price_per_box ?? ''),
      boxes_per_case: String(prod.boxes_per_case ?? ''),
      company_name:
        category === 'others' ? (prod.company_name || item.company_name) : item.company_name,
    };
    updated.total_amount = calcItemTotal(updated);
    onUpdate(updated);
    setSuggestions([]);
  }

  function handleBlur() {
    // Delay so onMouseDown on a suggestion fires first
    blurTimer.current = setTimeout(() => setSuggestions([]), 150);
  }

  async function autoSaveProduct() {
    const it = latestItemRef.current;
    // Only auto-save for Others category when manually typed (no product_id)
    if (it.category !== 'others') return;
    if (it.product_id || !it.item_name.trim() || !it.company_name.trim() || !it.rate_per_box) return;
    try {
      const payload = {
        category: it.category,
        item_name: it.item_name.trim(),
        price_per_box: parseFloat(it.rate_per_box) || 0,
        boxes_per_case: parseInt(it.boxes_per_case) || 12,
      };
      if (it.category === 'others') payload.company_name = it.company_name || null;
      const res = await api.post('/products', payload);
      onUpdate({ ...latestItemRef.current, product_id: res.data.id });
    } catch (err) {
      if (err.response?.status === 409 && err.response?.data?.id) {
        onUpdate({ ...latestItemRef.current, product_id: err.response.data.id });
      }
      // Silently ignore all other errors
    }
  }

  const showCompany = category === 'others';

  return (
    <tr>
      <td style={{ padding: '4px 6px', color: '#64748b' }}>{item.serial_number}</td>

      {/* Item name cell — dropdown rendered via portal to escape overflow:auto */}
      <td style={{ padding: '4px 6px', minWidth: 180 }}>
        <input
          ref={inputRef}
          value={item.item_name}
          onChange={e => handleNameInput(e.target.value)}
          onBlur={handleBlur}
          onFocus={refreshDropdownPos}
          placeholder="Item name"
          autoComplete="off"
          style={{ width: '100%', padding: '5px 8px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 13 }}
        />
        {suggestions.length > 0 && dropdownRect && createPortal(
          <div style={{
            position: 'fixed',
            top: dropdownRect.top,
            left: dropdownRect.left,
            width: dropdownRect.width,
            background: '#fff',
            border: '1px solid #ccc',
            borderRadius: 4,
            zIndex: 9999,
            maxHeight: 220,
            overflowY: 'auto',
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          }}>
            {suggestions.map(p => (
              <div
                key={p.id}
                onMouseDown={() => selectProduct(p)}
                style={{ padding: '8px 10px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #f1f5f9' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f0f9ff'}
                onMouseLeave={e => e.currentTarget.style.background = '#fff'}
              >
                <span style={{ color: '#94a3b8', fontFamily: 'monospace', fontSize: 11, marginRight: 4 }}>
                  {p.item_code}
                </span>
                {' - '}
                <strong>{p.item_name}</strong>
                {p.company_name && (
                  <span style={{ color: '#64748b', fontSize: 12 }}> ({p.company_name})</span>
                )}
                {' '}
                <span style={{ color: '#64748b', fontSize: 12 }}>₹{p.price_per_box}</span>
              </div>
            ))}
          </div>,
          document.body
        )}
      </td>

      {showCompany && (
        <td style={{ padding: '4px 6px' }}>
          <input
            value={item.company_name}
            onChange={e => handleFieldChange('company_name', e.target.value)}
            placeholder="Company"
            style={{ width: '100%', padding: '5px 8px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 13 }}
          />
        </td>
      )}

      <td style={{ padding: '4px 6px' }}>
        <input
          type="number" min={0} value={item.cases}
          onChange={e => handleFieldChange('cases', e.target.value)}
          style={{ width: 60, padding: '5px 6px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 13 }}
        />
      </td>

      <td style={{ padding: '4px 6px' }}>
        <input
          type="number" min={0} value={item.boxes}
          onChange={e => handleFieldChange('boxes', e.target.value)}
          style={{ width: 60, padding: '5px 6px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 13 }}
        />
      </td>

      <td style={{ padding: '4px 6px' }}>
        <input
          type="number" min={0} step="0.01" value={item.rate_per_box}
          onChange={e => handleFieldChange('rate_per_box', e.target.value)}
          onBlur={autoSaveProduct}
          style={{ width: 80, padding: '5px 6px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 13 }}
        />
      </td>

      <td style={{ padding: '4px 6px' }}>
        <input
          type="number" step="0.01" value={item.discount_percent}
          onChange={e => handleFieldChange('discount_percent', e.target.value)}
          onBlur={autoSaveProduct}
          style={{ width: 55, padding: '5px 6px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 13 }}
        />
      </td>

      <td style={{ padding: '4px 6px', textAlign: 'right', color: '#475569', fontSize: 12 }}>
        {(() => {
          const r = parseFloat(item.rate_per_box) || 0;
          const d = parseFloat(item.discount_percent) || 0;
          const rad = r * (1 + d / 100);
          return rad > 0 ? `₹${rad.toFixed(2)}` : '';
        })()}
      </td>

      <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 600 }}>
        ₹{item.total_amount.toFixed(2)}
      </td>

      <td style={{ padding: '4px 6px' }}>
        <button
          type="button"
          onClick={onRemove}
          style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}
        >✕</button>
      </td>
    </tr>
  );
}

export function ItemSection({ category, label, items, onItemsChange }) {
  function addRow() {
    onItemsChange([...items, EMPTY_ITEM(category, items.length + 1)]);
  }

  function updateItem(idx, updated) {
    const next = [...items];
    next[idx] = updated;
    onItemsChange(next);
  }

  function removeItem(idx) {
    const next = items
      .filter((_, i) => i !== idx)
      .map((it, i) => ({ ...it, serial_number: i + 1 }));
    onItemsChange(next);
  }

  const subtotal = items.reduce((s, it) => s + (it.total_amount || 0), 0);
  const showCompany = category === 'others';

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ marginBottom: 10 }}>
        <h3 style={{ margin: 0 }}>{label}</h3>
      </div>

      {items.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: '6px', color: '#64748b', fontWeight: 600, textAlign: 'left', width: 30 }}>#</th>
                <th style={{ padding: '6px', color: '#64748b', fontWeight: 600, textAlign: 'left' }}>Item Name</th>
                {showCompany && <th style={{ padding: '6px', color: '#64748b', fontWeight: 600, textAlign: 'left' }}>Company</th>}
                <th style={{ padding: '6px', color: '#64748b', fontWeight: 600, textAlign: 'left' }}>Cases</th>
                <th style={{ padding: '6px', color: '#64748b', fontWeight: 600, textAlign: 'left' }}>Boxes</th>
                <th style={{ padding: '6px', color: '#64748b', fontWeight: 600, textAlign: 'left' }}>Rate/Box</th>
                <th style={{ padding: '6px', color: '#64748b', fontWeight: 600, textAlign: 'left' }}>Disc%</th>
                <th style={{ padding: '6px', color: '#64748b', fontWeight: 600, textAlign: 'right' }}>Rate After Disc</th>
                <th style={{ padding: '6px', color: '#64748b', fontWeight: 600, textAlign: 'right' }}>Total</th>
                <th style={{ padding: '6px', width: 30 }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <ItemRow
                  key={item._key}
                  item={{ ...item, serial_number: idx + 1 }}
                  category={category}
                  onUpdate={updated => updateItem(idx, { ...updated, serial_number: idx + 1 })}
                  onRemove={() => removeItem(idx)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {items.length === 0 && (
        <p className="text-muted" style={{ fontSize: 13 }}>No items added yet.</p>
      )}

      <button type="button" className="btn btn-sm btn-secondary" onClick={addRow} style={{ marginTop: 8, width: '100%' }}>+ Add Row</button>

      {items.length > 0 && (
        <div style={{ textAlign: 'right', marginTop: 8, fontWeight: 600 }}>
          Subtotal: ₹{subtotal.toFixed(2)}
        </div>
      )}
    </div>
  );
}
