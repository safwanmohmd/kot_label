import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { PERMISSION_ITEMS } from '../config/routes';
import { 
  Eye, 
  EyeOff, 
  Activity, 
  Users, 
  RefreshCw, 
  KeyRound, 
  X, 
  Trash2, 
  AlertTriangle 
} from 'lucide-react';

export default function AdminUserManager() {
  const { profile, user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [actionMsg, setActionMsg] = useState('');
  const [activeTab, setActiveTab] = useState('permissions'); // 'permissions' | 'logs'
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Password Reset Modal State
  const [selectedUserForPassword, setSelectedUserForPassword] = useState(null);
  const [newPassInput, setNewPassInput] = useState('');
  const [passUpdating, setPassUpdating] = useState(false);
  const [passStatus, setPassStatus] = useState({ success: null, message: '' });

  // Delete User Confirmation Modal State
  const [userToDelete, setUserToDelete] = useState(null);
  const [deletingUser, setDeletingUser] = useState(false);

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

  const handleExecutePasswordChange = async (e) => {
    e.preventDefault();
    if (!selectedUserForPassword || !newPassInput) return;

    if (newPassInput.length < 6) {
      setPassStatus({ success: false, message: 'Password must be at least 6 characters long.' });
      return;
    }

    setPassUpdating(true);
    setPassStatus({ success: null, message: '' });

    try {
      if (selectedUserForPassword.id === currentUser?.id) {
        const { error } = await supabase.auth.updateUser({ password: newPassInput });
        if (error) throw error;
      }

      const { data, error } = await supabase.rpc('admin_reset_user_password', {
        target_user_id: selectedUserForPassword.id,
        new_password: newPassInput,
      });

      if (error) throw error;
      if (data && !data.success) throw new Error(data.message);

      setPassStatus({ success: true, message: `Password updated for ${selectedUserForPassword.email}` });
      setNewPassInput('');
      setTimeout(() => {
        setSelectedUserForPassword(null);
        setPassStatus({ success: null, message: '' });
      }, 1500);
    } catch (err) {
      setPassStatus({ success: false, message: err.message || 'Failed to update password.' });
    } finally {
      setPassUpdating(false);
    }
  };

  // Delete User Handler
  const handleExecuteDeleteUser = async () => {
    if (!userToDelete) return;

    setDeletingUser(true);
    try {
      const { data, error } = await supabase.rpc('admin_delete_user', {
        target_user_id: userToDelete.id,
      });

      if (error) throw error;
      if (data && !data.success) throw new Error(data.message);

      // Remove from local list
      setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id));
      setUserToDelete(null);
    } catch (err) {
      alert(err.message || 'Failed to delete user');
    } finally {
      setDeletingUser(false);
    }
  };

  if (!profile?.is_admin) {
    return <div className="p-8 text-rose-500 font-semibold text-sm">Admin access required.</div>;
  }

  return (
    <div className="space-y-6 max-w-full">
      {/* Header & View Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Admin Control Center</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage credentials, permissions, and monitor operator access logs.
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
            <span>Permissions & Users</span>
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
            <span>Activity Logs</span>
          </button>
        </div>
      </div>

      {activeTab === 'permissions' ? (
        <>
          {/* Add Operator Form & Admin Card */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 bg-white border border-slate-200/90 rounded-xl p-5 shadow-sm">
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

            <div className="bg-gradient-to-br from-slate-900 to-[#162044] text-white rounded-xl p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider mb-1">
                  <KeyRound className="w-4 h-4" />
                  <span>Admin Credentials</span>
                </div>
                <p className="text-xs text-slate-300">
                  Update your current master login password directly.
                </p>
                <div className="mt-2 text-[11px] text-slate-400 font-mono">
                  Active: {currentUser?.email}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedUserForPassword({
                    id: currentUser.id,
                    email: currentUser.email,
                    username: profile.username || 'Admin',
                  });
                }}
                className="mt-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-3 py-2 rounded-lg text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow"
              >
                <KeyRound className="w-3.5 h-3.5" />
                Change My Password
              </button>
            </div>
          </div>

          {/* User List Table */}
          <div className="bg-white border border-slate-200/90 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-600 border-b border-slate-200">
                    <th className="p-3.5 sticky left-0 bg-slate-50 font-bold z-10 whitespace-nowrap">Operator</th>
                    <th className="p-3.5 text-center font-bold">Actions</th>
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
                  {users.map((u) => {
                    const isSelf = u.id === currentUser?.id;

                    return (
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

                        {/* Actions: Reset Password + Delete User */}
                        <td className="p-3.5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedUserForPassword(u)}
                              title="Reset Password"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] transition cursor-pointer border border-slate-200"
                            >
                              <KeyRound className="w-3 h-3 text-slate-500" />
                              <span>Pass</span>
                            </button>

                            <button
                              type="button"
                              disabled={isSelf}
                              onClick={() => setUserToDelete(u)}
                              title={isSelf ? 'Cannot delete your own account' : 'Delete user'}
                              className="p-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
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
                    );
                  })}
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

      {/* PASSWORD CHANGE MODAL */}
      {selectedUserForPassword && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 relative animate-fade-in">
            <button
              onClick={() => {
                setSelectedUserForPassword(null);
                setPassStatus({ success: null, message: '' });
                setNewPassInput('');
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Set New Password</h3>
                <p className="text-[11px] text-slate-500 truncate max-w-[200px]">
                  {selectedUserForPassword.email}
                </p>
              </div>
            </div>

            {passStatus.message && (
              <div
                className={`text-xs p-3 rounded-lg mb-4 leading-relaxed font-medium ${
                  passStatus.success
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}
              >
                {passStatus.message}
              </div>
            )}

            <form onSubmit={handleExecutePasswordChange} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  autoFocus
                  placeholder="Minimum 6 characters"
                  value={newPassInput}
                  onChange={(e) => setNewPassInput(e.target.value)}
                  className="w-full bg-[#f8fafc] border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedUserForPassword(null)}
                  className="flex-1 px-3 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={passUpdating}
                  className="flex-1 bg-[#0a1128] hover:bg-[#162044] text-white px-3 py-2 rounded-lg text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
                >
                  {passUpdating ? 'Updating...' : 'Save Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE USER CONFIRMATION MODAL */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 relative animate-fade-in">
            <button
              onClick={() => setUserToDelete(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Delete Operator Account</h3>
                <p className="text-[11px] text-slate-500">This action cannot be undone.</p>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs text-slate-700 my-4 space-y-1">
              <div>
                <span className="font-semibold text-slate-500">Username: </span>
                <span className="font-bold text-slate-900">{userToDelete.username || '—'}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-500">Email: </span>
                <span className="font-mono text-slate-800">{userToDelete.email}</span>
              </div>
            </div>

            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              Are you sure you want to permanently delete this user? Their access credentials and assigned permissions will be deleted immediately.
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="flex-1 px-3 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingUser}
                onClick={handleExecuteDeleteUser}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white px-3 py-2 rounded-lg text-xs font-semibold transition disabled:opacity-50 cursor-pointer shadow-sm"
              >
                {deletingUser ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}