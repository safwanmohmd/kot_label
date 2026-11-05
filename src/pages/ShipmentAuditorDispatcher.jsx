import React, { useState, useMemo, useEffect } from 'react';
import { Search, Send, Volume2, CheckCircle2, ShieldCheck, Trash2, Key, Tag, X } from 'lucide-react';

// Default Extension ID stored in local cache
const EXTENSION_ID_KEY = 'kot_auditor_ext_id';
const LOCAL_ACTIVE_CACHE_KEY = 'kot_auditor_active_list';

export default function ShipmentAuditorSender() {
  const [rawTids, setRawTids] = useState('');
  const [extensionId, setExtensionId] = useState(
    localStorage.getItem(EXTENSION_ID_KEY) || ''
  );
  const [activeTids, setActiveTids] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_ACTIVE_CACHE_KEY) || '[]');
    } catch (e) {
      return [];
    }
  });
  const [dispatched, setDispatched] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');

  // Persist extension ID & local cache
  useEffect(() => {
    localStorage.setItem(EXTENSION_ID_KEY, extensionId);
  }, [extensionId]);

  useEffect(() => {
    localStorage.setItem(LOCAL_ACTIVE_CACHE_KEY, JSON.stringify(activeTids));
  }, [activeTids]);

  // Read active TIDs from the extension whenever the page mounts or ID changes
  const fetchActiveFromExtension = () => {
    if (typeof window.chrome !== 'undefined' && window.chrome.runtime && window.chrome.runtime.sendMessage && extensionId.trim()) {
      window.chrome.runtime.sendMessage(
        extensionId.trim(),
        { action: 'GET_PERSISTED_AUDITOR_TIDS' },
        (response) => {
          if (!window.chrome.runtime.lastError && response && Array.isArray(response.tids)) {
            setActiveTids(response.tids);
          }
        }
      );
    }
  };

  useEffect(() => {
    fetchActiveFromExtension();
  }, [extensionId]);

  // Clean raw inputs
  const parsedIncomingTids = useMemo(() => {
    return Array.from(
      new Set(
        rawTids
          .split(/[\n,;\s]+/)
          .map(s => s.trim().toUpperCase())
          .filter(Boolean)
      )
    );
  }, [rawTids]);

  // HIGH 3-BEEP PIERCING NOTICEABLE ALARM
  const playHighNoticeableAlarm = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      // 3 distinct piercing bursts: Beep (0s) ... Beep (0.16s) ... Beep (0.32s)
      [0, 0.16, 0.32].forEach(startOffset => {
        // High harmonic cluster: 2400Hz base with sharp square overtone
        [2400, 1600].forEach(freq => {
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

  // Push new TIDs to Extension & Active List
  const handleDispatch = (updatedList) => {
    const finalList = Array.from(new Set(updatedList.map(s => s.trim().toUpperCase()).filter(Boolean)));
    setActiveTids(finalList);

    // 1. Direct Chrome Extension message
    if (typeof window.chrome !== 'undefined' && window.chrome.runtime && window.chrome.runtime.sendMessage && extensionId.trim()) {
      window.chrome.runtime.sendMessage(
        extensionId.trim(),
        { type: 'SET_AUDITOR_TARGET_TIDS', tids: finalList },
        (response) => {
          if (window.chrome.runtime.lastError) {
            setSyncStatus('⚠️ Extension tab unreachable. Copied to clipboard.');
            navigator.clipboard.writeText(finalList.join('\n'));
          } else {
            setSyncStatus(`✅ Synced ${finalList.length} TIDs permanently!`);
          }
        }
      );
    } else {
      setSyncStatus('📋 Copied to clipboard (Use "Sync from Clipboard" in extension).');
      navigator.clipboard.writeText(finalList.join('\n'));
    }

    // 2. BroadcastChannel Fallback
    try {
      const channel = new BroadcastChannel('KOT_AUDITOR_CHANNEL');
      channel.postMessage({ type: 'SYNC_AUDITOR_TIDS', tids: finalList });
      channel.close();
    } catch (e) {}

    setDispatched(true);
    setTimeout(() => {
      setDispatched(false);
      setSyncStatus('');
    }, 3500);
  };

  const handleAppendNew = () => {
    if (parsedIncomingTids.length === 0) return;
    const combined = Array.from(new Set([...activeTids, ...parsedIncomingTids]));
    handleDispatch(combined);
    setRawTids('');
  };

  const handleRemoveSingle = (tidToRemove) => {
    const updated = activeTids.filter(id => id !== tidToRemove);
    handleDispatch(updated);
  };

  const handleClearAll = () => {
    handleDispatch([]);
    setRawTids('');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-sans">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 font-black text-lg">
            <Search className="h-5 w-5" />
            <span>Missing Shipment Auditor</span>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
              Live Storage Sync
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Audits reconciliation scans in real-time. Emits an urgent 3-beep alarm when any active missing TID appears.
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
        
        {/* Left Column: Input Panel */}
        <div className="md:col-span-6 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-3">
            {/* Extension ID Input */}
            <div className="flex items-center gap-2 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
              <Key className="h-4 w-4 text-cyan-400 flex-shrink-0" />
              <span className="text-xs text-slate-400 font-semibold whitespace-nowrap">Extension ID:</span>
              <input
                type="text"
                value={extensionId}
                onChange={(e) => setExtensionId(e.target.value)}
                placeholder="Paste ID from chrome://extensions"
                className="flex-1 bg-transparent border-none text-xs font-mono text-cyan-200 placeholder-slate-600 focus:outline-none"
              />
            </div>

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
                rows={6}
                value={rawTids}
                onChange={(e) => setRawTids(e.target.value)}
                placeholder="Paste missing TIDs here (1 per line or space-separated)...&#10;FMPR100239401&#10;FMPR100239402"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-cyan-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500 resize-y"
              />
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <button
                disabled={parsedIncomingTids.length === 0}
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
                    Sent to Extension!
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Sync & Save to Extension
                  </>
                )}
              </button>
              {syncStatus && (
                <span className="text-[11px] font-mono text-cyan-400 text-center">{syncStatus}</span>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Active TIDs Display */}
        <div className="md:col-span-6 flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-cyan-400" />
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Active In Extension ({activeTids.length})
              </span>
            </div>
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

          <div className="p-4 flex-1 overflow-y-auto max-h-[380px] space-y-2">
            {activeTids.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-500">
                No active missing TIDs stored in extension memory.
                <br />
                <span className="text-[11px] text-slate-600 mt-1 block">
                  Paste tracking numbers on the left and click "Sync & Save to Extension".
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
            <span>Auto-refreshed via <code>chrome.storage.local</code></span>
            <button
              onClick={fetchActiveFromExtension}
              className="text-cyan-400 hover:underline"
            >
              Force Refresh
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}