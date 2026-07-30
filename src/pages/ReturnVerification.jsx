import { useState, useRef, useEffect } from 'react';
import {
  PackageCheck,
  Scan,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Download,
  ListPlus,
  FileText,
  Keyboard,
  Copy,
  Save,
  ShieldCheck,
  Filter,
} from 'lucide-react';
import { useToast } from '../lib/useToast.jsx';

const CURRENT_SESSION_KEY = 'wm_returns_current_session_v1';
const HISTORY_KEY = 'wm_returns_saved_history_v1';

export function WishmasterReturnVerification() {
  const toast = useToast();

  // --- DUAL FILTERING STATE ---
  const [isolateTracking, setIsolateTracking] = useState(() => {
    return localStorage.getItem('wm_returns_isolate_tracking') !== 'false';
  });
  const [enableExclusions, setEnableExclusions] = useState(() => {
    return localStorage.getItem('wm_returns_enable_exclusions') !== 'false';
  });
  const [excludeWords, setExcludeWords] = useState(() => {
    return (
      localStorage.getItem('wm_returns_exclude_words') ||
      'FORWARD, UNDELIVERED, FLIPKART, ESCALATION, VERIFICATION, SHIPMENTS, PACKAGING, MANDATORY, P1, P2, P3, P4'
    );
  });

  useEffect(() => {
    localStorage.setItem('wm_returns_isolate_tracking', isolateTracking);
    localStorage.setItem('wm_returns_enable_exclusions', enableExclusions);
    localStorage.setItem('wm_returns_exclude_words', excludeWords);
  }, [isolateTracking, enableExclusions, excludeWords]);

  const extractTrackingIds = (input) => {
    if (!input) return [];

    const blockedKeywords = new Set(
      excludeWords
        .split(/[\n,;\t]+/)
        .map((w) => w.trim().toUpperCase())
        .filter(Boolean)
    );

    const filtered = [];
    const seen = new Set();

    if (isolateTracking) {
      const trackingIdRegex = /[A-Z]{3,4}[A-Z0-9\-_]{5,15}/gi;
      const matches = input.match(trackingIdRegex) || [];

      for (let match of matches) {
        const cleanId = match.toUpperCase();
        if (enableExclusions && blockedKeywords.has(cleanId)) continue;
        if (!seen.has(cleanId)) {
          seen.add(cleanId);
          filtered.push(cleanId);
        }
      }
    } else {
      const lines = input.split(/\r?\n/);
      for (let line of lines) {
        const cleanId = line.trim().toUpperCase();
        if (!cleanId) continue;
        if (enableExclusions && blockedKeywords.has(cleanId)) continue;
        if (!seen.has(cleanId)) {
          seen.add(cleanId);
          filtered.push(cleanId);
        }
      }
    }

    return filtered;
  };

  const [expectedIds, setExpectedIds] = useState(() => {
    try {
      const saved = localStorage.getItem(CURRENT_SESSION_KEY);
      return saved ? JSON.parse(saved).expectedIds || [] : [];
    } catch {
      return [];
    }
  });

  const [scannedIds, setScannedIds] = useState(() => {
    try {
      const saved = localStorage.getItem(CURRENT_SESSION_KEY);
      return saved ? JSON.parse(saved).scannedIds || [] : [];
    } catch {
      return [];
    }
  });

  const [expectedMode, setExpectedMode] = useState('bulk');
  const [returnedMode, setReturnedMode] = useState('scan');

  const [expectedScanInput, setExpectedScanInput] = useState('');
  const [expectedBulkInput, setExpectedBulkInput] = useState('');

  const [returnedScanInput, setReturnedScanInput] = useState('');
  const [returnedBulkInput, setReturnedBulkInput] = useState('');

  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem(HISTORY_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const expectedScanRef = useRef(null);
  const returnedScanRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem(
        CURRENT_SESSION_KEY,
        JSON.stringify({ expectedIds, scannedIds })
      );
    } catch (e) {
      console.error('Failed to auto-save current session state:', e);
    }
  }, [expectedIds, scannedIds]);

  useEffect(() => {
    if (expectedMode === 'scan' && expectedScanRef.current) {
      expectedScanRef.current.focus();
    }
  }, [expectedMode]);

  useEffect(() => {
    if (returnedMode === 'scan' && returnedScanRef.current) {
      returnedScanRef.current.focus();
    }
  }, [returnedMode]);

  const matched = expectedIds.filter((id) => scannedIds.includes(id));
  const missing = expectedIds.filter((id) => !scannedIds.includes(id));
  const extra = scannedIds.filter((id) => !expectedIds.includes(id));

  const saveCurrentSessionToHistory = () => {
    if (expectedIds.length === 0 && scannedIds.length === 0) {
      toast('No data in current session to save!', 'error');
      return false;
    }

    const newSession = {
      id: Date.now(),
      timestamp: new Date().toLocaleString([], {
        dateStyle: 'short',
        timeStyle: 'short',
      }),
      expectedCount: expectedIds.length,
      returnedCount: scannedIds.length,
      matchedCount: matched.length,
      missingCount: missing.length,
      extraCount: extra.length,
      expectedIds: [...expectedIds],
      scannedIds: [...scannedIds],
    };

    const updatedHistory = [newSession, ...history].slice(0, 5);
    setHistory(updatedHistory);

    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory));
      toast('Saved run snapshot to history!', 'success');
      return true;
    } catch (e) {
      console.error('Failed to save session to history:', e);
      return false;
    }
  };

  const handleReset = () => {
    if (expectedIds.length > 0 || scannedIds.length > 0) {
      if (confirm('Save current session snapshot before clearing?')) {
        saveCurrentSessionToHistory();
      }
    }
    setExpectedIds([]);
    setScannedIds([]);
    setExpectedScanInput('');
    setExpectedBulkInput('');
    setReturnedScanInput('');
    setReturnedBulkInput('');
    localStorage.removeItem(CURRENT_SESSION_KEY);
    toast('Started a new fresh verification session', 'info');
  };

  // REVISED UNBLOCKED COPY HANDLER
  const handleCopyList = (idList, label) => {
    if (!idList || idList.length === 0) {
      toast(`No ${label} data to copy!`, 'error');
      return;
    }

    const textToCopy = idList.join('\n');
    navigator.clipboard.writeText(textToCopy);
    toast(`Copied ${label} (${idList.length} items) to clipboard!`, 'success');
  };

  // --- EXPECTED TIDs HANDLERS ---
  const handleAddExpectedScan = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const rawId = expectedScanInput.trim().toUpperCase();
      if (!rawId) return;

      const extracted = extractTrackingIds(rawId);
      if (extracted.length === 0) {
        toast(`Invalid Tracking ID based on filter settings!`, 'error');
        return;
      }

      const id = extracted[0];
      if (expectedIds.includes(id)) {
        toast(`Expected ID "${id}" is already in the list!`, 'error');
      } else {
        setExpectedIds((prev) => [id, ...prev]);
        toast(`Added Expected ID: ${id}`, 'success');
      }
      setExpectedScanInput('');
    }
  };

  const handleAddExpectedBulk = () => {
    const validTids = extractTrackingIds(expectedBulkInput);

    if (validTids.length === 0) {
      toast('No valid tracking IDs found with active filter settings.', 'error');
      return;
    }

    const uniqueSet = Array.from(new Set([...expectedIds, ...validTids]));
    const addedCount = uniqueSet.length - expectedIds.length;

    setExpectedIds(uniqueSet);
    setExpectedBulkInput('');
    toast(`Added ${addedCount} expected ID(s).`, 'success');
  };

  // --- RETURNED TIDs HANDLERS ---
  const handleAddReturnedScan = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const rawId = returnedScanInput.trim().toUpperCase();
      if (!rawId) return;

      const extracted = extractTrackingIds(rawId);
      if (extracted.length === 0) {
        toast(`Invalid Tracking ID based on filter settings!`, 'error');
        return;
      }

      const id = extracted[0];
      if (scannedIds.includes(id)) {
        toast(`ID "${id}" is already scanned in returns!`, 'error');
      } else {
        setScannedIds((prev) => [id, ...prev]);
        if (expectedIds.includes(id)) {
          toast(`MATCH VERIFIED: ${id}`, 'success');
        } else {
          toast(`UNEXPECTED RETURN: ${id}`, 'error');
        }
      }
      setReturnedScanInput('');
    }
  };

  const handleAddReturnedBulk = () => {
    const validTids = extractTrackingIds(returnedBulkInput);

    if (validTids.length === 0) {
      toast('No valid tracking IDs found with active filter settings.', 'error');
      return;
    }

    const uniqueSet = Array.from(new Set([...scannedIds, ...validTids]));
    const addedCount = uniqueSet.length - scannedIds.length;

    setScannedIds(uniqueSet);
    setReturnedBulkInput('');
    toast(`Processed ${addedCount} returned ID(s).`, 'success');
  };

  const handleExportCsv = () => {
    const rows = [
      ['Tracking ID', 'In Expected List', 'In Returned List', 'Verification Status'],
    ];

    const allIds = Array.from(new Set([...expectedIds, ...scannedIds]));
    allIds.forEach((id) => {
      const isExp = expectedIds.includes(id);
      const isScanned = scannedIds.includes(id);

      let status = 'MATCHED';
      if (isExp && !isScanned) status = 'MISSING';
      if (!isExp && isScanned) status = 'EXTRA / UNEXPECTED';

      rows.push([id, isExp ? 'YES' : 'NO', isScanned ? 'YES' : 'NO', status]);
    });

    const csvContent =
      'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `wishmaster_return_verification_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const matchPercentage =
    expectedIds.length > 0
      ? Math.round((matched.length / expectedIds.length) * 100)
      : 0;

  return (
    <div className="min-h-screen bg-slate-900/5 text-slate-800 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto transition-all duration-300">
      {/* HEADER */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-2xl p-6 shadow-xl text-white relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-indigo-500/20 rounded-xl border border-indigo-400/30 backdrop-blur-md">
                <PackageCheck className="h-6 w-6 text-indigo-400" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                  Wishmaster Returns Hub
                </h1>
                <p className="text-xs text-slate-400">
                  Reconcile assigned tracking IDs with physically scanned returns in real time.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto flex-wrap sm:flex-nowrap">
            <button
              onClick={saveCurrentSessionToHistory}
              disabled={expectedIds.length === 0 && scannedIds.length === 0}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-lg transition-all flex items-center justify-center gap-1.5"
            >
              <Save className="h-4 w-4" /> Save Snapshot
            </button>
            <button
              onClick={handleExportCsv}
              disabled={expectedIds.length === 0 && scannedIds.length === 0}
              className="px-4 py-2 bg-slate-700/60 hover:bg-slate-700 border border-slate-600/50 disabled:opacity-50 text-slate-200 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
            >
              <Download className="h-4 w-4" /> Export CSV
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="h-4 w-4" /> New Session
            </button>
          </div>
        </div>
      </div>

      {/* DUAL METHOD FILTER CONTROL BAR */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2.5">
            <Filter className="h-5 w-5 text-indigo-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Advanced Tracking ID Filtration
              </h3>
              <p className="text-xs text-slate-500">
                Configure format isolation and exclusion keywords
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="relative inline-flex items-center cursor-pointer gap-2">
              <input
                type="checkbox"
                checked={isolateTracking}
                onChange={(e) => setIsolateTracking(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
              />
              <span className="text-xs font-bold text-slate-700">
                1. Isolate Tracking ID Format (Regex)
              </span>
            </label>
            <p className="text-[11px] text-slate-400 pl-6">
              Only accepts standard tracking format strings (e.g. FMPC12345678).
            </p>
          </div>

          <div className="space-y-2">
            <label className="relative inline-flex items-center cursor-pointer gap-2">
              <input
                type="checkbox"
                checked={enableExclusions}
                onChange={(e) => setEnableExclusions(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
              />
              <span className="text-xs font-bold text-slate-700">
                2. Exclusion Keywords Block
              </span>
            </label>
            <p className="text-[11px] text-slate-400 pl-6">
              Ignores non-tracking status labels or log noise.
            </p>
          </div>
        </div>

        {enableExclusions && (
          <div className="pt-2 border-t border-slate-100">
            <label className="text-[11px] font-semibold text-slate-600 mb-1 block">
              Excluded Words List (comma separated):
            </label>
            <textarea
              className="w-full font-mono text-xs h-16 p-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none bg-slate-50/50 resize-none"
              value={excludeWords}
              onChange={(e) => setExcludeWords(e.target.value)}
              placeholder="e.g. FORWARD, UNDELIVERED, P1, P2..."
            />
          </div>
        )}
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white/80 rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">Assigned TIDs</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <ListPlus className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-black text-slate-900">{expectedIds.length}</span>
            <span className="text-xs text-slate-400 font-mono">Expected</span>
          </div>
        </div>

        <div className="bg-white/80 rounded-2xl p-5 border border-emerald-100 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-600 uppercase">Matched Returns</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-black text-emerald-600">{matched.length}</span>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
              {matchPercentage}% Verified
            </span>
          </div>
        </div>

        <div className="bg-white/80 rounded-2xl p-5 border border-amber-100 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-600 uppercase">Pending / Missing</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-black text-amber-600">{missing.length}</span>
            <span className="text-xs text-amber-700 font-mono">Not Returned</span>
          </div>
        </div>

        <div className="bg-white/80 rounded-2xl p-5 border border-rose-100 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-600 uppercase">Extra / Unassigned</span>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
              <XCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-black text-rose-600">{extra.length}</span>
            <span className="text-xs text-rose-500 font-mono">Unexpected</span>
          </div>
        </div>
      </div>

      {/* INPUT PANELS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* EXPECTED TIDs */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <span className="h-7 w-7 rounded-xl bg-blue-50 text-blue-700 font-extrabold text-xs flex items-center justify-center">
                1
              </span>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Assigned Wishmaster TIDs</h2>
                <p className="text-[11px] text-slate-400">Tracking IDs List</p>
              </div>
            </div>
            <div className="flex bg-slate-100 p-1 rounded-xl text-[11px] font-medium text-slate-600">
              <button
                onClick={() => setExpectedMode('bulk')}
                className={`px-3 py-1 rounded-lg ${
                  expectedMode === 'bulk' ? 'bg-white shadow-sm text-indigo-600 font-bold' : ''
                }`}
              >
                Bulk Paste
              </button>
              <button
                onClick={() => setExpectedMode('scan')}
                className={`px-3 py-1 rounded-lg ${
                  expectedMode === 'scan' ? 'bg-white shadow-sm text-indigo-600 font-bold' : ''
                }`}
              >
                Scan Mode
              </button>
            </div>
          </div>

          {expectedMode === 'bulk' ? (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-blue-600" /> Paste Assigned List
                </label>
                <button
                  type="button"
                  onClick={() => handleCopyList(expectedIds, 'Expected TIDs')}
                  className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                >
                  <Copy className="h-3 w-3" /> Copy Loaded ({expectedIds.length})
                </button>
              </div>
              <textarea
                className="w-full font-mono uppercase text-xs h-28 p-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none resize-none bg-slate-50/50"
                placeholder="Paste TIDs here..."
                value={expectedBulkInput}
                onChange={(e) => setExpectedBulkInput(e.target.value)}
              />
              <button
                type="button"
                onClick={handleAddExpectedBulk}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2"
              >
                <ListPlus className="h-4 w-4" /> Load Assigned Tracking IDs
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-blue-600 flex items-center gap-1.5">
                <Scan className="h-4 w-4 animate-pulse text-blue-500" /> Live Barcode Input
              </label>
              <input
                ref={expectedScanRef}
                className="w-full font-mono uppercase text-sm p-3 rounded-xl border-2 border-blue-400 focus:ring-4 focus:ring-blue-500/10 outline-none"
                placeholder="Scan expected barcode..."
                value={expectedScanInput}
                onChange={(e) => setExpectedScanInput(e.target.value)}
                onKeyDown={handleAddExpectedScan}
              />
            </div>
          )}

          <div className="border border-slate-100 rounded-xl p-3 max-h-48 overflow-y-auto space-y-1.5 bg-slate-50/50">
            {expectedIds.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No assigned tracking IDs loaded.</p>
            ) : (
              expectedIds.map((id) => {
                const isScanned = scannedIds.includes(id);
                return (
                  <div
                    key={id}
                    className={`flex items-center justify-between p-2.5 rounded-lg text-xs font-mono border ${
                      isScanned
                        ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                        : 'bg-white border-slate-200/80 text-slate-700'
                    }`}
                  >
                    <span className="font-semibold">{id}</span>
                    {isScanned ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-sans font-bold text-[10px] flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Returned
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-amber-100/80 text-amber-700 font-sans font-medium text-[10px]">
                        Pending
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RETURNED TIDs */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <span className="h-7 w-7 rounded-xl bg-indigo-600 text-white font-extrabold text-xs flex items-center justify-center">
                2
              </span>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Physically Returned Products</h2>
                <p className="text-[11px] text-slate-400">Scan returned items</p>
              </div>
            </div>
            <div className="flex bg-slate-100 p-1 rounded-xl text-[11px] font-medium text-slate-600">
              <button
                onClick={() => setReturnedMode('scan')}
                className={`px-3 py-1 rounded-lg ${
                  returnedMode === 'scan' ? 'bg-white shadow-sm text-indigo-600 font-bold' : ''
                }`}
              >
                Scan Gun
              </button>
              <button
                onClick={() => setReturnedMode('bulk')}
                className={`px-3 py-1 rounded-lg ${
                  returnedMode === 'bulk' ? 'bg-white shadow-sm text-indigo-600 font-bold' : ''
                }`}
              >
                Bulk Paste
              </button>
            </div>
          </div>

          {returnedMode === 'scan' ? (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-indigo-600 flex items-center gap-1.5">
                  <Scan className="h-4 w-4 animate-pulse text-indigo-500" /> Active Scanner Input
                </label>
                <button
                  type="button"
                  onClick={() => handleCopyList(scannedIds, 'Returned TIDs')}
                  className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                >
                  <Copy className="h-3 w-3" /> Copy All Scanned ({scannedIds.length})
                </button>
              </div>
              <input
                ref={returnedScanRef}
                className="w-full font-mono uppercase text-sm p-3 rounded-xl border-2 border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 outline-none"
                placeholder="Scan returned barcode..."
                value={returnedScanInput}
                onChange={(e) => setReturnedScanInput(e.target.value)}
                onKeyDown={handleAddReturnedScan}
              />
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Keyboard className="h-3.5 w-3.5 text-indigo-600" /> Paste Returned TIDs
                </label>
                <button
                  type="button"
                  onClick={() => handleCopyList(scannedIds, 'Returned TIDs')}
                  className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                >
                  <Copy className="h-3 w-3" /> Copy All Scanned ({scannedIds.length})
                </button>
              </div>
              <textarea
                className="w-full font-mono uppercase text-xs h-28 p-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none resize-none bg-slate-50/50"
                placeholder="Paste returned TIDs..."
                value={returnedBulkInput}
                onChange={(e) => setReturnedBulkInput(e.target.value)}
              />
              <button
                type="button"
                onClick={handleAddReturnedBulk}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2"
              >
                <ListPlus className="h-4 w-4" /> Verify Returned Items List
              </button>
            </div>
          )}

          <div className="border border-slate-100 rounded-xl p-3 max-h-48 overflow-y-auto space-y-1.5 bg-slate-50/50">
            {scannedIds.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">Ready to scan returns.</p>
            ) : (
              scannedIds.map((id) => {
                const isValidExpected = expectedIds.includes(id);
                return (
                  <div
                    key={id}
                    className={`flex items-center justify-between p-2.5 rounded-lg text-xs font-mono border ${
                      isValidExpected
                        ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                        : 'bg-rose-50/80 border-rose-200 text-rose-900'
                    }`}
                  >
                    <span className="font-semibold">{id}</span>
                    {isValidExpected ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-sans font-bold text-[10px] flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Valid Match
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-sans font-bold text-[10px] flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Unexpected Item
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* RECONCILIATION TABLE */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 flex-wrap gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-indigo-600" /> Detailed Reconciliation Matrix
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Audit sheet of expected vs returned items</p>
          </div>

          <div className="flex gap-2 text-xs flex-wrap">
            <button
              onClick={() => handleCopyList(matched, 'Matched TIDs')}
              className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200/60 font-semibold flex items-center gap-1.5 hover:bg-emerald-100 transition-colors"
            >
              <Copy className="h-3.5 w-3.5 text-emerald-600" /> Copy Matched ({matched.length})
            </button>
            <button
              onClick={() => handleCopyList(missing, 'Missing TIDs')}
              className="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200/60 font-semibold flex items-center gap-1.5 hover:bg-amber-100 transition-colors"
            >
              <Copy className="h-3.5 w-3.5 text-amber-600" /> Copy Missing ({missing.length})
            </button>
            <button
              onClick={() => handleCopyList(extra, 'Extra TIDs')}
              className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-800 border border-rose-200/60 font-semibold flex items-center gap-1.5 hover:bg-rose-100 transition-colors"
            >
              <Copy className="h-3.5 w-3.5 text-rose-600" /> Copy Extra ({extra.length})
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/80 text-slate-500 font-bold uppercase">
                <th className="p-3.5">#</th>
                <th className="p-3.5">Tracking ID</th>
                <th className="p-3.5">Assigned to WM</th>
                <th className="p-3.5">Physically Returned</th>
                <th className="p-3.5">Audit Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {Array.from(new Set([...expectedIds, ...scannedIds])).length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400 font-sans">
                    No active scan data to compare.
                  </td>
                </tr>
              ) : (
                Array.from(new Set([...expectedIds, ...scannedIds])).map((id, index) => {
                  const isExp = expectedIds.includes(id);
                  const isScanned = scannedIds.includes(id);

                  let statusBadge = (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-sans font-bold text-[11px] inline-flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Matched
                    </span>
                  );

                  if (isExp && !isScanned) {
                    statusBadge = (
                      <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-sans font-bold text-[11px] inline-flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5" /> Missing
                      </span>
                    );
                  } else if (!isExp && isScanned) {
                    statusBadge = (
                      <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 font-sans font-bold text-[11px] inline-flex items-center gap-1">
                        <XCircle className="h-3.5 w-3.5" /> Extra / Unassigned
                      </span>
                    );
                  }

                  return (
                    <tr key={id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 text-slate-400 font-sans">{index + 1}</td>
                      <td className="p-3.5 font-bold text-slate-900">{id}</td>
                      <td className="p-3.5">
                        {isExp ? (
                          <span className="text-emerald-600 font-bold">YES</span>
                        ) : (
                          <span className="text-slate-300">NO</span>
                        )}
                      </td>
                      <td className="p-3.5">
                        {isScanned ? (
                          <span className="text-emerald-600 font-bold">YES</span>
                        ) : (
                          <span className="text-slate-300">NO</span>
                        )}
                      </td>
                      <td className="p-3.5">{statusBadge}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}