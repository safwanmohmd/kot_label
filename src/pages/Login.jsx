// src/pages/Login.jsx
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Box, Lock, User, ArrowRight, ShieldCheck } from 'lucide-react';

export default function Login() {
  const [identifier, setIdentifier] = useState(''); // Accepts username or email
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      let loginEmail = identifier.trim().toLowerCase();

      // If user typed a username without @, find the matching email from profiles
      if (!loginEmail.includes('@')) {
        const { data, error } = await supabase
          .from('profiles')
          .select('email')
          .ilike('username', loginEmail)
          .maybeSingle();

        if (error || !data) {
          throw new Error('User not found. Please check your username or email.');
        }
        loginEmail = data.email;
      }

      // Authenticate with Supabase
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });

      if (authError) throw authError;
    } catch (err) {
      setErrorMsg(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#f8fafc] flex items-center justify-center p-4 overflow-hidden select-none">
      <div className="w-full max-w-[390px] my-auto">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-[#2563eb] flex items-center justify-center text-white shadow-lg shadow-blue-500/25 mb-2.5">
            <Box className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-wider">
            KOT
          </h1>
          <p className="text-[11px] font-semibold text-slate-500 tracking-[0.2em] uppercase">
            WAREHOUSE EDITION
          </p>
        </div>

        {/* Card */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xl shadow-slate-200/50">
          <div className="mb-5">
            <h2 className="text-base font-bold text-slate-900">Sign in to Terminal</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Enter your authorized username or email
            </p>
          </div>

          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-600 text-xs px-3.5 py-2.5 rounded-lg mb-4 leading-relaxed font-medium">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Username or Email
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="admin or user@kot.in"
                  className="w-full bg-[#f8fafc] border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#2563eb] focus:bg-white focus:ring-2 focus:ring-blue-500/10 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#f8fafc] border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#2563eb] focus:bg-white focus:ring-2 focus:ring-blue-500/10 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0a1128] hover:bg-[#162044] text-white text-xs font-semibold py-2.5 px-4 rounded-lg shadow-md transition-all flex items-center justify-center gap-2 group disabled:opacity-60 cursor-pointer"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In to Workspace'}</span>
              {!loading && (
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 group-hover:text-white transition" />
              )}
            </button>
          </form>

          <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Role-Based Access Protected</span>
          </div>
        </div>
      </div>
    </div>
  );
}