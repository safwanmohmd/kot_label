import { useState, useEffect, useMemo } from 'react';
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
  Wand2,
  Edit2,
  Eye,
  Info,
  Save,
  Archive,
  AlertTriangle,
  ArrowRightCircle,
  Filter,
  Users,
  AlertOctagon
} from 'lucide-react';
import { useToast } from '../lib/useToast.jsx';
import { 
  fetchLpRecords, 
  fetchLossLedgerRecords,
  createLpRecord, 
  deleteLpRecord, 
  updateLpRecord, 
  createLpRecordsBulk,
  clearAllLpRecords,
  confirmAndPushLossLedger,
  reopenLossToTracker
} from '../lib/lpService.js';

export function LpTrackerList() {
  const toast = useToast();

  // Component States
  const [activeRecords, setActiveRecords] = useState([]);
  const [lossRecords, setLossRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [entryMode, setEntryMode] = useState('single');
  
  // Default sorting: Aging High to Low ('desc')
  const [sortDirection, setSortDirection] = useState('desc'); 
  
  // View Mode: 'active' (lp_tracker table) | 'loss' (loss_ledger table)
  const [viewMode, setViewMode] = useState('active');

  // Grouping & Filtering State
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [selectedWmFilter, setSelectedWmFilter] = useState('ALL');

  // Inline Editing
  const [editingRecordId, setEditingRecordId] = useState(null);
  const [editingWmName, setEditingWmName] = useState('');
  const [isUpdatingWm, setIsUpdatingWm] = useState(false);

  // Inspector Modal
  const [inspectingItem, setInspectingItem] = useState(null);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editedDetailsText, setEditedDetailsText] = useState('');
  const [isSavingDetails, setIsSavingDetails] = useState(false);

  const [isResetting, setIsResetting] = useState(false);

  // Single Form Fields
  const [trackingId, setTrackingId] = useState('');
  const [wishmasterName, setWishmasterName] = useState('');
  const [agingDays, setAgingDays] = useState('');
  const [status, setStatus] = useState('NOT FOUND');
  const [itemDetails, setItemDetails] = useState(''); 
  
  // Bulk Form Fields
  const [bulkText, setBulkText] = useState('');
  const [bulkWishmaster, setBulkWishmaster] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const STATUS_OPTIONS_ACTIVE = ['NOT FOUND', 'CLEARING TODAY', 'MARK LOSS PENDING', 'ALREADY MARKED LOSS'];
  const STATUS_OPTIONS_LOSS = ['LOSS'];

  const PRIORITY_RANK = {
    'CRITICAL': 4,
    'HIGH': 3,
    'MEDIUM': 2,
    'LOW': 1
  };

  async function loadData() {
    setLoading(true);
    try {
      const [trackerData, ledgerData] = await Promise.all([
        fetchLpRecords(),
        fetchLossLedgerRecords()
      ]);
      setActiveRecords(trackerData);
      setLossRecords(ledgerData);
    } catch (err) {
      toast('Error loading operational records.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function toggleSort() {
    if (sortDirection === 'desc') {
      setSortDirection('asc');
    } else if (sortDirection === 'asc') {
      setSortDirection('auto');
    } else {
      setSortDirection('desc');
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

  // Dashboard Metrics & Statistics
  const stats = useMemo(() => {
    const totalActive = activeRecords.length;
    const pendingLossCount = activeRecords.filter(r => r.status === 'MARK LOSS PENDING').length;
    const alreadyLossCount = activeRecords.filter(r => r.status === 'ALREADY MARKED LOSS').length;
    const clearingTodayCount = activeRecords.filter(r => r.status === 'CLEARING TODAY').length;
    const notFoundCount = activeRecords.filter(r => r.status === 'NOT FOUND').length;
    const criticalRiskCount = activeRecords.filter(r => r.priority === 'CRITICAL').length;
    const totalLossLedger = lossRecords.length;

    return {
      totalActive,
      pendingLossCount,
      alreadyLossCount,
      clearingTodayCount,
      notFoundCount,
      criticalRiskCount,
      totalLossLedger
    };
  }, [activeRecords, lossRecords]);

  // Unique Wishmaster list for group filter
  const uniqueWishmasters = useMemo(() => {
    const currentList = viewMode === 'loss' ? lossRecords : activeRecords;
    const wmSet = new Set();
    currentList.forEach(r => {
      if (r.wishmaster_name && r.wishmaster_name.trim()) {
        wmSet.add(r.wishmaster_name.trim());
      }
    });
    return Array.from(wmSet).sort();
  }, [activeRecords, lossRecords, viewMode]);

  function openInspector(item) {
    setInspectingItem(item);
    setEditedDetailsText(item.details || '');
    setIsEditingDetails(false);
  }

  async function handleSaveInspectedDetails() {
    setIsSavingDetails(true);
    try {
      const updatedValue = editedDetailsText.trim() || null;
      const isLoss = viewMode === 'loss';
      
      if (isLoss) {
        setLossRecords(prev => prev.map(r => r.id === inspectingItem.id ? { ...r, details: updatedValue } : r));
      } else {
        setActiveRecords(prev => prev.map(r => r.id === inspectingItem.id ? { ...r, details: updatedValue } : r));
      }

      await updateLpRecord(inspectingItem.id, { details: updatedValue }, isLoss);
      setInspectingItem(prev => ({ ...prev, details: updatedValue }));
      setIsEditingDetails(false);
      toast('Shipment details updated successfully.', 'success');
    } catch (err) {
      toast('Failed to save shipment detail updates.', 'error');
    } finally {
      setIsSavingDetails(false);
    }
  }

  async function sweepMissingRecords(incomingTrackingIds) {
    const upperIncomingIds = incomingTrackingIds.map(id => id.trim().toUpperCase());
    const missingActiveRecords = activeRecords.filter(rec => 
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
          }, false);
          sweepSuccessCount++;
        } catch (err) {
          console.error(`Absence sweep failed auto-clearing ID: ${rec.tracking_id}`, err);
        }
      })
    );

    return sweepSuccessCount;
  }

  async function handleResetDayArchive() {
    const confirmMsg = `🚨 WARNING: You are resetting the active tracking workspace (lp_tracker table).\n\nAll active trackers will be cleared.\n\nThe dedicated Loss Ledger will remain completely untouched. Proceed?`;
    if (!window.confirm(confirmMsg)) return;

    setIsResetting(true);
    try {
      await clearAllLpRecords();
      setActiveRecords([]);
      toast('Active LP workspace reset completed successfully.', 'success');
    } catch (err) {
      toast('Failed to clear active shift items.', 'error');
      console.error(err);
    } finally {
      setIsResetting(false);
    }
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
      toast('Please supply all required tracking parameters.', 'error');
      return;
    }

    const cleanId = trackingId.trim().toUpperCase();
    const parsedAging = Math.round(parseFloat(agingDays)) || 0;
    const assignedPriority = calculatePriority(parsedAging);

    const existingLossMatch = lossRecords.find(r => r.tracking_id.toUpperCase() === cleanId);
    const finalStatus = existingLossMatch ? 'ALREADY MARKED LOSS' : status;
    const finalWmName = existingLossMatch?.wishmaster_name ? existingLossMatch.wishmaster_name : wishmasterName.trim();

    const payload = {
      tracking_id: cleanId,
      wishmaster_name: finalWmName,
      aging_days: parsedAging,
      priority: existingLossMatch ? 'CRITICAL' : assignedPriority,
      status: finalStatus,
      details: itemDetails.trim() || (existingLossMatch ? existingLossMatch.details || 'Found in Loss Ledger' : null), 
      resolved_at: (finalStatus === 'ALREADY MARKED LOSS' || finalStatus === 'CLEARING TODAY') ? new Date().toISOString() : null
    };

    try {
      await createLpRecord(payload);
      if (finalStatus !== 'ALREADY MARKED LOSS' && finalStatus !== 'MARK LOSS PENDING') {
        await sweepMissingRecords([cleanId]);
      }

      toast(`Logged Case: ${cleanId} ${existingLossMatch ? '(Status: ALREADY MARKED LOSS)' : ''}`, 'success');
      resetSingleForm();
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      toast('Failed creating/updating tracker entry.', 'error');
    }
  }

  async function handleBulkSubmit() {
    if (!bulkText.trim() || !bulkWishmaster.trim()) {
      toast('Provide both the bulk manifest list and a Courier assignment.', 'error');
      return;
    }

    const lines = bulkText.split(/[\r\n]+/);
    const payloadMap = new Map();
    const incomingIds = [];
    const timestamp = new Date().toISOString();

    const knownLossMap = new Map();
    lossRecords.forEach(r => {
      knownLossMap.set(r.tracking_id.toUpperCase(), {
        wm_name: r.wishmaster_name,
        details: r.details
      });
    });

    lines.forEach((line) => {
      const cleanLine = line.trim();
      if (!cleanLine || cleanLine.toUpperCase() === 'CPT') return;

      const columns = cleanLine.split(/\s+/);
      if (columns.length < 2) return;

      const tId = columns[0].toUpperCase();
      const rawAging = columns[1];
      const parsedAging = Math.round(parseFloat(rawAging));

      if (isNaN(parsedAging)) return;

      const lossInfo = knownLossMap.get(tId);
      const isKnownLoss = !!lossInfo;
      const isFound = cleanLine.includes('✅') || cleanLine.toLowerCase().includes('found');
      
      const inferredStatus = isKnownLoss ? 'ALREADY MARKED LOSS' : isFound ? 'CLEARING TODAY' : 'NOT FOUND';
      const assignedPriority = isKnownLoss ? 'CRITICAL' : calculatePriority(parsedAging);
      const assignedWm = isKnownLoss && lossInfo.wm_name ? lossInfo.wm_name : bulkWishmaster.trim();

      if (!isKnownLoss) incomingIds.push(tId);

      payloadMap.set(tId, {
        tracking_id: tId,
        wishmaster_name: assignedWm,
        aging_days: parsedAging,
        priority: assignedPriority,
        status: inferredStatus,
        details: isKnownLoss ? (lossInfo.details || 'Already Marked Loss in Loss Ledger') : null, 
        resolved_at: (inferredStatus === 'CLEARING TODAY' || inferredStatus === 'ALREADY MARKED LOSS') ? timestamp : null
      });
    });

    const parsedPayloads = Array.from(payloadMap.values());

    if (parsedPayloads.length === 0) {
      toast('Could not interpret any valid tracking metrics from input.', 'error');
      return;
    }

    try {
      await createLpRecordsBulk(parsedPayloads);
      const autoClearedCount = await sweepMissingRecords(incomingIds);
      const alreadyLossCount = parsedPayloads.filter(p => p.status === 'ALREADY MARKED LOSS').length;

      if (alreadyLossCount > 0) {
        toast(`Imported ${parsedPayloads.length} entries (${alreadyLossCount} flagged as ALREADY MARKED LOSS).`, 'info');
      } else if (autoClearedCount > 0) {
        toast(`Imported ${parsedPayloads.length} entries. Sweep cleared ${autoClearedCount} un-submitted logs!`, 'success');
      } else {
        toast(`Successfully processed ${parsedPayloads.length} records!`, 'success');
      }

      resetBulkForm();
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      console.error(err);
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

  function startEditingWm(item) {
    setEditingRecordId(item.id);
    setEditingWmName(item.wishmaster_name);
  }

  async function saveInlineWmUpdate(id) {
    if (!editingWmName.trim()) {
      toast('Wishmaster name cannot be left blank.', 'error');
      return;
    }
    setIsUpdatingWm(true);
    const isLoss = viewMode === 'loss';
    try {
      if (isLoss) {
        setLossRecords(prev => prev.map(r => r.id === id ? { ...r, wishmaster_name: editingWmName.trim() } : r));
      } else {
        setActiveRecords(prev => prev.map(r => r.id === id ? { ...r, wishmaster_name: editingWmName.trim() } : r));
      }
      await updateLpRecord(id, { wishmaster_name: editingWmName.trim() }, isLoss);
      toast('Wishmaster assignment saved.', 'success');
      setEditingRecordId(null);
    } catch (err) {
      toast('Failed to save updated wishmaster name.', 'error');
      loadData();
    } finally {
      setIsUpdatingWm(false);
    }
  }

  function cancelInlineWmEdit() {
    setEditingRecordId(null);
    setEditingWmName('');
  }

  async function handleStatusChange(item, nextStatus) {
    const isLoss = viewMode === 'loss';
    
    if (isLoss && nextStatus !== 'LOSS') {
      if (!window.confirm(`Reopen case ${item.tracking_id} from Loss Ledger and move back to active LP Tracker?`)) return;
      try {
        await reopenLossToTracker(item);
        toast(`Case ${item.tracking_id} reopened to active tracker.`, 'success');
        loadData();
      } catch (err) {
        toast('Failed to reopen loss record.', 'error');
      }
      return;
    }

    try {
      const isResolved = nextStatus === 'CLEARING TODAY' || nextStatus === 'ALREADY MARKED LOSS';
      const timestamp = isResolved ? new Date().toISOString() : null;

      if (isLoss) {
        setLossRecords(prev => prev.map(r => r.id === item.id ? { ...r, status: nextStatus, resolved_at: timestamp } : r));
      } else {
        setActiveRecords(prev => prev.map(r => r.id === item.id ? { ...r, status: nextStatus, resolved_at: timestamp } : r));
      }

      await updateLpRecord(item.id, { status: nextStatus, resolved_at: timestamp }, isLoss);
      toast(`Updated status to ${nextStatus}`, 'success');
    } catch (err) {
      toast('Failed to save status modification.', 'error');
      loadData();
    }
  }

  async function handleMarkLossPending(item) {
    try {
      setActiveRecords(prev => prev.map(r => r.id === item.id ? { ...r, status: 'MARK LOSS PENDING', priority: 'CRITICAL' } : r));
      await updateLpRecord(item.id, { status: 'MARK LOSS PENDING', priority: 'CRITICAL' }, false);
      toast(`Case ${item.tracking_id} marked as Loss Pending. Push to Loss Ledger when confirmed.`, 'info');
    } catch (err) {
      toast('Failed setting loss pending status.', 'error');
      loadData();
    }
  }

  async function handleConfirmPushToLossLedger(item) {
    if (!window.confirm(`Confirm and push ${item.tracking_id} permanently to the Loss Ledger?`)) return;

    try {
      await confirmAndPushLossLedger(item);
      toast(`Case ${item.tracking_id} pushed to Loss Ledger. Status is ALREADY MARKED LOSS.`, 'success');
      loadData();
    } catch (err) {
      toast('Error pushing record to Loss Ledger.', 'error');
      loadData();
    }
  }

  async function handleMarkCleared(id, trackingLabel) {
    if (!window.confirm(`Mark ${trackingLabel} as CLEARED?`)) return;

    try {
      const timestamp = new Date().toISOString();
      setActiveRecords(prev => prev.map(r => r.id === id ? { ...r, status: 'CLEARING TODAY', resolved_at: timestamp } : r));
      await updateLpRecord(id, { status: 'CLEARING TODAY', resolved_at: timestamp }, false);
      toast(`Case ${trackingLabel} marked as Cleared.`, 'success');
    } catch (err) {
      toast('Error updating record.', 'error');
      loadData();
    }
  }

  async function handleDelete(id, label) {
    const isLoss = viewMode === 'loss';
    if (!window.confirm(`Permanently delete record ${label}?`)) return;
    try {
      await deleteLpRecord(id, isLoss);
      toast('Record purged successfully.', 'success');
      if (isLoss) {
        setLossRecords(prev => prev.filter(r => r.id !== id));
      } else {
        setActiveRecords(prev => prev.filter(r => r.id !== id));
      }
    } catch (err) {
      toast('Error deleting record.', 'error');
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
      case 'MARK LOSS PENDING': return 'bg-amber-100 text-amber-900 border-amber-300 font-black';
      case 'ALREADY MARKED LOSS': return 'bg-rose-600 text-white font-black border-rose-700';
      case 'LOSS': return 'bg-rose-100 border-rose-300 text-rose-800 font-black';
      case 'CLEARING TODAY': return 'bg-emerald-100 border-emerald-300 text-emerald-800 font-bold';
      default: return 'bg-purple-100 border-purple-300 text-purple-800 font-medium';
    }
  }

  // DEFAULT STRICT SORTING: AGING HIGH TO LOW
  const displayedRecords = useMemo(() => {
    let baseList = viewMode === 'loss' ? lossRecords : activeRecords;
    
    // Status Group Filter
    if (statusFilter !== 'ALL') {
      baseList = baseList.filter(rec => rec.status === statusFilter);
    }

    // Priority Group Filter
    if (priorityFilter !== 'ALL') {
      baseList = baseList.filter(rec => rec.priority === priorityFilter);
    }

    // Wishmaster Group Filter
    if (selectedWmFilter !== 'ALL') {
      baseList = baseList.filter(rec => rec.wishmaster_name?.trim() === selectedWmFilter);
    }

    // Search Query Filter
    let filtered = baseList.filter(rec => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        rec.tracking_id?.toLowerCase().includes(q) ||
        rec.wishmaster_name?.toLowerCase().includes(q) ||
        rec.status?.toLowerCase().includes(q) ||
        rec.priority?.toLowerCase().includes(q)
      );
    });

    // Aging-Driven Sorting (Default: High to Low)
    filtered.sort((a, b) => {
      const agingA = a.aging_days ?? 0;
      const agingB = b.aging_days ?? 0;

      if (sortDirection === 'desc' || sortDirection === 'auto') {
        // High to Low Aging (Pre-Default)
        if (agingB !== agingA) return agingB - agingA;
        const weightA = PRIORITY_RANK[a.priority] || 0;
        const weightB = PRIORITY_RANK[b.priority] || 0;
        return weightB - weightA;
      } else if (sortDirection === 'asc') {
        // Low to High Aging
        if (agingA !== agingB) return agingA - agingB;
        const weightA = PRIORITY_RANK[a.priority] || 0;
        const weightB = PRIORITY_RANK[b.priority] || 0;
        return weightA - weightB;
      }
      return 0;
    });
    
    return filtered;
  }, [activeRecords, lossRecords, viewMode, statusFilter, priorityFilter, selectedWmFilter, searchQuery, sortDirection]);

  return (
    <div className="w-full p-3 sm:p-4 space-y-3.5 animate-fade-in text-xs">
      {/* HEADER NAVIGATION STRIP */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-ink-200 shadow-2xs">
        <div>
          <button 
            onClick={() => window.history.back()}
            className="flex items-center gap-1.5 text-[11px] font-bold text-ink-600 hover:text-brand-600 transition-colors mb-0.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Return to Workspace Terminal
          </button>
          <h2 className="text-base sm:text-lg font-black text-ink-900 tracking-tight flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-brand-600" /> Loss Prevention Analytics & Tracking
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {viewMode === 'active' && (
            <button
              onClick={handleResetDayArchive}
              disabled={isResetting || activeRecords.length === 0}
              className="flex items-center gap-1.5 bg-amber-50 hover:bg-rose-600 text-amber-700 hover:text-white border border-amber-200 hover:border-rose-300 text-[11px] font-black uppercase px-3 py-1.5 rounded-lg transition-all shadow-3xs disabled:opacity-40 disabled:hover:bg-amber-50 disabled:hover:text-amber-700 disabled:cursor-not-allowed h-8"
              title="Purge daily active workspace trackers (lp_tracker). The dedicated Loss Ledger is untouched."
            >
              {isResetting ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5" /> Reset Day Workspace
                </>
              )}
            </button>
          )}

          <button 
            onClick={() => setIsModalOpen(true)}
            className="btn-primary px-3.5 py-1.5 text-[11px] font-bold shadow-xs h-8 flex items-center gap-1"
          >
            <Plus className="h-4 w-4" /> Add Case File
          </button>
        </div>
      </div>

      {/* ADVANCED METRIC DASHBOARD STATS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <div 
          onClick={() => { setViewMode('active'); setStatusFilter('ALL'); }}
          className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
            viewMode === 'active' && statusFilter === 'ALL'
              ? 'bg-white border-brand-500 shadow-xs ring-1 ring-brand-500'
              : 'bg-white border-ink-200 hover:border-brand-300 shadow-3xs'
          }`}
        >
          <span className="text-[10px] font-bold uppercase text-ink-400 block">Active Cases</span>
          <p className="text-base font-black text-ink-900 mt-0.5">{stats.totalActive}</p>
          <span className="text-[9px] text-brand-600 font-semibold">Total In Tracker</span>
        </div>

        {/* PENDING LOSS CONFIRM COUNT (TOP HIGHLIGHT) */}
        <div 
          onClick={() => { setViewMode('active'); setStatusFilter('MARK LOSS PENDING'); }}
          className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
            stats.pendingLossCount > 0
              ? 'bg-amber-500/10 border-amber-400 ring-1 ring-amber-400'
              : 'bg-white border-ink-200 shadow-3xs'
          }`}
        >
          <span className="text-[10px] font-bold uppercase text-amber-800 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-amber-600 animate-pulse" /> Pending Loss
          </span>
          <p className="text-base font-black text-amber-900 mt-0.5">{stats.pendingLossCount}</p>
          <span className="text-[9px] text-amber-700 font-bold">Needs Confirmation</span>
        </div>

        <div 
          onClick={() => { setViewMode('active'); setStatusFilter('NOT FOUND'); }}
          className="p-2.5 rounded-xl border border-ink-200 bg-white shadow-3xs cursor-pointer hover:border-purple-300"
        >
          <span className="text-[10px] font-bold uppercase text-purple-600 block">Not Found</span>
          <p className="text-base font-black text-purple-950 mt-0.5">{stats.notFoundCount}</p>
          <span className="text-[9px] text-purple-500 font-semibold">Pending Search</span>
        </div>

        <div 
          onClick={() => { setViewMode('active'); setStatusFilter('CLEARING TODAY'); }}
          className="p-2.5 rounded-xl border border-ink-200 bg-white shadow-3xs cursor-pointer hover:border-emerald-300"
        >
          <span className="text-[10px] font-bold uppercase text-emerald-600 block">Clearing Today</span>
          <p className="text-base font-black text-emerald-900 mt-0.5">{stats.clearingTodayCount}</p>
          <span className="text-[9px] text-emerald-600 font-semibold">Found Parcels</span>
        </div>

        <div 
          onClick={() => { setViewMode('active'); setPriorityFilter('CRITICAL'); }}
          className="p-2.5 rounded-xl border border-ink-200 bg-white shadow-3xs cursor-pointer hover:border-red-300"
        >
          <span className="text-[10px] font-bold uppercase text-red-600 block">Critical Risk</span>
          <p className="text-base font-black text-red-800 mt-0.5">{stats.criticalRiskCount}</p>
          <span className="text-[9px] text-red-500 font-semibold">&gt; 5 Days Aging</span>
        </div>

        <div 
          onClick={() => { setViewMode('loss'); setStatusFilter('ALL'); }}
          className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
            viewMode === 'loss'
              ? 'bg-rose-50 border-rose-400 ring-1 ring-rose-400'
              : 'bg-white border-ink-200 hover:border-rose-300 shadow-3xs'
          }`}
        >
          <span className="text-[10px] font-bold uppercase text-rose-600 block">Loss Ledger</span>
          <p className="text-base font-black text-rose-800 mt-0.5">{stats.totalLossLedger}</p>
          <span className="text-[9px] text-rose-600 font-semibold">Archived Losses</span>
        </div>
      </div>

      {/* MAIN DATA CONTAINER */}
      <div className="card p-0 overflow-hidden border border-ink-200 shadow-xs bg-white rounded-xl">
        {/* FILTER CONTROLS & GROUP SELECTION BAR */}
        <div className="p-3 border-b border-ink-100 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 bg-ink-50/40">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            {/* SEARCH INPUT */}
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-ink-400" />
              <input 
                type="text" 
                placeholder="Search tracking ID, WM..."
                className="input h-7.5 pl-8 pr-2.5 text-[11px] bg-white border-ink-200 w-full rounded-lg font-medium"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            {/* STATUS GROUP FILTER */}
            <div className="flex items-center gap-1 bg-white border border-ink-200 rounded-lg px-2 py-0.5">
              <Filter className="h-3 w-3 text-ink-400" />
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="text-[10px] font-bold bg-transparent focus:outline-none text-ink-800"
              >
                <option value="ALL">All Statuses</option>
                {viewMode === 'active' ? (
                  STATUS_OPTIONS_ACTIVE.map(st => (
                    <option key={st} value={st}>{st}</option>
                  ))
                ) : (
                  <option value="LOSS">LOSS</option>
                )}
              </select>
            </div>

            {/* PRIORITY GROUP FILTER */}
            <div className="flex items-center gap-1 bg-white border border-ink-200 rounded-lg px-2 py-0.5">
              <AlertOctagon className="h-3 w-3 text-ink-400" />
              <select
                value={priorityFilter}
                onChange={e => setPriorityFilter(e.target.value)}
                className="text-[10px] font-bold bg-transparent focus:outline-none text-ink-800"
              >
                <option value="ALL">All Severities</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>

            {/* WISHMASTER GROUP FILTER */}
            <div className="flex items-center gap-1 bg-white border border-ink-200 rounded-lg px-2 py-0.5">
              <Users className="h-3 w-3 text-ink-400" />
              <select
                value={selectedWmFilter}
                onChange={e => setSelectedWmFilter(e.target.value)}
                className="text-[10px] font-bold bg-transparent focus:outline-none text-ink-800 max-w-[130px] truncate"
              >
                <option value="ALL">All Wishmasters</option>
                {uniqueWishmasters.map(wm => (
                  <option key={wm} value={wm}>{wm}</option>
                ))}
              </select>
            </div>

            {(statusFilter !== 'ALL' || priorityFilter !== 'ALL' || selectedWmFilter !== 'ALL' || searchQuery) && (
              <button
                onClick={() => {
                  setStatusFilter('ALL');
                  setPriorityFilter('ALL');
                  setSelectedWmFilter('ALL');
                  setSearchQuery('');
                }}
                className="text-[10px] font-bold text-red-600 hover:text-red-800 underline"
              >
                Clear Filters
              </button>
            )}
          </div>

          {/* TABLE SEGMENT SWITCH */}
          <div className="flex items-center gap-2 self-start lg:self-auto">
            <div className="p-0.5 bg-ink-100 rounded-lg flex items-center border border-ink-200/60 shadow-3xs select-none">
              <button
                type="button"
                onClick={() => { setViewMode('active'); setStatusFilter('ALL'); }}
                className={`px-3 py-1 rounded-md text-[10px] font-black tracking-tight transition-all duration-150 ${
                  viewMode === 'active' 
                    ? 'bg-white text-brand-600 shadow-xs' 
                    : 'text-ink-500 hover:text-ink-800'
                }`}
              >
                Active Tracker ({activeRecords.length})
              </button>
              <button
                type="button"
                onClick={() => { setViewMode('loss'); setStatusFilter('ALL'); }}
                className={`px-3 py-1 rounded-md text-[10px] font-black tracking-tight flex items-center gap-1 transition-all duration-150 ${
                  viewMode === 'loss' 
                    ? 'bg-rose-600 text-white shadow-xs' 
                    : 'text-ink-500 hover:text-ink-800'
                }`}
              >
                <Archive className="h-3 w-3" /> Loss Ledger ({lossRecords.length})
              </button>
            </div>

            <span className="text-[10px] font-mono text-brand-700 bg-brand-50 border border-brand-200 px-2 py-1 rounded-md flex items-center gap-1 font-bold shadow-3xs hidden sm:flex">
              <Wand2 className="h-3 w-3 text-brand-600" /> 
              {viewMode === 'active' ? 'lp_tracker Table' : 'loss_ledger Table'}
            </span>
          </div>
        </div>

        {/* DATA TABLE MATRIX */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-20 text-center text-xs text-ink-500 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="h-6 w-6 text-brand-500 animate-spin" />
              <span>Loading tracking matrix records...</span>
            </div>
          ) : displayedRecords.length === 0 ? (
            <div className="py-16 text-center text-xs text-ink-400 font-medium px-6 italic">
              {viewMode === 'active' 
                ? 'No active records match the selected parameters.' 
                : 'No records in the dedicated Loss Ledger table.'}
            </div>
          ) : (
            <table className="w-full border-collapse text-left text-[11px]">
              <thead>
                <tr className="bg-ink-50 text-ink-700 font-bold border-b border-ink-100 uppercase tracking-wider text-[9px] select-none">
                  <th className="py-2.5 px-3 w-10 text-center">Type</th>
                  <th className="py-2.5 px-3">Tracking Reference ID</th>
                  <th className="py-2.5 px-3">Assigned Wishmaster</th>
                  <th className="py-2.5 px-3 cursor-pointer hover:bg-ink-100/80 transition-colors group/header" onClick={toggleSort}>
                    <div className="flex items-center gap-1">
                      <span>Aging (High → Low)</span>
                      {sortDirection === 'desc' && <ArrowDown className="h-3 w-3 text-brand-600" />}
                      {sortDirection === 'asc' && <ArrowUp className="h-3 w-3 text-brand-600" />}
                      {sortDirection === 'auto' && <span className="text-[8px] text-brand-600 font-black tracking-tighter bg-brand-100 px-1 rounded">DEFAULT</span>}
                    </div>
                  </th>
                  <th className="py-2.5 px-3">Calculated Risk</th>
                  <th className="py-2.5 px-3">Investigation Status</th>
                  <th className="py-2.5 px-3 text-center w-48">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {displayedRecords.map(item => {
                  const isAlreadyLoss = item.status === 'ALREADY MARKED LOSS';
                  const isLossPending = item.status === 'MARK LOSS PENDING';
                  const isEditingThisRow = editingRecordId === item.id;
                  
                  return (
                    <tr 
                      key={item.id} 
                      className={`transition-all duration-150 group ${
                        isAlreadyLoss
                          ? 'bg-rose-100/50 text-rose-950 font-bold hover:bg-rose-100/80'
                          : isLossPending
                          ? 'bg-amber-100/60 text-amber-950 font-bold hover:bg-amber-100/90'
                          : item.status === 'LOSS'
                          ? 'bg-rose-50/20 text-ink-700 hover:bg-rose-50/40' 
                          : item.status === 'CLEARING TODAY' ? 'bg-ink-50/40 text-ink-600' : 'hover:bg-brand-50/20'
                      }`}
                    >
                      <td className="py-2 px-3 text-center">
                        <div className="mx-auto p-1 rounded-md bg-ink-50 border border-ink-100 text-ink-500 w-6 h-6 flex items-center justify-center">
                          {isAlreadyLoss ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-rose-600" />
                          ) : isLossPending ? (
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 animate-pulse" />
                          ) : item.status === 'LOSS' ? (
                            <CheckCircle2 className="h-4 w-4 text-red-500" />
                          ) : item.status === 'CLEARING TODAY' ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          ) : (
                            <Package className="h-3.5 w-3.5" />
                          )}
                        </div>
                      </td>
                      
                      <td className="py-2 px-3 font-mono font-bold uppercase tracking-wide text-ink-900">
                        {item.tracking_id}
                      </td>
                      
                      <td className="py-2 px-3 text-ink-700 font-medium min-w-[170px]">
                        {isEditingThisRow ? (
                          <div className="flex items-center gap-1 max-w-xs animate-fade-in">
                            <input
                              type="text"
                              className="input h-6.5 text-[11px] font-medium border-brand-400 focus:border-brand-600 py-0.5 px-1.5 w-full rounded"
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
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={cancelInlineWmEdit}
                              className="p-1 text-ink-400 hover:bg-ink-100 rounded"
                              disabled={isUpdatingWm}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div 
                            className="flex items-center gap-1.5 group/edit cursor-pointer hover:text-brand-600 transition-colors"
                            onDoubleClick={() => startEditingWm(item)}
                          >
                            <span>{item.wishmaster_name}</span>
                            <button 
                              onClick={() => startEditingWm(item)}
                              className="opacity-0 group-hover/edit:opacity-100 group-hover:opacity-60 text-ink-400 hover:text-brand-600 transition-all p-0.5 rounded"
                            >
                              <Edit2 className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        )}
                      </td>

                      <td className="py-2 px-3 font-mono text-ink-600 font-bold">{item.aging_days} {item.aging_days === 1 ? 'Day' : 'Days'}</td>
                      
                      <td className="py-2 px-3">
                        <span className={`text-[9px] px-1.5 py-0.2 rounded border font-mono uppercase font-bold tracking-wide ${getPriorityStyle(item.priority)}`}>
                          {item.priority}
                        </span>
                      </td>
                      
                      <td className="py-2 px-3">
                        {isLossPending ? (
                          <div className="flex flex-col gap-0.5 max-w-[145px]">
                            <span className="text-[8px] font-black uppercase px-1 py-0.2 rounded bg-amber-200 text-amber-900 border border-amber-400 animate-pulse text-center leading-tight truncate">
                              LOSS CONFIRM PENDING
                            </span>
                            <select
                              className={`text-[10px] font-mono border rounded px-1 py-0.2 uppercase font-bold focus:outline-none ${getStatusSelectStyle(item.status)}`}
                              value={item.status}
                              onChange={(e) => handleStatusChange(item, e.target.value)}
                            >
                              {(viewMode === 'active' ? STATUS_OPTIONS_ACTIVE : STATUS_OPTIONS_LOSS).map(opt => (
                                <option key={opt} value={opt} className="bg-white text-ink-900 font-medium">{opt}</option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <select
                            className={`text-[10px] font-mono border rounded px-1.5 py-0.5 uppercase font-bold focus:outline-none ${getStatusSelectStyle(item.status)}`}
                            value={item.status}
                            onChange={(e) => handleStatusChange(item, e.target.value)}
                          >
                            {(viewMode === 'active' ? STATUS_OPTIONS_ACTIVE : STATUS_OPTIONS_LOSS).map(opt => (
                              <option key={opt} value={opt} className="bg-white text-ink-900 font-medium">{opt}</option>
                            ))}
                          </select>
                        )}
                      </td>

                      {/* COMPACT ACTION COLUMN */}
                      <td className="py-2 px-3">
                        <div className="flex items-center justify-center gap-1 flex-nowrap">
                          <button
                            onClick={() => openInspector(item)}
                            className="p-1 text-ink-400 hover:text-brand-600 hover:bg-brand-50 rounded transition-all shrink-0"
                            title="Inspect details"
                          >
                            <Eye className="h-3 w-3" />
                          </button>

                          <span className="text-ink-200 select-none">|</span>

                          {viewMode === 'active' ? (
                            <>
                              {isLossPending ? (
                                <button 
                                  onClick={() => handleConfirmPushToLossLedger(item)} 
                                  className="flex items-center bg-rose-600 hover:bg-rose-700 text-white text-[8px] font-black uppercase px-1.5 py-0.5 rounded shadow-3xs transition whitespace-nowrap shrink-0"
                                  title="Confirm & push record permanently to Loss Ledger"
                                >
                                  <ArrowRightCircle className="h-2.5 w-2.5 mr-0.5" /> Push Loss
                                </button>
                              ) : isAlreadyLoss ? (
                                <span className="text-[8px] font-black uppercase px-1 py-0.2 rounded bg-rose-200 text-rose-900 border border-rose-300 whitespace-nowrap">
                                  In Loss Ledger
                                </span>
                              ) : (
                                <>
                                  <button onClick={() => handleMarkLossPending(item)} className="flex items-center bg-amber-600 text-white hover:bg-amber-700 text-[8px] font-black uppercase px-1.5 py-0.5 rounded shadow-3xs whitespace-nowrap shrink-0">
                                    <ShieldAlert className="h-2.5 w-2.5 mr-0.5" /> Mark Loss
                                  </button>
                                  {item.status !== 'CLEARING TODAY' && (
                                    <button onClick={() => handleMarkCleared(item.id, item.tracking_id)} className="flex items-center bg-emerald-600 text-white hover:bg-emerald-700 text-[8px] font-black uppercase px-1.5 py-0.5 rounded shadow-3xs whitespace-nowrap shrink-0">
                                      <Check className="h-2.5 w-2.5 mr-0.5" /> Clear
                                    </button>
                                  )}
                                </>
                              )}
                            </>
                          ) : (
                            <button 
                              onClick={() => handleStatusChange(item, 'NOT FOUND')}
                              className="text-[9px] font-mono uppercase tracking-tight font-black text-brand-600 hover:text-brand-800 bg-brand-50 border border-brand-200 rounded px-1.5 py-0.5 transition-colors whitespace-nowrap shrink-0"
                              title="Reopen and transfer back to active LP Tracker"
                            >
                              Reopen
                            </button>
                          )}

                          <span className="text-ink-200 select-none">|</span>
                          
                          <button 
                            onClick={() => handleDelete(item.id, item.tracking_id)}
                            className="p-1 text-ink-400 hover:text-red-500 hover:bg-red-50 rounded transition-all shrink-0"
                          >
                            <Trash2 className="h-3 w-3" />
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

      {/* INSPECTION MODAL */}
      {inspectingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="card w-full max-w-md p-5 border-t-4 border-t-brand-600 border-x border-b border-ink-200 bg-white shadow-xl relative animate-scale-up">
            <button 
              onClick={() => setInspectingItem(null)} 
              className="absolute right-3.5 top-3.5 p-1 rounded-lg text-ink-400 hover:text-ink-600 hover:bg-ink-100 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-1.5 text-brand-700 font-bold text-[11px] uppercase tracking-wider mb-2">
              <Info className="h-3.5 w-3.5" /> Operational Audit Details
            </div>
            
            <h3 className="text-sm font-black text-ink-900 tracking-tight font-mono border-b border-ink-100 pb-2.5 mb-3">
              ID: {inspectingItem.tracking_id}
            </h3>

            <div className="space-y-2 text-[11px]">
              <div className="flex justify-between items-center py-1 border-b border-ink-50">
                <span className="text-ink-500 font-medium">Assigned Wishmaster:</span>
                <span className="text-ink-900 font-bold">{inspectingItem.wishmaster_name}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-ink-50">
                <span className="text-ink-500 font-medium">Package Aging:</span>
                <span className="text-ink-900 font-mono font-bold">{inspectingItem.aging_days} Days old</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-ink-50">
                <span className="text-ink-500 font-medium">Calculated Risk:</span>
                <span className={`text-[9px] px-1.5 py-0.2 rounded border font-mono font-bold ${getPriorityStyle(inspectingItem.priority)}`}>
                  {inspectingItem.priority}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-ink-50">
                <span className="text-ink-500 font-medium">Investigation Status:</span>
                <span className={`text-[9px] px-1.5 py-0.2 rounded border font-mono font-bold ${getStatusSelectStyle(inspectingItem.status)}`}>
                  {inspectingItem.status}
                </span>
              </div>
              {inspectingItem.resolved_at && (
                <div className="flex justify-between items-center py-1 border-b border-ink-50">
                  <span className="text-ink-500 font-medium">Resolution Date:</span>
                  <span className="text-ink-700 font-mono text-[10px]">
                    {new Date(inspectingItem.resolved_at).toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            <div className="bg-brand-50/50 border border-brand-100 p-3 rounded-lg mt-4 text-[11px] text-ink-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="block font-black uppercase text-brand-800 tracking-wider text-[9px]">
                  Shipment Details / Notes:
                </span>
                
                {!isEditingDetails && (
                  <button 
                    type="button"
                    onClick={() => setIsEditingDetails(true)}
                    className="text-[9px] font-bold text-brand-600 hover:text-brand-800 flex items-center gap-1 transition-colors"
                  >
                    <Edit2 className="h-2.5 w-2.5" /> Edit Details
                  </button>
                )}
              </div>

              {isEditingDetails ? (
                <div className="space-y-1.5 animate-fade-in">
                  <textarea 
                    className="input text-xs bg-white h-20 p-2 w-full border-brand-400 focus:border-brand-600 resize-none leading-relaxed font-medium rounded"
                    value={editedDetailsText}
                    onChange={e => setEditedDetailsText(e.target.value)}
                    placeholder="Enter updated context notes or remarks..."
                  />
                  <div className="flex justify-end gap-1">
                    <button 
                      onClick={() => {
                        setIsEditingDetails(false);
                        setEditedDetailsText(inspectingItem.details || '');
                      }}
                      className="px-2 py-0.5 rounded bg-ink-200 text-ink-700 font-bold text-[9px] hover:bg-ink-300"
                      disabled={isSavingDetails}
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleSaveInspectedDetails}
                      className="px-2.5 py-0.5 rounded bg-brand-600 text-white font-bold text-[9px] hover:bg-brand-700 flex items-center gap-1"
                      disabled={isSavingDetails}
                    >
                      {isSavingDetails ? (
                        <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                      ) : (
                        <>
                          <Save className="h-2.5 w-2.5" /> Save Changes
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="leading-relaxed whitespace-pre-wrap italic font-medium">
                  {inspectingItem.details ? inspectingItem.details : 'N/A'}
                </p>
              )}
            </div>

            <button 
              onClick={() => setInspectingItem(null)} 
              className="btn-secondary w-full py-1.5 text-[11px] font-bold justify-center mt-4 rounded-lg"
            >
              Close Inspector Panel
            </button>
          </div>
        </div>
      )}

      {/* ENTRY MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="card w-full max-w-lg p-5 border border-brand-200 bg-white shadow-xl relative animate-scale-up rounded-xl">
            <button onClick={() => setIsModalOpen(false)} className="absolute right-3.5 top-3.5 p-1 rounded-lg text-ink-400 hover:text-ink-600 hover:bg-ink-100 transition-colors">
              <X className="h-4 w-4" />
            </button>

            <div className="flex border-b border-ink-200 mb-3.5 gap-4">
              <button type="button" onClick={() => setEntryMode('single')} className={`pb-2 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-all ${entryMode === 'single' ? 'border-brand-600 text-brand-600' : 'border-transparent text-ink-500 hover:text-ink-900'}`}>
                <Sliders className="h-3.5 w-3.5" /> Single Entry
              </button>
              <button type="button" onClick={() => setEntryMode('bulk')} className={`pb-2 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-all ${entryMode === 'bulk' ? 'border-brand-600 text-brand-600' : 'border-transparent text-ink-500 hover:text-ink-900'}`}>
                <Copy className="h-3.5 w-3.5" /> Bulk Manifest Paste
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-3 text-xs">
              {entryMode === 'single' && (
                <div className="space-y-3">
                  <div>
                    <label className="label-text flex items-center gap-1"><Package className="h-3.5 w-3.5 text-ink-400" /> Unique Tracker ID</label>
                    <input type="text" className="input text-xs font-mono uppercase font-bold" placeholder="e.g. FMPC6250362428" value={trackingId} onChange={e => setTrackingId(e.target.value)} />
                  </div>
                  <div>
                    <label className="label-text flex items-center gap-1"><UserCheck className="h-3.5 w-3.5 text-ink-400" /> Wishmaster Name</label>
                    <input type="text" className="input text-xs" placeholder="Full name of handling courier agent" value={wishmasterName} onChange={e => setWishmasterName(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label-text flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-ink-400" /> Case Aging (Days)</label>
                      <input type="number" min="0" className="input text-xs font-bold font-mono" placeholder="0" value={agingDays} onChange={e => setAgingDays(e.target.value)} />
                    </div>
                    <div>
                      <label className="label-text flex items-center gap-1"><Activity className="h-3.5 w-3.5 text-ink-400" /> Operational Status</label>
                      <select className="input text-xs py-1.5 font-bold" value={status} onChange={e => setStatus(e.target.value)}>
                        {STATUS_OPTIONS_ACTIVE.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="label-text flex items-center gap-1"><FileText className="h-3.5 w-3.5 text-ink-400" /> Shipment Details / Explanation</label>
                    <textarea 
                      className="input text-xs h-16 p-2 leading-relaxed resize-none" 
                      placeholder="Provide context notes or remarks..." 
                      value={itemDetails} 
                      onChange={e => setItemDetails(e.target.value)} 
                    />
                  </div>
                </div>
              )}

              {entryMode === 'bulk' && (
                <div className="space-y-3">
                  <div>
                    <label className="label-text flex items-center gap-1"><UserCheck className="h-3.5 w-3.5 text-ink-400" /> Batch Wishmaster Assignment</label>
                    <input type="text" className="input text-xs" placeholder="Enter Courier assignment" value={bulkWishmaster} onChange={e => setBulkWishmaster(e.target.value)} />
                  </div>
                  <div>
                    <label className="label-text flex items-center gap-1"><FileText className="h-3.5 w-3.5 text-ink-400" /> Raw Log Content Box</label>
                    <textarea className="input text-xs font-mono h-36 p-2.5 leading-relaxed" placeholder={"FMPC6250362428\t3\nSRSC0300349519\t2 ✅"} value={bulkText} onChange={e => setBulkText(e.target.value)} />
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-1.5">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary flex-1 py-1.5 text-xs font-bold justify-center rounded-lg">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="btn-primary flex-1 py-1.5 text-xs font-bold justify-center rounded-lg">
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