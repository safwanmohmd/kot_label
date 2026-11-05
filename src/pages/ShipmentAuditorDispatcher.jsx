import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Search, Send, Volume2, CheckCircle2, Trash2, Tag, X, Globe, RefreshCw } from 'lucide-react';

export default function ShipmentAuditorDispatcher() {
  const [rawTids, setRawTids] = useState('');
  const [activeTids, setActiveTids] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dispatched, setDispatched] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');

  // 1. Fetch Global List using project's existing Supabase client
  const fetchGlobalActiveTids = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('auditor_targets')
        .select('tracking_id')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) {
        setActiveTids(data.map((d) => d.tracking_id.toUpperCase()));
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setSyncStatus(`⚠️ Fetch error: ${err.message || 'Check connection'}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGlobalActiveTids();
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

  // High 3-Beep Piercing Noticeable Alarm Test
  const playHighNoticeableAlarm = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.16, 0.32].forEach((startOffset) => {
        [2400, 1600].forEach((freq) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'square';

          const t = ctx.currentTime + startOffset;
          osc.frequency.setValueAtTime(freq, t);

          gain.gain.setValueAtTime(0.35, t);
          gain.gain.setValueAtTime(0.35, t + 0.10);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.12);
        });
      });
    } catch (e) {}
  };

const handleAppendNew = async () => {
    if (parsedIncomingTids.length === 0) return;
    setIsLoading(true);
    setSyncStatus('Broadcasting to Supabase...');

    // Only supply tracking_id matching the table primary key
    const rowsToInsert = parsedIncomingTids.map((tid) => ({
      tracking_id: tid
    }));

    try {
      const { error } = await supabase
        .from('auditor_targets')
        .upsert(rowsToInsert, { onConflict: 'tracking_id' });

      if (error) throw error;

      setSyncStatus(`✅ Synced ${rowsToInsert.length} TIDs Globally!`);
      setRawTids('');
      setDispatched(true);
      await fetchGlobalActiveTids();

      setTimeout(() => {
        setDispatched(false);
        setSyncStatus('');
      }, 3000);
    } catch (err) {
      console.error('Upload error details:', err);
      setSyncStatus(`⚠️ Sync failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Remove Single TID
  const handleRemoveSingle = async (tidToRemove) => {
    try {
      const { error } = await supabase
        .from('auditor_targets')
        .delete()
        .eq('tracking_id', tidToRemove);

      if (error) throw error;
      setActiveTids((prev) => prev.filter((id) => id !== tidToRemove));
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  // 4. Clear All Globally
  const handleClearAll = async () => {
    if (!window.confirm('Clear all missing TIDs globally across all hub devices?')) return;
    try {
      const { error } = await supabase
        .from('auditor_targets')
        .delete()
        .neq('tracking_id', '');

      if (error) throw error;
      setActiveTids([]);
    } catch (err) {
      console.error('Clear all error:', err);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-sans">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 font-black text-lg">
            <Globe className="h-5 w-5" />
            <span>Shipment Auditor (Global Hub)</span>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
              Supabase Connected
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            TIDs entered here sync live to all hub workstations and extension terminals.
          </p>
        </div>

        <button
          onClick={playHighNoticeableAlarm}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 px-3.5 py-2 rounded-lg text-xs font-bold transition-all shadow"
        >
          <Volume2 className="h-4 w-4 text-cyan-400" />
          Test 3-Beep Alarm
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Left Column: Input Form */}
        <div className="md:col-span-6 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-3">
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Add Missing Tracking IDs
                </label>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-cyan-300 border border-slate-700">
                  {parsedIncomingTids.length} Ready
                </span>
              </div>

              <textarea
                rows={7}
                value={rawTids}
                onChange={(e) => setRawTids(e.target.value)}
                placeholder="Paste missing TIDs here...&#10;FMPR100239401&#10;FMPR100239402"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-cyan-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500 resize-y"
              />
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <button
                disabled={parsedIncomingTids.length === 0 || isLoading}
                onClick={handleAppendNew}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all shadow ${
                  dispatched
                    ? 'bg-emerald-600 text-white'
                    : 'bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-40 disabled:cursor-not-allowed'
                }`}
              >
                {dispatched ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Broadcasted to All Extensions!
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    {isLoading ? 'Syncing...' : 'Broadcast to All Devices (Global)'}
                  </>
                )}
              </button>
              {syncStatus && (
                <span className="text-[11px] font-mono text-cyan-400 text-center">{syncStatus}</span>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Active Cloud TIDs */}
        <div className="md:col-span-6 flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-cyan-400" />
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Active In Cloud ({activeTids.length})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchGlobalActiveTids}
                className="text-slate-400 hover:text-cyan-400 p-1"
                title="Refresh Cloud Data"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              {activeTids.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="flex items-center gap-1 text-[11px] text-red-400 hover:text-red-300 font-bold px-2 py-0.5 rounded bg-red-950/40 border border-red-800/60"
                >
                  <Trash2 className="h-3 w-3" />
                  Clear All
                </button>
              )}
            </div>
          </div>

          <div className="p-4 flex-1 overflow-y-auto max-h-[380px] space-y-2">
            {activeTids.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-500">
                No active missing TIDs in Supabase.
                <br />
                <span className="text-[11px] text-slate-600 mt-1 block">
                  Add tracking numbers on the left to sync to all hub workstations.
                </span>
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
                      className="text-slate-500 hover:text-red-400 focus:outline-none"
                      title="Remove TID"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="px-4 py-2 bg-slate-950 border-t border-slate-800 text-[11px] text-slate-500 font-mono flex items-center justify-between">
            <span>Extensions poll every 8 seconds</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Live Connected
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}