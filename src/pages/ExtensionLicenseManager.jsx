import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  Monitor, RefreshCw, Trash2, Edit3, Check, X,
  Wifi, WifiOff, Search, Lock, Unlock, Radar, EyeOff
} from 'lucide-react';

export default function ExtensionLicenseManager() {
  const [devices, setDevices] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'approved' | 'capturing' | 'blocked'
  const [editingId, setEditingId] = useState(null);
  const [editLabelValue, setEditLabelValue] = useState('');

  const fetchDevices = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('extension_devices')
        .select('*')
        .order('last_seen_at', { ascending: false });

      if (!error && data) {
        setDevices(data);
      }
    } catch (e) {
      console.error('Device fetch error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 8000);
    return () => clearInterval(interval);
  }, []);

  // Toggle Full Extension License (Grant / Revoke)
  const togglePermission = async (device) => {
    const nextState = !device.is_approved;
    try {
      const { error } = await supabase
        .from('extension_devices')
        .update({ is_approved: nextState })
        .eq('device_id', device.device_id);

      if (!error) {
        setDevices((prev) =>
          prev.map((d) =>
            d.device_id === device.device_id ? { ...d, is_approved: nextState } : d
          )
        );
      }
    } catch (e) {
      alert('Failed to update permission: ' + e.message);
    }
  };

  // Toggle Auditor TID Capture (Enable / Disable scan logging on this PC)
  const toggleAuditorCapture = async (device) => {
    const nextCaptureState = device.auditor_enabled === false ? true : false;
    try {
      const { error } = await supabase
        .from('extension_devices')
        .update({ auditor_enabled: nextCaptureState })
        .eq('device_id', device.device_id);

      if (!error) {
        setDevices((prev) =>
          prev.map((d) =>
            d.device_id === device.device_id ? { ...d, auditor_enabled: nextCaptureState } : d
          )
        );
      }
    } catch (e) {
      alert('Failed to update Auditor capture setting: ' + e.message);
    }
  };

  // Rename Workstation Label
  const saveDeviceLabel = async (deviceId) => {
    const cleanLabel = editLabelValue.trim() || 'Workstation';
    try {
      const { error } = await supabase
        .from('extension_devices')
        .update({ label: cleanLabel })
        .eq('device_id', deviceId);

      if (!error) {
        setDevices((prev) =>
          prev.map((d) =>
            d.device_id === deviceId ? { ...d, label: cleanLabel } : d
          )
        );
      }
    } catch (e) {} finally {
      setEditingId(null);
    }
  };

  // Remove Device Record
  const removeDevice = async (deviceId) => {
    if (!window.confirm(`Delete device ${deviceId}?`)) return;
    try {
      await supabase.from('extension_devices').delete().eq('device_id', deviceId);
      setDevices((prev) => prev.filter((d) => d.device_id !== deviceId));
    } catch (e) {}
  };

  const isOnline = (iso) => {
    if (!iso) return false;
    return Date.now() - new Date(iso).getTime() < 45000;
  };

  const formatLastSeen = (iso) => {
    if (!iso) return '-';
    const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diffSec < 15) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const filteredDevices = useMemo(() => {
    return devices.filter((d) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        d.device_id.toLowerCase().includes(q) ||
        (d.label || '').toLowerCase().includes(q) ||
        (d.platform || '').toLowerCase().includes(q);

      if (!matchesSearch) return false;
      if (statusFilter === 'approved') return d.is_approved;
      if (statusFilter === 'capturing') return d.is_approved && d.auditor_enabled !== false;
      if (statusFilter === 'blocked') return !d.is_approved;
      return true;
    });
  }, [devices, searchQuery, statusFilter]);

  const approvedCount = devices.filter((d) => d.is_approved).length;
  const capturingCount = devices.filter((d) => d.is_approved && d.auditor_enabled !== false).length;
  const blockedCount = devices.filter((d) => !d.is_approved).length;

  return (
    <div className="space-y-4 max-w-6xl mx-auto font-sans p-3 sm:p-5 text-slate-100">
      
      {/* Header Strip */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-cyan-400 font-black text-base">
            <Monitor className="h-5 w-5" />
            <span>Extension License & Auditor Capture Control</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono sm:border-l sm:border-slate-800 sm:pl-3">
            <span className="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-700/60 text-emerald-300">
              Licensed: <b>{approvedCount}</b>
            </span>
            <span className="px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-700/60 text-cyan-300">
              Catching TIDs: <b>{capturingCount}</b>
            </span>
            <span className="px-2 py-0.5 rounded bg-rose-950/60 border border-rose-800/60 text-rose-300">
              Blocked: <b>{blockedCount}</b>
            </span>
          </div>
        </div>

        <button
          onClick={fetchDevices}
          className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold transition"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xs">
        <div className="px-3.5 py-2.5 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="h-3.5 w-3.5 text-slate-500 absolute left-2.5 top-2" />
            <input
              type="text"
              placeholder="Search Device ID or Workstation Name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>

          <div className="flex flex-wrap bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[11px] font-bold">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-md transition ${statusFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}
            >
              All ({devices.length})
            </button>
            <button
              onClick={() => setStatusFilter('capturing')}
              className={`px-2.5 py-1 rounded-md transition ${statusFilter === 'capturing' ? 'bg-cyan-600 text-white' : 'text-cyan-400'}`}
            >
              Catching TIDs ({capturingCount})
            </button>
            <button
              onClick={() => setStatusFilter('approved')}
              className={`px-2.5 py-1 rounded-md transition ${statusFilter === 'approved' ? 'bg-emerald-600 text-white' : 'text-emerald-400'}`}
            >
              Licensed ({approvedCount})
            </button>
            <button
              onClick={() => setStatusFilter('blocked')}
              className={`px-2.5 py-1 rounded-md transition ${statusFilter === 'blocked' ? 'bg-rose-600 text-white' : 'text-rose-400'}`}
            >
              Blocked ({blockedCount})
            </button>
          </div>
        </div>

        {/* Systems Table */}
        <div className="overflow-x-auto">
          {filteredDevices.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-500">
              No extension systems match the active filter.
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] uppercase font-bold text-slate-400 bg-slate-950/60">
                  <th className="py-2.5 px-3">State</th>
                  <th className="py-2.5 px-3">Device ID</th>
                  <th className="py-2.5 px-3">Workstation</th>
                  <th className="py-2.5 px-3">Last Seen</th>
                  <th className="py-2.5 px-3">1. Extension Access</th>
                  <th className="py-2.5 px-3">2. Auditor TID Capture</th>
                  <th className="py-2.5 px-3 text-right">Remove</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredDevices.map((dev) => {
                  const online = isOnline(dev.last_seen_at);
                  const isCapturing = dev.is_approved && dev.auditor_enabled !== false;

                  return (
                    <tr
                      key={dev.device_id}
                      className={`transition ${
                        !dev.is_approved ? 'bg-rose-950/15 hover:bg-rose-950/25' : 'hover:bg-slate-800/30'
                      }`}
                    >
                      <td className="py-2.5 px-3">
                        {online ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                            <Wifi className="h-3.5 w-3.5 animate-pulse" /> ONLINE
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500">
                            <WifiOff className="h-3.5 w-3.5" /> OFFLINE
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 font-mono font-bold text-cyan-300">
                        {dev.device_id}
                      </td>

                      <td className="py-2.5 px-3">
                        {editingId === dev.device_id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={editLabelValue}
                              onChange={(e) => setEditLabelValue(e.target.value)}
                              className="bg-slate-950 border border-cyan-500 rounded px-2 py-0.5 text-xs text-white focus:outline-none w-36"
                              autoFocus
                            />
                            <button onClick={() => saveDeviceLabel(dev.device_id)} className="text-emerald-400 p-0.5">
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => setEditingId(null)} className="text-slate-400 p-0.5">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 group">
                            <span className="font-semibold text-slate-200">{dev.label || 'Unassigned Workstation'}</span>
                            <button
                              onClick={() => {
                                setEditingId(dev.device_id);
                                setEditLabelValue(dev.label || '');
                              }}
                              className="opacity-40 group-hover:opacity-100 text-slate-400 hover:text-cyan-400 transition"
                            >
                              <Edit3 className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-slate-300 text-[11px] font-mono">
                        {formatLastSeen(dev.last_seen_at)}
                      </td>

                      {/* Toggle 1: Extension License */}
                      <td className="py-2.5 px-3">
                        <button
                          onClick={() => togglePermission(dev)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10.5px] font-black transition border ${
                            dev.is_approved
                              ? 'bg-emerald-950/70 border-emerald-600/80 text-emerald-300 hover:bg-rose-950/70 hover:border-rose-600 hover:text-rose-300'
                              : 'bg-rose-950/70 border-rose-600/80 text-rose-300 hover:bg-emerald-950/70 hover:border-emerald-600 hover:text-emerald-300'
                          }`}
                        >
                          {dev.is_approved ? (
                            <><Unlock className="h-3 w-3" /> GRANTED</>
                          ) : (
                            <><Lock className="h-3 w-3" /> BLOCKED</>
                          )}
                        </button>
                      </td>

                      {/* Toggle 2: Auditor TID Capture ON/OFF */}
                      <td className="py-2.5 px-3">
                        <button
                          onClick={() => toggleAuditorCapture(dev)}
                          disabled={!dev.is_approved}
                          title={!dev.is_approved ? 'Grant Extension Access first' : 'Toggle whether this device logs scanned TIDs'}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10.5px] font-black transition border disabled:opacity-35 ${
                            isCapturing
                              ? 'bg-cyan-950/80 border-cyan-500/80 text-cyan-300 hover:bg-amber-950/70 hover:border-amber-600 hover:text-amber-300'
                              : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-cyan-950/70 hover:border-cyan-600 hover:text-cyan-300'
                          }`}
                        >
                          {isCapturing ? (
                            <><Radar className="h-3 w-3 animate-pulse" /> CATCHING TIDs</>
                          ) : (
                            <><EyeOff className="h-3 w-3" /> NOT CATCHING</>
                          )}
                        </button>
                      </td>

                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => removeDevice(dev.device_id)}
                          className="text-slate-500 hover:text-red-400 p-1 rounded transition"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
