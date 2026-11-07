import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Search, Send, Volume2, CheckCircle2, Trash2, Tag, X, Globe, RefreshCw, AlertTriangle, Clock } from 'lucide-react';

export default function ShipmentAuditorDispatcher() {
  const [rawTids, setRawTids] = useState('');
  const [activeTids, setActiveTids] = useState([]);
  const [detectedLogs, setDetectedLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dispatched, setDispatched] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');

  // 1. Fetch Active Target TIDs
  const fetchGlobalActiveTids = async () => {
    try {
      const { data, error } = await supabase
        .from('auditor_targets')
        .select('tracking_id')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setActiveTids(data.map((d) => d.tracking_id.toUpperCase()));
      }
    } catch (err) {
      console.error('Fetch error:', err);
    }
  };

  // 2. Fetch Found/Detected Missing Scan Logs
  const fetchDetectedLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('auditor_found_logs')
        .select('*')
        .order('found_at', { ascending: false })
        .limit(25);

      if (!error && data) {
        setDetectedLogs(data);
      }
    } catch (err) {
      console.error('Logs fetch error:', err);
    }
  };

  const refreshAll = async () => {
    setIsLoading(true);
    await Promise.all([fetchGlobalActiveTids(), fetchDetectedLogs()]);
    setIsLoading(false);
  };

  useEffect(() => {
    refreshAll();
    const interval = setInterval(fetchDetectedLogs, 6000);
    return () => clearInterval(interval);
  }, []);

  const parsedIncomingTids = useMemo(() => {
    return Array.from(
      new Set(
        rawTids
          .split(/[\n,;\s]+/)
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean)
      )
    );
  }, [rawTids]);

  const handleAppendNew = async () => {
    if (parsedIncomingTids.length === 0) return;
    setIsLoading(true);
    setSyncStatus('Broadcasting to Supabase...');

    const rowsToInsert = parsedIncomingTids.map((tid) => ({
      tracking_id: tid
    }));

    try {
      const { error } = await supabase
        .from('auditor_targets')
        .upsert(rowsToInsert, { onConflict: 'tracking_id' });

      if (error) throw error;

      setSyncStatus(`✅ Saved ${rowsToInsert.length} TIDs Globally!`);
      setRawTids('');
      setDispatched(true);
      await fetchGlobalActiveTids();

      setTimeout(() => {
        setDispatched(false);
        setSyncStatus('');
      }, 3000);
    } catch (err) {
      setSyncStatus(`⚠️ Sync failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveSingle = async (tidToRemove) => {
    try {
      await supabase.from('auditor_targets').delete().eq('tracking_id', tidToRemove);
      setActiveTids((prev) => prev.filter((id) => id !== tidToRemove));
    } catch (err) {}
  };

  const formatDateTime = (isoString) => {
    if (!isoString) return '-';
    const d = new Date(isoString);
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto font-sans p-4">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 font-black text-lg">
            <Globe className="h-5 w-5" />
            <span>Missing Shipment Auditor Hub</span>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
              Live Cloud Interceptor
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            When any listed tracking ID is scanned manually on any hub workstation, it triggers a 3-beep alarm and logs the exact timestamp below.
          </p>
        </div>

        <button
          onClick={refreshAll}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 px-3.5 py-2 rounded-lg text-xs font-bold transition shadow"
        >
          <RefreshCw className={`h-4 w-4 text-cyan-400 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Status
        </button>
      </div>

      {/* DETECTED MISSING SCANS LIVE FEED */}
      {detectedLogs.length > 0 && (
        <div className="bg-amber-950/20 border border-amber-600/40 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-amber-600/30 pb-2 mb-3">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
              <AlertTriangle className="h-4 w-4" />
              <span>🚨 Live Intercepted Missing Shipments</span>
            </div>
            <span className="text-[10px] font-mono text-amber-300 bg-amber-900/50 px-2 py-0.5 rounded border border-amber-700">
              {detectedLogs.length} Scanned Detected
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[160px] overflow-y-auto pr-1">
            {detectedLogs.map((log) => (
              <div
                key={log.id}
                className="bg-slate-900 border border-amber-600/30 rounded-lg p-2.5 flex items-start justify-between gap-2 shadow-xs"
              >
                <div>
                  <span className="font-mono font-bold text-xs text-amber-300 block">{log.tracking_id}</span>
                  <span className="text-[10.5px] text-slate-400 flex items-center gap-1 mt-0.5">
                    <Clock className="h-3 w-3 text-cyan-400" />
                    {formatDateTime(log.found_at)}
                  </span>
                </div>
                <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700">
                  Intercepted
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* INPUT FORM & ACTIVE QUEUE */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-6 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-3">
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Target Missing Tracking IDs
                </label>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-cyan-300 border border-slate-700">
                  {parsedIncomingTids.length} Ready
                </span>
              </div>

              <textarea
                rows={6}
                value={rawTids}
                onChange={(e) => setRawTids(e.target.value)}
                placeholder="Paste missing TIDs here...&#10;FMPR100239401&#10;FMPR100239402"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-cyan-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500 resize-y"
              />
            </div>

            <button
              disabled={parsedIncomingTids.length === 0 || isLoading}
              onClick={handleAppendNew}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition shadow bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
              {isLoading ? 'Syncing...' : 'Add to Active Missing Queue'}
            </button>
            {syncStatus && (
              <span className="text-[11px] font-mono text-cyan-400 text-center block">{syncStatus}</span>
            )}
          </div>
        </div>

        <div className="md:col-span-6 flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-cyan-400" />
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Currently Monitored ({activeTids.length})
              </span>
            </div>
          </div>

          <div className="p-4 flex-1 overflow-y-auto max-h-[260px] space-y-2">
            {activeTids.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-500">
                No active missing TIDs in the cloud queue.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {activeTids.map((tid) => (
                  <span
                    key={tid}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-950 border border-cyan-800/50 text-cyan-300 font-mono text-xs shadow-xs"
                  >
                    <span>{tid}</span>
                    <button
                      onClick={() => handleRemoveSingle(tid)}
                      className="text-slate-500 hover:text-red-400"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}