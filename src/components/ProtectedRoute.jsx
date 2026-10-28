import React from 'react';
import { useAuth } from '../context/AuthContext';
import Login from '../pages/Login';
import { ShieldAlert, Send, Box } from 'lucide-react';

export default function ProtectedRoute({ permissionKey, children }) {
  const { user, profile, loading, hasAccess } = useAuth();

  // Smooth buffering state: Only triggers when cold-booting without any cache
  if (loading && !profile) {
    return (
      <div className="fixed inset-0 z-50 bg-[#f8fafc] flex flex-col items-center justify-center select-none overflow-hidden">
        {/* Top Edge Animated Shimmer Beam */}
        <div className="fixed top-0 left-0 right-0 h-1 bg-slate-200/70 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-blue-500 via-indigo-600 to-blue-500 animate-[moveBeam_1.4s_cubic-bezier(0.4,0,0.2,1)_infinite] w-2/5" />
        </div>

        {/* Center Card Loader */}
        <div className="flex flex-col items-center p-8 bg-white border border-slate-200/90 rounded-2xl shadow-xl shadow-slate-200/70 max-w-xs w-full text-center">
          {/* Logo with pulsing beacon */}
          <div className="relative mb-4">
            <div className="w-12 h-12 rounded-xl bg-[#2563eb] flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
              <Box className="w-6 h-6 animate-pulse" />
            </div>
            <div className="absolute -inset-1 rounded-2xl bg-blue-500/20 animate-ping -z-10" />
          </div>

          <h3 className="text-sm font-extrabold text-slate-900 tracking-wider">
            KOT LOGISTICS
          </h3>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mt-0.5">
            Connecting Terminal
          </p>

          {/* Smooth progress dots */}
          <div className="flex items-center gap-1.5 mt-5">
            <div className="w-2 h-2 rounded-full bg-blue-600 animate-[bounce_1s_infinite_100ms]" />
            <div className="w-2 h-2 rounded-full bg-blue-600 animate-[bounce_1s_infinite_200ms]" />
            <div className="w-2 h-2 rounded-full bg-blue-600 animate-[bounce_1s_infinite_300ms]" />
          </div>
        </div>

        <style>{`
          @keyframes moveBeam {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(350%); }
          }
        `}</style>
      </div>
    );
  }

  // Not authenticated
  if (!user && !profile) {
    return <Login />;
  }

  // Permission check
  if (permissionKey && !hasAccess(permissionKey)) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6 select-none animate-fade-in">
        <div className="w-14 h-14 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-center text-rose-500 mb-4 shadow-sm">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-1">Access Restricted</h2>
        <p className="text-sm text-slate-600 font-medium max-w-md">
          Admin denied permission to view this page.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-slate-100 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-700 shadow-sm">
          <Send className="w-3.5 h-3.5 text-blue-600" />
          <span>Request access @ <strong className="text-blue-600 font-bold">safwanmohmd</strong></span>
        </div>
      </div>
    );
  }

  return children;
}