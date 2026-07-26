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
  History,
  Trash2,
  Save,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';
import { useToast } from '../lib/useToast.jsx';

const CURRENT_SESSION_KEY = 'wm_returns_current_session_v1';
const HISTORY_KEY = 'wm_returns_saved_history_v1';

export function WishmasterReturnVerification() {
  const toast = useToast();

  // --- STATE WITH LOCALSTORAGE INITIALIZATION (SURVIVES PAGE REFRESH) ---
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

  // Active input modes: 'scan' or 'bulk'
  const [expectedMode, setExpectedMode] = useState('bulk');
  const [returnedMode, setReturnedMode] = useState('scan');

  // Raw input strings
  const [expectedScanInput, setExpectedScanInput] = useState('');
  const [expectedBulkInput, setExpectedBulkInput] = useState('');

  const [returnedScanInput, setReturnedScanInput] = useState('');
  const [returnedBulkInput, setReturnedBulkInput] = useState('');

  // History state (Completed saved sessions)
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem(HISTORY_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // DOM Refs for auto-focus
  const expectedScanRef = useRef(null);
  const returnedScanRef = useRef(null);

  // --- AUTO-SAVE CURRENT ACTIVE SESSION TO LOCALSTORAGE ON EVERY CHANGE ---
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

  // Auto-focus scanner inputs when switching to scan mode
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

  // Calculations
  const matched = expectedIds.filter((id) => scannedIds.includes(id));
  const missing = expectedIds.filter((id) => !scannedIds.includes(id));
  const extra = scannedIds.filter((id) => !expectedIds.includes(id));

  // Explicit Save Session to History Panel
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

  // Restore saved session from history
  const handleRestoreSession = (session) => {
    setExpectedIds(session.expectedIds || []);
    setScannedIds(session.scannedIds || []);
    toast(`Restored session from ${session.timestamp}`, 'info');
  };

  // Clear all saved history
  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem(HISTORY_KEY);
    toast('Saved runs history cleared', 'info');
  };

  // Reset Current Session State
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

  // Copy helper
  const handleCopyToClipboard = (text, label) => {
    if (!text || text.trim() === '') {
      toast(`No ${label} data to copy!`, 'error');
      return;
    }
    navigator.clipboard.writeText(text);
    toast(`Copied ${label} to clipboard!`, 'success');
  };

  // --- EXPECTED TIDs HANDLERS ---
  const handleAddExpectedScan = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const id = expectedScanInput.trim().toUpperCase();
      if (!id) return;

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
    const items = expectedBulkInput
      .split(/[\n, ]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);

    if (items.length === 0) {
      toast('Please enter valid tracking IDs to import.', 'error');
      return;
    }

    const uniqueSet = Array.from(new Set([...expectedIds, ...items]));
    const addedCount = uniqueSet.length - expectedIds.length;

    setExpectedIds(uniqueSet);
    setExpectedBulkInput('');
    toast(`Added ${addedCount} expected tracking ID(s).`, 'success');
  };

  // --- RETURNED TIDs HANDLERS ---
  const handleAddReturnedScan = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const id = returnedScanInput.trim().toUpperCase();
      if (!id) return;

      if (scannedIds.includes(id)) {
        toast(`ID "${id}" already scanned in returns!`, 'error');
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
    const items = returnedBulkInput
      .split(/[\n, ]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);

    if (items.length === 0) {
      toast('Please enter valid tracking IDs.', 'error');
      return;
    }

    const uniqueSet = Array.from(new Set([...scannedIds, ...items]));
    const addedCount = uniqueSet.length - scannedIds.length;

    setScannedIds(uniqueSet);
    setReturnedBulkInput('');
    toast(`Processed ${addedCount} returned tracking ID(s).`, 'success');
  };

  // CSV Export
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

  // Calculate Match Rate Percentage
  const matchPercentage = expectedIds.length > 0 
    ? Math.round((matched.length / expectedIds.length) * 100) 
    : 0;

  return (
    <div className="min-h-screen bg-slate-900/5 text-slate-800 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto transition-all duration-300">
      
      {/* --- DASHBOARD HEADER --- */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-2xl p-6 shadow-xl text-white relative overflow-hidden">
        {/* Subtle decorative glow circle */}
        <div className="absolute -right-10 -bottom-10 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-indigo-500/20 rounded-xl border border-indigo-400/30 backdrop-blur-md">
                <PackageCheck className="h-6 w-6 text-indigo-400" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                  Wishmaster Returns Hub
                  <span className="text-[10px] bg-indigo-500/30 text-indigo-300 border border-indigo-400/30 px-2 py-0.5 rounded-full font-medium">
                    Live Auto-Saved
                  </span>
                </h1>
                <p className="text-xs text-slate-400">
                  Reconcile assigned tracking IDs with physically scanned returns in real time.
                </p>
              </div>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2.5 w-full md:w-auto flex-wrap sm:flex-nowrap">
            <button
              onClick={saveCurrentSessionToHistory}
              disabled={expectedIds.length === 0 && scannedIds.length === 0}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-1.5 flex-1 md:flex-initial"
            >
              <Save className="h-4 w-4" /> Save Snapshot
            </button>
            <button
              onClick={handleExportCsv}
              disabled={expectedIds.length === 0 && scannedIds.length === 0}
              className="px-4 py-2 bg-slate-700/60 hover:bg-slate-700 border border-slate-600/50 disabled:opacity-50 text-slate-200 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 flex-1 md:flex-initial"
            >
              <Download className="h-4 w-4" /> Export CSV
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 flex-1 md:flex-initial"
            >
              <RotateCcw className="h-4 w-4" /> New Session
            </button>
          </div>
        </div>
      </div>

      {/* --- DASHBOARD STATS CARDS --- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Expected */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Assigned TIDs
            </span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <ListPlus className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-black text-slate-900">{expectedIds.length}</span>
            <span className="text-xs text-slate-400 font-mono">Expected</span>
          </div>
        </div>

        {/* Matched */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl p-5 border border-emerald-100 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
              Matched Returns
            </span>
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

        {/* Missing */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl p-5 border border-amber-100 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">
              Pending / Missing
            </span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-black text-amber-600">{missing.length}</span>
            <span className="text-xs text-amber-700 font-mono">Not Returned</span>
          </div>
        </div>

        {/* Unexpected Extra */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl p-5 border border-rose-100 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-600 uppercase tracking-wider">
              Extra / Unassigned
            </span>
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

      {/* --- DUAL SCANNER & INPUT PANELS --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* PANEL 1: EXPECTED TIDs */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <span className="h-7 w-7 rounded-xl bg-blue-50 text-blue-700 font-extrabold text-xs flex items-center justify-center border border-blue-200/60">
                1
              </span>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Assigned Wishmaster TIDs
                </h2>
                <p className="text-[11px] text-slate-400">Product IDs handed over for delivery</p>
              </div>
            </div>
            
            {/* Mode Switcher */}
            <div className="flex bg-slate-100 p-1 rounded-xl text-[11px] font-medium text-slate-600">
              <button
                onClick={() => setExpectedMode('bulk')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  expectedMode === 'bulk'
                    ? 'bg-white shadow-sm text-indigo-600 font-bold'
                    : 'hover:text-slate-900'
                }`}
              >
                Bulk Paste
              </button>
              <button
                onClick={() => setExpectedMode('scan')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  expectedMode === 'scan'
                    ? 'bg-white shadow-sm text-indigo-600 font-bold'
                    : 'hover:text-slate-900'
                }`}
              >
                Scan Mode
              </button>
            </div>
          </div>

          {/* Mode UI switch */}
          {expectedMode === 'bulk' ? (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-blue-600" />
                  Paste Assigned List
                </label>
                <button
                  type="button"
                  onClick={() => handleCopyToClipboard(expectedIds.join('\n'), 'Expected TIDs')}
                  className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                >
                  <Copy className="h-3 w-3" /> Copy Loaded ({expectedIds.length})
                </button>
              </div>
              <textarea
                className="w-full font-mono uppercase text-xs h-28 p-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none resize-none bg-slate-50/50"
                placeholder="Paste TIDs here separated by newlines, spaces, or commas..."
                value={expectedBulkInput}
                onChange={(e) => setExpectedBulkInput(e.target.value)}
              />
              <button
                type="button"
                onClick={handleAddExpectedBulk}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                <ListPlus className="h-4 w-4" /> Load Assigned Tracking IDs
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-blue-600 flex items-center gap-1.5">
                <Scan className="h-4 w-4 animate-pulse text-blue-500" />
                Live Barcode Input (Expected TIDs)
              </label>
              <input
                ref={expectedScanRef}
                className="w-full font-mono uppercase text-sm p-3 rounded-xl border-2 border-blue-400 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                placeholder="Scan expected package barcode..."
                value={expectedScanInput}
                onChange={(e) => setExpectedScanInput(e.target.value)}
                onKeyDown={handleAddExpectedScan}
              />
              <p className="text-[11px] text-slate-400">
                Trigger barcode reader or hit Enter to register item.
              </p>
            </div>
          )}

          {/* List display */}
          <div className="border border-slate-100 rounded-xl p-3 max-h-48 overflow-y-auto space-y-1.5 bg-slate-50/50">
            {expectedIds.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">
                No assigned tracking IDs loaded. Paste or scan above.
              </p>
            ) : (
              expectedIds.map((id) => {
                const isScanned = scannedIds.includes(id);
                return (
                  <div
                    key={id}
                    className={`flex items-center justify-between p-2.5 rounded-lg text-xs font-mono transition-all border ${
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

        {/* PANEL 2: RETURNED PRODUCTS SCANNER */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <span className="h-7 w-7 rounded-xl bg-indigo-600 text-white font-extrabold text-xs flex items-center justify-center shadow-md shadow-indigo-600/20">
                2
              </span>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Physically Returned Products
                </h2>
                <p className="text-[11px] text-slate-400">Scan returned items from Wishmaster</p>
              </div>
            </div>

            {/* Mode Switcher */}
            <div className="flex bg-slate-100 p-1 rounded-xl text-[11px] font-medium text-slate-600">
              <button
                onClick={() => setReturnedMode('scan')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  returnedMode === 'scan'
                    ? 'bg-white shadow-sm text-indigo-600 font-bold'
                    : 'hover:text-slate-900'
                }`}
              >
                Scan Gun
              </button>
              <button
                onClick={() => setReturnedMode('bulk')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  returnedMode === 'bulk'
                    ? 'bg-white shadow-sm text-indigo-600 font-bold'
                    : 'hover:text-slate-900'
                }`}
              >
                Bulk Paste
              </button>
            </div>
          </div>

          {/* Mode UI switch */}
          {returnedMode === 'scan' ? (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-indigo-600 flex items-center gap-1.5">
                  <Scan className="h-4 w-4 animate-pulse text-indigo-500" />
                  Active Physical Scanner Input
                </label>
                <button
                  type="button"
                  onClick={() => handleCopyToClipboard(scannedIds.join('\n'), 'Returned TIDs')}
                  className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                >
                  <Copy className="h-3 w-3" /> Copy Scanned ({scannedIds.length})
                </button>
              </div>
              <input
                ref={returnedScanRef}
                className="w-full font-mono uppercase text-sm p-3 rounded-xl border-2 border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all shadow-sm"
                placeholder="Scan returned product barcode here..."
                value={returnedScanInput}
                onChange={(e) => setReturnedScanInput(e.target.value)}
                onKeyDown={handleAddReturnedScan}
              />
              <p className="text-[11px] text-slate-400">
                Instant verification against expected list as soon as you scan.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Keyboard className="h-3.5 w-3.5 text-indigo-600" />
                  Paste Returned TIDs
                </label>
                <button
                  type="button"
                  onClick={() => handleCopyToClipboard(scannedIds.join('\n'), 'Returned TIDs')}
                  className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                >
                  <Copy className="h-3 w-3" /> Copy Returned List
                </button>
              </div>
              <textarea
                className="w-full font-mono uppercase text-xs h-28 p-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none resize-none bg-slate-50/50"
                placeholder="Paste returned TIDs here..."
                value={returnedBulkInput}
                onChange={(e) => setReturnedBulkInput(e.target.value)}
              />
              <button
                type="button"
                onClick={handleAddReturnedBulk}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                <ListPlus className="h-4 w-4" /> Verify Returned Items List
              </button>
            </div>
          )}

          {/* List display */}
          <div className="border border-slate-100 rounded-xl p-3 max-h-48 overflow-y-auto space-y-1.5 bg-slate-50/50">
            {scannedIds.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">
                Ready to scan! Use USB/Bluetooth barcode scanner above.
              </p>
            ) : (
              scannedIds.map((id) => {
                const isValidExpected = expectedIds.includes(id);
                return (
                  <div
                    key={id}
                    className={`flex items-center justify-between p-2.5 rounded-lg text-xs font-mono transition-all border ${
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

      {/* --- SAVED RUN SNAPSHOTS HISTORY --- */}
      {history.length > 0 && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Saved Verification Snapshots (Last 5)
              </h3>
            </div>
            <button
              type="button"
              onClick={handleClearHistory}
              className="text-xs text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1"
            >
              <Trash2 className="h-3.5 w-3.5" /> Clear History
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {history.map((session, idx) => (
              <div
                key={session.id}
                className="border border-slate-200/80 rounded-xl p-3.5 bg-slate-50/50 hover:bg-white hover:border-indigo-300 transition-all flex flex-col justify-between text-xs space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between font-bold text-slate-900">
                    <span>Run #{history.length - idx}</span>
                    <span className="text-[10px] text-slate-400 font-normal">{session.timestamp}</span>
                  </div>
                  <div className="text-[11px] text-slate-600 mt-2 space-y-1">
                    <div className="flex justify-between">
                      <span>Expected:</span>
                      <b className="font-mono">{session.expectedCount}</b>
                    </div>
                    <div className="flex justify-between">
                      <span>Returned:</span>
                      <b className="font-mono">{session.returnedCount}</b>
                    </div>
                    <div className="flex justify-between text-emerald-600 font-semibold">
                      <span>Matched:</span>
                      <b className="font-mono">{session.matchedCount}</b>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleRestoreSession(session)}
                  className="w-full py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 rounded-lg text-[11px] font-semibold transition-all shadow-sm"
                >
                  Load Run
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- RECONCILIATION AUDIT TABLE --- */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 flex-wrap gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-indigo-600" />
              Detailed Reconciliation Matrix
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Comprehensive audit sheet of expected vs returned items</p>
          </div>

          <div className="flex gap-2 text-xs">
            <button
              onClick={() => handleCopyToClipboard(missing.join('\n'), 'Missing TIDs')}
              className="px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/60 font-semibold transition-all flex items-center gap-1.5"
            >
              <Copy className="h-3.5 w-3.5" /> Copy Missing ({missing.length})
            </button>
            <button
              onClick={() => handleCopyToClipboard(extra.join('\n'), 'Extra TIDs')}
              className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200/60 font-semibold transition-all flex items-center gap-1.5"
            >
              <Copy className="h-3.5 w-3.5" /> Copy Extra ({extra.length})
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/80 text-slate-500 font-bold uppercase tracking-wider">
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
                    No active scan data to compare. Scan returned packages or import expected TIDs above.
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