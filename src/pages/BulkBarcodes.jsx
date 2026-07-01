import { useEffect, useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import {
  ScanLine,
  Upload,
  Trash2,
  AlertCircle,
  Filter,
  XCircle,
  Copy,
  History,
  CornerDownLeft
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
  
  // --- EXCLUSION FILTER CONFIGURATION STATES ---
  const [enableExclusions, setEnableExclusions] = useState(true);
  const [excludeWordsInput, setExcludeWordsInput] = useState(
    'FORWARD, UNDELIVERED, NA, P2, FLIPKART, ESCALATION, VERIFICATION, SHIPMENTS, PACKAGING, MANDATORY'
  );
  
  // --- LOCAL STORAGE HISTORY STATE ---
  const [historyLog, setHistoryLog] = useState(() => {
    try {
      const saved = localStorage.getItem('bulk_barcode_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const fileRef = useRef(null);
  const TRACKING_ID_EXTRACT_REGEX = /^[A-Z]{3,4}[A-Z0-9\-_]{5,15}$/i;

  // Sync history log array changes instantly with browser storage
  useEffect(() => {
    localStorage.setItem('bulk_barcode_history', JSON.stringify(historyLog));
  }, [historyLog]);

  const blockedKeywords = useMemo(() => {
    return excludeWordsInput
      .split(/[\n,;\t]+/)
      .map((w) => w.trim().toUpperCase())
      .filter(Boolean);
  }, [excludeWordsInput]);

  function parseText(text) {
    return text
      .split(/\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function buildEntries(lines) {
    const countsMap = new Map();
    const rawParsedValues = [];

    for (let segment of lines) {
      let targetValue = segment;
      const upperSegment = segment.toUpperCase();

      if (enableExclusions) {
        if (blockedKeywords.some(keyword => upperSegment === keyword || upperSegment.includes(keyword))) {
          continue;
        }
      }

      if (onlyTrackingIds) {
        if (TRACKING_ID_EXTRACT_REGEX.test(segment)) {
          targetValue = segment.toUpperCase();
        } else {
          continue;
        }
      }

      const value = barcodeType === 'CODE39' ? sanitizeForCode39(targetValue) : targetValue;
      if (!value) continue;

      countsMap.set(value, (countsMap.get(value) || 0) + 1);
      rawParsedValues.push(value);
    }

    const seen = new Set();
    const built = [];

    for (let value of rawParsedValues) {
      if (seen.has(value)) continue;
      seen.add(value);

      built.push({
        id: crypto.randomUUID(),
        value,
        count: countsMap.get(value),
        status: 'ok'
      });
    }

    return built;
  }

  const handleCopyFilteredIds = () => {
    if (entries.length === 0) return;
    const textToCopy = entries.map(entry => entry.value).join('\n');
    navigator.clipboard.writeText(textToCopy);
    toast(`Copied ${entries.length} filtered barcode tracking IDs!`, 'success');
  };

  // Saves generated snapshot data into local history loop array (Max 10 entries)
  const appendToHistory = (text, itemQuantity) => {
    if (!text.trim()) return;
    
    const newRecord = {
      id: crypto.randomUUID(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      textBlock: text,
      count: itemQuantity
    };

    setHistoryLog(prev => {
      // Eliminate exact matches to avoid clutter, keeping chronological ordering clean
      const filtered = prev.filter(item => item.textBlock.trim() !== text.trim());
      return [newRecord, ...filtered].slice(0, 10);
    });
  };

  function handleGenerate() {
    const lines = parseText(rawText);
    if (lines.length === 0) {
      toast('Paste at least one line of data.', 'error');
      return;
    }
    const built = buildEntries(lines);
    setEntries(built);
    
    if (built.length > 0) {
      appendToHistory(rawText, built.length); // Commit current state snapshot to record array
      setViewMode(true);
    } else {
      toast('No valid tracking IDs found matching your filter rules.', 'error');
    }
  }

  function handleFileUpload(file) {
    const name = file.name.toLowerCase();
    if (name.endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = String(e.target?.result ?? '');
        setRawText(text);
        const parsedLines = text.split(/\s+/).map((s) => s.trim()).filter(Boolean);
        const built = buildEntries(parsedLines);
        setEntries(built);
        if (built.length > 0) {
          appendToHistory(text, built.length);
          setViewMode(true);
        }
      };
      reader.readAsText(file);
    }
  }

  const handleClearHistory = () => {
    setHistoryLog([]);
    toast('Local barcode run history cleared!', 'success');
  };

  const stats = useMemo(() => {
    return { total: entries.length };
  }, [entries]);

  if (viewMode) {
    return (
      <div className="fixed inset-0 bg-white z-[9999] overflow-y-auto flex flex-col items-center p-6">
        <div className="fixed top-4 left-4 flex items-center gap-3 z-50">
          <button 
            onClick={() => setViewMode(false)}
            className="bg-ink-900 text-white font-bold text-xs uppercase tracking-wider px-4 py-2 rounded shadow hover:bg-ink-800 transition-all"
          >
            &larr; Exit Window
          </button>
          
          <button 
            onClick={handleCopyFilteredIds}
            className="bg-brand-600 text-white font-bold text-xs uppercase tracking-wider px-4 py-2 rounded shadow hover:bg-brand-700 transition-all flex items-center gap-1.5"
          >
            <Copy className="h-3.5 w-3.5" /> Copy Filtered TIDs
          </button>

          <span className="bg-ink-100 text-ink-800 text-xs font-bold px-3 py-2 rounded shadow-sm border border-ink-200">
            Total Unique Items: {entries.length}
          </span>
        </div>

        <div className="w-full flex flex-col items-center justify-start gap-1 mt-14">
          {entries.map((entry, index) => (
            <div
              key={entry.id}
              className="relative flex items-center justify-center bg-white border-b border-ink-100 px-24 py-2 overflow-hidden group hover:bg-ink-50"
              style={{ minHeight: `${barHeight + 40}px` }}
            >
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

              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 select-none">
                <span className="text-[10px] uppercase font-bold text-ink-400 tracking-wider">Qty:</span>
                <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded-md ${
                  entry.count > 1 ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-ink-100 text-ink-700 border border-ink-200'
                }`}>
                  {entry.count}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

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
              className="w-full min-h-[220px] p-3 border border-ink-200 rounded-lg font-mono text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 resize-y"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={`Paste manifest / logistics text logs here...`}
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
                  <span>Isolate Tracking Format</span>
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
                <select className="w-full p-2 border border-ink-200 rounded-lg text-sm" value={barcodeType} onChange={(e) => setBarcodeType(e.target.value)}>
                  <option value="CODE128">Code128</option>
                  <option value="CODE39">Code39</option>
                </select>
              </div>
              <div>
                <label className="label-text">Bar Width</label>
                <input type="number" min={1} max={6} className="w-full p-2 border border-ink-200 rounded-lg text-sm" value={barWidth} onChange={(e) => setBarWidth(Number(e.target.value))} />
              </div>
              <div>
                <label className="label-text">Bar Height (px)</label>
                <input type="number" min={20} max={200} className="w-full p-2 border border-ink-200 rounded-lg text-sm" value={barHeight} onChange={(e) => setBarHeight(Number(e.target.value))} />
              </div>
              <div>
                <label className="label-text">Font Size</label>
                <input type="number" min={6} max={32} className="w-full p-2 border border-ink-200 rounded-lg text-sm" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-sm text-ink-700 cursor-pointer">
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
          {/* Exclusion Filter Input Widget Box */}
          <div className={`card p-5 border transition-all ${enableExclusions ? 'border-red-100 bg-white' : 'border-ink-200 bg-ink-50/50'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className={`flex items-center gap-1.5 font-bold text-sm ${enableExclusions ? 'text-red-700' : 'text-ink-500'}`}>
                <XCircle className="h-4 w-4" />
                <h3>Exclusion Keywords Block</h3>
              </div>
              
              <label className="flex items-center gap-1.5 text-xs font-bold cursor-pointer select-none text-ink-700">
                <span>Active</span>
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-ink-300 text-red-600 focus:ring-red-500 cursor-pointer"
                  checked={enableExclusions}
                  onChange={(e) => setEnableExclusions(e.target.checked)}
                />
              </label>
            </div>
            
            <p className="text-[11px] text-ink-500 mb-2">
              Any word typed here (comma or line separated) will be strictly prevented from turning into barcodes.
            </p>
            <textarea
              disabled={!enableExclusions}
              className={`w-full p-2 border rounded-lg font-mono text-xs focus:ring-2 focus:ring-red-500 focus:border-red-500 min-h-[110px] resize-y transition-all ${
                enableExclusions 
                  ? 'bg-red-50/20 text-red-900 border-ink-200' 
                  : 'bg-ink-100/50 text-ink-400 border-ink-200 cursor-not-allowed'
              }`}
              value={excludeWordsInput}
              onChange={(e) => setExcludeWordsInput(e.target.value)}
              placeholder="e.g., FORWARD, UNDELIVERED, P2"
            />
          </div>

          {/* NEW MODULE: Local Workspace History Deck Panel Tracker */}
          <div className="card p-5 border border-ink-200 bg-white">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 font-bold text-sm text-ink-800">
                <History className="h-4 w-4 text-brand-500" />
                <h3>Recent Run History</h3>
              </div>
              {historyLog.length > 0 && (
                <button 
                  onClick={handleClearHistory} 
                  className="text-[10px] font-bold text-red-500 hover:underline uppercase"
                >
                  Clear history
                </button>
              )}
            </div>
            
            {historyLog.length === 0 ? (
              <p className="text-xs text-ink-400 italic">No previous runs captured yet.</p>
            ) : (
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {historyLog.map((item) => (
                  <div 
                    key={item.id}
                    onClick={() => {
                      setRawText(item.textBlock);
                      toast('Restored text input from cache history!', 'success');
                    }}
                    className="flex items-center justify-between p-2 rounded-lg border border-ink-100 bg-ink-50/50 hover:bg-brand-50 hover:border-brand-200 cursor-pointer transition-all group"
                  >
                    <div className="truncate pr-2">
                      <div className="text-[11px] font-mono font-bold text-ink-800 flex items-center gap-1">
                        <span>Run @ {item.timestamp}</span>
                        <span className="text-[10px] font-normal font-sans text-ink-400">({item.count} TIDs)</span>
                      </div>
                      <p className="text-[10px] text-ink-500 truncate font-mono mt-0.5">
                        {item.textBlock.substring(0, 45)}...
                      </p>
                    </div>
                    <CornerDownLeft className="h-3 w-3 text-ink-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-bold text-ink-900 mb-4">Active Deck Counter</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm text-ink-700">
                <span>Unique Barcodes Loaded</span>
                <span className="font-bold text-green-600">{stats.total}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}