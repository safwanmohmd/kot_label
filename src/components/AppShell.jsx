import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Terminal,
  PlusCircle,
  FileCode,
  QrCode,
  History,
  Briefcase,
  Search,
  FileSpreadsheet,
  CheckCircle,
  ArrowUpDown,
  Eye,
  Truck,
  ClipboardList,
  Users,
  HardDrive,
  Mail,
  Settings,
  ShieldAlert,
  LogOut,
  Box,
  Lock
} from 'lucide-react';

const SIDEBAR_SECTIONS = [
  {
    category: 'CORE TERMINAL',
    items: [
      { id: 'dashboard', label: 'Dashboard', path: '/', icon: LayoutDashboard },
      { id: 'chromebook', label: 'Chromebook Runner', path: '/chromebook', icon: Terminal },
      { id: 'create', label: 'Create Label', path: '/create', icon: PlusCircle },
      { id: 'create_prn', label: 'PRN Label Generator', path: '/create-prn', icon: FileCode },
      { id: 'bulk', label: 'Bulk Barcodes', path: '/bulk', icon: QrCode },
      { id: 'history', label: 'Label History', path: '/history', icon: History },
    ],
  },
  {
    category: 'TRACKING & INSPECTION',
    items: [
      { id: 'bags', label: 'PRE ALERT', path: '/bags', icon: Briefcase },
      { id: 'search', label: 'Shipment Auditor', path: '/search', icon: Search },
      { id: 'eod', label: 'EOD Report', path: '/eod', icon: FileSpreadsheet },
      { id: 'verifytid', label: 'Return Verification', path: '/verifytid', icon: CheckCircle },
      { id: 'sort', label: 'Tracking Sorter', path: '/sort', icon: ArrowUpDown },
      { id: 'unmask', label: 'Unmask Deck', path: '/unmask', icon: Eye },
      { id: 'lp', label: 'Lp Tracker', path: '/lp', icon: Truck },
      { id: 'manualdelivery', label: 'Manual Delivery', path: '/manualdelivery', icon: ClipboardList },
    ],
  },
  {
    category: 'DIRECTORY TOOLS',
    items: [
      { id: 'vendors', label: 'Vendor Directory', path: '/vendors', icon: Users },
      { id: 'gdrive', label: 'GDrive Vault', path: '/gdrive', icon: HardDrive },
      { id: 'lossgen', label: 'Loss Log Email Gen', path: '/lossgen', icon: Mail },
    ],
  },
  {
    category: 'SYSTEM & CONFIG',
    items: [
      { id: 'settings', label: 'Settings', path: '/settings', icon: Settings },
    ],
  },
];

export function AppShell({ children }) {
  const { hasAccess, canSeeInNav, profile, signOut } = useAuth();
  const location = useLocation();

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const currentTitle = (() => {
    if (location.pathname === '/') return 'Dashboard';
    if (location.pathname === '/admin/users') return 'User Management';
    for (const sec of SIDEBAR_SECTIONS) {
      const match = sec.items.find((item) => item.path === location.pathname);
      if (match) return match.label;
    }
    return 'Dashboard';
  })();

  return (
    <div className="flex h-screen bg-[#f8fafc] text-slate-800 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-[#0a1128] text-slate-300 flex flex-col justify-between shrink-0 select-none border-r border-[#162044]">
        <div className="flex flex-col h-full overflow-hidden">
          {/* Logo Area */}
          <div className="p-4 flex items-center gap-3 border-b border-[#162044]/80">
            <div className="w-9 h-9 rounded-lg bg-[#2563eb] flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Box className="w-5 h-5" />
            </div>
            <div>
              <div className="font-extrabold text-white text-sm tracking-wider">KOT</div>
              <div className="text-[10px] text-slate-400 font-medium tracking-widest uppercase -mt-0.5">
                WAREHOUSE EDITION
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-5 custom-sidebar-scroll">
            {SIDEBAR_SECTIONS.map((sec) => {
              // Filters based on canSeeInNav (either user has permission OR show_all_nav_items is true)
              const navItems = sec.items.filter((item) => canSeeInNav(item.id));
              if (navItems.length === 0) return null;

              return (
                <div key={sec.category}>
                  <div className="px-3 pb-1.5 text-[10px] font-semibold text-slate-500 tracking-wider">
                    {sec.category}
                  </div>
                  <div className="space-y-0.5">
                    {navItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = location.pathname === item.path;
                      const isPermitted = hasAccess(item.id);

                      return (
                        <Link
                          key={item.id}
                          to={item.path}
                          className={`flex items-center justify-between px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                            isActive
                              ? 'bg-[#2563eb] text-white shadow-sm'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-[#131c3b]'
                          } ${!isPermitted ? 'opacity-70' : ''}`}
                        >
                          <div className="flex items-center gap-3 truncate">
                            <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                            <span className="truncate">{item.label}</span>
                          </div>
                          {!isPermitted && (
                            <Lock className="w-3 h-3 text-slate-500 shrink-0 ml-1.5" />
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Admin Management Link */}
            {profile?.is_admin && (
              <div>
                <div className="px-3 pb-1.5 text-[10px] font-semibold text-amber-500/80 tracking-wider">
                  ADMINISTRATION
                </div>
                <Link
                  to="/admin/users"
                  className={`flex items-center gap-3 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    location.pathname === '/admin/users'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-amber-400/90 hover:text-amber-300 hover:bg-[#131c3b]'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  <span className="truncate">User Access Permissions</span>
                </Link>
              </div>
            )}
          </nav>

          {/* User & Signout */}
          {profile && (
            <div className="p-3 border-t border-[#162044] bg-[#070d20] flex items-center justify-between text-xs text-slate-400">
              <span className="truncate max-w-[140px] text-[11px] text-slate-300">{profile.email}</span>
              <button
                onClick={signOut}
                title="Sign out"
                className="text-slate-400 hover:text-rose-400 p-1 rounded transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Viewport */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#f8fafc]">
        <header className="h-16 bg-white border-b border-slate-200/80 px-8 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-base font-bold text-slate-900 leading-tight">{currentTitle}</h1>
            <p className="text-xs text-slate-400 leading-tight">{currentDate}</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              System online
            </div>
            <Link
              to="/settings"
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition"
            >
              <Settings className="w-4 h-4" />
            </Link>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export default AppShell;