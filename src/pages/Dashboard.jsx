import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Package,
  Printer,
  TrendingUp,
  Clock,
  ArrowRight,
  PlusCircle,
  ScanLine,
  Truck,
  AlertCircle,
} from 'lucide-react';
import { fetchLabels } from '../lib/labels.js';
import { isSupabaseConfigured } from '../lib/supabase.js';

export function Dashboard() {
  const [labels, setLabels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchLabels();
        if (!cancelled) setLabels(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load labels');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    const total = labels.length;
    const printed = labels.filter((l) => l.status === 'printed').length;
    const today = labels.filter((l) => {
      const d = new Date(l.created_at);
      const now = new Date();
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
      );
    }).length;

    const byCourier = new Map();
    for (const l of labels) {
      const k = l.courier_name ?? 'Unassigned';
      byCourier.set(k, (byCourier.get(k) ?? 0) + 1);
    }
    const topCouriers = Array.from(byCourier.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      d.setHours(0, 0, 0, 0);
      return { date: d, count: 0 };
    });
    for (const l of labels) {
      const d = new Date(l.created_at);
      d.setHours(0, 0, 0, 0);
      const bucket = last7.find((b) => b.date.getTime() === d.getTime());
      if (bucket) bucket.count++;
    }

    return { total, printed, today, topCouriers, last7 };
  }, [labels]);

  const maxDay = Math.max(1, ...stats.last7.map((d) => d.count));
  const recent = labels.slice(0, 6);

  return (
    <div className="space-y-6 animate-fade-in">
      {!isSupabaseConfigured && (
        <div className="card flex items-start gap-3 p-4 border-amber-200 bg-amber-50">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-900">Running in offline mode</p>
            <p className="text-xs text-amber-800">
              Supabase isn't configured. Labels you create won't be saved to the database, but all
              barcode generation, printing, and PDF export still work.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuickAction
          to="/create"
          icon={PlusCircle}
          title="Create New Label"
          desc="Generate a shipping label with live barcode preview"
          color="brand"
        />
        <QuickAction
          to="/bulk"
          icon={ScanLine}
          title="Bulk Barcode Generator"
          desc="Paste or upload tracking IDs to generate barcodes in bulk"
          color="brand"
        />
        <QuickAction
          to="/history"
          icon={Clock}
          title="Label History"
          desc="Search, filter, and reprint saved labels"
          color="ink"
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Package}
          label="Total Labels"
          value={stats.total}
          accent="bg-brand-50 text-brand-700"
          loading={loading}
        />
        <StatCard
          icon={Printer}
          label="Printed"
          value={stats.printed}
          accent="bg-green-50 text-green-700"
          loading={loading}
        />
        <StatCard
          icon={TrendingUp}
          label="Created Today"
          value={stats.today}
          accent="bg-amber-50 text-amber-700"
          loading={loading}
        />
        <StatCard
          icon={Truck}
          label="Active Couriers"
          value={stats.topCouriers.length}
          accent="bg-ink-100 text-ink-700"
          loading={loading}
        />
      </div>

      {error && (
        <div className="card p-4 border-red-200 bg-red-50 text-sm text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-ink-900">Labels — Last 7 Days</h3>
              <p className="text-xs text-ink-500">Daily creation volume</p>
            </div>
          </div>
          <div className="flex items-end justify-between gap-2 h-40">
            {stats.last7.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex-1 flex items-end">
                  <div
                    className="w-full bg-brand-500 rounded-t-md transition-all duration-300 hover:bg-brand-600 relative group"
                    style={{ height: `${(d.count / maxDay) * 100}%`, minHeight: d.count > 0 ? '8px' : '2px' }}
                  >
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-ink-700 opacity-0 group-hover:opacity-100 transition-opacity">
                      {d.count}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] text-ink-500 font-medium">
                  {d.date.toLocaleDateString('en-US', { weekday: 'short' })}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-bold text-ink-900 mb-1">Top Couriers</h3>
          <p className="text-xs text-ink-500 mb-4">By label volume</p>
          <div className="space-y-3">
            {stats.topCouriers.length === 0 && !loading && (
              <p className="text-xs text-ink-400">No data yet</p>
            )}
            {stats.topCouriers.map(([name, count]) => {
              const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
              return (
                <div key={name}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-ink-700">{name}</span>
                    <span className="text-ink-500">{count}</span>
                  </div>
                  <div className="h-2 bg-ink-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-500 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between p-5 border-b border-ink-100">
          <div>
            <h3 className="text-sm font-bold text-ink-900">Recent Labels</h3>
            <p className="text-xs text-ink-500">Latest created shipping labels</p>
          </div>
          <Link
            to="/history"
            className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1"
          >
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-ink-400">Loading…</div>
        ) : recent.length === 0 ? (
          <div className="p-8 text-center">
            <Package className="h-10 w-10 text-ink-300 mx-auto mb-2" />
            <p className="text-sm text-ink-500 mb-3">No labels yet</p>
            <Link to="/create" className="btn-primary text-xs">
              Create your first label
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-xs text-ink-500 uppercase tracking-wide">
                <tr>
                  <th className="text-left font-semibold px-5 py-3">Tracking ID</th>
                  <th className="text-left font-semibold px-5 py-3">Receiver</th>
                  <th className="text-left font-semibold px-5 py-3 hidden md:table-cell">Courier</th>
                  <th className="text-left font-semibold px-5 py-3 hidden sm:table-cell">Status</th>
                  <th className="text-right font-semibold px-5 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {recent.map((l) => (
                  <tr key={l.id} className="hover:bg-ink-50 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs text-ink-900">
                      {l.tracking_id}
                    </td>
                    <td className="px-5 py-3 text-ink-700">{l.receiver_name}</td>
                    <td className="px-5 py-3 text-ink-600 hidden md:table-cell">
                      {l.courier_name ?? '—'}
                    </td>
                    <td className="px-5 py-3 hidden sm:table-cell">
                      <StatusBadge status={l.status} />
                    </td>
                    <td className="px-5 py-3 text-right text-xs text-ink-500">
                      {new Date(l.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function QuickAction({ to, icon: Icon, title, desc, color }) {
  return (
    <Link
      to={to}
      className={`card p-5 group hover:shadow-elevated transition-all duration-200 hover:-translate-y-0.5 ${
        color === 'brand' ? 'border-brand-200 hover:border-brand-300' : ''
      }`}
    >
      <div
        className={`h-10 w-10 rounded-lg flex items-center justify-center mb-3 ${
          color === 'brand' ? 'bg-brand-600 text-white' : 'bg-ink-800 text-white'
        }`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="text-sm font-bold text-ink-900 mb-1 flex items-center gap-1">
        {title}
        <ArrowRight className="h-3.5 w-3.5 text-ink-400 group-hover:text-brand-600 group-hover:translate-x-0.5 transition-all" />
      </h3>
      <p className="text-xs text-ink-500 leading-snug">{desc}</p>
    </Link>
  );
}

function StatCard({ icon: Icon, label, value, accent, loading }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${accent}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="text-2xl font-bold text-ink-900">
        {loading ? <span className="text-ink-300">—</span> : value}
      </p>
      <p className="text-xs text-ink-500 font-medium mt-0.5">{label}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    created: { label: 'Created', cls: 'bg-ink-100 text-ink-700' },
    printed: { label: 'Printed', cls: 'bg-green-100 text-green-700' },
    archived: { label: 'Archived', cls: 'bg-ink-100 text-ink-500' },
  };
  const s = map[status] ?? map.created;
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
}
