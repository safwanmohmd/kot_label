import { useState, useEffect } from 'react';
import { 
  ClipboardList, 
  Plus, 
  Trash2, 
  ArrowLeft, 
  RefreshCw, 
  Search,
  Clock,
  UserCheck,
  Package,
  Activity,
  CheckCircle2,
  X,
  ShieldAlert,
  Sliders,
  Copy,
  FileText,
  ArrowUp,
  ArrowDown,
  Check,
  Archive,
  Layers,
  Wand2,
  Edit2,
  Eye,
  Info
} from 'lucide-react';
import { useToast } from '../lib/useToast.jsx';
import { fetchLpRecords, createLpRecord, deleteLpRecord, updateLpRecord, createLpRecordsBulk } from '../lib/lpService.js';

export function LpTrackerList() {
  const toast = useToast();

  // --- COMPONENT STATES ---
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [entryMode, setEntryMode] = useState('single');
  
  // Table View Switch Control ('active' or 'archived')
  const [currentView, setCurrentView] = useState('active');
  const [sortDirection, setSortDirection] = useState('auto'); // Default to automatic rank sorting
  
  // Inline Wishmaster Editing Tracking States
  const [editingRecordId, setEditingRecordId] = useState(null);
  const [editingWmName, setEditingWmName] = useState('');
  const [isUpdatingWm, setIsUpdatingWm] = useState(false);

  // Quick View Inspection Modal State
  const [inspectingItem, setInspectingItem] = useState(null);

  // Single Form Fields
  const [trackingId, setTrackingId] = useState('');
  const [wishmasterName, setWishmasterName] = useState('');
  const [agingDays, setAgingDays] = useState('');
  const [status, setStatus] = useState('NOT FOUND');
  const [itemDetails, setItemDetails] = useState(''); // New input field state for item details
  
  // Bulk Form Fields
  const [bulkText, setBulkText] = useState('');
  const [bulkWishmaster, setBulkWishmaster] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const STATUS_OPTIONS = ['NOT FOUND', 'CLEARING TODAY', 'LOSS'];

  // Priority Rank Matrix for Auto-Sorting Logic
  const PRIORITY_RANK = {
    'CRITICAL': 4,
    'HIGH': 3,
    'MEDIUM': 2,
    'LOW': 1
  };

  async function loadData() {
    setLoading(true);
    try {
      const data = await fetchLpRecords();
      setRecords(data);
    } catch (err) {
      toast('Error loading operational Loss Prevention records.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function toggleSort() {
    if (sortDirection === 'auto' || sortDirection === 'none') {
      setSortDirection('desc');
    } else if (sortDirection === 'desc') {
      setSortDirection('asc');
    } else {
      setSortDirection('auto');
    }
  }

  function calculatePriority(days) {
    const numDays = parseInt(days, 10);
    if (isNaN(numDays) || numDays < 0) return 'LOW';
    if (numDays > 5) return 'CRITICAL';
    if (numDays >= 3) return 'HIGH';
    if (numDays >= 1) return 'MEDIUM';
    return 'LOW';
  }

  function isOlderThanTwoDays(isoString) {
    if (!isoString) return false;
    const resolvedDate = new Date(isoString);
    const twoDaysInMs = 2 * 24 * 60 * 60 * 1000;
    return (new Date() - resolvedDate) > twoDaysInMs;
  }

  // --- AUTOMATED ABSENCE SWEEP ENGINE ---
  async function sweepMissingRecords(incomingTrackingIds) {
    const upperIncomingIds = incomingTrackingIds.map(id => id.trim().toUpperCase());
    
    const missingActiveRecords = records.filter(rec => 
      rec.status === 'NOT FOUND' && 
      !upperIncomingIds.includes(rec.tracking_id.toUpperCase())
    );

    if (missingActiveRecords.length === 0) return 0;

    const timestamp = new Date().toISOString();
    let sweepSuccessCount = 0;

    await Promise.all(
      missingActiveRecords.map(async (rec) => {
        try {
          await updateLpRecord(rec.id, { 
            status: 'CLEARING TODAY', 
            resolved_at: timestamp 
          });
          sweepSuccessCount++;
        } catch (err) {
          console.error(`Absence sweep failed auto-clearing ID: ${rec.tracking_id}`, err);
        }
      })
    );

    return sweepSuccessCount;
  }

  async function handleFormSubmit(e) {
    e.preventDefault();
    setIsSubmitting(true);

    if (entryMode === 'single') {
      await handleSingleSubmit();
    } else {
      await handleBulkSubmit();
    }
    setIsSubmitting(false);
  }

  async function handleSingleSubmit() {
    if (!trackingId.trim() || !wishmasterName.trim() || !agingDays.trim()) {
      toast('Please supply all required tracking input parameters.', 'error');
      return;
    }

    const cleanId = trackingId.trim().toUpperCase();
    const assignedPriority = calculatePriority(agingDays);
    const payload = {
      tracking_id: cleanId,
      wishmaster_name: wishmasterName.trim(),
      aging_days: parseInt(agingDays, 10),
      priority: assignedPriority,
      status: status,
      details: itemDetails.trim() || null, // Write details from layout to database node row
      resolved_at: (status === 'LOSS' || status === 'CLEARING TODAY') ? new Date().toISOString() : null
    };

    try {
      await createLpRecord(payload);
      const autoClearedCount = await sweepMissingRecords([cleanId]);
      
      if (autoClearedCount > 0) {
        toast(`Logged ${cleanId}. Auto-archived ${autoClearedCount} missing rows!`, 'success');
      } else {
        toast(`Logged Case: ${cleanId}`, 'success');
      }

      resetSingleForm();
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      toast('Failed creating new tracker entry layout row.', 'error');
    }
  }

  async function handleBulkSubmit() {
    if (!bulkText.trim() || !bulkWishmaster.trim()) {
      toast('Provide both the bulk manifest list and a target Courier assignment.', 'error');
      return;
    }

    const lines = bulkText.split('\n');
    const parsedPayloads = [];
    const incomingIds = [];
    const timestamp = new Date().toISOString();

    lines.forEach((line) => {
      const cleanLine = line.trim();
      if (!cleanLine || cleanLine === 'CPT') return;

      const columns = cleanLine.split(/\s+/);
      if (columns.length < 2) return;

      const tId = columns[0].toUpperCase();
      const rawAging = columns[1];
      const parsedAging = parseInt(rawAging, 10);

      if (isNaN(parsedAging)) return;

      const isFound = cleanLine.includes('✅') || cleanLine.toLowerCase().includes('found');
      const inferredStatus = isFound ? 'CLEARING TODAY' : 'NOT FOUND';
      const assignedPriority = calculatePriority(parsedAging);

      incomingIds.push(tId);
      parsedPayloads.push({
        tracking_id: tId,
        wishmaster_name: bulkWishmaster.trim(),
        aging_days: parsedAging,
        priority: assignedPriority,
        status: inferredStatus,
        details: null, // Bulk input records explicitly map details directly to null
        resolved_at: inferredStatus === 'CLEARING TODAY' ? timestamp : null
      });
    });

    if (parsedPayloads.length === 0) {
      toast('Could not interpret any valid Tracking metrics out of text block.', 'error');
      return;
    }

    try {
      await createLpRecordsBulk(parsedPayloads);
      const autoClearedCount = await sweepMissingRecords(incomingIds);

      if (autoClearedCount > 0) {
        toast(`Imported ${parsedPayloads.length} entries. Sweep moved ${autoClearedCount} un-submitted logs directly to Archives!`, 'success');
      } else {
        toast(`Successfully batch processed ${parsedPayloads.length} records!`, 'success');
      }

      resetBulkForm();
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      toast('Database write transaction error running bulk parsing stack.', 'error');
    }
  }

  function resetSingleForm() {
    setTrackingId('');
    setWishmasterName('');
    setAgingDays('');
    setStatus('NOT FOUND');
    setItemDetails('');
  }

  function resetBulkForm() {
    setBulkText('');
    setBulkWishmaster('');
  }

  // --- START INLINE WISHMASTER EDIT HANDLERS ---
  function startEditingWm(item) {
    if (item.status === 'LOSS' || item.status === 'CLEARING TODAY') return; 
    setEditingRecordId(item.id);
    setEditingWmName(item.wishmaster_name);
  }

  async function saveInlineWmUpdate(id) {
    if (!editingWmName.trim()) {
      toast('Wishmaster assignment name cannot be left blank.', 'error');
      return;
    }
    setIsUpdatingWm(true);
    try {
      setRecords(prev => prev.map(r => r.id === id ? { ...r, wishmaster_name: editingWmName.trim() } : r));
      await updateLpRecord(id, { wishmaster_name: editingWmName.trim() });
      toast('Wishmaster assignment saved successfully.', 'success');
      setEditingRecordId(null);
    } catch (err) {
      toast('Failed to save updated wishmaster name changes.', 'error');
      loadData();
    } finally {
      setIsUpdatingWm(false);
    }
  }

  function cancelInlineWmEdit() {
    setEditingRecordId(null);
    setEditingWmName('');
  }
  // --- END INLINE WISHMASTER EDIT HANDLERS ---

  async function handleStatusChange(id, nextStatus) {
    try {
      const isResolved = nextStatus === 'LOSS' || nextStatus === 'CLEARING TODAY';
      const timestamp = isResolved ? new Date().toISOString() : null;

      setRecords(prev => prev.map(r => r.id === id ? { ...r, status: nextStatus, resolved_at: timestamp } : r));
      await updateLpRecord(id, { status: nextStatus, resolved_at: timestamp });
      toast(`Moved case to ${isResolved ? 'Archives' : 'Active Workspace'}`, 'success');
    } catch (err) {
      toast('Failed to save status modifications.', 'error');
      loadData();
    }
  }

  async function handleMarkLoss(id, trackingLabel) {
    try {
      const timestamp = new Date().toISOString();
      setRecords(prev => prev.map(r => r.id === id ? { ...r, status: 'LOSS', priority: 'CRITICAL', resolved_at: timestamp } : r));
      await updateLpRecord(id, { status: 'LOSS', priority: 'CRITICAL', resolved_at: timestamp });
      toast(`Case ${trackingLabel} sent straight to Loss Archives.`, 'success');
    } catch (err) {
      toast('Error reporting asset loss.', 'error');
      loadData();
    }
  }

  async function handleMarkCleared(id, trackingLabel) {
    try {
      const timestamp = new Date().toISOString();
      setRecords(prev => prev.map(r => r.id === id ? { ...r, status: 'CLEARING TODAY', resolved_at: timestamp } : r));
      await updateLpRecord(id, { status: 'CLEARING TODAY', resolved_at: timestamp });
      toast(`Case ${trackingLabel} moved straight to Clear Archives.`, 'success');
    } catch (err) {
      toast('Error saving cleared row parameters.', 'error');
      loadData();
    }
  }

  async function handleDelete(id, label) {
    if (!window.confirm(`Delete data traces for case file reference ${label}?`)) return;
    try {
      await deleteLpRecord(id);
      toast('Case record purged safely.', 'success');
      setRecords(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      toast('Error executing item deletion block.', 'error');
    }
  }

  function getPriorityStyle(priority) {
    switch(priority) {
      case 'CRITICAL': return 'bg-red-50 border-red-200 text-red-700 font-black';
      case 'HIGH': return 'bg-amber-50 border-amber-200 text-amber-700 font-bold';
      case 'MEDIUM': return 'bg-blue-50 border-blue-200 text-blue-700';
      default: return 'bg-ink-100 border-ink-200 text-ink-600';
    }
  }

  function getStatusSelectStyle(val) {
    switch(val) {
      case 'LOSS': return 'bg-rose-100 border-rose-300 text-rose-800 font-black';
      case 'CLEARING TODAY': return 'bg-emerald-100 border-emerald-300 text-emerald-800 font-bold';
      default: return 'bg-purple-100 border-purple-300 text-purple-800 font-medium';
    }
  }

  const activeDeck = records.filter(rec => rec.status === 'NOT FOUND');
  const archiveDeck = records.filter(rec => 
    (rec.status === 'LOSS' || rec.status === 'CLEARING TODAY') && 
    !isOlderThanTwoDays(rec.resolved_at)
  );

  const processedRecords = (() => {
    let baseList = currentView === 'active' ? activeDeck : archiveDeck;
    
    let output = baseList.filter(rec => {
      const q = searchQuery.toLowerCase();
      return (
        rec.tracking_id?.toLowerCase().includes(q) ||
        rec.wishmaster_name?.toLowerCase().includes(q) ||
        rec.status?.toLowerCase().includes(q) ||
        rec.priority?.toLowerCase().includes(q)
      );
    });

    if (sortDirection === 'auto') {
      output.sort((a, b) => {
        const weightA = PRIORITY_RANK[a.priority] || 0;
        const weightB = PRIORITY_RANK[b.priority] || 0;
        if (weightB !== weightA) return weightB - weightA;
        return (b.aging_days ?? 0) - (a.aging_days ?? 0);
      });
    } else if (sortDirection === 'desc') {
      output.sort((a, b) => (b.aging_days ?? 0) - (a.aging_days ?? 0));
    } else if (sortDirection === 'asc') {
      output.sort((a, b) => (a.aging_days ?? 0) - (b.aging_days ?? 0));
    }
    
    return output;
  })();

  return (
    <div className="w-full p-4 space-y-4 animate-fade-in">
      
      {/* HEADER CONTROLS NAVIGATION STRIP */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button 
            onClick={() => window.history.back()}
            className="flex items-center gap-2 text-xs font-bold text-ink-600 hover:text-brand-600 transition-colors mb-1"
          >
            <ArrowLeft className="h-4 w-4" /> Return to Workspace Terminal
          </button>
          <h2 className="text-xl font-black text-ink-900 tracking-tight flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-brand-600" /> Loss Prevention Dashboard Console
          </h2>
        </div>

        <button 
          onClick={() => setIsModalOpen(true)}
          className="btn-primary px-4 py-2 text-xs font-bold shadow-sm self-start sm:self-auto"
        >
          <Plus className="h-4 w-4 mr-1.5" /> Add New Case File
        </button>
      </div>

      {/* --- SEGMENTED SWITCH COMPONENT --- */}
      <div className="flex items-center justify-start p-1 bg-ink-100 rounded-xl max-w-sm border border-ink-200">
        <button
          onClick={() => setCurrentView('active')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${
            currentView === 'active' 
              ? 'bg-white text-brand-600 shadow-sm border border-ink-200/50' 
              : 'text-ink-600 hover:text-ink-900'
          }`}
        >
          <Layers className="h-3.5 w-3.5" /> Active Deck ({activeDeck.length})
        </button>
        <button
          onClick={() => setCurrentView('archived')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${
            currentView === 'archived' 
              ? 'bg-white text-brand-600 shadow-sm border border-ink-200/50' 
              : 'text-ink-600 hover:text-ink-900'
          }`}
        >
          <Archive className="h-3.5 w-3.5" /> Resolved Archives ({archiveDeck.length})
        </button>
      </div>

      {/* FULL WIDTH MAIN PANEL */}
      <div className="card p-0 overflow-hidden border border-ink-200 shadow-sm bg-white">
        
        {/* SUB HEADER - SYSTEM FILTER ACTIONS */}
        <div className="p-4 border-b border-ink-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-ink-50/40">
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-ink-400" />
            <input 
              type="text" 
              placeholder={`Search ${currentView === 'active' ? 'active' : 'archived'} files...`}
              className="input h-9 pl-9 pr-3 text-xs bg-white border-ink-200 w-full"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="text-[11px] font-mono text-brand-700 bg-brand-50 border border-brand-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-bold shadow-3xs">
              <Wand2 className="h-3.5 w-3.5 text-brand-600 animate-pulse" /> 
              Auto-Sorted by Priority
            </div>
          </div>
        </div>

        {/* PRIMARY DATA MATRIX TABLE AREA */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-24 text-center text-xs text-ink-500 flex flex-col items-center justify-center gap-2.5">
              <RefreshCw className="h-6 w-6 text-brand-500 animate-spin" />
              <span>Querying database node stacks...</span>
            </div>
          ) : processedRecords.length === 0 ? (
            <div className="py-24 text-center text-sm text-ink-400 font-medium px-6 italic">
              {currentView === 'active' 
                ? 'No active items pending tracking data.' 
                : 'No items resolved within the last 48 hours.'}
            </div>
          ) : (
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-ink-50 text-ink-700 font-bold border-b border-ink-100 uppercase tracking-wider text-[10px] select-none">
                  <th className="p-4 w-12 text-center">Type</th>
                  <th className="p-4">Tracking Reference ID</th>
                  <th className="p-4">Assigned Wishmaster</th>
                  <th className="p-4 cursor-pointer hover:bg-ink-100/80 transition-colors group/header" onClick={toggleSort}>
                    <div className="flex items-center gap-1">
                      <span>Package Aging</span>
                      {sortDirection === 'auto' && <span className="text-[9px] text-brand-600 font-black tracking-tighter bg-brand-100 px-1 rounded">AUTO</span>}
                      {sortDirection === 'desc' && <ArrowDown className="h-3.5 w-3.5 text-brand-600" />}
                      {sortDirection === 'asc' && <ArrowUp className="h-3.5 w-3.5 text-brand-600" />}
                    </div>
                  </th>
                  <th className="p-4">Calculated Risk Severity</th>
                  <th className="p-4">Investigation Status</th>
                  <th className="p-4 text-center w-52">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {processedRecords.map(item => {
                  const isRowLocked = item.status === 'LOSS' || item.status === 'CLEARING TODAY';
                  const isEditingThisRow = editingRecordId === item.id;
                  
                  return (
                    <tr 
                      key={item.id} 
                      className={`transition-all duration-200 group ${
                        isRowLocked ? 'bg-ink-50/40 opacity-85 select-none' : 'hover:bg-brand-50/20'
                      }`}
                    >
                      <td className="p-4 text-center">
                        <div className="mx-auto p-1.5 rounded-lg bg-ink-50 border border-ink-100 text-ink-500 w-8 h-8 flex items-center justify-center">
                          {isRowLocked ? (
                            <CheckCircle2 className={`h-4 w-4 ${item.status === 'LOSS' ? 'text-red-500' : 'text-emerald-500'}`} />
                          ) : (
                            <Package className="h-4 w-4" />
                          )}
                        </div>
                      </td>
                      <td className="p-4 font-mono font-bold uppercase tracking-wide text-ink-900">
                        {item.tracking_id}
                      </td>
                      
                      <td className="p-4 text-ink-700 font-medium min-w-[200px]">
                        {isEditingThisRow ? (
                          <div className="flex items-center gap-1.5 max-w-xs animate-fade-in">
                            <input
                              type="text"
                              className="input h-8 text-xs font-medium border-brand-400 focus:border-brand-600 py-1 px-2 w-full"
                              value={editingWmName}
                              onChange={e => setEditingWmName(e.target.value)}
                              disabled={isUpdatingWm}
                              autoFocus
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveInlineWmUpdate(item.id);
                                if (e.key === 'Escape') cancelInlineWmEdit();
                              }}
                            />
                            <button
                              onClick={() => saveInlineWmUpdate(item.id)}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                              disabled={isUpdatingWm}
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={cancelInlineWmEdit}
                              className="p-1 text-ink-400 hover:bg-ink-100 rounded"
                              disabled={isUpdatingWm}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div 
                            className={`flex items-center gap-2 group/edit ${!isRowLocked ? 'cursor-pointer hover:text-brand-600 transition-colors' : ''}`}
                            onDoubleClick={() => startEditingWm(item)}
                          >
                            <span>{item.wishmaster_name}</span>
                            {!isRowLocked && (
                              <button 
                                onClick={() => startEditingWm(item)}
                                className="opacity-0 group-hover/edit:opacity-100 group-hover:opacity-60 text-ink-400 hover:text-brand-600 transition-all p-0.5 rounded"
                              >
                                <Edit2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="p-4 font-mono text-ink-600 font-bold">{item.aging_days} {item.aging_days === 1 ? 'Day' : 'Days'}</td>
                      <td className="p-4">
                        <span className={`text-[10px] px-2 py-0.5 rounded border font-mono uppercase font-bold tracking-wide ${getPriorityStyle(item.priority)}`}>
                          {item.priority}
                        </span>
                      </td>
                      
                      <td className="p-4">
                        <select
                          className={`text-[11px] font-mono border rounded px-2 py-1 uppercase font-bold focus:outline-none ${getStatusSelectStyle(item.status)}`}
                          value={item.status}
                          onChange={(e) => handleStatusChange(item.id, e.target.value)}
                        >
                          {STATUS_OPTIONS.map(opt => (
                            <option key={opt} value={opt} className="bg-white text-ink-900 font-medium">{opt}</option>
                          ))}
                        </select>
                      </td>

                      <td className="p-4">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* --- ACTION EYE BUTTON --- */}
                          <button
                            onClick={() => setInspectingItem(item)}
                            className="p-1.5 text-ink-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-all"
                            title="Inspect shipment explanations"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>

                          <span className="text-ink-200 select-none">|</span>

                          {!isRowLocked ? (
                            <>
                              <button onClick={() => handleMarkLoss(item.id, item.tracking_id)} className="flex items-center bg-red-600 text-white hover:bg-red-700 text-[9px] font-black uppercase px-2 py-1 rounded shadow-3xs">
                                <ShieldAlert className="h-2.5 w-2.5 mr-0.5" /> Loss
                              </button>
                              <button onClick={() => handleMarkCleared(item.id, item.tracking_id)} className="flex items-center bg-emerald-600 text-white hover:bg-emerald-700 text-[9px] font-black uppercase px-2 py-1 rounded shadow-3xs">
                                <Check className="h-2.5 w-2.5 mr-0.5" /> Clear
                              </button>
                            </>
                          ) : (
                            <span className="text-[10px] font-mono uppercase tracking-tight font-black text-ink-600 italic mr-1">
                              {item.status === 'LOSS' ? '❌ Lost Shipment' : '✅ Cleared'}
                            </span>
                          )}

                          <span className="text-ink-200 select-none">|</span>
                          
                          <button 
                            onClick={() => handleDelete(item.id, item.tracking_id)}
                            className="p-1.5 text-ink-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* --- QUICK VIEW INSPECTION MODAL PANEL --- */}
      {inspectingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="card w-full max-w-md p-6 border-t-4 border-t-brand-600 border-x border-b border-ink-200 bg-white shadow-xl relative animate-scale-up">
            <button 
              onClick={() => setInspectingItem(null)} 
              className="absolute right-4 top-4 p-1 rounded-lg text-ink-400 hover:text-ink-600 hover:bg-ink-100 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2 text-brand-700 font-bold text-xs uppercase tracking-wider mb-2">
              <Info className="h-4 w-4" /> Operational Audit Details
            </div>
            
            <h3 className="text-base font-black text-ink-900 tracking-tight font-mono border-b border-ink-100 pb-3 mb-4">
              ID: {inspectingItem.tracking_id}
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center py-1.5 border-b border-ink-50">
                <span className="text-ink-500 font-medium">Assigned Wishmaster:</span>
                <span className="text-ink-900 font-bold">{inspectingItem.wishmaster_name}</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-ink-50">
                <span className="text-ink-500 font-medium">Manifest Package Aging:</span>
                <span className="text-ink-900 font-mono font-bold">{inspectingItem.aging_days} Days old</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-ink-50">
                <span className="text-ink-500 font-medium">Calculated Risk Severity:</span>
                <span className={`text-[10px] px-2 py-0.5 rounded border font-mono font-bold ${getPriorityStyle(inspectingItem.priority)}`}>
                  {inspectingItem.priority}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-ink-50">
                <span className="text-ink-500 font-medium">Investigation Status:</span>
                <span className={`text-[10px] px-2 py-0.5 rounded border font-mono font-bold ${getStatusSelectStyle(inspectingItem.status)}`}>
                  {inspectingItem.status === 'LOSS' ? 'LOSS' : inspectingItem.status}
                </span>
              </div>
              {inspectingItem.resolved_at && (
                <div className="flex justify-between items-center py-1.5 border-b border-ink-50">
                  <span className="text-ink-500 font-medium">Resolution Timestamp:</span>
                  <span className="text-ink-700 font-mono text-[11px]">
                    {new Date(inspectingItem.resolved_at).toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            {/* --- CORE EXPLANATION CONTAINER --- */}
            <div className="bg-brand-50/50 border border-brand-100 p-4 rounded-xl mt-5 text-[11px] text-ink-800 space-y-1">
              <span className="block font-black uppercase text-brand-800 tracking-wider text-[10px]">Shipment Details Explanation:</span>
              <p className="leading-relaxed whitespace-pre-wrap italic font-medium">
                {inspectingItem.details ? inspectingItem.details : 'N/A'}
              </p>
            </div>

            <button 
              onClick={() => setInspectingItem(null)} 
              className="btn-secondary w-full py-2 text-xs font-bold justify-center mt-5"
            >
              Close Inspector Panel
            </button>
          </div>
        </div>
      )}

      {/* --- POPUP OVERLAY DATA MODAL DIALOG --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="card w-full max-w-lg p-6 border border-brand-200 bg-white shadow-xl relative animate-scale-up">
            
            <button onClick={() => setIsModalOpen(false)} className="absolute right-4 top-4 p-1 rounded-lg text-ink-400 hover:text-ink-600 hover:bg-ink-100 transition-colors">
              <X className="h-4 w-4" />
            </button>

            <div className="flex border-b border-ink-200 mb-4 gap-4">
              <button type="button" onClick={() => setEntryMode('single')} className={`pb-2 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-all ${entryMode === 'single' ? 'border-brand-600 text-brand-600' : 'border-transparent text-ink-500 hover:text-ink-900'}`}>
                <Sliders className="h-3.5 w-3.5" /> Single Entry
              </button>
              <button type="button" onClick={() => setEntryMode('bulk')} className={`pb-2 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-all ${entryMode === 'bulk' ? 'border-brand-600 text-brand-600' : 'border-transparent text-ink-500 hover:text-ink-900'}`}>
                <Copy className="h-3.5 w-3.5" /> Bulk Manifest Paste
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              {entryMode === 'single' && (
                <div className="space-y-4">
                  <div>
                    <label className="label-text flex items-center gap-1"><Package className="h-3.5 w-3.5 text-ink-400" /> Unique Tracker ID</label>
                    <input type="text" className="input text-xs font-mono uppercase font-bold" placeholder="e.g. FMPC6250362428" value={trackingId} onChange={e => setTrackingId(e.target.value)} />
                  </div>
                  <div>
                    <label className="label-text flex items-center gap-1"><UserCheck className="h-3.5 w-3.5 text-ink-400" /> Wishmaster Name</label>
                    <input type="text" className="input text-xs" placeholder="Full name of handling courier agent" value={wishmasterName} onChange={e => setWishmasterName(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label-text flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-ink-400" /> Case Aging (Days)</label>
                      <input type="number" min="0" className="input text-xs font-bold font-mono" placeholder="0" value={agingDays} onChange={e => setAgingDays(e.target.value)} />
                    </div>
                    <div>
                      <label className="label-text flex items-center gap-1"><Activity className="h-3.5 w-3.5 text-ink-400" /> Operational Status</label>
                      <select className="input text-xs py-1.5 font-bold" value={status} onChange={e => setStatus(e.target.value)}>
                        {STATUS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  </div>
                  {/* --- NEW INPUT COMPONENT ADDED FOR SINGLE ENTRY MODE --- */}
                  <div>
                    <label className="label-text flex items-center gap-1"><FileText className="h-3.5 w-3.5 text-ink-400" /> Shipment Details / Explanation</label>
                    <textarea 
                      className="input text-xs h-20 p-2.5 leading-relaxed resize-none" 
                      placeholder="Provide custom context notes or details about this specific shipment investigation..." 
                      value={itemDetails} 
                      onChange={e => setItemDetails(e.target.value)} 
                    />
                  </div>
                </div>
              )}

              {entryMode === 'bulk' && (
                <div className="space-y-4">
                  <div>
                    <label className="label-text flex items-center gap-1"><UserCheck className="h-3.5 w-3.5 text-ink-400" /> Batch Wishmaster Assignment</label>
                    <input type="text" className="input text-xs" placeholder="Enter Courier assignment" value={bulkWishmaster} onChange={e => setBulkWishmaster(e.target.value)} />
                  </div>
                  <div>
                    <label className="label-text flex items-center gap-1"><FileText className="h-3.5 w-3.5 text-ink-400" /> Raw Log Content Box</label>
                    <textarea className="input text-xs font-mono h-40 p-3 leading-relaxed" placeholder={"FMPC6250362428\t3\nSRSC0300349519\t2 ✅"} value={bulkText} onChange={e => setBulkText(e.target.value)} />
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary flex-1 py-2 text-xs font-bold justify-center">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="btn-primary flex-1 py-2 text-xs font-bold justify-center">
                  {isSubmitting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : entryMode === 'single' ? 'Log Case File' : 'Batch Import List'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}