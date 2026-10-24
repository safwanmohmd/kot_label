// src/components/ProtectedRoute.jsx
import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Login from '../pages/Login';
import { ShieldAlert, Send } from 'lucide-react';
import { logUserActivity } from '../lib/activityLogger';
import { APP_ROUTES } from '../config/routes';

export default function ProtectedRoute({ permissionKey, children }) {
  const { user, profile, loading, hasAccess } = useAuth();

  useEffect(() => {
    if (user && profile && permissionKey && hasAccess(permissionKey)) {
      const routeObj = APP_ROUTES.find((r) => r.id === permissionKey);
      logUserActivity({
        user,
        profile,
        routeId: permissionKey,
        routeLabel: routeObj?.label || permissionKey,
        action: 'VISITED_PAGE',
      });
    }
  }, [permissionKey, user, profile]);

  if (loading || (user && !profile)) {
    return (
      <div className="h-screen w-screen bg-[#f8fafc] flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
          Loading KOT Portal...
        </span>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (permissionKey && !hasAccess(permissionKey)) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6 select-none">
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