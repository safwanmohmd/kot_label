import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  Search, Send, Volume2, VolumeX, Tag, X,
  Globe, RefreshCw, AlertTriangle, Barcode,
  Flame, Download, Copy, Check, Layers, RotateCcw, ChevronDown
} from 'lucide-react';

const PAGE_RENDER_STEP = 100; // Render 100 DOM rows at a time to eliminate browser lag

export default function ShipmentAuditorDispatcher() {
  const [rawTids, setRawTids] = useState('');
  const [activeTargets, setActiveTargets] = useState([]);
  const [scannedLogs, setScannedLogs] = useState([]);
  
  // DOM Pagination Limit (Prevents rendering thousands of <tr> elements at once)
  const [visibleLimit, setVisibleLimit] = useState(PAGE_RENDER_STEP);

  // Single & Bulk Search State
  const [searchMode, setSearchMode] = useState('single'); // 'single' | 'bulk'
  const [searchQuery, setSearchQuery] = useState('');
  const [bulkSearchInput, setBulkSearchInput] = useState('');
  const [bulkAuditResults, setBulkAuditResults] = useState(null);

  // Advanced Log Filters
  const [selectedFilter, setSelectedFilter] = useState('all'); // 'all' | 'intercepted' | 'rto' | 'standard'
  const [dateFilter, setDateFilter] = useState('20d'); // 'today' | '7d' | '20d'
  const [stationFilter, setStationFilter] = useState('all');

  // Remote & UI States
  const [globalAlarmEnabled, setGlobalAlarmEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isTogglingAlarm, setIsTogglingAlarm] = useState(false);
  const [copiedList, setCopiedList] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');

  // Reset visible DOM row window whenever filters or search change
  useEffect(() => {
    setVisibleLimit(PAGE_RENDER_STEP);
  }, [searchQuery, selectedFilter, dateFilter, stationFilter, searchMode]);

  // 1. Fetch Remote Global Alarm Toggle
  const fetchAlarmConfig = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('auditor_config')
        .select('value')
        .eq('key', 'global_alarm_enabled')
        .maybeSingle();

      if (!error && data) {
        setGlobalAlarmEnabled(data.value === 'true');
      }
    } catch (e) {}
  }, []);

  // 2. Fetch Active Missing Targets
  const fetchActiveTargets = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('auditor_targets')
        .select('tracking_id')
        .order('created_at', { ascending: false })
        .limit(5000);

      if (!error && data) {
        setActiveTargets(data.map((d) => d.tracking_id.toUpperCase()));
      }
    } catch (e) {}
  }, []);

  // 3. Parallel Fast-Fetch ALL Manual Scans in Last 20 Days (Bypasses 1000-row cap quickly)
  const fetchAllScans = useCallback(async () => {
    try {
      const twentyDaysAgo = new Date();
      twentyDaysAgo.setDate(twentyDaysAgo.getDate() - 20);
      const isoCutoff = twentyDaysAgo.toISOString();

      // Step A: Get exact total count first (fast HEAD query)
      const { count, error: countError } = await supabase
        .from('manual_scans')
        .select('*', { count: 'exact', head: true })
        .gte('scanned_at', isoCutoff);

      if (countError) throw countError;

      const totalRows = count || 0;
      if (totalRows === 0) {
        setScannedLogs([]);
        return;
      }

      // Step B: Fetch all 1,000-row chunks in parallel using Promise.all
      const step = 1000;
      const totalPages = Math.ceil(totalRows / step);
      const pagePromises = [];

      for (let page = 0; page < totalPages; page++) {
        const from = page * step;
        const to = from + step - 1;
        pagePromises.push(
          supabase
            .from('manual_scans')
            .select('tracking_id, scanned_at, is_missing_match, is_rto, device_info')
            .gte('scanned_at', isoCutoff)
            .order('scanned_at', { ascending: false })
            .range(from, to)
        );
      }

      const responses = await Promise.all(pagePromises);
      const mergedRecords = [];

      responses.forEach((res) => {
        if (res.data) {
          for (let i = 0; i < res.data.length; i++) {
            const row = res.data[i];
            // Pre-compute numeric timestamp once to make filtering instantaneous
            row._ts = new Date(row.scanned_at).getTime();
            mergedRecords.push(row);
          }
        }
      });

      setScannedLogs(mergedRecords);
    } catch (e) {
      console.error('Scans fetch error:', e);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([fetchAlarmConfig(), fetchActiveTargets(), fetchAllScans()]);
    setIsLoading(false);
  }, [fetchAlarmConfig, fetchActiveTargets, fetchAllScans]);

  useEffect(() => {
    refreshAll();
    const interval = setInterval(() => {
      fetchAllScans();
      fetchActiveTargets();
    }, 10000);
    return () => clearInterval(interval);
  }, [refreshAll, fetchAllScans, fetchActiveTargets]);

  // Toggle Remote Cloud Alarm
  const toggleGlobalAlarm = async () => {
    setIsTogglingAlarm(true);
    const nextState = !globalAlarmEnabled;
    try {
      const { error } = await supabase
        .from('auditor_config')
        .upsert({
          key: 'global_alarm_enabled',
          value: String(nextState),
          updated_at: new Date().toISOString()
        });
      if (!error) setGlobalAlarmEnabled(nextState);
    } catch (e) {} finally {
      setIsTogglingAlarm(false);
    }
  };

  // 20-Day Prune
  const triggerSelfDestructPrune = async () => {
    if (!window.confirm('Purge all scan records older than 20 days?')) return;
    try {
      const twentyDaysAgo = new Date();
      twentyDaysAgo.setDate(twentyDaysAgo.getDate() - 20);
      await supabase.from('manual_scans').delete().lt('scanned_at', twentyDaysAgo.toISOString());
      await fetchAllScans();
    } catch (e) {}
  };

  // Append New Missing Targets
  const parsedIncomingTids = useMemo(() => {
    return Array.from(
      new Set(
        rawTids.split(/[\n,;\s]+/).map((s) => s.trim().toUpperCase()).filter(Boolean)
      )
    );
  }, [rawTids]);

  const handleAppendNew = async () => {
    if (parsedIncomingTids.length === 0) return;
    setIsLoading(true);
    setSyncStatus('Syncing...');

    const rows = parsedIncomingTids.map((tid) => ({ tracking_id: tid }));
    try {
      const { error } = await supabase.from('auditor_targets').upsert(rows, { onConflict: 'tracking_id' });
      if (error) throw error;

      setSyncStatus(`✅ +${rows.length} Synced`);
      setRawTids('');
      await fetchActiveTargets();

      setTimeout(() => {
        setSyncStatus('');
      }, 2500);
    } catch (err) {
      setSyncStatus(`⚠️ ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveTarget = async (tid) => {
    try {
      await supabase.from('auditor_targets').delete().eq('tracking_id', tid);
      setActiveTargets((prev) => prev.filter((id) => id !== tid));
    } catch (e) {}
  };

  // Bulk Search Execution (O(1) Hash Map Lookup across all 20D records)
  const runBulkSearch = () => {
    const queryList = Array.from(
      new Set(
        bulkSearchInput.split(/[\n,;\s]+/).map((s) => s.trim().toUpperCase()).filter(Boolean)
      )
    );

    if (queryList.length === 0) {
      setBulkAuditResults(null);
      return;
    }

    const logMap = new Map();
    for (let i = 0; i < scannedLogs.length; i++) {
      const log = scannedLogs[i];
      const key = log.tracking_id.toUpperCase();
      if (!logMap.has(key)) logMap.set(key, log);
    }

    const matched = [];
    const notScanned = [];

    queryList.forEach((tid, index) => {
      const hit = logMap.get(tid);
      if (hit) {
        matched.push({ index: index + 1, ...hit });
      } else {
        notScanned.push({ index: index + 1, tracking_id: tid });
      }
    });

    setBulkAuditResults({
      totalQueried: queryList.length,
      matched,
      notScanned
    });
  };

  // Helpers
  const formatDateTime = (iso) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  const getDaysRemaining = (ts) => {
    if (!ts) return 20;
    const expiryDate = ts + 20 * 24 * 60 * 60 * 1000;
    return Math.max(0, Math.ceil((expiryDate - Date.now()) / (1000 * 60 * 60 * 24)));
  };

  // Single-Pass KPI Aggregation (Calculates all counts in 1 loop instead of 5 separate .filter() passes)
  const metrics = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayTs = startOfToday.getTime();

    let todayPrc = 0;
    let todayRto = 0;
    let intercepted = 0;
    let rtoTotal = 0;
    let standard = 0;
    const stationSet = new Set();

    for (let i = 0; i < scannedLogs.length; i++) {
      const s = scannedLogs[i];
      if (s._ts >= todayTs) {
        todayPrc++;
        if (s.is_rto) todayRto++;
      }
      if (s.is_missing_match) intercepted++;
      if (s.is_rto) rtoTotal++;
      if (!s.is_missing_match && !s.is_rto) standard++;
      stationSet.add(s.device_info || 'Terminal');
    }

    return {
      todayPrcCount: todayPrc,
      todayRtoCount: todayRto,
      interceptedCount: intercepted,
      rtoTotalCount: rtoTotal,
      standardCount: standard,
      uniqueStations: Array.from(stationSet)
    };
  }, [scannedLogs]);

  // Filtered Single-Mode Logs
  const filteredScans = useMemo(() => {
    const now = Date.now();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayTs = startOfToday.getTime();
    const sevenDaysTs = now - 7 * 24 * 60 * 60 * 1000;
    const normalizedQuery = searchQuery.toLowerCase().trim();

    return scannedLogs.filter((item) => {
      if (normalizedQuery && !item.tracking_id.toLowerCase().includes(normalizedQuery)) {
        return false;
      }
      if (selectedFilter === 'intercepted' && !item.is_missing_match) return false;
      if (selectedFilter === 'rto' && !item.is_rto) return false;
      if (selectedFilter === 'standard' && (item.is_missing_match || item.is_rto)) return false;
      if (stationFilter !== 'all' && (item.device_info || 'Terminal') !== stationFilter) return false;

      if (dateFilter === 'today' && item._ts < todayTs) return false;
      if (dateFilter === '7d' && item._ts < sevenDaysTs) return false;

      return true;
    });
  }, [scannedLogs, searchQuery, selectedFilter, stationFilter, dateFilter]);

  // Sliced array for fast, lag-free DOM rendering
  const visibleScans = useMemo(() => {
    return filteredScans.slice(0, visibleLimit);
  }, [filteredScans, visibleLimit]);

  // Copy Visible TIDs
  const copyVisibleTids = () => {
    const listToCopy = searchMode === 'bulk' && bulkAuditResults
      ? bulkAuditResults.matched.map((m) => `${m.tracking_id}\t${formatDateTime(m.scanned_at)}\t${m.is_rto ? 'RTO:YES' : 'RTO:NO'}\t${m.is_missing_match ? 'INTERCEPTED' : 'SCANNED'}`)
      : filteredScans.map((s) => s.tracking_id);

    if (listToCopy.length === 0) return;
    navigator.clipboard.writeText(listToCopy.join('\n'));
    setCopiedList(true);
    setTimeout(() => setCopiedList(false), 1800);
  };

  // Export CSV (Exports ALL matching records, not just visible DOM slice)
  const exportToCSV = () => {
    if (searchMode === 'bulk' && bulkAuditResults) {
      const headers = ['Seq', 'Tracking ID', 'Scan Status', 'Is RTO', 'Alert Type', 'Scan Timestamp', 'Workstation'];
      const rows = [
        ...bulkAuditResults.matched.map((m) => [
          m.index, `"${m.tracking_id}"`, '"SCANNED"', `"${m.is_rto ? 'YES' : 'NO'}"`,
          `"${m.is_missing_match ? 'MISSING_INTERCEPT' : 'STANDARD'}"`,
          `"${formatDateTime(m.scanned_at)}"`, `"${m.device_info || 'Terminal'}"`
        ]),
        ...bulkAuditResults.notScanned.map((u) => [
          u.index, `"${u.tracking_id}"`, '"NOT_SCANNED"', '"-"', '"-"', '"-"', '"-"'
        ])
      ].sort((a, b) => a[0] - b[0]);

      const csv = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const link = document.createElement('a');
      link.href = encodeURI(csv);
      link.download = `Bulk_Scan_Audit_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      return;
    }

    if (filteredScans.length === 0) return;
    const headers = ['Tracking ID', 'Is RTO', 'Classification', 'Terminal Timestamp', 'Retention Days', 'Workstation'];
    const rows = filteredScans.map((r) => [
      `"${r.tracking_id}"`,
      `"${r.is_rto ? 'YES' : 'NO'}"`,
      `"${r.is_missing_match ? 'INTERCEPTED_MISSING' : 'STANDARD_SCAN'}"`,
      `"${formatDateTime(r.scanned_at)}"`,
      `"${getDaysRemaining(r._ts)}d"`,
      `"${r.device_info || 'Terminal'}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csvContent);
    link.download = `PRC_Scan_Logs_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="space-y-3 max-w-7xl mx-auto font-sans p-2 sm:p-4 text-slate-100">
      
      {/* Compact Header & Today PRC / RTO Metrics Strip */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-cyan-400 font-black text-sm">
            <Globe className="h-4 w-4" />
            <span>PRC Auditor & Scan Logs</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono sm:border-l sm:border-slate-800 sm:pl-3">
            <button
              onClick={() => { setSearchMode('single'); setDateFilter('today'); setSelectedFilter('all'); }}
              className="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-700/60 text-emerald-300 hover:bg-emerald-900/60 transition"
              title="Filter Today's PRC scans"
            >
              Today PRC: <b>{metrics.todayPrcCount.toLocaleString()}</b>
            </button>

            <button
              onClick={() => { setSearchMode('single'); setDateFilter('today'); setSelectedFilter('rto'); }}
              className="px-2 py-0.5 rounded bg-purple-950/60 border border-purple-700/60 text-purple-300 hover:bg-purple-900/60 transition"
              title="Filter Today's RTO scans"
            >
              Today RTO: <b>{metrics.todayRtoCount.toLocaleString()}</b>
            </button>

            <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300">
              20D Total: <b className="text-white">{scannedLogs.length.toLocaleString()}</b>
            </span>

            <span className="px-2 py-0.5 rounded bg-amber-950/40 border border-amber-800/50 text-amber-300">
              Intercepted: <b>{metrics.interceptedCount.toLocaleString()}</b>
            </span>

            <button
              onClick={triggerSelfDestructPrune}
              title="Prune records older than 20 days"
              className="px-2 py-0.5 rounded bg-rose-950/30 border border-rose-800/40 text-rose-400 hover:bg-rose-900/40 flex items-center gap-1"
            >
              <Flame className="h-3 w-3" /> 20D Prune
            </button>
          </div>
        </div>

        {/* Global Sound & Refresh Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleGlobalAlarm}
            disabled={isTogglingAlarm}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition border ${
              globalAlarmEnabled
                ? 'bg-rose-950/70 border-rose-600/80 text-rose-300'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            {globalAlarmEnabled ? <Volume2 className="h-3.5 w-3.5 text-rose-400 animate-pulse" /> : <VolumeX className="h-3.5 w-3.5" />}
            <span>{globalAlarmEnabled ? 'Alarm: ON' : 'Alarm: MUTED'}</span>
          </button>

          <button
            onClick={refreshAll}
            className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 px-2.5 py-1 rounded-lg text-[11px] font-bold transition"
          >
            <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
            Sync
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        
        {/* Left Column: Minimalized Target Queue Box */}
        <div className="lg:col-span-3 space-y-3">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-xs space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[10.5px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1">
                <Tag className="h-3 w-3 text-cyan-400" /> Flag Missing TIDs
              </span>
              <span className="text-[10px] font-mono text-cyan-300">{parsedIncomingTids.length} ready</span>
            </div>

            <textarea
              rows={3}
              value={rawTids}
              onChange={(e) => setRawTids(e.target.value)}
              placeholder="Paste missing TIDs..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-[11px] font-mono text-cyan-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500 resize-y"
            />

            <button
              disabled={parsedIncomingTids.length === 0 || isLoading}
              onClick={handleAppendNew}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-40"
            >
              <Send className="h-3 w-3" />
              {syncStatus || 'Add to Missing Queue'}
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
              <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                Monitored ({activeTargets.length})
              </span>
            </div>
            <div className="max-h-[240px] overflow-y-auto flex flex-wrap gap-1">
              {activeTargets.length === 0 ? (
                <span className="text-[11px] text-slate-600">Queue empty</span>
              ) : (
                activeTargets.map((tid) => (
                  <span
                    key={tid}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-950 border border-cyan-800/50 text-cyan-300 font-mono text-[10px]"
                  >
                    <span>{tid}</span>
                    <button onClick={() => handleRemoveTarget(tid)} className="text-slate-500 hover:text-red-400">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Lag-Free Windowed Log Workspace */}
        <div className="lg:col-span-9 flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xs">
          
          {/* Top Bar */}
          <div className="px-3 py-2 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[11px] font-bold">
              <button
                onClick={() => setSearchMode('single')}
                className={`px-2.5 py-1 rounded-md transition flex items-center gap-1.5 ${
                  searchMode === 'single' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Barcode className="h-3.5 w-3.5" />
                Live PRC Logs
              </button>
              <button
                onClick={() => setSearchMode('bulk')}
                className={`px-2.5 py-1 rounded-md transition flex items-center gap-1.5 ${
                  searchMode === 'bulk' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                Bulk TID Search
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={copyVisibleTids}
                className="flex items-center gap-1 px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[10.5px] font-bold transition"
              >
                {copiedList ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                {copiedList ? 'Copied' : 'Copy'}
              </button>
              <button
                onClick={exportToCSV}
                className="flex items-center gap-1 px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-700 text-[10.5px] font-bold transition"
              >
                <Download className="h-3 w-3" />
                CSV
              </button>
            </div>
          </div>

          {/* MODE A: BULK TRACKING ID SEARCH */}
          {searchMode === 'bulk' && (
            <div className="p-3 bg-slate-900/60 border-b border-slate-800 space-y-2.5">
              <div className="flex flex-col sm:flex-row gap-2">
                <textarea
                  rows={3}
                  value={bulkSearchInput}
                  onChange={(e) => setBulkSearchInput(e.target.value)}
                  placeholder="Paste bulk Tracking IDs here to check PRC scan timestamps and RTO status..."
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs font-mono text-indigo-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 resize-y"
                />
                <div className="flex sm:flex-col justify-end gap-1.5">
                  <button
                    onClick={runBulkSearch}
                    disabled={!bulkSearchInput.trim()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 whitespace-nowrap"
                  >
                    <Search className="h-3.5 w-3.5" />
                    Search Bulk TIDs
                  </button>
                  {bulkSearchInput && (
                    <button
                      onClick={() => { setBulkSearchInput(''); setBulkAuditResults(null); }}
                      className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg text-[11px] font-bold"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {bulkAuditResults && (
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono pt-1">
                  <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300">
                    Checked: <b>{bulkAuditResults.totalQueried}</b>
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-700/60 text-emerald-300">
                    ✓ Scanned: <b>{bulkAuditResults.matched.length}</b>
                  </span>
                  <span className="px-2 py-0.5 rounded bg-purple-950/60 border border-purple-700/60 text-purple-300">
                    RTO: <b>{bulkAuditResults.matched.filter((m) => m.is_rto).length}</b>
                  </span>
                  <span className="px-2 py-0.5 rounded bg-rose-950/60 border border-rose-800/60 text-rose-300">
                    ✕ Not Scanned: <b>{bulkAuditResults.notScanned.length}</b>
                  </span>
                </div>
              )}
            </div>
          )}

          {/* MODE B: SINGLE SEARCH & FILTER BAR */}
          {searchMode === 'single' && (
            <div className="px-3 py-2 bg-slate-900/50 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div className="relative flex-1 min-w-[160px] max-w-xs">
                <Search className="h-3.5 w-3.5 text-slate-500 absolute left-2.5 top-2" />
                <input
                  type="text"
                  placeholder="Quick filter TID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-md pl-8 pr-2.5 py-1 text-[11px] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-[10.5px]">
                <div className="flex bg-slate-950 p-0.5 rounded border border-slate-800 font-bold">
                  <button
                    onClick={() => setSelectedFilter('all')}
                    className={`px-2 py-0.5 rounded ${selectedFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}
                  >
                    All ({scannedLogs.length})
                  </button>
                  <button
                    onClick={() => setSelectedFilter('rto')}
                    className={`px-2 py-0.5 rounded ${selectedFilter === 'rto' ? 'bg-purple-600 text-white' : 'text-purple-400'}`}
                  >
                    RTO ({metrics.rtoTotalCount})
                  </button>
                  <button
                    onClick={() => setSelectedFilter('intercepted')}
                    className={`px-2 py-0.5 rounded ${selectedFilter === 'intercepted' ? 'bg-amber-600 text-white' : 'text-amber-400'}`}
                  >
                    Intercept ({metrics.interceptedCount})
                  </button>
                  <button
                    onClick={() => setSelectedFilter('standard')}
                    className={`px-2 py-0.5 rounded ${selectedFilter === 'standard' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}
                  >
                    Normal ({metrics.standardCount})
                  </button>
                </div>

                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[10.5px] text-slate-300 font-bold focus:outline-none"
                >
                  <option value="today">Today</option>
                  <option value="7d">Last 7 Days</option>
                  <option value="20d">Last 20 Days</option>
                </select>

                <select
                  value={stationFilter}
                  onChange={(e) => setStationFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[10.5px] text-slate-300 font-bold focus:outline-none max-w-[120px] truncate"
                >
                  <option value="all">All Stations</option>
                  {metrics.uniqueStations.map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Fast Windowed Table */}
          <div className="overflow-y-auto max-h-[380px]">
            {searchMode === 'bulk' ? (
              !bulkAuditResults ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  Paste tracking numbers above and click <b>Search Bulk TIDs</b> to inspect scan timestamps and RTO status.
                </div>
              ) : (
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] uppercase font-bold text-slate-400 sticky top-0 bg-slate-950">
                      <th className="py-1.5 px-2.5 w-10">#</th>
                      <th className="py-1.5 px-2.5">Tracking ID</th>
                      <th className="py-1.5 px-2.5">RTO</th>
                      <th className="py-1.5 px-2.5">Scan Status</th>
                      <th className="py-1.5 px-2.5">Scanned Date & Time</th>
                      <th className="py-1.5 px-2.5 text-right">Workstation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50 font-mono">
                    {bulkAuditResults.matched.slice(0, visibleLimit).map((item) => (
                      <tr
                        key={`match-${item.tracking_id}`}
                        className={item.is_missing_match ? 'bg-amber-950/30 border-l-2 border-l-amber-500' : 'hover:bg-slate-800/30'}
                      >
                        <td className="py-1.5 px-2.5 text-slate-500">{item.index}</td>
                        <td className={`py-1.5 px-2.5 font-bold ${item.is_missing_match ? 'text-amber-300' : 'text-emerald-300'}`}>
                          {item.tracking_id}
                        </td>
                        <td className="py-1.5 px-2.5">
                          {item.is_rto ? (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                              <RotateCcw className="h-2.5 w-2.5" /> RTO
                            </span>
                          ) : (
                            <span className="text-[9px] text-slate-500">NO</span>
                          )}
                        </td>
                        <td className="py-1.5 px-2.5">
                          {item.is_missing_match ? (
                            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              🚨 INTERCEPTED
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                              ✓ SCANNED
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 px-2.5 text-slate-200">{formatDateTime(item.scanned_at)}</td>
                        <td className="py-1.5 px-2.5 text-right text-slate-400 text-[10px]">{item.device_info || 'Terminal'}</td>
                      </tr>
                    ))}
                    {bulkAuditResults.notScanned.slice(0, Math.max(0, visibleLimit - bulkAuditResults.matched.length)).map((item) => (
                      <tr key={`miss-${item.tracking_id}`} className="bg-rose-950/15 hover:bg-rose-950/25">
                        <td className="py-1.5 px-2.5 text-slate-500">{item.index}</td>
                        <td className="py-1.5 px-2.5 font-bold text-rose-300">{item.tracking_id}</td>
                        <td className="py-1.5 px-2.5 text-slate-600">-</td>
                        <td className="py-1.5 px-2.5">
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800/60">
                            ✕ NOT SCANNED
                          </span>
                        </td>
                        <td className="py-1.5 px-2.5 text-slate-500">-</td>
                        <td className="py-1.5 px-2.5 text-right text-slate-600 text-[10px]">-</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            ) : visibleScans.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No scan records match the active filters.
              </div>
            ) : (
              <>
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] uppercase font-bold text-slate-400 sticky top-0 bg-slate-950">
                      <th className="py-1.5 px-2.5">Tracking ID</th>
                      <th className="py-1.5 px-2.5">RTO</th>
                      <th className="py-1.5 px-2.5">Status</th>
                      <th className="py-1.5 px-2.5">Terminal Timestamp</th>
                      <th className="py-1.5 px-2.5">TTL</th>
                      <th className="py-1.5 px-2.5 text-right">Station</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50 font-mono">
                    {visibleScans.map((scan) => {
                      const daysLeft = getDaysRemaining(scan._ts);
                      const isMissing = scan.is_missing_match;
                      const isRto = scan.is_rto;

                      return (
                        <tr
                          key={`${scan.tracking_id}-${scan._ts}`}
                          className={`transition ${
                            isMissing
                              ? 'bg-amber-950/30 hover:bg-amber-950/50 border-l-2 border-l-amber-500'
                              : isRto
                              ? 'bg-purple-950/15 hover:bg-purple-950/25'
                              : 'hover:bg-slate-800/30'
                          }`}
                        >
                          <td className="py-1.5 px-2.5">
                            <span className={`font-bold ${isMissing ? 'text-amber-300' : isRto ? 'text-purple-200' : 'text-slate-200'}`}>
                              {scan.tracking_id}
                            </span>
                          </td>
                          <td className="py-1.5 px-2.5">
                            {isRto ? (
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                                <RotateCcw className="h-2.5 w-2.5" /> RTO
                              </span>
                            ) : (
                              <span className="text-[9px] text-slate-600">NO</span>
                            )}
                          </td>
                          <td className="py-1.5 px-2.5">
                            {isMissing ? (
                              <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                <AlertTriangle className="h-2.5 w-2.5" /> INTERCEPT
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                                NORMAL
                              </span>
                            )}
                          </td>
                          <td className="py-1.5 px-2.5 text-slate-300">{formatDateTime(scan.scanned_at)}</td>
                          <td className="py-1.5 px-2.5">
                            <span className={`text-[10px] font-bold ${daysLeft <= 3 ? 'text-rose-400' : 'text-slate-500'}`}>
                              {daysLeft}d
                            </span>
                          </td>
                          <td className="py-1.5 px-2.5 text-right text-slate-500 text-[10px]">
                            {scan.device_info || 'Terminal'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Load More Button (Prevents DOM Bloat) */}
                {filteredScans.length > visibleLimit && (
                  <div className="p-2 text-center bg-slate-950/60 border-t border-slate-800/60">
                    <button
                      onClick={() => setVisibleLimit((prev) => prev + PAGE_RENDER_STEP)}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[11px] font-bold transition"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                      Load 100 More ({(filteredScans.length - visibleLimit).toLocaleString()} remaining)
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Slim Footer */}
          <div className="px-3 py-1.5 bg-slate-950 border-t border-slate-800 text-[10px] text-slate-500 font-mono flex items-center justify-between">
            <span>
              {searchMode === 'bulk' && bulkAuditResults
                ? `Bulk Audit: ${bulkAuditResults.matched.length} Scanned / ${bulkAuditResults.notScanned.length} Missing`
                : `Rendered ${visibleScans.length.toLocaleString()} of ${filteredScans.length.toLocaleString()} matched`}
            </span>
            <span className="text-cyan-500">Today PRC: {metrics.todayPrcCount} | Today RTO: {metrics.todayRtoCount}</span>
          </div>

        </div>
      </div>
    </div>
  );
}