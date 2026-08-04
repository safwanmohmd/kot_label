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
  Hash,
  Settings2,
  ChevronDown,
  Check,
  Archive,
  MapPin,
  FileText,
  Barcode,
  PackageCheck,
  CheckSquare,
  Square,
  Layout,
  Sparkles,
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
  receiver_name: 'Receiver Name',
  address_line1: 'Address Line 1',
  address_line2: 'Address Line 2',
  receiver_city: 'City Name',
  receiver_postal_code: '676505',
  receiver_country: 'India',
  receiver_phone: '9876543210',
};

// Initial Form State
const EMPTY = {
  tracking_id: '',
  quick_address_input: '',
  ...PRESET_RECEIVER,
  sender_name: '',
  sender_address: '',
  sender_phone: '',
  courier_name: 'Ekart',
  courier_service: '',
  weight: '',
  dimensions: '',
  notes: '',
  label_size: '100x150',
  label_style: 'standard', // 'standard' | 'dual' | 'bold'
  barcode_type: 'CODE128',
  show_second_barcode: true,
};

// Generates raw PRN ZPL string based on selected label style
function generatePrnContent(form) {
  const style = form.label_style || 'standard';

  // STYLE 2: DUAL STACKED
  if (style === 'dual') {
    return `CT~~CD,~CC^~CT~
^XA
~TA000~JSN^LT0^MNW^MTD^PON^PMN^LH0,0^JMA^PR5,5~SD30^JUS^LRN^CI27^PA0,1,1,0
^XZ
^XA
^MMT^PW669^LL467^LS0
^FO16,16^GB637,435,2^FS
^FT30,42^A0N,14,14^FDCourier:^FS
^FT30,70^A0N,24,24^FD${form.courier_name || 'COURIER'}^FS
^FO16,80^GB637,0,2^FS
^FT30,105^A0N,14,14^FDDELIVER TO:^FS
^FT30,130^A0N,22,22^FD${form.receiver_name || ''}^FS
^FT30,155^A0N,18,18^FD${form.address_line1 || ''} ${form.address_line2 || ''}^FS
^FT30,180^A0N,18,18^FDCITY: ${form.receiver_city || ''} (${form.receiver_postal_code || ''})^FS
^FO16,195^GB637,0,1^FS
${form.notes ? `^BY2,2,35^FT30,245^BCN,,N,N,N\n^FD${form.notes}^FS\n` : ''}
^FT30,265^A0N,16,16^FDORDER REF: ${form.notes || '-'}^FS
^FO16,280^GB637,0,2^FS
^BY2.2,3,65^FT30,365^BCN,,N,N,N
^FD${form.tracking_id || ''}^FS
^FT30,395^A0N,24,26^FD${form.tracking_id || ''}^FS
^PQ1,0,1,Y
^XZ
`;
  }

  // STYLE 3: HIGH DENSITY / BOLD TRACKING
  if (style === 'bold') {
    return `CT~~CD,~CC^~CT~
^XA
~TA000~JSN^LT0^MNW^MTD^PON^PMN^LH0,0^JMA^PR5,5~SD30^JUS^LRN^CI27^PA0,1,1,0
^XZ
^XA
^MMT^PW669^LL467^LS0
^FO16,16^GB637,435,4^FS
^FO16,16^GB637,50,5^FS
^FT30,48^A0N,26,26^FR^FD${(form.courier_name || 'COURIER').toUpperCase()}^FS
^FT30,90^A0N,14,14^FDSHIP TO:^FS
^FT30,115^A0N,22,22^FD${form.receiver_name || ''}^FS
^FT30,140^A0N,18,18^FD${form.address_line1 || ''}^FS
^FT30,165^A0N,18,18^FD${form.receiver_city || ''} - ${form.receiver_postal_code || ''}^FS
^FO330,66^GB0,124,2^FS
^FT345,90^A0N,14,14^FDORDER DETAILS:^FS
^FT345,115^A0N,18,18^FD${form.notes || '-'}^FS
^FT345,145^A0N,14,14^FDWEIGHT: ${form.weight || '0.50'} KG^FS
^FO16,190^GB637,0,2^FS
^BY2.5,3,80^FT80,300^BCN,,N,N,N
^FD${form.tracking_id || ''}^FS
^FT180,340^A0N,28,30^FD${form.tracking_id || ''}^FS
^PQ1,0,1,Y
^XZ
`;
  }

  // STYLE 1: STANDARD LOGISTICS
  const line1 = form.address_line1 ? `^FT30,150^A0N,22,22^CI28^FD${form.address_line1}^FS^CI27\n` : '';
  const line2 = form.address_line2 ? `^FT30,178^A0N,22,22^CI28^FD${form.address_line2}^FS^CI27\n` : '';
  const backupData = form.notes || form.tracking_id || '';
  const hasSecond = form.show_second_barcode && backupData;

  const lineLength = hasSecond ? 510 : 637;
  
  const secondBarcodeZpl = hasSecond
    ? `^BY2,2,40^FO570,35^BCR,40,N,N,N\n^FD${backupData}^FS\n^FT640,400^A0R,14,14^FD${backupData}^FS\n`
    : '';

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
^FO16,16^GB637,435,3^FS
^FO16,70^GB${lineLength},0,2^FS
^FT30,52^A0N,28,30^CI28^FDKOT - PRN | ${form.courier_name || 'COURIER'}^FS^CI27
^FT30,100^A0N,18,18^CI28^FDSHIP TO:^FS^CI27
^FT30,124^A0N,24,24^CI28^FD${form.receiver_name || ''}^FS^CI27
${line1}${line2}
^FT30,220^A0N,20,20^CI28^FDCITY: ${form.receiver_city || ''}  |  PIN: ${form.receiver_postal_code || ''}^FS^CI27
^FO16,240^GB${lineLength},0,2^FS
^FT30,275^A0N,22,22^CI28^FDORDER ID: ${form.notes || '-'}^FS^CI27
${secondBarcodeZpl}^FO16,290^GB${lineLength},0,2^FS
^BY2.2,3,75^FT30,395^BCN,,N,N,N,A
^FD${form.tracking_id || ''}^FS
^FT30,425^A0N,28,32^CI28^FD${form.tracking_id || ''}^FS^CI27
^PQ1,0,1,Y
^XZ
`;
}

// SVG Generator for Barcode
function generateBarcodeSvgString(trackingId, barcodeType, height = 75, displayValue = false, moduleWidth = 2) {
  if (!trackingId) return '';
  try {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    JsBarcode(svg, sanitizeForCode39(trackingId), {
      format: barcodeType === 'CODE39' ? 'CODE39' : 'CODE128',
      width: moduleWidth,
      height: height,
      displayValue: displayValue,
      font: 'monospace',
      fontSize: 14,
      margin: 4,
      background: 'transparent',
      lineColor: '#000000',
    });
    svg.setAttribute('style', 'shape-rendering: crispEdges; display: block;');
    return svg.outerHTML;
  } catch (e) {
    return `<div style="font-family: monospace; font-size: 14px;">${trackingId}</div>`;
  }
}

// Smart Parser for Multi-line & Comma-separated Indian Courier Addresses
function parseRawAddressText(rawText) {
  if (!rawText || !rawText.trim()) return {};

  let lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => {
      if (!l) return false;
      if (/^\d{4}-\d{2}-\d{2}/.test(l)) return false;
      if (l.toUpperCase() === 'NA') return false;
      return true;
    });

  let pincode = '';
  let phone = '';
  let name = '';
  let city = '';
  let state = '';
  const addressParts = [];

  const indianStates = [
    'KERALA', 'TAMIL NADU', 'KARNATAKA', 'MAHARASHTRA', 'DELHI', 
    'TELANGANA', 'ANDHRA PRADESH', 'GUJARAT', 'WEST BENGAL', 'UTTAR PRADESH'
  ];

  const pinMatch = rawText.match(/\b\d{6}\b/);
  if (pinMatch) pincode = pinMatch[0];

  const phoneMatch = rawText.match(/\b[6-9]\d{9}\b/);
  if (phoneMatch) phone = phoneMatch[0];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line === pincode || line === phone || /^\d{6}$/.test(line)) continue;

    if (indianStates.includes(line.toUpperCase())) {
      state = line;
      continue;
    }

    if (!name && !/^\d+$/.test(line) && line.length < 40) {
      name = line;
      continue;
    }

    addressParts.push(line);
  }

  if (addressParts.length > 0) {
    const lastPart = addressParts[addressParts.length - 1];
    if (lastPart.toUpperCase() === lastPart && lastPart.length < 25) {
      city = addressParts.pop();
    } else if (addressParts.length > 1) {
      city = addressParts.pop();
    }
  }

  const addr1 = addressParts[0] || '';
  const addr2 = addressParts.slice(1).join(', ') || '';

  return {
    receiver_name: name || '',
    address_line1: addr1,
    address_line2: addr2,
    receiver_city: city || '',
    receiver_postal_code: pincode || '',
    receiver_phone: phone || '',
  };
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
          quick_address_input: '',
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
          label_size: label.label_size ?? '100x150',
          label_style: label.label_style ?? 'standard',
          barcode_type: label.barcode_type ?? 'CODE128',
          show_second_barcode: label.show_second_barcode ?? true,
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

  function handleQuickPasteChange(e) {
    const rawVal = e.target.value;
    const parsed = parseRawAddressText(rawVal);

    setForm((f) => ({
      ...f,
      quick_address_input: rawVal,
      receiver_name: parsed.receiver_name || f.receiver_name,
      address_line1: parsed.address_line1 || f.address_line1,
      address_line2: parsed.address_line2 || f.address_line2,
      receiver_city: parsed.receiver_city || f.receiver_city,
      receiver_postal_code: parsed.receiver_postal_code || f.receiver_postal_code,
      receiver_phone: parsed.receiver_phone || f.receiver_phone,
    }));
  }

  function handleApplyPresets() {
    setForm((f) => ({
      ...f,
      ...PRESET_RECEIVER,
      quick_address_input: '',
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
        label_style: form.label_style || 'standard',
        barcode_type: form.barcode_type,
        show_second_barcode: form.show_second_barcode,
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
            <h3 className="text-sm font-bold text-ink-900">Tracking & Barcode Options</h3>
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
              <label className="label-text">Label Style / Layout</label>
              <select
                className="input font-semibold text-brand-600"
                value={form.label_style || 'standard'}
                onChange={(e) => update('label_style', e.target.value)}
              >
                <option value="standard">Style 1: Standard Logistics (Side Barcode)</option>
                <option value="dual">Style 2: Dual Stacked (Order + Tracking)</option>
                <option value="bold">Style 3: High Density Express</option>
              </select>
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

            {(form.label_style === 'standard' || !form.label_style) && (
              <div className="sm:col-span-2 flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => update('show_second_barcode', !form.show_second_barcode)}
                  className="flex items-center gap-2 text-sm font-semibold text-ink-800 hover:text-brand-600 cursor-pointer select-none"
                >
                  {form.show_second_barcode ? (
                    <CheckSquare className="h-5 w-5 text-brand-600" />
                  ) : (
                    <Square className="h-5 w-5 text-ink-400" />
                  )}
                  <span>Include Secondary Vertical Backup Barcode</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Customer Delivery Address & Smart Input */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-brand-600" />
              <h3 className="text-sm font-bold text-ink-900">Customer Delivery Details</h3>
            </div>
            <button
              type="button"
              onClick={handleApplyPresets}
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 underline"
            >
              Load Preset Defaults
            </button>
          </div>

          <div className="space-y-4">
            <div className="bg-brand-50/50 p-3 rounded-lg border border-brand-200/60">
              <div className="flex items-center gap-1.5 mb-1.5 text-brand-700 text-xs font-bold uppercase tracking-wider">
                <Sparkles className="h-3.5 w-3.5 text-brand-600" />
                <span>Smart Single Input (Paste Address Text Here)</span>
              </div>
              <textarea
                className="input min-h-[90px] text-xs font-mono bg-white"
                value={form.quick_address_input}
                onChange={handleQuickPasteChange}
                placeholder={`Paste multi-line raw address here, e.g.:\nAzaa\nNambili Parambath House\nKoyamon Road, Near Kathib Masjid\nMALAPPURAM\nKerala\n676306`}
              />
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
                  placeholder="e.g. 676505"
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
              <label className="label-text">Order ID / Backup Text</label>
              <input
                className="input"
                value={form.notes}
                onChange={(e) => update('notes', e.target.value)}
                placeholder="Optional (Defaults to Tracking ID)"
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

        {/* Action Controls */}
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

      {/* Live Label Preview */}
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
              <MiniStat 
                icon={Layout} 
                label="Style Layout" 
                value={(form.label_style || 'standard').toUpperCase()} 
              />
              <MiniStat 
                icon={Hash} 
                label="Type" 
                value={form.barcode_type || 'CODE128'} 
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Dynamic PRN Preview Component supporting multiple layout styles */
export function PrnLabelPreview({ form }) {
  const primaryBarcodeSvgRef = useRef(null);
  const secondaryBarcodeSvgRef = useRef(null);
  const orderBarcodeSvgRef = useRef(null);
  const wrapperRef = useRef(null);
  const [scale, setScale] = useState(1);

  const style = form?.label_style || 'standard';

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

  // Primary Barcode
  useEffect(() => {
    if (primaryBarcodeSvgRef.current && form?.tracking_id) {
      try {
        JsBarcode(primaryBarcodeSvgRef.current, sanitizeForCode39(form.tracking_id), {
          format: form.barcode_type === 'CODE39' ? 'CODE39' : 'CODE128',
          width: style === 'bold' ? 2.5 : 2.2,
          height: style === 'bold' ? 80 : 65,
          displayValue: false,
          margin: 0,
          background: 'transparent',
          lineColor: '#000000',
        });
        primaryBarcodeSvgRef.current.setAttribute('style', 'shape-rendering: crispEdges; display: block;');
      } catch (e) {
        console.error('Primary Barcode Error:', e);
      }
    }
  }, [form?.tracking_id, form?.barcode_type, style]);

  // Secondary Backup Barcode
  useEffect(() => {
    const backupValue = form?.notes || form?.tracking_id;
    if (secondaryBarcodeSvgRef.current && form?.show_second_barcode && backupValue && style === 'standard') {
      try {
        JsBarcode(secondaryBarcodeSvgRef.current, sanitizeForCode39(backupValue), {
          format: form.barcode_type === 'CODE39' ? 'CODE39' : 'CODE128',
          width: 1.8,            
          height: 40,           
          displayValue: false,
          margin: 2,            
          background: '#ffffff',
          lineColor: '#000000',
        });
        secondaryBarcodeSvgRef.current.setAttribute('style', 'shape-rendering: crispEdges; display: block;');
      } catch (e) {
        console.error('Secondary Barcode Error:', e);
      }
    }
  }, [form?.notes, form?.tracking_id, form?.barcode_type, form?.show_second_barcode, style]);

  // Order Barcode
  useEffect(() => {
    if (orderBarcodeSvgRef.current && form?.notes && style === 'dual') {
      try {
        JsBarcode(orderBarcodeSvgRef.current, sanitizeForCode39(form.notes), {
          format: 'CODE128',
          width: 1.5,
          height: 35,
          displayValue: false,
          margin: 0,
          background: 'transparent',
          lineColor: '#000000',
        });
        orderBarcodeSvgRef.current.setAttribute('style', 'shape-rendering: crispEdges; display: block;');
      } catch (e) {
        console.error('Order Barcode Error:', e);
      }
    }
  }, [form?.notes, style]);

  const nativeWidth = 669;
  const nativeHeight = 467;

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
          fontFamily: 'Inter, sans-serif, monospace',
          boxSizing: 'border-box',
          overflow: 'hidden',
          padding: '16px',
        }}
      >
        {style === 'dual' && (
          <div style={{ width: '100%', height: '100%', border: '2px solid #000', padding: '12px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: '8px' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b' }}>EXPRESS COURIER</div>
                <div style={{ fontSize: '20px', fontWeight: '900' }}>{form?.courier_name || 'COURIER'}</div>
              </div>
            </div>

            <div style={{ fontSize: '13px' }}>
              <div style={{ fontWeight: 'bold', color: '#64748b' }}>DELIVER TO:</div>
              <div style={{ fontSize: '18px', fontWeight: '900' }}>{form?.receiver_name || ''}</div>
              <div>{form?.address_line1 || ''} {form?.address_line2 || ''}</div>
              <div style={{ fontWeight: 'bold' }}>CITY: {form?.receiver_city || ''} ({form?.receiver_postal_code || ''})</div>
            </div>

            <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b' }}>ORDER REF BARCODE</div>
                <svg ref={orderBarcodeSvgRef}></svg>
                <div style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 'bold' }}>{form?.notes || '-'}</div>
              </div>
              <div style={{ fontSize: '12px', fontWeight: 'bold', background: '#e2e8f0', padding: '6px 12px', borderRadius: '4px' }}>
                PREPAID
              </div>
            </div>

            <div style={{ borderTop: '2px solid #000', paddingTop: '6px' }}>
              <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b' }}>PRIMARY WAYBILL</div>
              <svg ref={primaryBarcodeSvgRef}></svg>
              <div style={{ fontSize: '20px', fontWeight: '900', fontFamily: 'monospace', letterSpacing: '0.08em' }}>{form?.tracking_id || '-'}</div>
            </div>
          </div>
        )}

        {style === 'bold' && (
          <div style={{ width: '100%', height: '100%', border: '4px solid #000', padding: '12px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ background: '#000', color: '#fff', padding: '8px 12px', margin: '-12px -12px 8px -12px', display: 'flex', justify: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: '900', fontSize: '20px' }}>{(form?.courier_name || 'COURIER').toUpperCase()}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', borderBottom: '2px solid #000', paddingBottom: '8px' }}>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '10px', color: '#64748b' }}>SHIP TO:</div>
                <div style={{ fontWeight: '900', fontSize: '16px' }}>{form?.receiver_name || ''}</div>
                <div style={{ fontSize: '12px' }}>{form?.address_line1 || ''}</div>
                <div style={{ fontSize: '12px' }}>{form?.receiver_city || ''} - {form?.receiver_postal_code || ''}</div>
              </div>
              <div style={{ borderLeft: '1px solid #cbd5e1', paddingLeft: '8px' }}>
                <div style={{ fontWeight: 'bold', fontSize: '10px', color: '#64748b' }}>ORDER DETAILS:</div>
                <div style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '14px' }}>{form?.notes || '-'}</div>
                <div style={{ fontSize: '11px', color: '#475569', marginTop: '6px' }}>WEIGHT: {form?.weight || '0.50'} KG</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
              <svg ref={primaryBarcodeSvgRef}></svg>
              <div style={{ fontSize: '24px', fontWeight: '900', fontFamily: 'monospace', letterSpacing: '0.1em', marginTop: '6px' }}>{form?.tracking_id || '-'}</div>
            </div>
          </div>
        )}

        {style === 'standard' && (
          <div style={{ width: '100%', height: '100%', border: '2px solid #000000', boxSizing: 'border-box', position: 'relative', padding: '14px' }}>
            {form?.show_second_barcode && (
              <div style={{ position: 'absolute', right: '15px', top: '20px', bottom: '20px', width: '65px', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                <div style={{ transform: 'rotate(90deg)', transformOrigin: 'center center', display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: '#ffffff', padding: '4px', whiteSpace: 'nowrap' }}>
                  <svg ref={secondaryBarcodeSvgRef}></svg>
                  <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 'bold', marginTop: '2px' }}>
                    {form?.notes || form?.tracking_id || 'BACKUP'}
                  </span>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justify: 'space-between', borderBottom: '2px solid #000000', paddingBottom: '8px', marginBottom: '10px', paddingRight: form?.show_second_barcode ? '100px' : '0px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ backgroundColor: '#000000', color: '#ffffff', padding: '5px', borderRadius: '6px' }}>
                  <PackageCheck className="h-5 w-5 stroke-[2.5]" />
                </div>
                <span style={{ fontSize: '22px', fontWeight: '900', letterSpacing: '0.05em' }}>KOT - PRN</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#f1f5f9', padding: '4px 12px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                <Truck className="h-5 w-5 stroke-[2]" />
                <span style={{ fontSize: '16px', fontWeight: '700' }}>{form?.courier_name || 'COURIER'}</span>
              </div>
            </div>

            <div style={{ minHeight: '120px', paddingRight: form?.show_second_barcode ? '100px' : '0px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '4px', letterSpacing: '0.05em' }}>
                <MapPin className="h-3.5 w-3.5" />
                <span>SHIP TO:</span>
              </div>
              <div style={{ fontSize: '18px', fontWeight: '800', marginBottom: '4px' }}>{form?.receiver_name || ''}</div>
              <div style={{ fontSize: '14px', lineHeight: '20px', color: '#1e293b' }}>
                {form?.address_line1 && <div>{form.address_line1}</div>}
                {form?.address_line2 && <div>{form.address_line2}</div>}
              </div>
              <div style={{ fontSize: '14px', fontWeight: '700', marginTop: '6px' }}>
                CITY: {form?.receiver_city || ''} &nbsp;|&nbsp; PIN: {form?.receiver_postal_code || ''}
              </div>
            </div>

            <div style={{ borderTop: '2px solid #000000', borderBottom: '2px solid #000000', padding: '6px 0', margin: '8px 0', marginRight: form?.show_second_barcode ? '100px' : '0px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText className="h-4 w-4" />
              <span style={{ fontSize: '15px', fontWeight: '700' }}>ORDER ID: {form?.notes || '-'}</span>
            </div>

            <div style={{ display: 'flex', itemsCenter: 'flex-end', justifyContent: 'space-between', marginTop: '8px', paddingRight: form?.show_second_barcode ? '100px' : '0px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '2px' }}>
                  <Barcode className="h-3.5 w-3.5" />
                  <span>BARCODE TRACKING</span>
                </div>
                <svg ref={primaryBarcodeSvgRef}></svg>
                <div style={{ fontSize: '20px', fontWeight: '900', fontFamily: 'monospace', letterSpacing: '0.08em', color: '#000000', marginTop: '4px' }}>
                  {form?.tracking_id || '-'}
                </div>
              </div>
            </div>
          </div>
        )}
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
  if (!settings) return {};
  return {
    label_size: settings.defaultLabelSize || '100x150',
    courier_name: settings.defaultCourier || 'Ekart',
    barcode_type: settings.barcode?.type || 'CODE128',
    receiver_country: 'India',
  };
}

/* Renders HTML String for Direct Print Engine (Print-Forced High Contrast Pure SVGs) */
function renderPrnLabelHtml(form) {
  const style = form?.label_style || 'standard';
  const addressLines = [form?.address_line1, form?.address_line2].filter(Boolean);
  
  // Barcode graphics
  const primaryBarcodeSvg = generateBarcodeSvgString(form?.tracking_id, form?.barcode_type, style === 'bold' ? 80 : 65, false, style === 'bold' ? 2.5 : 2.2);
  const backupValue = form?.notes || form?.tracking_id;
  
  const secondaryBarcodeSvg = form?.show_second_barcode && backupValue 
    ? generateBarcodeSvgString(backupValue, form?.barcode_type, 40, false, 1.8)
    : '';
  const orderBarcodeSvg = form?.notes ? generateBarcodeSvgString(form.notes, 'CODE128', 35, false, 1.5) : '';

  // Embedded Printer-Safe Vector Icons (Forced Black/White contrast)
  const iconPackageCheck = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle;"><path d="M16 16l2 2 4-4"/><path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14"/></svg>`;
  const iconTruck = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle;"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`;
  const iconMapPin = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle;"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;
  const iconFileText = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle;"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>`;
  const iconBarcode = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle;"><path d="M3 5v14"/><path d="M8 5v14"/><path d="M12 5v14"/><path d="M17 5v14"/><path d="M21 5v14"/></svg>`;

  if (style === 'dual') {
    return `
      <div style="width:669px; height:467px; background:#fff; color:#000; font-family:sans-serif; padding:16px; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact;">
        <div style="width:100%; height:100%; border:2px solid #000; padding:12px; box-sizing:border-box; display:flex; flex-direction:column; justify-content:space-between;">
          <div style="display:flex; justify-content:space-between; border-bottom:2px solid #000; padding-bottom:8px;">
            <div>
              <div style="font-size:12px; font-weight:bold; color:#000;">EXPRESS COURIER</div>
              <div style="font-size:20px; font-weight:900;">${form?.courier_name || 'COURIER'}</div>
            </div>
          </div>
          <div style="font-size:13px;">
            <div style="font-weight:bold; color:#000;">DELIVER TO:</div>
            <div style="font-size:18px; font-weight:900;">${form?.receiver_name || ''}</div>
            <div>${form?.address_line1 || ''} ${form?.address_line2 || ''}</div>
            <div style="font-size:14px; font-weight:bold;">CITY: ${form?.receiver_city || ''} (${form?.receiver_postal_code || ''})</div>
          </div>
          <div style="border-top:1px solid #000; padding-top:6px; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-size:10px; font-weight:bold; color:#000;">ORDER REF BARCODE</div>
              ${orderBarcodeSvg}
              <div style="font-size:12px; font-family:monospace; font-weight:bold;">${form?.notes || '-'}</div>
            </div>
            <div style="font-size:12px; font-weight:bold; border:1px solid #000; padding:6px 12px; border-radius:4px;">PREPAID</div>
          </div>
          <div style="border-top:2px solid #000; padding-top:6px;">
            <div style="font-size:10px; font-weight:bold; color:#000;">PRIMARY WAYBILL</div>
            ${primaryBarcodeSvg}
            <div style="font-size:20px; font-weight:900; font-family:monospace; letter-spacing:0.08em;">${form?.tracking_id || '-'}</div>
          </div>
        </div>
      </div>
    `;
  }

  if (style === 'bold') {
    return `
      <div style="width:669px; height:467px; background:#fff; color:#000; font-family:sans-serif; padding:16px; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact;">
        <div style="width:100%; height:100%; border:4px solid #000; padding:12px; box-sizing:border-box; display:flex; flex-direction:column; justify-content:space-between;">
          <div style="background:#000 !important; color:#fff !important; padding:8px 12px; margin:-12px -12px 8px -12px; display:flex; justify-content:space-between; align-items:center;">
            <span style="font-weight:900; font-size:20px; color:#ffffff !important;">${(form?.courier_name || 'COURIER').toUpperCase()}</span>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; border-bottom:2px solid #000; padding-bottom:8px;">
            <div>
              <div style="font-weight:bold; font-size:10px; color:#000;">SHIP TO:</div>
              <div style="font-weight:900; font-size:16px;">${form?.receiver_name || ''}</div>
              <div style="font-size:12px;">${form?.address_line1 || ''}</div>
              <div style="font-size:12px;">${form?.receiver_city || ''} - ${form?.receiver_postal_code || ''}</div>
            </div>
            <div style="border-left:1px solid #000; padding-left:8px;">
              <div style="font-weight:bold; font-size:10px; color:#000;">ORDER DETAILS:</div>
              <div style="font-family:monospace; font-weight:bold; font-size:14px;">${form?.notes || '-'}</div>
              <div style="font-size:11px; color:#000; margin-top:6px;">WEIGHT: ${form?.weight || '0.50'} KG</div>
            </div>
          </div>
          <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:12px; border:1px solid #000; border-radius:6px;">
            ${primaryBarcodeSvg}
            <div style="font-size:24px; font-weight:900; font-family:monospace; letter-spacing:0.1em; margin-top:6px;">${form?.tracking_id || '-'}</div>
          </div>
        </div>
      </div>
    `;
  }

  const hasSecond = form?.show_second_barcode && backupValue;

  return `
    <div style="
      width: 669px;
      height: 467px;
      position: relative;
      background: #ffffff;
      color: #000000;
      font-family: Inter, sans-serif, monospace;
      box-sizing: border-box;
      overflow: hidden;
      padding: 16px;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    ">
      <div style="
        width: 100%;
        height: 100%;
        border: 2px solid #000000;
        box-sizing: border-box;
        position: relative;
        padding: 14px;
      ">
        ${secondaryBarcodeSvg ? `
          <div style="
            position: absolute;
            right: 15px;
            top: 20px;
            bottom: 20px;
            width: 65px;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10;
          ">
            <div style="
              transform: rotate(90deg);
              transform-origin: center center;
              display: flex;
              flex-direction: column;
              align-items: center;
              background-color: #ffffff;
              padding: 4px;
              white-space: nowrap;
            ">
              ${secondaryBarcodeSvg}
              <span style="font-size: 11px; font-family: monospace; font-weight: bold; margin-top: 2px;">${backupValue}</span>
            </div>
          </div>
        ` : ''}

        <div style="
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 2px solid #000000;
          padding-bottom: 8px;
          margin-bottom: 10px;
          padding-right: ${hasSecond ? '100px' : '0px'};
        ">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="background-color: #000000 !important; color: #ffffff !important; padding: 5px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center;">
              ${iconPackageCheck}
            </div>
            <span style="font-size: 22px; font-weight: 900; letter-spacing: 0.05em;">KOT - PRN</span>
          </div>
          <div style="display: flex; align-items: center; gap: 6px; background-color: #ffffff; padding: 4px 12px; border-radius: 4px; border: 1px solid #000000;">
            ${iconTruck}
            <span style="font-size: 16px; font-weight: 700;">${form?.courier_name || 'COURIER'}</span>
          </div>
        </div>

        <div style="min-height: 120px; padding-right: ${hasSecond ? '100px' : '0px'};">
          <div style="display: flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 700; color: #000000; margin-bottom: 4px; letter-spacing: 0.05em;">
            ${iconMapPin}
            <span>SHIP TO:</span>
          </div>
          <div style="font-size: 18px; font-weight: 800; margin-bottom: 4px;">
            ${form?.receiver_name || ''}
          </div>
          <div style="font-size: 14px; line-height: 20px; color: #000000;">
            ${addressLines.map((l) => `<div>${l}</div>`).join('')}
          </div>
          <div style="font-size: 14px; font-weight: 700; margin-top: 6px;">
            CITY: ${form?.receiver_city || ''} &nbsp;|&nbsp; PIN: ${form?.receiver_postal_code || ''}
          </div>
        </div>

        <div style="
          border-top: 2px solid #000000;
          border-bottom: 2px solid #000000;
          padding: 6px 0;
          margin: 8px 0;
          margin-right: ${hasSecond ? '100px' : '0px'};
          font-size: 15px;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 6px;
        ">
          ${iconFileText}
          <span>ORDER ID: ${form?.notes || '-'}</span>
        </div>

        <div style="
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          margin-top: 8px;
          padding-right: ${hasSecond ? '100px' : '0px'};
        ">
          <div>
            <div style="display: flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; color: #000000; margin-bottom: 2px;">
              ${iconBarcode}
              <span>BARCODE TRACKING</span>
            </div>
            ${primaryBarcodeSvg}
            <div style="font-size: 20px; font-weight: 900; font-family: monospace; letter-spacing: 0.08em; color: #000000; margin-top: 4px;">
              ${form?.tracking_id || '-'}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}