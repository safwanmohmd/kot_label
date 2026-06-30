import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Printer,
  FileDown,
  Pencil,
  Trash2,
  Package,
  ChevronDown,
  ChevronUp,
  X,
  Eye,
} from 'lucide-react';
import { fetchLabels, deleteLabel, markPrinted } from '../lib/labels.js';
import { CUSTOM_LABEL_SIZE_KEY, useSettings } from '../lib/settings.js';
import { useToast } from '../lib/useToast.jsx';
import { exportLabelToPdf } from '../lib/pdf.js';
import { buildPrintDocument, printHtml } from '../lib/print.js';
import { getLabelSize } from '../types/label.js';
import { Barcode } from '../components/Barcode.jsx';

export function LabelHistory() {
  const [settings] = useSettings();
  const toast = useToast();
  const [labels, setLabels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [courierFilter, setCourierFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortKey, setSortKey] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');
  const [selected, setSelected] = useState(new Set());
  const [previewLabel, setPreviewLabel] = useState(null);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchLabels();
        if (!cancelled) setLabels(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const couriers = useMemo(() => {
    const set = new Set();
    for (const l of labels) if (l.courier_name) set.add(l.courier_name);
    return Array.from(set).sort();
  }, [labels]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = labels.filter((l) => {
      if (courierFilter !== 'all' && l.courier_name !== courierFilter) return false;
      if (statusFilter !== 'all' && l.status !== statusFilter) return false;
      if (!q) return true;
      return (
        l.tracking_id.toLowerCase().includes(q) ||
        l.receiver_name.toLowerCase().includes(q) ||
        (l.receiver_city ?? '').toLowerCase().includes(q) ||
        (l.courier_name ?? '').toLowerCase().includes(q)
      );
    });
    out = [...out].sort((a, b) => {
      let cmp = 0;
      const av = String(a[sortKey] ?? '');
      const bv = String(b[sortKey] ?? '');
      if (sortKey === 'print_count') {
        cmp = (a.print_count ?? 0) - (b.print_count ?? 0);
      } else if (sortKey === 'created_at') {
        cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else {
        cmp = av.localeCompare(bv);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return out;
  }, [labels, search, courierFilter, statusFilter, sortKey, sortDir]);

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  function toggleSelect(id) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((l) => l.id)));
    }
  }

  async function handlePrint(label) {
    try {
      const size = label.label_size === CUSTOM_LABEL_SIZE_KEY
        ? { widthMm: settings.customLabelSize.widthMm, heightMm: settings.customLabelSize.heightMm, layout: 'full' }
        : getLabelSize(label.label_size);
      const html = renderSinglePrintHtml(label, settings.organizationName, settings);
      const doc = buildPrintDocument(html, { w: size.widthMm, h: size.heightMm });
      printHtml(doc);
      markPrinted(label.id).catch(() => {});
      toast('Sent to printer.', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Print failed', 'error');
    }
  }

  async function handlePdf(label) {
    try {
      await exportLabelToPdf(label, { ...settings.barcode, type: label.barcode_type }, settings);
      toast('PDF downloaded.', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Export failed', 'error');
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this label? This cannot be undone.')) return;
    setDeleting(id);
    try {
      await deleteLabel(id);
      setLabels((l) => l.filter((x) => x.id !== id));
      setSelected((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
      toast('Label deleted.', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Delete failed', 'error');
    } finally {
      setDeleting(null);
    }
  }

  async function handleBulkPrint() {
    const targets = filtered.filter((l) => selected.has(l.id));
    if (targets.length === 0) return;
    for (const label of targets) {
      await handlePrint(label);
    }
  }

  async function handleBulkPdf() {
    const targets = filtered.filter((l) => selected.has(l.id));
    if (targets.length === 0) return;
    for (const label of targets) {
      await handlePdf(label);
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="card p-4">
        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
            <input
              className="input pl-10"
              placeholder="Search by tracking ID, receiver, city, or courier…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <select
              className="input min-w-[140px]"
              value={courierFilter}
              onChange={(e) => setCourierFilter(e.target.value)}
            >
              <option value="all">All couriers</option>
              {couriers.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select
              className="input min-w-[120px]"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All status</option>
              <option value="created">Created</option>
              <option value="printed">Printed</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="card p-3 flex items-center gap-2 animate-fade-in">
          <span className="text-sm font-semibold text-ink-700 px-2">
            {selected.size} selected
          </span>
          <button onClick={handleBulkPrint} className="btn-secondary text-xs">
            <Printer className="h-3.5 w-3.5" /> Print Selected
          </button>
          <button onClick={handleBulkPdf} className="btn-secondary text-xs">
            <FileDown className="h-3.5 w-3.5" /> Export PDFs
          </button>
          <button onClick={() => setSelected(new Set())} className="btn-ghost text-xs ml-auto">
            Clear selection
          </button>
        </div>
      )}

      <div className="card">
        {loading ? (
          <div className="p-10 text-center text-sm text-ink-400">Loading labels…</div>
        ) : error ? (
          <div className="p-6 text-sm text-red-700 bg-red-50">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <Package className="h-10 w-10 text-ink-300 mx-auto mb-2" />
            <p className="text-sm text-ink-500 mb-3">
              {labels.length === 0 ? 'No labels yet.' : 'No labels match your filters.'}
            </p>
            <Link to="/create" className="btn-primary text-xs">
              Create a label
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-xs text-ink-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={selected.size === filtered.length && filtered.length > 0}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                    />
                  </th>
                  <SortableTh label="Tracking ID" k="tracking_id" cur={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortableTh label="Receiver" k="receiver_name" cur={sortKey} dir={sortDir} onSort={toggleSort} />
                  <th className="text-left font-semibold px-4 py-3 hidden md:table-cell">Destination</th>
                  <SortableTh label="Courier" k="courier_name" cur={sortKey} dir={sortDir} onSort={toggleSort} extra="hidden lg:table-cell" />
                  <SortableTh label="Prints" k="print_count" cur={sortKey} dir={sortDir} onSort={toggleSort} extra="hidden sm:table-cell" />
                  <th className="text-left font-semibold px-4 py-3 hidden sm:table-cell">Status</th>
                  <SortableTh label="Created" k="created_at" cur={sortKey} dir={sortDir} onSort={toggleSort} extra="hidden md:table-cell" />
                  <th className="text-right font-semibold px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {filtered.map((l) => (
                  <tr key={l.id} className="hover:bg-ink-50 transition-colors group">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(l.id)}
                        onChange={() => toggleSelect(l.id)}
                        className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs text-ink-900 font-semibold">{l.tracking_id}</div>
                      <div className="text-[10px] text-ink-500">{l.barcode_type} · {l.label_size}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink-800">{l.receiver_name}</div>
                      <div className="text-xs text-ink-500 truncate max-w-[180px]">{l.receiver_address}</div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-ink-600 text-xs">
                      {[l.receiver_city, l.receiver_country].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-ink-700">
                      {l.courier_name ?? '—'}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-ink-600 text-xs">
                      {l.print_count}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <StatusBadge status={l.status} />
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-xs text-ink-500">
                      {new Date(l.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        <IconBtn onClick={() => setPreviewLabel(l)} title="Preview">
                          <Eye className="h-4 w-4" />
                        </IconBtn>
                        <IconBtn onClick={() => handlePrint(l)} title="Print">
                          <Printer className="h-4 w-4" />
                        </IconBtn>
                        <IconBtn onClick={() => handlePdf(l)} title="Download PDF">
                          <FileDown className="h-4 w-4" />
                        </IconBtn>
                        <Link to={`/create/${l.id}`} className="p-1.5 rounded text-ink-500 hover:bg-ink-100 hover:text-brand-600" title="Edit">
                          <Pencil className="h-4 w-4" />
                        </Link>
                        <IconBtn
                          onClick={() => handleDelete(l.id)}
                          title="Delete"
                          disabled={deleting === l.id}
                          danger
                        >
                          <Trash2 className="h-4 w-4" />
                        </IconBtn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {filtered.length > 0 && (
        <p className="text-xs text-ink-500 text-center">
          Showing {filtered.length} of {labels.length} labels
        </p>
      )}

      {previewLabel && (
        <PreviewModal
          label={previewLabel}
          settings={settings.barcode}
          orgName={settings.organizationName}
          onClose={() => setPreviewLabel(null)}
          onPrint={() => {
            handlePrint(previewLabel);
            setPreviewLabel(null);
          }}
          onPdf={() => {
            handlePdf(previewLabel);
            setPreviewLabel(null);
          }}
        />
      )}
    </div>
  );
}

function SortableTh({ label, k, cur, dir, onSort, extra = '' }) {
  const active = cur === k;
  return (
    <th className={`text-left font-semibold px-4 py-3 cursor-pointer select-none hover:text-ink-700 ${extra}`}>
      <button onClick={() => onSort(k)} className="flex items-center gap-1">
        {label}
        {active ? (
          dir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3 opacity-30" />
        )}
      </button>
    </th>
  );
}

function IconBtn({ onClick, title, children, disabled, danger }) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`p-1.5 rounded transition-colors disabled:opacity-50 ${
        danger
          ? 'text-ink-500 hover:bg-red-50 hover:text-red-600'
          : 'text-ink-500 hover:bg-ink-100 hover:text-brand-600'
      }`}
    >
      {children}
    </button>
  );
}

function StatusBadge({ status }) {
  const map = {
    created: { label: 'Created', cls: 'bg-ink-100 text-ink-700' },
    printed: { label: 'Printed', cls: 'bg-green-100 text-green-700' },
    archived: { label: 'Archived', cls: 'bg-ink-100 text-ink-500' },
  };
  const s = map[status] ?? map.created;
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
}

function PreviewModal({ label, settings, orgName, onClose, onPrint, onPdf }) {
  const size = getLabelSize(label.label_size);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 no-print">
      <div className="absolute inset-0 bg-ink-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-elevated max-w-3xl w-full max-h-[90vh] overflow-auto animate-fade-in">
        <div className="flex items-center justify-between p-5 border-b border-ink-100">
          <div>
            <h3 className="text-sm font-bold text-ink-900">Label Preview</h3>
            <p className="text-xs text-ink-500 font-mono">{label.tracking_id}</p>
            <p className="text-[10px] text-ink-400">{orgName}</p>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6 flex flex-col items-center gap-4 bg-ink-50">
          <div className="bg-white p-4 rounded-lg shadow-card">
            <div className="flex flex-col gap-3" style={{ width: size.layout === 'compact' ? '50mm' : '100mm' }}>
              <div className="bg-brand-600 text-white px-3 py-2 rounded-t flex items-center justify-between">
                <span className="text-xs font-bold">SHIPPING LABEL</span>
                {label.courier_name && <span className="text-[10px] font-bold">{label.courier_name}</span>}
              </div>
              <div className="px-3 pb-3 flex flex-col gap-2">
                <div>
                  <p className="text-[8px] font-bold text-ink-500 tracking-widest">TRACKING ID</p>
                  <p className="font-mono font-bold text-sm text-ink-900 break-all">{label.tracking_id}</p>
                </div>
                <Barcode
                  value={label.tracking_id}
                  settings={{ ...settings, type: label.barcode_type, height: 50, fontSize: 12 }}
                  className="w-full h-16 bg-white border border-ink-100 rounded"
                />
                <div className="border-t border-dashed border-ink-200 pt-2">
                  <p className="text-[8px] font-bold text-ink-500 tracking-widest">SHIP TO</p>
                  <p className="text-sm font-bold text-ink-900">{label.receiver_name}</p>
                  <p className="text-xs text-ink-700">{label.receiver_address}</p>
                  {(label.receiver_city || label.receiver_postal_code) && (
                    <p className="text-xs text-ink-700">
                      {[label.receiver_city, label.receiver_postal_code].filter(Boolean).join(' ')}
                    </p>
                  )}
                  {label.receiver_country && <p className="text-xs text-ink-700">{label.receiver_country}</p>}
                  {label.receiver_phone && <p className="text-xs text-ink-600">Tel: {label.receiver_phone}</p>}
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={onPrint} className="btn-primary">
              <Printer className="h-4 w-4" /> Print
            </button>
            <button onClick={onPdf} className="btn-secondary">
              <FileDown className="h-4 w-4" /> Download PDF
            </button>
            <Link to={`/create/${label.id}`} className="btn-secondary">
              <Pencil className="h-4 w-4" /> Edit
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function renderSinglePrintHtml(label, orgName, settings) {
  const size = label.label_size === CUSTOM_LABEL_SIZE_KEY && settings?.customLabelSize
    ? { widthMm: settings.customLabelSize.widthMm, heightMm: settings.customLabelSize.heightMm, layout: 'full' }
    : getLabelSize(label.label_size);
  const isCompact = size.layout === 'compact';
  const fmt = label.barcode_type === 'CODE39' ? 'CODE39' : label.barcode_type === 'QR' ? 'QR' : 'CODE128';

  if (isCompact) {
    return `
    <div class="print-page" style="width:${size.widthMm}mm;height:${size.heightMm}mm;padding:1mm;box-sizing:border-box;display:flex;flex-direction:column;font-family:Inter,sans-serif;">
      <div style="display:flex;justify-content:space-between;font-size:6px;font-weight:bold;color:#334155;">
        <span>${escapeHtml(label.courier_name || 'COURIER')}</span>
        <span style="font-family:monospace;">${escapeHtml(label.tracking_id)}</span>
      </div>
      <svg id="bar"></svg>
    </div>
    <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
    <script>try{JsBarcode("#bar", "${escapeHtml(label.tracking_id)}",{format:"${fmt === 'QR' ? 'CODE128' : fmt}",width:1,height:14,displayValue:false,margin:0});}catch(e){}</script>
    `;
  }

  return `
  <div class="print-page" style="width:${size.widthMm}mm;height:${size.heightMm}mm;display:flex;flex-direction:column;font-family:Inter,sans-serif;overflow:hidden;">
    <div style="background:#2563eb;color:white;padding:6mm 5mm;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:13px;font-weight:bold;letter-spacing:0.05em;">SHIPPING LABEL</div>
          <div style="font-size:9px;color:#dbeafe;">${escapeHtml(orgName || 'ElasticRunKottakkal_KOT')}</div>
        </div>
        ${label.courier_name ? `<div style="font-size:11px;font-weight:bold;background:rgba(255,255,255,0.15);padding:2px 8px;border-radius:4px;">${escapeHtml(label.courier_name)}</div>` : ''}
      </div>
    </div>
    <div style="padding:5mm;flex:1;display:flex;flex-direction:column;gap:3mm;">
      <div>
        <div style="font-size:8px;font-weight:bold;color:#64748b;letter-spacing:0.1em;">TRACKING ID</div>
        <div style="font-size:14px;font-family:monospace;font-weight:bold;color:#0f172a;word-break:break-all;">${escapeHtml(label.tracking_id)}</div>
      </div>
      <svg id="bar" style="width:100%;min-height:20mm;"></svg>
      <div style="border-top:1px dashed #cbd5e1;"></div>
      <div>
        <div style="font-size:8px;font-weight:bold;color:#64748b;letter-spacing:0.1em;margin-bottom:2px;">SHIP TO</div>
        <div style="font-size:13px;font-weight:bold;color:#0f172a;">${escapeHtml(label.receiver_name)}</div>
        <div style="font-size:11px;color:#334155;">${escapeHtml(label.receiver_address)}</div>
        ${[label.receiver_city, label.receiver_postal_code].filter(Boolean).join(' ') ? `<div style="font-size:11px;color:#334155;">${escapeHtml([label.receiver_city, label.receiver_postal_code].filter(Boolean).join(' '))}</div>` : ''}
        ${label.receiver_country ? `<div style="font-size:11px;color:#334155;">${escapeHtml(label.receiver_country)}</div>` : ''}
        ${label.receiver_phone ? `<div style="font-size:11px;color:#475569;">Tel: ${escapeHtml(label.receiver_phone)}</div>` : ''}
      </div>
      ${(label.courier_service || label.weight) ? `
      <div style="margin-top:auto;border-top:1px solid #e2e8f0;padding-top:3mm;display:flex;gap:6mm;font-size:10px;">
        ${label.courier_service ? `<div><span style="font-weight:bold;color:#64748b;">SERVICE: </span><span style="color:#1e293b;">${escapeHtml(label.courier_service)}</span></div>` : ''}
        ${label.weight ? `<div><span style="font-weight:bold;color:#64748b;">WEIGHT: </span><span style="color:#1e293b;">${escapeHtml(label.weight)}</span></div>` : ''}
      </div>` : ''}
    </div>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
  <script>try{JsBarcode("#bar", "${escapeHtml(label.tracking_id)}",{format:"${fmt === 'QR' ? 'CODE128' : fmt}",width:2,height:50,displayValue:true,fontSize:12,margin:2,background:"#ffffff",lineColor:"#0f172a"});}catch(e){}</script>
  `;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
