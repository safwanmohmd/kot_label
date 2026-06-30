import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Save,
  Printer,
  FileDown,
  RotateCcw,
  Truck,
  User,
  MapPin,
  Package,
  Hash,
  Settings2,
  ChevronDown,
  Check,
} from 'lucide-react';
import { LabelPreview } from '../components/LabelPreview.jsx';
import { CUSTOM_LABEL_SIZE_KEY, useSettings } from '../lib/settings.js';
import { useToast } from '../lib/useToast.jsx';
import { createLabel, fetchLabel, markPrinted, updateLabel } from '../lib/labels.js';
import {
  COURIER_OPTIONS,
  COUNTRY_OPTIONS,
  LABEL_SIZES,
  getLabelSize,
} from '../types/label.js';
import { exportLabelToPdf } from '../lib/pdf.js';
import { buildPrintDocument, printHtml } from '../lib/print.js';
import { sanitizeForCode39, supportsValue } from '../lib/barcode.js';

const EMPTY = {
  tracking_id: '',
  receiver_name: '',
  receiver_address: '',
  receiver_phone: '',
  receiver_city: '',
  receiver_postal_code: '',
  receiver_country: 'United States',
  sender_name: '',
  sender_address: '',
  sender_phone: '',
  courier_name: 'Ekart',
  courier_service: '',
  weight: '',
  dimensions: '',
  notes: '',
  label_size: '100x150',
  barcode_type: 'CODE128',
};

export function CreateLabel() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [settings] = useSettings();
  const [form, setForm] = useState({ ...EMPTY, ...settingsDefaults(settings) });
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [loading, setLoading] = useState(Boolean(id));
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [savedId, setSavedId] = useState(id ?? null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const label = await fetchLabel(id);
        if (cancelled || !label) return;
        setForm({
          tracking_id: label.tracking_id,
          receiver_name: label.receiver_name,
          receiver_address: label.receiver_address,
          receiver_phone: label.receiver_phone ?? '',
          receiver_city: label.receiver_city ?? '',
          receiver_postal_code: label.receiver_postal_code ?? '',
          receiver_country: label.receiver_country ?? 'United States',
          sender_name: label.sender_name ?? '',
          sender_address: label.sender_address ?? '',
          sender_phone: label.sender_phone ?? '',
          courier_name: label.courier_name ?? 'FedEx',
          courier_service: label.courier_service ?? '',
          weight: label.weight ?? '',
          dimensions: label.dimensions ?? '',
          notes: label.notes ?? '',
          label_size: label.label_size,
          barcode_type: label.barcode_type,
        });
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Failed to load label', 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, toast]);

  const size = form.label_size === CUSTOM_LABEL_SIZE_KEY
    ? {
        key: CUSTOM_LABEL_SIZE_KEY,
        name: settings.customLabelSize.widthMm + ' x ' + settings.customLabelSize.heightMm + ' mm',
        description: 'Custom',
        widthMm: settings.customLabelSize.widthMm,
        heightMm: settings.customLabelSize.heightMm,
        layout: 'full',
      }
    : getLabelSize(form.label_size);
  const labelSizes = [
    ...LABEL_SIZES,
    { key: CUSTOM_LABEL_SIZE_KEY, name: settings.customLabelSize.widthMm + ' x ' + settings.customLabelSize.heightMm + ' mm', description: 'Custom' },
  ];
  const barcodeSettings = useMemo(
    () => ({ ...settings.barcode, type: form.barcode_type }),
    [settings.barcode, form.barcode_type],
  );

  const trackingInvalid = form.tracking_id.length > 0 && !supportsValue(form.barcode_type, form.tracking_id);
  const canSave = form.tracking_id.trim() && form.receiver_name.trim() && form.receiver_address.trim() && !trackingInvalid;

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    if (!canSave) {
      toast('Please fill in Tracking ID, receiver name, and address.', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        tracking_id: form.tracking_id.trim(),
        receiver_name: form.receiver_name.trim(),
        receiver_address: form.receiver_address.trim(),
        receiver_phone: form.receiver_phone.trim() || null,
        receiver_city: form.receiver_city.trim() || null,
        receiver_postal_code: form.receiver_postal_code.trim() || null,
        receiver_country: form.receiver_country || null,
        sender_name: form.sender_name.trim() || null,
        sender_address: form.sender_address.trim() || null,
        sender_phone: form.sender_phone.trim() || null,
        courier_name: form.courier_name || null,
        courier_service: form.courier_service.trim() || null,
        weight: form.weight.trim() || null,
        dimensions: form.dimensions.trim() || null,
        notes: form.notes.trim() || null,
        label_size: form.label_size,
        barcode_type: form.barcode_type,
      };
      if (savedId) {
        await updateLabel(savedId, payload);
        toast('Label updated.', 'success');
      } else {
        const created = await createLabel(payload);
        setSavedId(created.id);
        toast('Label saved to history.', 'success');
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to save label', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handlePrint() {
    if (!form.tracking_id.trim()) {
      toast('Enter a tracking ID first.', 'error');
      return;
    }
    setPrinting(true);
    try {
      const previewHtml = renderLabelHtml(form, size, settings.barcode, settings.organizationName, settings.customerPosition, settings.labelHeader);
      const doc = buildPrintDocument(previewHtml, { w: size.widthMm, h: size.heightMm });
      printHtml(doc);
      if (savedId) {
        markPrinted(savedId).catch(() => {});
      }
      toast('Sent to printer.', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Print failed', 'error');
    } finally {
      setPrinting(false);
    }
  }

  async function handlePdf() {
    if (!form.tracking_id.trim()) {
      toast('Enter a tracking ID first.', 'error');
      return;
    }
    setExporting(true);
    try {
      const label = {
        id: savedId ?? 'draft',
        ...form,
        receiver_phone: form.receiver_phone || null,
        receiver_city: form.receiver_city || null,
        receiver_postal_code: form.receiver_postal_code || null,
        receiver_country: form.receiver_country || null,
        sender_name: form.sender_name || null,
        sender_address: form.sender_address || null,
        sender_phone: form.sender_phone || null,
        courier_name: form.courier_name || null,
        courier_service: form.courier_service || null,
        weight: form.weight || null,
        dimensions: form.dimensions || null,
        notes: form.notes || null,
        status: 'created',
        print_count: 0,
        last_printed_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await exportLabelToPdf(label, barcodeSettings, settings);
      toast('PDF downloaded.', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'PDF export failed', 'error');
    } finally {
      setExporting(false);
    }
  }

  function handleReset() {
    setForm({ ...EMPTY, ...settingsDefaults(settings) });
    setSavedId(null);
    navigate('/create');
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-sm text-ink-400">Loading label…</div>;
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 animate-fade-in">
      <div className="xl:col-span-3 space-y-5">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Hash className="h-4 w-4 text-brand-600" />
            <h3 className="text-sm font-bold text-ink-900">Tracking & Barcode</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label-text">Tracking ID *</label>
              <input
                className={`input font-mono ${trackingInvalid ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                value={form.tracking_id}
                onChange={(e) => update('tracking_id', e.target.value)}
                placeholder="e.g. 1Z999AA10123456784"
                autoFocus
              />
              {trackingInvalid && (
                <p className="text-xs text-red-600 mt-1">
                  {form.barcode_type === 'CODE39'
                    ? 'Code39 supports only A-Z, 0-9, and - . $ / + % SPACE.'
                    : 'This value is not valid for the selected barcode type.'}
                </p>
              )}
            </div>
            <div>
              <label className="label-text">Barcode Type</label>
              <select
                className="input"
                value={form.barcode_type}
                onChange={(e) => update('barcode_type', e.target.value)}
              >
                <option value="CODE128">Code128 (recommended)</option>
                <option value="CODE39">Code39</option>
                <option value="QR">QR Code</option>
              </select>
            </div>
            <div>
              <label className="label-text">Label Size</label>
              <select
                className="input"
                value={form.label_size}
                onChange={(e) => update('label_size', e.target.value)}
              >
                {labelSizes.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.name} - {s.description}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <User className="h-4 w-4 text-brand-600" />
            <h3 className="text-sm font-bold text-ink-900">Receiver</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label-text">Receiver Name *</label>
              <input
                className="input"
                value={form.receiver_name}
                onChange={(e) => update('receiver_name', e.target.value)}
                placeholder="Full name or company"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label-text">Address *</label>
              <textarea
                className="input min-h-[72px] resize-y"
                value={form.receiver_address}
                onChange={(e) => update('receiver_address', e.target.value)}
                placeholder="Street address, apartment, suite"
              />
            </div>
            <div>
              <label className="label-text">City</label>
              <input
                className="input"
                value={form.receiver_city}
                onChange={(e) => update('receiver_city', e.target.value)}
                placeholder="City"
              />
            </div>
            <div>
              <label className="label-text">Postal Code</label>
              <input
                className="input"
                value={form.receiver_postal_code}
                onChange={(e) => update('receiver_postal_code', e.target.value)}
                placeholder="ZIP / postal"
              />
            </div>
            <div>
              <label className="label-text">Country</label>
              <select
                className="input"
                value={form.receiver_country}
                onChange={(e) => update('receiver_country', e.target.value)}
              >
                {COUNTRY_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-text">Phone</label>
              <input
                className="input"
                value={form.receiver_phone}
                onChange={(e) => update('receiver_phone', e.target.value)}
                placeholder="+1 555 0100"
              />
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Truck className="h-4 w-4 text-brand-600" />
            <h3 className="text-sm font-bold text-ink-900">Courier & Package</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-text">Courier</label>
              <select
                className="input"
                value={form.courier_name}
                onChange={(e) => update('courier_name', e.target.value)}
              >
                {COURIER_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-text">Service</label>
              <input
                className="input"
                value={form.courier_service}
                onChange={(e) => update('courier_service', e.target.value)}
                placeholder="Express, Ground, Overnight…"
              />
            </div>
            <div>
              <label className="label-text">Weight</label>
              <input
                className="input"
                value={form.weight}
                onChange={(e) => update('weight', e.target.value)}
                placeholder="2.5 kg"
              />
            </div>
            <div>
              <label className="label-text">Dimensions</label>
              <input
                className="input"
                value={form.dimensions}
                onChange={(e) => update('dimensions', e.target.value)}
                placeholder="30 × 20 × 15 cm"
              />
            </div>
          </div>
        </div>

        <div className="card p-5">
          <button
            onClick={() => setShowAdvanced((s) => !s)}
            className="flex items-center justify-between w-full text-left"
          >
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-brand-600" />
              <h3 className="text-sm font-bold text-ink-900">Sender & Notes</h3>
            </div>
            <ChevronDown
              className={`h-4 w-4 text-ink-400 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
            />
          </button>
          {showAdvanced && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 animate-fade-in">
              <div>
                <label className="label-text">Sender Name</label>
                <input
                  className="input"
                  value={form.sender_name}
                  onChange={(e) => update('sender_name', e.target.value)}
                  placeholder="Sender name or company"
                />
              </div>
              <div>
                <label className="label-text">Sender Phone</label>
                <input
                  className="input"
                  value={form.sender_phone}
                  onChange={(e) => update('sender_phone', e.target.value)}
                  placeholder="+1 555 0199"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label-text">Sender Address</label>
                <textarea
                  className="input min-h-[60px] resize-y"
                  value={form.sender_address}
                  onChange={(e) => update('sender_address', e.target.value)}
                  placeholder="Return address"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label-text">Internal Notes</label>
                <textarea
                  className="input min-h-[60px] resize-y"
                  value={form.notes}
                  onChange={(e) => update('notes', e.target.value)}
                  placeholder="Notes for warehouse staff (not printed on label)"
                />
              </div>
            </div>
          )}
        </div>

        <div className="card p-4 flex flex-wrap items-center gap-2 sticky bottom-4">
          <button onClick={handleSave} disabled={saving || !canSave} className="btn-primary">
            <Save className="h-4 w-4" />
            {saving ? 'Saving…' : savedId ? 'Update Label' : 'Save Label'}
          </button>
          <button onClick={handlePrint} disabled={printing || !form.tracking_id} className="btn-secondary">
            <Printer className="h-4 w-4" />
            {printing ? 'Preparing…' : 'Print'}
          </button>
          <button onClick={handlePdf} disabled={exporting || !form.tracking_id} className="btn-secondary">
            <FileDown className="h-4 w-4" />
            {exporting ? 'Exporting…' : 'Download PDF'}
          </button>
          <button onClick={handleReset} className="btn-ghost ml-auto">
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
          {savedId && (
            <span className="badge bg-green-100 text-green-700">
              <Check className="h-3 w-3" /> Saved
            </span>
          )}
        </div>
      </div>

      <div className="xl:col-span-2">
        <div className="xl:sticky xl:top-4">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-ink-900">Live Preview</h3>
              <span className="text-xs text-ink-500">{size.name}</span>
            </div>
            <div className="flex justify-center items-start bg-ink-100 rounded-lg p-4 overflow-auto">
              <div
                style={{ transform: 'scale(1)', transformOrigin: 'top center' }}
                className="max-w-full"
              >
                <LabelPreview
                  label={form}
                  size={size}
                  settings={barcodeSettings}
                  organizationName={settings.organizationName}
                  customerPosition={settings.customerPosition}
                  labelHeader={settings.labelHeader}
                />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <MiniStat icon={MapPin} label="Size" value={`${size.widthMm}×${size.heightMm}mm`} />
              <MiniStat icon={Hash} label="Type" value={form.barcode_type} />
              <MiniStat icon={Package} label="Layout" value={size.layout} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value }) {
  return (
    <div className="rounded-lg bg-ink-50 p-2.5">
      <Icon className="h-3.5 w-3.5 text-ink-400 mx-auto mb-1" />
      <p className="text-[10px] text-ink-500 uppercase tracking-wide">{label}</p>
      <p className="text-xs font-semibold text-ink-800 truncate">{value}</p>
    </div>
  );
}

function settingsDefaults(settings) {
  return {
    label_size: settings.defaultLabelSize,
    courier_name: settings.defaultCourier,
    receiver_country: 'United States',
  };
}

function renderLabelHtml(form, size, barcode, orgName, customerPosition, labelHeader) {
  const isCompact = size.layout === 'compact';
  const barcodeType = form.barcode_type;

  if (isCompact) {
    return `
    <div class="print-page" style="width:${size.widthMm}mm;height:${size.heightMm}mm;padding:1mm;box-sizing:border-box;display:flex;flex-direction:column;font-family:Inter,sans-serif;">
      <div style="display:flex;justify-content:space-between;font-size:6px;font-weight:bold;color:#334155;">
        <span>${escapeHtml(form.courier_name || 'COURIER')}</span>
        <span style="font-family:monospace;">${escapeHtml(form.tracking_id)}</span>
      </div>
      <div id="barcode" style="flex:1;min-height:0;"></div>
    </div>
    <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
    <script>
      try {
        JsBarcode("#barcode svg-element", "${escapeHtml(form.tracking_id)}", {
          format: "${barcodeType === 'CODE39' ? 'CODE39' : 'CODE128'}",
          width: 1, height: 14, displayValue: false, margin: 0
        });
      } catch(e) { console.error(e); }
    </script>
    `;
  }

  return `
  <div class="print-page" style="width:${size.widthMm}mm;height:${size.heightMm}mm;position:relative;font-family:Inter,sans-serif;overflow:hidden;">
    <div style="background:${labelHeader?.color ?? '#2563eb'};color:white;height:${labelHeader?.heightMm ?? 22}mm;padding:0 5mm;display:flex;align-items:center;">
      <div style="display:flex;justify-content:space-between;align-items:center;width:100%;">
        <div>
          <div style="font-size:10px;font-weight:bold;letter-spacing:0.05em;">SHIPPING LABEL</div>
          <div style="font-size:9px;color:#dbeafe;">${escapeHtml(orgName || 'ElasticRunKottakkal_KOT')}</div>
        </div>
        ${form.courier_name ? `<div style="font-size:11px;font-weight:bold;background:rgba(255,255,255,0.15);padding:2px 8px;border-radius:4px;">${escapeHtml(form.courier_name)}</div>` : ''}
      </div>
    </div>
    <div style="position:absolute;left:5mm;right:5mm;top:${(labelHeader?.heightMm ?? 22) + 5}mm;">
      <div>
        <div style="font-size:8px;font-weight:bold;color:#64748b;letter-spacing:0.1em;">TRACKING ID</div>
        <div style="font-size:14px;font-family:monospace;font-weight:bold;color:#0f172a;word-break:break-all;">${escapeHtml(form.tracking_id)}</div>
      </div>
      <div id="barcode" style="position:absolute;left:0;top:15mm;width:100%;height:20mm;background:white;border:1px solid #e2e8f0;border-radius:4px;display:flex;align-items:center;justify-content:center;"></div>
      <div style="border-top:1px dashed #cbd5e1;"></div>
      <div style="position:absolute;left:${Math.max(0, (customerPosition?.xMm ?? 5) - 5)}mm;top:${Math.max(0, (customerPosition?.yMm ?? 62) - ((labelHeader?.heightMm ?? 22) + 5))}mm;width:${customerPosition?.widthMm ?? 90}mm;">
        <div style="font-size:8px;font-weight:bold;color:#64748b;letter-spacing:0.1em;margin-bottom:2px;">SHIP TO</div>
        <div style="font-size:${customerPosition?.fontSize ?? 13}px;font-weight:bold;color:#0f172a;">${escapeHtml(form.receiver_name)}</div>
        <div style="font-size:${Math.max(8, (customerPosition?.fontSize ?? 13) - 2)}px;color:#334155;">${escapeHtml(form.receiver_address)}</div>
        ${[form.receiver_city, form.receiver_postal_code].filter(Boolean).join(' ') ? `<div style="font-size:${Math.max(8, (customerPosition?.fontSize ?? 13) - 2)}px;color:#334155;">${escapeHtml([form.receiver_city, form.receiver_postal_code].filter(Boolean).join(' '))}</div>` : ''}
        ${form.receiver_country ? `<div style="font-size:${Math.max(8, (customerPosition?.fontSize ?? 13) - 2)}px;color:#334155;">${escapeHtml(form.receiver_country)}</div>` : ''}
        ${form.receiver_phone ? `<div style="font-size:${Math.max(8, (customerPosition?.fontSize ?? 13) - 2)}px;color:#475569;">Tel: ${escapeHtml(form.receiver_phone)}</div>` : ''}
      </div>
      ${(form.sender_name || form.sender_address) ? `
      <div style="border-top:1px dashed #cbd5e1;"></div>
      <div>
        <div style="font-size:8px;font-weight:bold;color:#64748b;letter-spacing:0.1em;margin-bottom:2px;">FROM</div>
        ${form.sender_name ? `<div style="font-size:11px;font-weight:bold;color:#1e293b;">${escapeHtml(form.sender_name)}</div>` : ''}
        ${form.sender_address ? `<div style="font-size:11px;color:#475569;">${escapeHtml(form.sender_address)}</div>` : ''}
      </div>` : ''}
      ${(form.courier_service || form.weight) ? `
      <div style="margin-top:auto;border-top:1px solid #e2e8f0;padding-top:3mm;display:flex;gap:6mm;font-size:10px;">
        ${form.courier_service ? `<div><span style="font-weight:bold;color:#64748b;">SERVICE: </span><span style="color:#1e293b;">${escapeHtml(form.courier_service)}</span></div>` : ''}
        ${form.weight ? `<div><span style="font-weight:bold;color:#64748b;">WEIGHT: </span><span style="color:#1e293b;">${escapeHtml(form.weight)}</span></div>` : ''}
      </div>` : ''}
    </div>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
  <script>
    (function() {
      var el = document.getElementById('barcode');
      if (!el) return;
      var svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
      el.appendChild(svg);
      try {
        JsBarcode(svg, "${escapeHtml(sanitizeForCode39(form.tracking_id))}", {
          format: "${barcodeType === 'CODE39' ? 'CODE39' : 'CODE128'}",
          width: ${barcode.width}, height: 50, displayValue: true, fontSize: 12, margin: 2,
          background: "#ffffff", lineColor: "#0f172a"
        });
      } catch(e) { console.error(e); }
    })();
  </script>
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
