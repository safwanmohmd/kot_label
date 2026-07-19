import { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  UserPlus, 
  ClipboardCopy, 
  Search, 
  RefreshCw, 
  Trash2, 
  UserCheck, 
  Database,
  FileText
} from 'lucide-react';
import { useToast } from '../lib/useToast.jsx';
import { 
  fetchVendors, 
  saveSingleVendor, 
  saveBulkVendors, 
  deleteVendorRecord 
} from '../lib/vendorService.js';

export function WishmasterVendorManager() {
  const toast = useToast();
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Single entry form states
  const [singleName, setSingleName] = useState('');
  const [singleId, setSingleId] = useState('');
  const [isSubmittingSingle, setIsSubmittingSingle] = useState(false);

  // Bulk parser workspace states
  const [bulkRawInput, setBulkRawInput] = useState('');
  const [parsedPreview, setParsedPreview] = useState([]);
  const [isSubmittingBulk, setIsSubmittingBulk] = useState(false);

  async function loadVendorData() {
    setLoading(true);
    try {
      const data = await fetchVendors();
      setVendors(data);
    } catch (err) {
      toast('Failed to download Wishmaster mappings.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadVendorData();
  }, []);

  // Real-time parser listening to paste textarea changes
  useEffect(() => {
    if (!bulkRawInput.trim()) {
      setParsedPreview([]);
      return;
    }

    // Handles tab-spaces from spreadsheets or simple spacing configs line-by-line
    const lines = bulkRawInput.split('\n');
    const results = [];

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // Extract the terminal block (Vendor ID looks like EFTK000360) and keep the name leftside
      const parts = trimmed.split(/\t/); // First match spreadsheet tab keys
      
      if (parts.length >= 2) {
        results.push({ wm_name: parts[0].trim(), vendor_id: parts[1].trim().toUpperCase() });
      } else {
        // Fallback for space-delimited text if pasted as standard raw line entries
        const matches = trimmed.match(/(.+)\s+(EFTK\d+|[A-Z0-9]+)$/i);
        if (matches) {
          results.push({ wm_name: matches[1].trim(), vendor_id: matches[2].trim().toUpperCase() });
        }
      }
    });

    setParsedPreview(results);
  }, [bulkRawInput]);

  async function handleSingleSubmit(e) {
    e.preventDefault();
    if (!singleName.trim() || !singleId.trim()) {
      toast('Name and Vendor ID configuration required.', 'error');
      return;
    }

    setIsSubmittingSingle(true);
    try {
      await saveSingleVendor(singleName, singleId);
      toast(`Mapped Profile: ${singleId.toUpperCase()}`, 'success');
      setSingleName('');
      setSingleId('');
      await loadVendorData();
    } catch (err) {
      toast(err.message || 'Error inserting database entry.', 'error');
    } finally {
      setIsSubmittingSingle(false);
    }
  }

  async function handleBulkSubmit() {
    if (!parsedPreview.length) return;

    setIsSubmittingBulk(true);
    try {
      await saveBulkVendors(parsedPreview);
      toast(`Successfully ingested ${parsedPreview.length} configurations to Supabase`, 'success');
      setBulkRawInput('');
      setParsedPreview([]);
      await loadVendorData();
    } catch (err) {
      toast('Ingestion error, verify mapping structures or duplicates.', 'error');
    } finally {
      setIsSubmittingBulk(false);
    }
  }

  async function handleDelete(item) {
    if (!window.confirm(`Permanently remove identifier mapping for ${item.wm_name}?`)) return;
    try {
      setVendors(prev => prev.filter(v => v.id !== item.id));
      await deleteVendorRecord(item.id);
      toast('Vendor record purged successfully.', 'success');
    } catch (err) {
      toast('Database write transaction execution dropped.', 'error');
      await loadVendorData();
    }
  }

  // --- FILTERING LOGIC ---
  const q = searchQuery.toLowerCase().trim();
  const filteredVendors = vendors.filter(v => 
    v.wm_name?.toLowerCase().includes(q) || 
    v.vendor_id?.toLowerCase().includes(q)
  );

  return (
    <div className="w-full p-3 space-y-4 text-xs bg-ink-50/20 min-h-screen">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-ink-100 pb-2 bg-white p-3 rounded-lg shadow-2xs">
        <div>
          <button 
            onClick={() => window.history.back()}
            className="flex items-center gap-1 text-[10px] font-bold text-ink-600 hover:text-brand-600 transition-colors mb-0.5"
          >
            <ArrowLeft className="h-3 w-3" /> Back to Dispatch Counter Tracker
          </button>
          <h2 className="text-base font-black text-ink-900 tracking-tight flex items-center gap-1.5">
            <Database className="h-4 w-4 text-indigo-600" /> Wishmaster Database Terminal
          </h2>
          <p className="text-[11px] text-ink-500 mt-0.5">
            Synchronize vendor profiles, control reference datasets, and mass paste matrix structures from spreadsheets.
          </p>
        </div>

        {/* Dynamic Filtering Row */}
        <div className="relative max-w-xs w-full sm:w-64">
          <Search className="absolute left-2.5 top-2 h-3 w-3 text-ink-400" />
          <input 
            type="text" 
            placeholder="Search by WM name or Vendor ID..." 
            className="input h-7 pl-7 text-[11px] bg-white border-ink-200 px-2 rounded w-full"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-start">
        {/* FORMS CONTAINER */}
        <div className="space-y-3">
          {/* SINGLE PROFILE INPUT */}
          <div className="card p-3.5 border border-ink-200 bg-white shadow-xs space-y-3 rounded-lg">
            <h3 className="text-[10px] font-black uppercase tracking-wider text-ink-700 flex items-center gap-1 border-b pb-1.5">
              <UserPlus className="h-3 w-3 text-indigo-600" /> Add Single Vendor Mappings
            </h3>
            <form onSubmit={handleSingleSubmit} className="space-y-2.5">
              <div>
                <label className="text-[10px] font-bold text-ink-600 block mb-0.5">Wishmaster Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. shahul hameed" 
                  className="input h-7 text-[11px] font-medium px-2"
                  value={singleName}
                  onChange={e => setSingleName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-ink-600 block mb-0.5">Vendor ID Assignment</label>
                <input 
                  type="text" 
                  placeholder="e.g. EFTK000360" 
                  className="input h-7 text-[11px] font-mono uppercase font-bold px-2"
                  value={singleId}
                  onChange={e => setSingleId(e.target.value)}
                />
              </div>
              <button type="submit" disabled={isSubmittingSingle} className="btn-primary w-full h-7 text-[11px] font-bold justify-center mt-1 bg-ink-900 text-white hover:bg-ink-800 rounded">
                {isSubmittingSingle ? <RefreshCw className="h-3 w-3 animate-spin" /> : 'Commit Mappings'}
              </button>
            </form>
          </div>

          {/* BULK MATRIX SPREADSHEET PASTER */}
          <div className="card p-3.5 border border-ink-200 bg-white shadow-xs space-y-3 rounded-lg">
            <h3 className="text-[10px] font-black uppercase tracking-wider text-ink-700 flex items-center gap-1 border-b pb-1.5">
              <ClipboardCopy className="h-3 w-3 text-emerald-600" /> Bulk Spreadsheet Importer
            </h3>
            <div className="space-y-2">
              <p className="text-[10px] text-ink-500 leading-tight">
                Copy cells cleanly directly inside Excel or Google Sheets columns containing <span className="font-bold font-mono">Name</span> and <span className="font-bold font-mono">Vendor ID</span>, then paste below:
              </p>
              <textarea 
                className="input text-[11px] h-20 p-1.5 resize-none leading-normal font-mono placeholder:text-[10px]"
                placeholder={"shahul hameed\tEFTK000360\nANVAR\tEFTK000362"}
                value={bulkRawInput}
                onChange={e => setBulkRawInput(e.target.value)}
              />

              {/* Parallel Live Output Matrix Summary */}
              {parsedPreview.length > 0 && (
                <div className="border border-emerald-100 bg-emerald-50/30 rounded p-2 space-y-1.5 max-h-32 overflow-y-auto">
                  <div className="text-[9px] font-bold uppercase tracking-wide text-emerald-800 flex items-center justify-between">
                    <span>Parsed Realtime Log Matrix</span>
                    <span>({parsedPreview.length} rows detected)</span>
                  </div>
                  <div className="space-y-1 text-[10px] font-mono text-ink-700">
                    {parsedPreview.map((item, idx) => (
                      <div key={idx} className="flex justify-between border-b border-emerald-100/50 pb-0.5">
                        <span className="truncate max-w-[120px] font-medium">{item.wm_name}</span>
                        <span className="font-bold text-emerald-700 shrink-0">{item.vendor_id}</span>
                      </div>
                    ))}
                  </div>
                  <button 
                    onClick={handleBulkSubmit}
                    disabled={isSubmittingBulk}
                    className="w-full text-center py-1 mt-1 font-bold bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] rounded transition-colors flex items-center justify-center gap-1"
                  >
                    {isSubmittingBulk ? <RefreshCw className="h-2.5 w-2.5 animate-spin" /> : 'Bulk Sync Array to Supabase'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* OUTPUT MATRIX GRID TERMINAL VIEW */}
        <div className="lg:col-span-2 card p-0 border border-ink-200 overflow-hidden bg-white shadow-xs rounded-lg">
          <div className="p-2 border-b border-ink-100 bg-ink-50/40 flex items-center justify-between font-bold text-ink-800">
            <span className="flex items-center gap-1">
              <UserCheck className="h-3.5 w-3.5 text-indigo-600" /> Operational Active Mappings Matrix ({filteredVendors.length})
            </span>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="py-8 text-center text-ink-400">Downloading active registry state...</div>
            ) : filteredVendors.length === 0 ? (
              <div className="py-8 text-center text-ink-400 italic">No mapped patterns matched current inputs.</div>
            ) : (
              <table className="w-full border-collapse text-left text-[11px]">
                <thead>
                  <tr className="bg-ink-50 text-ink-700 font-bold border-b border-ink-100 uppercase text-[9px] tracking-wider select-none">
                    <th className="p-2.5 w-1/2">Wishmaster Employee / Name</th>
                    <th className="p-2.5 w-1/3">Assigned Vendor ID Mapping</th>
                    <th className="p-2.5 text-center w-16">Purge</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {filteredVendors.map(item => (
                    <tr key={item.id} className="hover:bg-ink-50/30 transition-colors">
                      <td className="p-2.5 max-w-xs font-medium text-ink-900 capitalize">
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                          <span className="truncate">{item.wm_name}</span>
                        </div>
                      </td>
                      <td className="p-2.5">
                        <span className="px-2 py-0.5 rounded border border-indigo-200 bg-indigo-50 font-mono font-bold uppercase text-indigo-700 tracking-wide text-[10px]">
                          {item.vendor_id}
                        </span>
                      </td>
                      <td className="p-2.5 text-center">
                        <button
                          onClick={() => handleDelete(item)}
                          className="p-1 rounded text-ink-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                          title="Delete Mapping Record"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}