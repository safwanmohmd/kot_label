import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import JsBarcode from 'jsbarcode';
import JSZip from 'jszip';
import {
  Save,
  Printer,
  RotateCcw,
  Truck,
  User,
  Package,
  Hash,
  Settings2,
  ChevronDown,
  Check,
  Archive,
} from 'lucide-react';
import { CUSTOM_LABEL_SIZE_KEY, useSettings } from '../lib/settings.js';
import { useToast } from '../lib/useToast.jsx';
import { createLabel, fetchLabel, markPrinted, updateLabel } from '../lib/labels.js';
import {
  COURIER_OPTIONS,
  COUNTRY_OPTIONS,
  LABEL_SIZES,
  getLabelSize,
} from '../types/label.js';
import { buildPrintDocument, printHtml } from '../lib/print.js';
import { sanitizeForCode39, supportsValue } from '../lib/barcode.js';

// Preset Receiver Default Details
const PRESET_RECEIVER = {
  receiver_name: 'Reciver Name',
  address_line1: 'address 1',
  address_line2: 'address 2',
  receiver_city: 'na',
  receiver_postal_code: 'na',
  receiver_country: 'India',
  receiver_phone: 'na',
};

// Initial Form State
const EMPTY = {
  tracking_id: '',
  ...PRESET_RECEIVER,
  sender_name: '',
  sender_address: '',
  sender_phone: '',
  courier_name: 'Ekart',
  courier_service: '',
  weight: '',
  dimensions: '',
  notes: '',
  data_matrix_payload: '',
  label_size: '100x150',
  barcode_type: 'CODE128',
};

// Generates raw PRN ZPL string for customer shipping labels
function generatePrnContent(form) {
  const line1 = form.address_line1 ? `^FT16,145^A0N,20,20^CI28^FD${form.address_line1}^FS^CI27\n` : '';
  const line2 = form.address_line2 ? `^FT16,170^A0N,20,20^CI28^FD${form.address_line2}^FS^CI27\n` : '';
  const payload = form.data_matrix_payload || form.tracking_id || '';

  return `CT~~CD,~CC^~CT~
^XA
~TA000
~JSN
^LT0
^MNW
^MTD
^PON
^PMN
^LH0,0
^JMA
^PR5,5
~SD30
^JUS
^LRN
^CI27
^PA0,1,1,0
^XZ
^XA
^MMT
^PW669
^LL467
^LS0
^FT40,58^A0N,34,35^CI28^FD${form.courier_name || ''}^FS^CI27
^FT16,92^A0N,20,20^CI28^FDDeliver To :^FS^CI27

^FT16,120^A0N,20,20^CI28^FD${form.receiver_name || ''}^FS^CI27
${line1}${line2}
^FT16,245^A0N,20,20^CI28^FDCity: ${form.receiver_city || ''}^FS^CI27
^FT16,308^A0N,20,20^CI28^FDOrder ID:\n${form.notes || ''}^FS^CI27
^FT384,288^BXN,12,200,0,0,1,_,1
^FD${payload}^FS
^BY2,3,81^FT40,448^BCN,,Y,Y,N,A
^FD${form.tracking_id || ''}^FS
^FO16,20^GB328,48,2^FS
^FT16,270^A0N,20,20^CI28^FDPIN: ${form.receiver_postal_code || ''}^FS^CI27
^FT527,428^A0N,28,28^CI28^FD(DEL/MUD)^FS^CI27
^PQ1,0,1,Y
^XZ
`;
}

// DataMatrix Vector Generator
function generateDataMatrixSvgString(payload) {
  if (!payload || !payload.trim()) return '';
  const cols = 20;
  const rows = 20;
  const cellSize = 8;
  const sizePx = cols * cellSize;

  const str = payload.trim();
  const grid = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = 0; i < rows; i++) grid[i][0] = 1;
  for (let j = 0; j < cols; j++) grid[rows - 1][j] = 1;
  for (let j = 0; j < cols; j += 2) grid[0][j] = 1;
  for (let i = 0; i < rows; i += 2) grid[i][cols - 1] = 1;

  let bitStream = '';
  for (let i = 0; i < str.length; i++) {
    bitStream += str.charCodeAt(i).toString(2).padStart(8, '0');
  }

  let bitIdx = 0;
  for (let r = 1; r < rows - 1; r++) {
    for (let c = 1; c < cols - 1; c++) {
      if (bitIdx < bitStream.length) {
        grid[r][c] = bitStream[bitIdx] === '1' ? 1 : 0;
        bitIdx++;
      } else {
        grid[r][c] = (r * 7 + c * 13) % 2 === 0 ? 1 : 0;
      }
    }
  }

  let rects = '';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === 1) {
        rects += `<rect x="${c * cellSize}" y="${r * cellSize}" width="${cellSize}" height="${cellSize}" fill="#000000" />`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sizePx}" height="${sizePx}" viewBox="0 0 ${sizePx} ${sizePx}" style="display:block;">
    <rect width="${sizePx}" height="${sizePx}" fill="#ffffff" />
    ${rects}
  </svg>`;
}

// SVG Generator for Tracking Barcode
function generateBarcodeSvgString(trackingId, barcodeType) {
  if (!trackingId) return '';
  try {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    JsBarcode(svg, sanitizeForCode39(trackingId), {
      format: barcodeType === 'CODE39' ? 'CODE39' : 'CODE128',
      width: 2.5,
      height: 81,
      displayValue: true,
      font: 'monospace',
      fontSize: 16,
      margin: 0,
      background: 'transparent',
      lineColor: '#000000',
    });
    return svg.outerHTML;
  } catch (e) {
    return `<div style="font-family: monospace; font-size: 16px;">${trackingId}</div>`;
  }
}

function getTruckSvg() {
  return `<svg width="28" height="20" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="1" y="3" width="15" height="13"></rect>
    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
    <circle cx="5.5" cy="18.5" r="2.5"></circle>
    <circle cx="18.5" cy="18.5" r="2.5"></circle>
  </svg>`;
}

export function CreatePrnLabel() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [settings] = useSettings();
  const [form, setForm] = useState({ ...EMPTY, ...settingsDefaults(settings) });
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);
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
        const addrLines = (label.receiver_address || '').split('\n');
        setForm({
          tracking_id: label.tracking_id ?? '',
          receiver_name: label.receiver_name ?? PRESET_RECEIVER.receiver_name,
          address_line1: addrLines[0] ?? PRESET_RECEIVER.address_line1,
          address_line2: addrLines[1] ?? PRESET_RECEIVER.address_line2,
          receiver_phone: label.receiver_phone ?? PRESET_RECEIVER.receiver_phone,
          receiver_city: label.receiver_city ?? PRESET_RECEIVER.receiver_city,
          receiver_postal_code: label.receiver_postal_code ?? PRESET_RECEIVER.receiver_postal_code,
          receiver_country: label.receiver_country ?? PRESET_RECEIVER.receiver_country,
          sender_name: label.sender_name ?? '',
          sender_address: label.sender_address ?? '',
          sender_phone: label.sender_phone ?? '',
          courier_name: label.courier_name ?? 'Ekart',
          courier_service: label.courier_service ?? '',
          weight: label.weight ?? '',
          dimensions: label.dimensions ?? '',
          notes: label.notes ?? '',
          data_matrix_payload: label.data_matrix_payload ?? '',
          label_size: label.label_size ?? '100x150',
          barcode_type: label.barcode_type ?? 'CODE128',
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

  useEffect(() => {
    if (!id && !savedId && settings) {
      setForm((prev) => ({
        ...prev,
        ...settingsDefaults(settings),
      }));
    }
  }, [settings, id, savedId]);

  const size = form.label_size === CUSTOM_LABEL_SIZE_KEY
    ? {
        key: CUSTOM_LABEL_SIZE_KEY,
        name: (settings?.customLabelSize?.widthMm ?? 100) + ' x ' + (settings?.customLabelSize?.heightMm ?? 150) + ' mm',
        description: 'Custom',
        widthMm: settings?.customLabelSize?.widthMm ?? 100,
        heightMm: settings?.customLabelSize?.heightMm ?? 150,
        layout: 'full',
      }
    : getLabelSize(form.label_size);

  const labelSizes = [
    ...LABEL_SIZES,
    { key: CUSTOM_LABEL_SIZE_KEY, name: (settings?.customLabelSize?.widthMm ?? 100) + ' x ' + (settings?.customLabelSize?.heightMm ?? 150) + ' mm', description: 'Custom' },
  ];

  const trackingInvalid = form.tracking_id.length > 0 && !supportsValue(form.barcode_type, form.tracking_id);
  const canSave = form.tracking_id.trim() && form.receiver_name.trim() && (form.address_line1.trim() || form.address_line2.trim()) && !trackingInvalid;

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleApplyPresets() {
    setForm((f) => ({
      ...f,
      ...PRESET_RECEIVER,
    }));
    toast('Preset customer details applied!', 'success');
  }

  async function handleDownloadPrnZip() {
    if (!form.tracking_id.trim()) {
      toast('Please enter a Tracking ID first.', 'error');
      return;
    }
    try {
      const zip = new JSZip();
      const trackingId = form.tracking_id.trim();
      const prnData = generatePrnContent(form);

      const fileName = `shipmentId_${trackingId}.prn`;
      zip.file(fileName, prnData);

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `shipments_${trackingId}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast('PRN ZIP downloaded successfully!', 'success');
    } catch (e) {
      toast('Failed to generate ZIP archive.', 'error');
    }
  }

  async function handleSave() {
    if (!canSave) {
      toast('Please fill in Tracking ID, receiver name, and address.', 'error');
      return;
    }
    setSaving(true);
    try {
      const combinedAddress = [form.address_line1.trim(), form.address_line2.trim()].filter(Boolean).join('\n');
      const payload = {
        tracking_id: form.tracking_id.trim(),
        receiver_name: form.receiver_name.trim(),
        receiver_address: combinedAddress,
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
      const previewHtml = renderPrnLabelHtml(form);
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

  function handleReset() {
    setForm({ ...EMPTY, ...settingsDefaults(settings) });
    setSavedId(null);
    navigate('/create-prn');
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
                placeholder="e.g. FMPC6260775790"
                autoFocus
              />
            </div>
            <div>
              <label className="label-text">Barcode Type</label>
              <select
                className="input"
                value={form.barcode_type}
                onChange={(e) => update('barcode_type', e.target.value)}
              >
                <option value="CODE128">Code128 (ZPL Default)</option>
                <option value="CODE39">Code39</option>
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

        {/* Receiver / Delivery Address Form */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-brand-600" />
              <h3 className="text-sm font-bold text-ink-900">Customer Delivery Address</h3>
            </div>
            <button
              type="button"
              onClick={handleApplyPresets}
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 underline"
            >
              Load Preset Defaults
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label-text">Receiver Name *</label>
              <input
                className="input"
                value={form.receiver_name}
                onChange={(e) => update('receiver_name', e.target.value)}
                placeholder="Enter customer name or company"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label-text">Address Line 1 *</label>
              <input
                className="input"
                value={form.address_line1}
                onChange={(e) => update('address_line1', e.target.value)}
                placeholder="House No., Building, Street Name"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label-text">Address Line 2</label>
              <input
                className="input"
                value={form.address_line2}
                onChange={(e) => update('address_line2', e.target.value)}
                placeholder="Area, Landmark, Village"
              />
            </div>
            <div>
              <label className="label-text">City</label>
              <input
                className="input"
                value={form.receiver_city}
                onChange={(e) => update('receiver_city', e.target.value)}
                placeholder="Enter City"
              />
            </div>
            <div>
              <label className="label-text">PIN Code / Postal Code</label>
              <input
                className="input"
                value={form.receiver_postal_code}
                onChange={(e) => update('receiver_postal_code', e.target.value)}
                placeholder="e.g. 400001"
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
                placeholder="Enter Mobile Number"
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
              <label className="label-text">Order ID / Notes</label>
              <input
                className="input"
                value={form.notes}
                onChange={(e) => update('notes', e.target.value)}
                placeholder="Enter Order ID"
              />
            </div>
            <div>
              <label className="label-text">Weight</label>
              <input
                className="input"
                value={form.weight}
                onChange={(e) => update('weight', e.target.value)}
                placeholder="e.g. 0.45"
              />
            </div>
            <div>
              <label className="label-text">2D DataMatrix Payload (^BX)</label>
              <input
                className="input font-mono text-xs"
                value={form.data_matrix_payload}
                onChange={(e) => update('data_matrix_payload', e.target.value)}
                placeholder="e.g. 2A-364950753ODEL/MUDSE03ESR98"
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
              <h3 className="text-sm font-bold text-ink-900">Sender Details</h3>
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
                  placeholder="Sender name"
                />
              </div>
              <div>
                <label className="label-text">Sender Phone</label>
                <input
                  className="input"
                  value={form.sender_phone}
                  onChange={(e) => update('sender_phone', e.target.value)}
                  placeholder="Sender phone"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label-text">Sender Address</label>
                <textarea
                  className="input min-h-[60px] resize-y"
                  value={form.sender_address}
                  onChange={(e) => update('sender_address', e.target.value)}
                  placeholder="Sender address"
                />
              </div>
            </div>
          )}
        </div>

        {/* Action Bar */}
        <div className="card p-4 flex flex-wrap items-center gap-2 sticky bottom-4">
          <button onClick={handleSave} disabled={saving || !canSave} className="btn-primary">
            <Save className="h-4 w-4" />
            {saving ? 'Saving…' : savedId ? 'Update Label' : 'Save Label'}
          </button>
          
          <button onClick={handleDownloadPrnZip} className="btn-secondary bg-amber-500 hover:bg-amber-600 text-white border-none">
            <Archive className="h-4 w-4" />
            Export PRN (ZIP)
          </button>

          <button onClick={handlePrint} disabled={printing || !form.tracking_id} className="btn-secondary">
            <Printer className="h-4 w-4" />
            {printing ? 'Preparing…' : 'Print'}
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

      {/* Live Preview */}
      <div className="xl:col-span-2">
        <div className="xl:sticky xl:top-4">
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink-900">Customer Label Preview</h3>
              <span className="text-xs text-ink-500">{size.name}</span>
            </div>

            <div className="flex justify-center items-start bg-ink-100 rounded-lg p-3 overflow-hidden min-h-[350px] w-full">
              <PrnLabelPreview form={form} />
            </div>

            <div className="grid grid-cols-2 gap-2 text-center">
              <MiniStat icon={Package} label="Format" value="ZPL Native (PRN)" />
              <MiniStat icon={Hash} label="Type" value={form.barcode_type} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Dynamic PRN Preview Component */
export function PrnLabelPreview({ form }) {
  const barcodeSvgRef = useRef(null);
  const wrapperRef = useRef(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!wrapperRef.current) return;

    const updateScale = () => {
      if (!wrapperRef.current) return;
      const containerWidth = wrapperRef.current.clientWidth;
      const targetWidth = 669;

      if (containerWidth < targetWidth) {
        setScale(containerWidth / targetWidth);
      } else {
        setScale(1);
      }
    };

    const observer = new ResizeObserver(updateScale);
    observer.observe(wrapperRef.current);
    updateScale();

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (barcodeSvgRef.current && form.tracking_id) {
      try {
        JsBarcode(barcodeSvgRef.current, sanitizeForCode39(form.tracking_id), {
          format: form.barcode_type === 'CODE39' ? 'CODE39' : 'CODE128',
          width: 2.5,
          height: 81,
          displayValue: true,
          font: 'monospace',
          fontSize: 16,
          margin: 0,
          background: 'transparent',
          lineColor: '#000000',
        });
      } catch (e) {
        console.error('Barcode error:', e);
      }
    }
  }, [form.tracking_id, form.barcode_type]);

  const nativeWidth = 669;
  const nativeHeight = 467;
  const payloadToUse = form.data_matrix_payload || form.tracking_id || '';

  return (
    <div ref={wrapperRef} className="w-full flex justify-center items-start overflow-hidden">
      <div
        style={{
          width: `${nativeWidth}px`,
          height: `${nativeHeight}px`,
          marginBottom: `-${(1 - scale) * nativeHeight}px`,
          marginRight: `-${(1 - scale) * nativeWidth}px`,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          position: 'relative',
          background: '#ffffff',
          color: '#000000',
          fontFamily: 'monospace, sans-serif',
          boxSizing: 'border-box',
          overflow: 'hidden',
          border: '1px solid #999999',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        }}
      >
        {/* Header Box */}
        <div
          style={{
            position: 'absolute',
            left: '16px',
            top: '20px',
            width: '328px',
            height: '48px',
            border: '2px solid #000',
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            padding: '0 8px',
            fontSize: '22px',
            fontWeight: 'bold',
            textAlign: 'center',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          <Truck className="h-6 w-6 stroke-[2.5]" />
          <span>{form.courier_name || ''}</span>
        </div>

        <div style={{ position: 'absolute', left: '16px', top: '76px', fontSize: '15px' }}>Deliver To :</div>
        <div style={{ position: 'absolute', left: '16px', top: '102px', fontSize: '15px', fontWeight: 'bold' }}>
          {form.receiver_name || ''}
        </div>

        <div style={{ position: 'absolute', left: '16px', top: '127px', fontSize: '15px', lineHeight: '22px' }}>
          {form.address_line1 && <div>{form.address_line1}</div>}
          {form.address_line2 && <div>{form.address_line2}</div>}
        </div>

        <div style={{ position: 'absolute', left: '16px', top: '227px', fontSize: '15px', fontWeight: 'bold' }}>
          City: {form.receiver_city || ''}
        </div>

        <div style={{ position: 'absolute', left: '16px', top: '252px', fontSize: '15px', fontWeight: 'bold' }}>
          PIN: {form.receiver_postal_code || ''}
        </div>

        <div style={{ position: 'absolute', left: '16px', top: '290px', fontSize: '15px', fontWeight: 'bold', width: '350px', wordBreak: 'break-all' }}>
          Order ID: {form.notes || ''}
        </div>

        {/* 2D DataMatrix */}
        <div style={{ position: 'absolute', left: '384px', top: '80px' }}>
          <ZebraDataMatrix value={payloadToUse} />
        </div>

        {/* Tracking Barcode */}
        <div
          style={{
            position: 'absolute',
            left: '40px',
            top: '335px',
            height: '110px',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'flex-start',
          }}
        >
          <svg ref={barcodeSvgRef}></svg>
        </div>

        <div style={{ position: 'absolute', left: '527px', top: '405px', fontSize: '22px', fontWeight: 'bold' }}>
          (DEL/MUD)
        </div>
      </div>
    </div>
  );
}

/* DataMatrix Canvas Renderer */
function ZebraDataMatrix({ value }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cols = 20;
    const rows = 20;
    const cellSize = 8;
    canvas.width = cols * cellSize;
    canvas.height = rows * cellSize;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!value || value.trim().length === 0) return;

    ctx.fillStyle = '#000000';

    const str = value.trim();
    const grid = Array.from({ length: rows }, () => Array(cols).fill(0));

    for (let i = 0; i < rows; i++) grid[i][0] = 1;
    for (let j = 0; j < cols; j++) grid[rows - 1][j] = 1;

    for (let j = 0; j < cols; j += 2) grid[0][j] = 1;
    for (let i = 0; i < rows; i += 2) grid[i][cols - 1] = 1;

    let bitStream = '';
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      bitStream += code.toString(2).padStart(8, '0');
    }

    let bitIdx = 0;
    for (let r = 1; r < rows - 1; r++) {
      for (let c = 1; c < cols - 1; c++) {
        if (bitIdx < bitStream.length) {
          grid[r][c] = bitStream[bitIdx] === '1' ? 1 : 0;
          bitIdx++;
        } else {
          grid[r][c] = (r * 7 + c * 13) % 2 === 0 ? 1 : 0;
        }
      }
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c] === 1) {
          ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
        }
      }
    }
  }, [value]);

  return <canvas ref={canvasRef} style={{ width: '160px', height: '160px' }} />;
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
  if (!settings) return {};
  return {
    label_size: settings.defaultLabelSize || '100x150',
    courier_name: settings.defaultCourier || 'Ekart',
    barcode_type: settings.barcode?.type || 'CODE128',
    receiver_country: 'India',
  };
}

function renderPrnLabelHtml(form) {
  const addressLines = [form.address_line1, form.address_line2].filter(Boolean);
  const barcodeSvg = generateBarcodeSvgString(form.tracking_id, form.barcode_type);
  const matrixPayload = form.data_matrix_payload || form.tracking_id || '';
  const dataMatrixSvg = generateDataMatrixSvgString(matrixPayload);
  const truckSvg = getTruckSvg();

  return `
    <div style="
      width: 669px;
      height: 467px;
      position: relative;
      background: #ffffff;
      color: #000000;
      font-family: monospace, sans-serif;
      box-sizing: border-box;
      overflow: hidden;
      padding: 0;
      margin: 0;
    ">
      <!-- Top Header Box -->
      <div style="
        position: absolute;
        left: 16px;
        top: 20px;
        width: 328px;
        height: 48px;
        border: 2px solid #000;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        padding: 0 8px;
        font-size: 22px;
        font-weight: bold;
        text-align: center;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      ">
        ${truckSvg}
        <span>${form.courier_name || ''}</span>
      </div>

      <div style="position: absolute; left: 16px; top: 76px; font-size: 15px;">Deliver To :</div>
      <div style="position: absolute; left: 16px; top: 102px; font-size: 15px; font-weight: bold;">
        ${form.receiver_name || ''}
      </div>

      <div style="position: absolute; left: 16px; top: 127px; font-size: 15px; line-height: 22px;">
        ${addressLines.map((l) => `<div>${l}</div>`).join('')}
      </div>

      <div style="position: absolute; left: 16px; top: 227px; font-size: 15px; font-weight: bold;">
        City: ${form.receiver_city || ''}
      </div>

      <div style="position: absolute; left: 16px; top: 252px; font-size: 15px; font-weight: bold;">
        PIN: ${form.receiver_postal_code || ''}
      </div>

      <div style="position: absolute; left: 16px; top: 290px; font-size: 15px; font-weight: bold; width: 350px; word-break: break-all;">
        Order ID: ${form.notes || ''}
      </div>

      <!-- Rendered 2D DataMatrix -->
      <div style="position: absolute; left: 384px; top: 80px; width: 160px; height: 160px;">
        ${dataMatrixSvg}
      </div>

      <!-- Tracking Barcode -->
      <div style="
        position: absolute;
        left: 40px;
        top: 335px;
        height: 110px;
        display: flex;
        align-items: flex-start;
        justify-content: flex-start;
      ">
        ${barcodeSvg}
      </div>

      <div style="position: absolute; left: 527px; top: 405px; font-size: 22px; font-weight: bold;">
        (DEL/MUD)
      </div>
    </div>
  `;
}