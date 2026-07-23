import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  PlusCircle,
  Layers,
  History,
  Settings,
  Package,
  ScanLine,
  Menu,
  Eye,
  ShieldAlert,
  Truck,
  Users,
  MailPlus,
  X,
  FileCode,
} from 'lucide-react';
import { useState } from 'react';

// Organized navigation configurations grouped by functional category
const NAV_GROUPS = [
  {
    groupLabel: 'Core Terminal',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/create', label: 'Create Label', icon: PlusCircle },
      { to: '/create-prn', label: 'PRN Label Generator', icon: FileCode },
      { to: '/bulk', label: 'Bulk Barcodes', icon: ScanLine },
      { to: '/history', label: 'Label History', icon: History },
    ]
  },
  {
    groupLabel: 'Tracking & Inspection',
    items: [
      { to: '/unmask', label: 'Unmask Deck', icon: Eye },
      { to: '/lp', label: 'Lp Tracker', icon: ShieldAlert },
      { to: '/manualdelivery', label: 'Manual Delivery', icon: Truck },
    ]
  },
  {
    groupLabel: 'Directory Tools',
    items: [
      { to: '/vendors', label: 'Vendor Directory', icon: Users },
      { to: '/lossgen', label: 'Loss Log Email Gen', icon: MailPlus },
    ]
  },
  {
    groupLabel: 'System & Config',
    items: [
      { to: '/settings', label: 'Settings', icon: Settings },
    ]
  }
];

// Flattened list mapping helper for the top header page matching logic
const ALL_NAV_ITEMS = NAV_GROUPS.flatMap(group => group.items);

export function AppShell({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen bg-ink-50 flex">
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden lg:flex w-64 flex-col bg-ink-900 text-white no-print">
        <SidebarContent />
      </aside>

      {/* MOBILE DRAWER LAYER */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 no-print">
          <div
            className="absolute inset-0 bg-ink-900/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-ink-900 text-white flex flex-col animate-slide-in">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 text-ink-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* VIEWPORT CONTROLLER */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-ink-200 flex items-center justify-between px-4 lg:px-8 no-print">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden text-ink-600 hover:text-ink-900"
            >
              <Menu className="h-6 w-6" />
            </button>
            <div>
              <h1 className="text-base font-bold text-ink-900">
                {ALL_NAV_ITEMS.find((n) => (n.end ? location.pathname === n.to : location.pathname.startsWith(n.to) && n.to !== '/'))?.label ?? 'Dashboard'}
              </h1>
              <p className="text-xs text-ink-500 hidden sm:block">
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 text-xs text-ink-500">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse-soft" />
              System online
            </div>
            
            {/* ACTIVE ACTION HUB REDIRECT BUTTON / ROUTER CONTROL LINKS */}
            <NavLink 
              to="/settings"
              className={({ isActive }) => 
                `h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold transition-all border ${
                  isActive 
                    ? 'bg-brand-600 border-brand-700 text-white shadow-xs' 
                    : 'bg-ink-100 border-ink-200 text-ink-700 hover:bg-ink-200'
                }`
              }
              title="System Settings Configuration"
            >
              <Settings className="h-4 w-4" />
            </NavLink>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

function SidebarContent({ onNavigate }) {
  return (
    <>
      {/* BRAND HEADER DISPLAY LOGO BOX */}
      <div className="h-16 flex items-center gap-2.5 px-5 border-b border-ink-800">
        <div className="h-9 w-9 rounded-lg bg-brand-600 flex items-center justify-center">
          <Package className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-white">KOT</p>
          <p className="text-[10px] text-ink-400 uppercase tracking-wider">Warehouse Edition</p>
        </div>
      </div>

      {/* SCROLLABLE CATEGORIZED SIDE NAVIGATION CONTROLLER */}
      <nav className="flex-1 py-4 px-3 space-y-5 overflow-y-auto">
        {NAV_GROUPS.map((group) => (
          <div key={group.groupLabel} className="space-y-1">
            {/* SUB-CATEGORY DESCRIPTIONS SEPARATORS */}
            <h3 className="px-3 text-[9px] font-bold text-ink-500 uppercase tracking-widest mb-1.5">
              {group.groupLabel}
            </h3>
            
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                        isActive
                          ? 'bg-brand-600 text-white font-semibold'
                          : 'text-ink-300 hover:bg-ink-800/60 hover:text-white'
                      }`
                    }
                  >
                    <Icon className="h-4.5 w-4.5 flex-shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* CONSOLE STATUS FOOTER META CARD */}
      <div className="p-3 border-t border-ink-800">
        <div className="rounded-lg bg-ink-800/40 p-2.5 border border-ink-800/60">
          <div className="flex items-center gap-2 mb-0.5">
            <Layers className="h-3.5 w-3.5 text-brand-400" />
            <p className="text-[11px] font-bold text-white">Courier API Ready</p>
          </div>
          <p className="text-[10px] text-ink-400 leading-normal">
            Structure supports integration vectors via regional endpoint routing models.
          </p>
        </div>
      </div>
    </>
  );
}