import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Copy, 
  ExternalLink, 
  Plus, 
  Search, 
  Trash2, 
  FolderSymlink, 
  Check, 
  RefreshCw,
  X,
  ArrowRightCircle,
  ArrowLeftCircle,
  Clock
} from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export function DriveLinksManager() {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  // Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    link_type: 'forward', // 'forward' or 'reverse'
    url: '',
    note: ''
  });

  // Fetch links from drive_links table
  const fetchLinks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('drive_links')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching links:', error);
    } else {
      setLinks(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLinks();
  }, []);

  // Insert a new drive link
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.url.trim()) return;

    const { error } = await supabase.from('drive_links').insert([{
      link_type: formData.link_type,
      url: formData.url.trim(),
      note: formData.note.trim()
    }]);

    if (error) {
      console.error('Error adding link:', error);
    } else {
      setFormData({ link_type: 'forward', url: '', note: '' });
      setIsModalOpen(false);
      fetchLinks();
    }
  };

  // Delete a drive link
  const handleDeleteLink = async (id) => {
    if (!window.confirm('Delete this link?')) return;
    const { error } = await supabase.from('drive_links').delete().eq('id', id);
    if (error) console.error('Error deleting link:', error);
    else fetchLinks();
  };

  // Copy URL to Clipboard
  const handleCopy = (url, id) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filter links by search query
  const filteredLinks = links.filter((item) => {
    const query = searchQuery.toLowerCase();
    return (
      item.url.toLowerCase().includes(query) ||
      (item.note && item.note.toLowerCase().includes(query))
    );
  });

  const forwardLinks = filteredLinks.filter((l) => l.link_type === 'forward');
  const reverseLinks = filteredLinks.filter((l) => l.link_type === 'reverse');

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FolderSymlink className="h-7 w-7 text-indigo-600" />
            GDrive Links Vault
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage your Forward and Reverse Google Drive links in one dashboard with instant copy buttons.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors cursor-pointer shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Add Drive Link
        </button>
      </div>

      {/* Search & Refresh Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search url or note..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        <button
          onClick={fetchLinks}
          title="Refresh Data"
          className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Main Dashboard Deck */}
      {loading ? (
        <div className="text-center py-12 text-slate-400 font-medium">Loading drive links from Supabase...</div>
      ) : filteredLinks.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300 text-slate-500">
          No drive links found. Click "Add Drive Link" to save one.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200 p-6 gap-6 md:gap-0">
            
            {/* FORWARD LINKS COLUMN */}
            <div className="md:pr-6 space-y-4">
              <div className="flex items-center justify-between bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-800">
                  <ArrowRightCircle className="h-4 w-4 text-emerald-600" />
                  Forward Links ({forwardLinks.length})
                </div>
              </div>

              {forwardLinks.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">No forward links stored.</p>
              ) : (
                <div className="space-y-2.5">
                  {forwardLinks.map((item) => (
                    <LinkRow
                      key={item.id}
                      item={item}
                      copiedId={copiedId}
                      onCopy={handleCopy}
                      onDelete={handleDeleteLink}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* REVERSE LINKS COLUMN */}
            <div className="md:pl-6 space-y-4">
              <div className="flex items-center justify-between bg-amber-50 p-3 rounded-lg border border-amber-100">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-800">
                  <ArrowLeftCircle className="h-4 w-4 text-amber-600" />
                  Reverse Links ({reverseLinks.length})
                </div>
              </div>

              {reverseLinks.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">No reverse links stored.</p>
              ) : (
                <div className="space-y-2.5">
                  {reverseLinks.map((item) => (
                    <LinkRow
                      key={item.id}
                      item={item}
                      copiedId={copiedId}
                      onCopy={handleCopy}
                      onDelete={handleDeleteLink}
                    />
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ADD DRIVE LINK MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form onSubmit={handleSubmit} className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-base font-bold text-slate-800">Save New Drive Link</h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Link Type Toggle */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Link Type</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, link_type: 'forward' })}
                  className={`py-2 px-3 rounded-lg border text-xs font-bold uppercase flex items-center justify-center gap-2 cursor-pointer transition-all ${
                    formData.link_type === 'forward'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <ArrowRightCircle className="h-4 w-4" /> Forward
                </button>

                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, link_type: 'reverse' })}
                  className={`py-2 px-3 rounded-lg border text-xs font-bold uppercase flex items-center justify-center gap-2 cursor-pointer transition-all ${
                    formData.link_type === 'reverse'
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <ArrowLeftCircle className="h-4 w-4" /> Reverse
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Google Drive URL</label>
              <input
                type="url"
                required
                placeholder="https://drive.google.com/..."
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Optional Label / Note</label>
              <input
                type="text"
                placeholder="e.g., Folder A - Raw Scans"
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 border border-slate-300 text-slate-600 rounded-lg text-sm font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 cursor-pointer">
                Save Link
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// Sub-component for individual link item rows
function LinkRow({ item, copiedId, onCopy, onDelete }) {
  const isCopied = copiedId === item.id;

  return (
    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2 group hover:border-slate-300 transition-all">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-slate-800 truncate">
          {item.note || 'GDrive Link'}
        </span>
        <span className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
          <Clock className="h-3 w-3" />
          {new Date(item.updated_at || item.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-mono text-slate-500 truncate flex-1" title={item.url}>
          {item.url}
        </span>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => onCopy(item.url, item.id)}
            className={`px-2.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              isCopied
                ? 'bg-emerald-600 text-white'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
            title="Copy Link"
          >
            {isCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{isCopied ? 'Copied' : 'Copy'}</span>
          </button>

          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
            title="Open Link"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>

          <button
            onClick={() => onDelete(item.id)}
            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
            title="Delete Link"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}