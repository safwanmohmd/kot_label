import { useRef, useState } from 'react';
import { Save, RotateCcw, Building2, ScanLine, Check, Move } from 'lucide-react';
import {
  DEFAULT_CUSTOMER_POSITION,
  DEFAULT_CUSTOM_LABEL_SIZE,
  DEFAULT_LABEL_HEADER,
  CUSTOM_LABEL_SIZE_KEY,
  useSettings,
} from '../lib/settings.js';
import { useToast } from '../lib/useToast.jsx';
import {
  COURIER_OPTIONS,
  DEFAULT_BARCODE_SETTINGS,
  LABEL_SIZES,
  getLabelSize,
} from '../types/label.js';
import { Barcode } from '../components/Barcode.jsx';

const DEFAULT_SETTINGS = {
  barcode: DEFAULT_BARCODE_SETTINGS,
  defaultLabelSize: '100x150',
  defaultCourier: 'ekart',
  organizationName: 'ElasticRunKottakkal_KOT',
  organizationAddress: '',
  customLabelSize: DEFAULT_CUSTOM_LABEL_SIZE,
  customerPosition: DEFAULT_CUSTOMER_POSITION,
  labelHeader: {
    ...DEFAULT_LABEL_HEADER,
    show: true, // Defaulting to enabled structural display
  },
};

export function Settings() {
  const [settings, setSettings] = useSettings();
  const toast = useToast();
  const [draft, setDraft] = useState({
    ...DEFAULT_SETTINGS,
    ...settings,
    labelHeader: {
      show: true, // Safeguard fallback if missing from state core
      ...(settings?.labelHeader || DEFAULT_LABEL_HEADER),
    }
  });

  function update(key, value) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function updateBarcode(key, value) {
    setDraft((d) => ({ ...d, barcode: { ...d.barcode, [key]: value } }));
  }

  function updateCustomLabelSize(key, value) {
    setDraft((d) => ({
      ...d,
      customLabelSize: { ...d.customLabelSize, [key]: Number(value) },
    }));
  }

  function updateCustomerPosition(next) {
    setDraft((d) => ({
      ...d,
      customerPosition: { ...d.customerPosition, ...next },
    }));
  }

  function updateLabelHeader(key, value) {
    setDraft((d) => ({
      ...d,
      labelHeader: { ...d.labelHeader, [key]: key === 'heightMm' ? Number(value) : value },
    }));
  }

  function handleSave() {
    setSettings(draft);
    toast('Settings saved.', 'success');
  }

  function handleReset() {
    setDraft({
      ...DEFAULT_SETTINGS,
      barcode: { ...DEFAULT_BARCODE_SETTINGS },
      customLabelSize: { ...DEFAULT_CUSTOM_LABEL_SIZE },
      customerPosition: { ...DEFAULT_CUSTOMER_POSITION },
      labelHeader: { ...DEFAULT_LABEL_HEADER, show: true },
    });
    toast('Settings reset to defaults.', 'info');
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);
  const labelOptions = [
    ...LABEL_SIZES,
    {
      key: CUSTOM_LABEL_SIZE_KEY,
      name: `${draft.customLabelSize.widthMm} x ${draft.customLabelSize.heightMm} mm`,
      description: 'Custom',
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl">
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="h-4 w-4 text-brand-600" />
          <h3 className="text-sm font-bold text-ink-900">Organization</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="label-text">Organization Name</label>
            <input
              className="input"
              value={draft.organizationName}
              onChange={(e) => update('organizationName', e.target.value)}
              placeholder="Your company name"
            />
            <p className="text-xs text-ink-500 mt-1">Appears in the label header.</p>
          </div>
          <div className="sm:col-span-2">
            <label className="label-text">Default Sender Address</label>
            <textarea
              className="input min-h-[60px] resize-y"
              value={draft.organizationAddress}
              onChange={(e) => update('organizationAddress', e.target.value)}
              placeholder="Pre-fills the sender field on new labels"
            />
          </div>
          <div>
            <label className="label-text">Default Courier</label>
            <select
              className="input"
              value={draft.defaultCourier}
              onChange={(e) => update('defaultCourier', e.target.value)}
            >
              {COURIER_OPTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-text">Default Label Size</label>
            <select
              className="input"
              value={draft.defaultLabelSize}
              onChange={(e) => update('defaultLabelSize', e.target.value)}
            >
              {labelOptions.map((s) => (
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
          <Move className="h-4 w-4 text-brand-600" />
          <h3 className="text-sm font-bold text-ink-900">Label Layout</h3>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-text">Custom Width (mm)</label>
                <input type="number" min={25} max={300} className="input" value={draft.customLabelSize.widthMm} onChange={(e) => updateCustomLabelSize('widthMm', e.target.value)} />
              </div>
              <div>
                <label className="label-text">Custom Height (mm)</label>
                <input type="number" min={15} max={300} className="input" value={draft.customLabelSize.heightMm} onChange={(e) => updateCustomLabelSize('heightMm', e.target.value)} />
              </div>
            </div>

            {/* NEW MODULE: Header Layout Activation Controls Toggle */}
            <div className="bg-ink-50/50 p-3 rounded-lg border border-ink-100">
              <label className="flex items-center gap-2 text-sm font-bold text-ink-800 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={draft.labelHeader.show !== false}
                  onChange={(e) => updateLabelHeader('show', e.target.checked)}
                  className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                />
                Enable Top Bar Header
              </label>
              <p className="text-[11px] text-ink-500 mt-1">
                Toggles the colored header bar containing shipping block logs.
              </p>
            </div>

            {/* Conditional Submenus rendering based on local layout validation checkbox status */}
            {draft.labelHeader.show !== false && (
              <div className="space-y-4 border-l-2 border-ink-100 pl-3 pt-1 animate-fade-in">
                <div>
                  <label className="label-text">Top Bar Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      className="h-10 w-14 rounded border border-ink-200 cursor-pointer"
                      value={draft.labelHeader.color}
                      onChange={(e) => updateLabelHeader('color', e.target.value)}
                    />
                    <input
                      className="input flex-1 font-mono"
                      value={draft.labelHeader.color}
                      onChange={(e) => updateLabelHeader('color', e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="label-text">Top Bar Height</label>
                  <input
                    type="range"
                    min={1}
                    max={40}
                    value={draft.labelHeader.heightMm}
                    onChange={(e) => updateLabelHeader('heightMm', e.target.value)}
                    className="w-full accent-blue-600"
                  />
                  <p className="text-xs text-ink-500 mt-1">{draft.labelHeader.heightMm} mm</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-text">Customer Width</label>
                <input type="range" min={30} max={160} value={draft.customerPosition.widthMm} onChange={(e) => updateCustomerPosition({ widthMm: Number(e.target.value) })} className="w-full accent-blue-600" />
              </div>
              <div>
                <label className="label-text">Customer Text</label>
                <input type="range" min={2} max={22} value={draft.customerPosition.fontSize} onChange={(e) => updateCustomerPosition({ fontSize: Number(e.target.value) })} className="w-full accent-blue-600" />
              </div>
            </div>
          </div>

          <LabelLayoutEditor draft={draft} updateCustomerPosition={updateCustomerPosition} />
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <ScanLine className="h-4 w-4 text-brand-600" />
          <h3 className="text-sm font-bold text-ink-900">Barcode Defaults</h3>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="label-text">Default Barcode Type</label>
              <select
                className="input"
                value={draft.barcode.type}
                onChange={(e) => updateBarcode('type', e.target.value)}
              >
                <option value="CODE128">Code128 (recommended)</option>
                <option value="CODE39">Code39</option>
                <option value="QR">QR Code</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label-text">Bar Width</label>
                <input type="number" min={1} max={6} className="input" value={draft.barcode.width} onChange={(e) => updateBarcode('width', Number(e.target.value))} />
              </div>
              <div>
                <label className="label-text">Bar Height (px)</label>
                <input type="number" min={20} max={200} className="input" value={draft.barcode.height} onChange={(e) => updateBarcode('height', Number(e.target.value))} />
              </div>
              <div>
                <label className="label-text">Font Size</label>
                <input type="number" min={6} max={32} className="input" value={draft.barcode.fontSize} onChange={(e) => updateBarcode('fontSize', Number(e.target.value))} />
              </div>
              <div>
                <label className="label-text">Margin</label>
                <input type="number" min={0} max={20} className="input" value={draft.barcode.margin} onChange={(e) => updateBarcode('margin', Number(e.target.value))} />
              </div>
            </div>
            <div>
              <label className="label-text">Bar Color</label>
              <div className="flex items-center gap-2">
                <input type="color" className="h-10 w-14 rounded border border-ink-200 cursor-pointer" value={draft.barcode.lineColor} onChange={(e) => updateBarcode('lineColor', e.target.value)} />
                <input className="input flex-1 font-mono" value={draft.barcode.lineColor} onChange={(e) => updateBarcode('lineColor', e.target.value)} />
              </div>
            </div>
            <div>
              <label className="label-text">Background</label>
              <div className="flex items-center gap-2">
                <input type="color" className="h-10 w-14 rounded border border-ink-200 cursor-pointer" value={draft.barcode.background} onChange={(e) => updateBarcode('background', e.target.value)} />
                <input className="input flex-1 font-mono" value={draft.barcode.background} onChange={(e) => updateBarcode('background', e.target.value)} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink-700">
              <input
                type="checkbox"
                checked={draft.barcode.displayValue}
                onChange={(e) => updateBarcode('displayValue', e.target.checked)}
                className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
              />
              Show tracking ID text under barcode
            </label>
          </div>

          <div>
            <label className="label-text">Live Preview</label>
            <div className="rounded-lg border border-ink-200 bg-white p-6 flex items-center justify-center min-h-[200px]">
              <Barcode
                value="1Z999AA10123456784"
                settings={draft.barcode}
                className="w-full max-w-xs h-32 flex items-center justify-center"
              />
            </div>
            <p className="text-xs text-ink-500 mt-2">
              Preview uses a sample tracking ID. Changes apply to new labels.
            </p>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-bold text-ink-900 mb-4">Supported Label Sizes</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {LABEL_SIZES.map((s) => (
            <div key={s.key} className="rounded-lg border border-ink-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-ink-900">{s.name}</span>
                {draft.defaultLabelSize === s.key && (
                  <span className="badge bg-brand-100 text-brand-700">
                    <Check className="h-3 w-3" /> Default
                  </span>
                )}
              </div>
              <p className="text-xs text-ink-500 mb-3">{s.description}</p>
              <div className="flex items-end gap-1 h-20">
                <div
                  className="bg-brand-100 border border-brand-300 rounded"
                  style={{
                    width: `${Math.min(60, (s.widthMm / Math.max(s.widthMm, s.heightMm)) * 60)}px`,
                    height: `${Math.min(72, (s.heightMm / Math.max(s.widthMm, s.heightMm)) * 60)}px`,
                  }}
                />
              </div>
              <p className="text-[10px] text-ink-400 mt-2 font-mono">
                {s.widthMm} x {s.heightMm} mm
                {s.perSheet ? ` - ${s.perSheet}/sheet` : ''}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-4 flex items-center gap-2 sticky bottom-4">
        <button onClick={handleSave} disabled={!dirty} className="btn-primary">
          <Save className="h-4 w-4" /> Save Settings
        </button>
        <button onClick={handleReset} disabled={!dirty} className="btn-ghost">
          <RotateCcw className="h-4 w-4" /> Reset to Defaults
        </button>
        {dirty && <span className="text-xs text-amber-600 ml-2">Unsaved changes</span>}
      </div>
    </div>
  );
}

function LabelLayoutEditor({ draft, updateCustomerPosition }) {
  const previewRef = useRef(null);
  const size = draft.defaultLabelSize === CUSTOM_LABEL_SIZE_KEY
    ? { widthMm: draft.customLabelSize.widthMm, heightMm: draft.customLabelSize.heightMm }
    : getLabelSize(draft.defaultLabelSize);
  const scale = Math.min(3.2, 300 / size.widthMm, 430 / size.heightMm);
  const widthPx = size.widthMm * scale;
  const heightPx = size.heightMm * scale;
  const customer = draft.customerPosition;
  const bodyFontSize = Math.max(8, customer.fontSize - 2);

  const isHeaderVisible = draft.labelHeader.show !== false;
  // Calculate dynamic offsets so layout stays intact if header is pulled out
  const headerHeightMm = isHeaderVisible ? draft.labelHeader.heightMm : 0;

  function moveCustomer(e) {
    const rect = previewRef.current?.getBoundingClientRect();
    if (!rect) return;
    const xMm = clamp((e.clientX - rect.left) / scale, 0, Math.max(0, size.widthMm - customer.widthMm));
    const yMm = clamp((e.clientY - rect.top) / scale, 0, Math.max(0, size.heightMm - 25));
    updateCustomerPosition({ xMm: Math.round(xMm), yMm: Math.round(yMm) });
  }

  function handlePointerDown(e) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    moveCustomer(e);
  }

  return (
    <div className="rounded-lg border border-ink-200 bg-ink-100 p-4 overflow-auto">
      <div className="flex justify-center min-w-[320px]">
        <div
          ref={previewRef}
          className="relative bg-white border border-ink-300 shadow-card overflow-hidden"
          style={{ width: `${widthPx}px`, height: `${heightPx}px` }}
          onPointerMove={(e) => {
            if (e.buttons === 1) moveCustomer(e);
          }}
        >
          {/* Top Bar Header Section - Rendered conditionally based on draft setup */}
          {isHeaderVisible && (
            <div
              className="absolute inset-x-0 top-0 px-3 flex items-center justify-between text-white"
              style={{ height: `${headerHeightMm * scale}px`, backgroundColor: draft.labelHeader.color }}
            >
              <div>
                <p className="text-[8px] font-bold leading-tight">SHIPPING LABEL</p>
                <p className="text-[8px] text-white/80 leading-tight">{draft.organizationName || 'ElasticRunKottakkal_KOT'}</p>
              </div>
              <p className="text-[9px] font-bold bg-white/15 px-2 py-0.5 rounded">{draft.defaultCourier}</p>
            </div>
          )}
          
          <div className="absolute" style={{ left: `${5 * scale}px`, top: `${(headerHeightMm + 5) * scale}px`, right: `${5 * scale}px` }}>
            <p className="text-[8px] font-bold text-ink-500">TRACKING ID</p>
            <p className="text-[11px] font-mono font-bold">1Z999AA10123456784</p>
          </div>
          <div
            className="absolute rounded border border-ink-200 bg-white flex items-center justify-center text-[10px] font-mono text-ink-500"
            style={{ left: `${5 * scale}px`, top: `${(headerHeightMm + 20) * scale}px`, width: `${(size.widthMm - 10) * scale}px`, height: `${20 * scale}px` }}
          >
            BARCODE
          </div>
          <div
            className="absolute cursor-move border-2 border-brand-500 bg-white/90 p-1 shadow-sm select-none touch-none"
            style={{ left: `${customer.xMm * scale}px`, top: `${customer.yMm * scale}px`, width: `${customer.widthMm * scale}px` }}
            onPointerDown={handlePointerDown}
          >
            <p className="text-[8px] font-bold text-brand-600">SHIP TO</p>
            <p className="font-bold text-ink-900 leading-tight" style={{ fontSize: `${customer.fontSize}px` }}>Customer Name</p>
            <p className="text-ink-700 leading-snug" style={{ fontSize: `${bodyFontSize}px` }}>Customer address line</p>
            <p className="text-ink-700 leading-snug" style={{ fontSize: `${bodyFontSize}px` }}>City 12345</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}