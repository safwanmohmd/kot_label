import { useEffect, useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import {
  ScanLine,
  Upload,
  Trash2,
  AlertCircle,
  Filter,
} from 'lucide-react';
import { Barcode } from '../components/Barcode.jsx';
import { useSettings } from '../lib/settings.js';
import { useToast } from '../lib/useToast.jsx';
import { sanitizeForCode39 } from '../lib/barcode.js';

export function BulkBarcodes() {
  const [settings] = useSettings();
  const toast = useToast();
  const [rawText, setRawText] = useState('');
  const [entries, setEntries] = useState([]);
  const [barcodeType, setBarcodeType] = useState(settings.barcode.type);
  const [displayValue, setDisplayValue] = useState(true);
  const [barWidth, setBarWidth] = useState(settings.barcode.width || 2);
  const [barHeight, setBarHeight] = useState(settings.barcode.height || 50);
  const [fontSize, setFontSize] = useState(settings.barcode.fontSize || 10);
  const [viewMode, setViewMode] = useState(false);
  const [onlyTrackingIds, setOnlyTrackingIds] = useState(true);
  const fileRef = useRef(null);

  const TRACKING_ID_EXTRACT_REGEX = /[A-Z]{3,4}[A-Z0-9\-_]{5,15}/i;

  function parseText(text) {
    return text
      .split(/[\n;\t]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function buildEntries(lines) {
    const seen = new Set();
    const built = [];

    for (let line of lines) {
      let targetValue = line;

      if (onlyTrackingIds) {
        const match = line.match(TRACKING_ID_EXTRACT_REGEX);
        if (match) {
          targetValue = match[0].toUpperCase();
        } else {
          continue;
        }
      }

      const value = barcodeType === 'CODE39' ? sanitizeForCode39(targetValue) : targetValue;
      if (!value) continue;

      if (seen.has(value)) continue;
      seen.add(value);

      built.push({
        id: crypto.randomUUID(),
        value,
        status: 'ok'
      });
    }

    return built;
  }

  function handleGenerate() {
    const lines = parseText(rawText);
    if (lines.length === 0) {
      toast('Paste at least one line of data.', 'error');
      return;
    }
    const built = buildEntries(lines);
    setEntries(built);
    if (built.length > 0) {
      setViewMode(true);
    } else {
      toast('No tracking IDs found in the input text.', 'error');
    }
  }

  function handleFileUpload(file) {
    const name = file.name.toLowerCase();
    if (name.endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = String(e.target?.result ?? '');
        setRawText(text);
        setEntries(buildEntries(parseText(text)));
        setViewMode(true);
      };
      reader.readAsText(file);
    }
  }

  const stats = useMemo(() => {
    return { total: entries.length };
  }, [entries]);

  // --- FULL SCREEN CLEAN SCANNING WINDOW ---
  if (viewMode) {
    return (
      <div className="fixed inset-0 bg-white z-[9999] overflow-y-auto flex flex-col items-center p-6">
        <div className="fixed top-4 left-4 flex items-center gap-4 z-50">
          <button 
            onClick={() => setViewMode(false)}
            className="bg-ink-900 text-white font-bold text-xs uppercase tracking-wider px-4 py-2 rounded shadow hover:bg-ink-800 transition-all"
          >
            ← Exit Window
          </button>
          <span className="bg-ink-100 text-ink-800 text-xs font-bold px-3 py-2 rounded shadow-sm border border-ink-200">
            Total Deck Count: {entries.length}
          </span>
        </div>

        {/* Pure vertical stack with running index counters */}
        <div className="w-full flex flex-col items-center justify-start gap-1 mt-14">
          {entries.map((entry, index) => (
            <div
              key={entry.id}
              className="relative flex items-center justify-center bg-white border-b border-ink-100 px-12 py-2 overflow-hidden group hover:bg-ink-50"
              style={{ minHeight: `${barHeight + 40}px` }}
            >
              {/* Floating Badge for the Serial Position/Count */}
              <div className="absolute left-2 top-1/2 -translate-y-1/2 bg-ink-200 text-ink-700 font-mono text-[11px] font-bold h-6 min-w-6 px-1.5 flex items-center justify-center rounded-full select-none">
                #{index + 1}
              </div>

              <Barcode
                value={entry.value}
                settings={{
                  ...settings.barcode,
                  type: barcodeType,
                  width: barWidth,
                  height: barHeight,
                  fontSize,
                  displayValue,
                }}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // --- BASE GENERATOR CONSOLE ---
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <ScanLine className="h-4 w-4 text-brand-600" />
              <h3 className="text-sm font-bold text-ink-900">Input Raw Data Block</h3>
            </div>
            <textarea
              className="input min-h-[220px] font-mono text-sm resize-y"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={`Paste raw delivery/logistics text here...`}
            />
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <button onClick={handleGenerate} className="btn-primary">
                ⚡ Open Scanning Deck
              </button>
              <button onClick={() => fileRef.current?.click()} className="btn-secondary">
                Upload File
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".txt"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileUpload(f);
                  e.target.value = '';
                }}
              />
              <div className="flex items-center bg-ink-50 border border-ink-200 px-3 py-1.5 rounded-lg gap-2 ml-auto">
                <Filter className={`h-3.5 w-3.5 ${onlyTrackingIds ? 'text-brand-600' : 'text-ink-400'}`} />
                <label className="text-xs font-semibold text-ink-700 cursor-pointer select-none flex items-center gap-2">
                  <span>Isolate Tracking Numbers</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                    checked={onlyTrackingIds}
                    onChange={(e) => setOnlyTrackingIds(e.target.checked)}
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-bold text-ink-900 mb-4">Barcode Dimensions Configuration</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="label-text">Barcode Type</label>
                <select className="input" value={barcodeType} onChange={(e) => setBarcodeType(e.target.value)}>
                  <option value="CODE128">Code128</option>
                  <option value="CODE39">Code39</option>
                </select>
              </div>
              <div>
                <label className="label-text">Bar Width</label>
                <input type="number" min={1} max={6} className="input" value={barWidth} onChange={(e) => setBarWidth(Number(e.target.value))} />
              </div>
              <div>
                <label className="label-text">Bar Height (px)</label>
                <input type="number" min={20} max={200} className="input" value={barHeight} onChange={(e) => setBarHeight(Number(e.target.value))} />
              </div>
              <div>
                <label className="label-text">Font Size</label>
                <input type="number" min={6} max={32} className="input" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm text-ink-700">
                  <input
                    type="checkbox"
                    checked={displayValue}
                    onChange={(e) => setDisplayValue(e.target.checked)}
                    className="h-4 w-4 rounded border-ink-300 text-brand-600"
                  />
                  Show text under barcode
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="card p-5">
            <h3 className="text-sm font-bold text-ink-900 mb-4">Active Deck Counter</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm text-ink-700">
                <span>Barcodes Loaded</span>
                <span className="font-bold text-green-600">{stats.total}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}