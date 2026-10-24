// src/pages/AdminUserManager.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { PERMISSION_ITEMS } from '../config/routes';
import { Eye, EyeOff, Activity, Users, RefreshCw } from 'lucide-react';

export default function AdminUserManager() {
  const { profile } = useAuth();
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [actionMsg, setActionMsg] = useState('');
  const [activeTab, setActiveTab] = useState('permissions'); // 'permissions' | 'logs'
  const [loadingLogs, setLoadingLogs] = useState(false);

  const fetchUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true });
    if (data) setUsers(data);
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    const { data } = await supabase
      .from('user_activity_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(100);
    if (data) setLogs(data);
    setLoadingLogs(false);
  };

  useEffect(() => {
    if (profile?.is_admin) {
      fetchUsers();
      fetchLogs();
    }
  }, [profile]);

  const handleToggleRoute = async (userId, routeId) => {
    const target = users.find((u) => u.id === userId);
    if (!target) return;

    const currentRoutes = target.allowed_routes || [];
    const updatedRoutes = currentRoutes.includes(routeId)
      ? currentRoutes.filter((r) => r !== routeId)
      : [...currentRoutes, routeId];

    setSavingId(userId);
    const { error } = await supabase
      .from('profiles')
      .update({ allowed_routes: updatedRoutes, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (!error) {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, allowed_routes: updatedRoutes } : u))
      );
    }
    setSavingId(null);
  };

  const handleToggleAdmin = async (userId, currentAdmin) => {
    setSavingId(userId);
    const { error } = await supabase
      .from('profiles')
      .update({ is_admin: !currentAdmin })
      .eq('id', userId);

    if (!error) {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, is_admin: !currentAdmin } : u))
      );
    }
    setSavingId(null);
  };

  const handleToggleShowAllNav = async (userId, currentValue) => {
    setSavingId(userId);
    const { error } = await supabase
      .from('profiles')
      .update({ show_all_nav_items: !currentValue, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (!error) {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, show_all_nav_items: !currentValue } : u))
      );
    }
    setSavingId(null);
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setActionMsg('');
    const sanitizedUsername = newUsername.trim().toLowerCase();

    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: newUserEmail.trim(),
      password: newUserPassword,
    });

    if (authErr) {
      setActionMsg(`Error: ${authErr.message}`);
      return;
    }

    if (authData?.user) {
      // Save custom username
      await supabase
        .from('profiles')
        .update({ username: sanitizedUsername })
        .eq('id', authData.user.id);

      setActionMsg('User registered successfully.');
      setNewUserEmail('');
      setNewUsername('');
      setNewUserPassword('');
      fetchUsers();
    }
  };

  if (!profile?.is_admin) {
    return <div className="p-8 text-rose-500 font-semibold text-sm">Admin access required.</div>;
  }

  return (
    <div className="space-y-6 max-w-full">
      {/* Top Bar with Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Admin Control Center</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage permissions, credentials, and monitor operator access logs.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('permissions')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              activeTab === 'permissions'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Permissions Matrix</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('logs');
              fetchLogs();
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              activeTab === 'logs'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-blue-600" />
            <span>User Activity Logs</span>
          </button>
        </div>
      </div>

      {activeTab === 'permissions' ? (
        <>
          {/* Add Operator Form */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-sm">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">Add Operator Account</h2>
            <form onSubmit={handleCreateUser} className="flex flex-wrap items-end gap-3 text-sm">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Username</label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="bg-[#f8fafc] border border-slate-200 rounded-lg px-3 py-2 text-slate-900 text-xs focus:outline-none focus:border-blue-600"
                  placeholder="operator_1"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="bg-[#f8fafc] border border-slate-200 rounded-lg px-3 py-2 text-slate-900 text-xs focus:outline-none focus:border-blue-600"
                  placeholder="user@kot.in"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="bg-[#f8fafc] border border-slate-200 rounded-lg px-3 py-2 text-slate-900 text-xs focus:outline-none focus:border-blue-600"
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                className="bg-[#0a1128] hover:bg-[#162044] text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-sm transition"
              >
                Create Operator
              </button>
              {actionMsg && <span className="text-xs text-blue-600 self-center font-medium">{actionMsg}</span>}
            </form>
          </div>

          {/* Permissions Matrix */}
          <div className="bg-white border border-slate-200/90 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-600 border-b border-slate-200">
                    <th className="p-3.5 sticky left-0 bg-slate-50 font-bold z-10 whitespace-nowrap">Operator</th>
                    <th className="p-3.5 text-center font-bold">Admin</th>
                    <th className="p-3.5 text-center font-bold bg-blue-50/60 text-blue-800 whitespace-nowrap border-l border-r border-blue-100">
                      Show All in Sidebar
                    </th>
                    {PERMISSION_ITEMS.map((page) => (
                      <th key={page.id} className="p-3.5 text-center font-semibold text-slate-600 whitespace-nowrap">
                        {page.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/60 transition">
                      <td className="p-3.5 font-medium sticky left-0 bg-white whitespace-nowrap z-10 text-slate-900">
                        <div>
                          <span className="font-bold">{u.username || '—'}</span>
                          <span className="block text-[10px] text-slate-400">{u.email}</span>
                        </div>
                        {savingId === u.id && (
                          <span className="text-[10px] text-amber-500 font-semibold">Updating...</span>
                        )}
                      </td>
                      <td className="p-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={Boolean(u.is_admin)}
                          onChange={() => handleToggleAdmin(u.id, u.is_admin)}
                          className="accent-blue-600 cursor-pointer w-4 h-4"
                        />
                      </td>
                      <td className="p-3.5 text-center bg-blue-50/30 border-l border-r border-blue-100">
                        <button
                          type="button"
                          disabled={u.is_admin}
                          onClick={() => handleToggleShowAllNav(u.id, Boolean(u.show_all_nav_items))}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition cursor-pointer disabled:opacity-50 ${
                            u.show_all_nav_items
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                          }`}
                        >
                          {u.show_all_nav_items ? (
                            <>
                              <Eye className="w-3 h-3" /> Visible
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3 h-3" /> Hidden
                            </>
                          )}
                        </button>
                      </td>
                      {PERMISSION_ITEMS.map((page) => {
                        const isChecked = u.is_admin || (u.allowed_routes || []).includes(page.id);
                        return (
                          <td key={page.id} className="p-3.5 text-center">
                            <input
                              type="checkbox"
                              disabled={u.is_admin}
                              checked={isChecked}
                              onChange={() => handleToggleRoute(u.id, page.id)}
                              className="accent-blue-600 cursor-pointer disabled:opacity-40 w-4 h-4"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Activity Logs View */
        <div className="bg-white border border-slate-200/90 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Live Operator Page Access & Tool History</h2>
              <p className="text-xs text-slate-500">Tracks real-time tool usage across the terminal.</p>
            </div>
            <button
              onClick={fetchLogs}
              disabled={loadingLogs}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <th className="p-3 font-semibold">Timestamp</th>
                  <th className="p-3 font-semibold">User</th>
                  <th className="p-3 font-semibold">Email</th>
                  <th className="p-3 font-semibold">Module Visited</th>
                  <th className="p-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/60">
                    <td className="p-3 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="p-3 whitespace-nowrap font-bold text-slate-900">
                      {log.username || '—'}
                    </td>
                    <td className="p-3 whitespace-nowrap text-slate-500">
                      {log.email}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200/60 font-semibold">
                        {log.route_label}
                      </span>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span className="text-slate-600 font-medium">
                        {log.action}
                      </span>
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400">
                      No activity logs recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}