import { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  PackageCheck, 
  Plus, 
  Phone, 
  Search, 
  CheckCircle, 
  RefreshCw,
  ShieldAlert,
  Smartphone,
  CheckSquare,
  Trash2 // Imported Trash icon
} from 'lucide-react';
import { useToast } from '../lib/useToast.jsx';
import { 
  fetchManualDeliveries, 
  createManualDelivery, 
  updateManualDelivery, 
  syncManualDeliveryToLpLoss,
  deleteManualDelivery // Imported Delete service method
} from '../lib/lpService.js';

export function ManualDeliveryTracker() {
  const toast = useToast();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Input fields form state
  const [trackingId, setTrackingId] = useState('');
  const [deliveryStatus, setDeliveryStatus] = useState('DELIVERED_TO_CUSTOMER');
  const [cashStatus, setCashStatus] = useState('CASH_COLLECTED');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncingId, setIsSyncingId] = useState(null);

  async function loadData() {
    setLoading(true);
    try {
      const data = await fetchManualDeliveries();
      setRecords(data);
    } catch (err) {
      toast('Error fetching manual delivery logs.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!trackingId.trim() || !customerPhone.trim()) {
      toast('Tracking ID and Customer Phone Number are mandatory fields.', 'error');
      return;
    }

    setIsSubmitting(true);
    const payload = {
      tracking_id: trackingId.trim().toUpperCase(),
      delivery_status: deliveryStatus,
      cash_status: cashStatus,
      customer_phone: customerPhone.trim(),
      notes: notes.trim() || null,
      synced_to_lp: false
    };

    try {
      await createManualDelivery(payload);
      toast(`Logged Hub Handover: ${payload.tracking_id}`, 'success');
      setTrackingId('');
      setCustomerPhone('');
      setNotes('');
      await loadData();
    } catch (err) {
      toast('Failed to record manual hub delivery entry.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCrossSyncLpLoss(item) {
    if (!window.confirm(`Escalate shipment ${item.tracking_id} to Loss Archives? This will sync directly into the primary Loss Prevention module.`)) return;
    
    setIsSyncingId(item.id);
    try {
      await syncManualDeliveryToLpLoss(item);
      setRecords(prev => prev.map(r => r.id === item.id ? { ...r, synced_to_lp: true } : r));
      toast(`Shipment ${item.tracking_id} successfully mapped to primary LP Loss database table.`, 'success');
      await loadData();
    } catch (err) {
      toast('Error mapping transaction across storage modules.', 'error');
    } finally {
      setIsSyncingId(null);
    }
  }

  async function handleMarkErpCleared(item) {
    const message = `⚠️ WARNING: Are you completely sure Shipment ${item.tracking_id} has been fully updated and marked as DELIVERED directly inside the primary ERP panel?\n\nThis confirms that the package data cycle has finished.`;
    if (!window.confirm(message)) return;

    try {
      await updateManualDelivery(item.id, { 
        delivery_status: 'ERP_CLEARED_DELIVERED',
        notes: `${item.notes || ''} [ERP cleared manually]`.trim()
      });
      toast(`Shipment ${item.tracking_id} marked as cleared from ERP system.`, 'success');
      await loadData();
    } catch (err) {
      toast('Failed to update ERP status flags.', 'error');
    }
  }

  async function handleDeleteRecord(item) {
    if (!window.confirm(`⚠️ DANGER: Are you sure you want to permanently delete record ${item.tracking_id} from logs? This action cannot be undone.`)) return;
    
    try {
      // Optimistic state filter update for quick UI response
      setRecords(prev => prev.filter(r => r.id !== item.id));
      await deleteManualDelivery(item.id);
      toast(`Record ${item.tracking_id} successfully deleted.`, 'success');
    } catch (err) {
      toast('Failed to complete background row purge.', 'error');
      await loadData(); // Rollback local changes on backend failure
    }
  }

  async function toggleCashSettlement(id, currentStatus) {
    let nextStatus = 'CASH_COLLECTED';
    if (currentStatus === 'CASH_COLLECTED') nextStatus = 'GPAY_TO_HUB_INCHARGE';
    else if (currentStatus === 'GPAY_TO_HUB_INCHARGE') nextStatus = 'RECONCILED_WITH_WM';
    else nextStatus = 'CASH_COLLECTED';

    try {
      setRecords(prev => prev.map(r => r.id === id ? { ...r, cash_status: nextStatus } : r));
      await updateManualDelivery(id, { cash_status: nextStatus });
      toast(`Financial status changed to ${nextStatus.replace(/_/g, ' ')}`, 'success');
    } catch (err) {
      toast('Failed to update financial configuration.', 'error');
      loadData();
    }
  }

  const filteredRecords = records.filter(rec => {
    if (rec.synced_to_lp) return false; 

    const q = searchQuery.toLowerCase();
    return (
      rec.tracking_id?.toLowerCase().includes(q) ||
      rec.customer_phone?.includes(q) ||
      rec.cash_status?.toLowerCase().includes(q) ||
      rec.delivery_status?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="w-full p-3 space-y-3 animate-fade-in text-xs">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-ink-100 pb-2">
        <div>
          <button 
            onClick={() => window.history.back()}
            className="flex items-center gap-1 text-[10px] font-bold text-ink-600 hover:text-brand-600 transition-colors mb-0.5"
          >
            <ArrowLeft className="h-3 w-3" /> Return to Workspace Terminal
          </button>
          <h2 className="text-base font-black text-ink-900 tracking-tight flex items-center gap-1.5">
            <PackageCheck className="h-4 w-4 text-emerald-600" /> Hub Manual Counter Delivery Log
          </h2>
          <p className="text-[11px] text-ink-500 max-w-2xl mt-0.5 leading-relaxed">
            Log shipments picked up manually by customers at the hub. Tracks held cash, direct mobile GPay transfers, and phone numbers for automated cross-sync to Loss Prevention workflows.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-start">
        {/* INPUT LOG FORM PANEL */}
        <div className="card p-3.5 border border-ink-200 bg-white shadow-xs space-y-3">
          <h3 className="text-[10px] font-black uppercase tracking-wider text-ink-700 flex items-center gap-1 border-b pb-1.5">
            <Plus className="h-3 w-3 text-brand-600" /> Record Hub Handover
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-2.5">
            <div>
              <label className="text-[10px] font-bold text-ink-600 block mb-0.5">Shipment Tracking ID</label>
              <input 
                type="text" 
                className="input h-7 text-[11px] font-mono uppercase font-bold px-2" 
                placeholder="e.g. FMPC6250362428" 
                value={trackingId} 
                onChange={e => setTrackingId(e.target.value)} 
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-ink-600 block mb-0.5">Customer Mobile Phone</label>
              <div className="relative">
                <Phone className="absolute left-2.5 top-2 h-3 w-3 text-ink-400" />
                <input 
                  type="tel" 
                  className="input h-7 text-[11px] pl-7 font-mono font-bold px-2" 
                  placeholder="e.g. 9876543210" 
                  value={customerPhone} 
                  onChange={e => setCustomerPhone(e.target.value)} 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-ink-600 block mb-0.5">Handover Status</label>
                <select 
                  className="input h-7 text-[11px] font-bold bg-white focus:outline-none px-1.5 py-0"
                  value={deliveryStatus}
                  onChange={e => setDeliveryStatus(e.target.value)}
                >
                  <option value="DELIVERED_TO_CUSTOMER">CUSTOMER COLLECTED</option>
                  <option value="CANCELLED_DELAYED">CANCELLED / DELAYED</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-ink-600 block mb-0.5">Cash Placement</label>
                <select 
                  className="input h-7 text-[11px] font-bold bg-white focus:outline-none px-1.5 py-0"
                  value={cashStatus}
                  onChange={e => setCashStatus(e.target.value)}
                >
                  <option value="CASH_COLLECTED">CASH IN HUB</option>
                  <option value="GPAY_TO_HUB_INCHARGE">GPAY TO INCHARGE</option>
                  <option value="RECONCILED_WITH_WM">PASSED TO WM</option>
                  <option value="NO_CASH_PREPAID">PREPAID / NO CASH</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-ink-600 block mb-0.5">Internal Hub Settlement Notes</label>
              <textarea 
                className="input text-[11px] h-12 p-1.5 resize-none leading-normal font-medium"
                placeholder="Note down cash handover parameters..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>

            <button type="submit" disabled={isSubmitting} className="btn-primary w-full h-7 text-[11px] font-bold justify-center mt-1">
              {isSubmitting ? <RefreshCw className="h-3 w-3 animate-spin" /> : 'Log Handover Record'}
            </button>
          </form>
        </div>

        {/* DATA MATRIX PANEL AREA */}
        <div className="lg:col-span-2 card p-0 border border-ink-200 overflow-hidden bg-white shadow-xs">
          <div className="p-2 border-b border-ink-100 bg-ink-50/40 flex items-center justify-between">
            <div className="relative max-w-xs w-full">
              <Search className="absolute left-2.5 top-2 h-3 w-3 text-ink-400" />
              <input 
                type="text" 
                placeholder="Search manual tracking logs..."
                className="input h-7 pl-7 text-[11px] bg-white border-ink-200 px-2"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="py-12 text-center text-ink-400 text-[11px] flex items-center justify-center gap-1.5">
                <RefreshCw className="h-3 w-3 animate-spin text-brand-600" /> Querying active registry lists...
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="py-12 text-center text-ink-400 text-[11px] italic">No active manual shipments matching search queries.</div>
            ) : (
              <table className="w-full border-collapse text-left text-[11px]">
                <thead>
                  <tr className="bg-ink-50 text-ink-700 font-bold border-b border-ink-100 uppercase text-[9px] tracking-wider select-none">
                    <th className="p-2.5">Tracking ID</th>
                    <th className="p-2.5">Customer Phone</th>
                    <th className="p-2.5">Handover Status</th>
                    <th className="p-2.5">Cash Position</th>
                    <th className="p-2.5">Notes</th>
                    <th className="p-2.5 text-center w-40">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {filteredRecords.map(item => (
                    <tr key={item.id} className="hover:bg-ink-50/30 transition-colors">
                      <td className="p-2.5 font-mono font-bold text-ink-900 uppercase tracking-wide">{item.tracking_id}</td>
                      <td className="p-2.5 font-mono font-medium text-ink-600">{item.customer_phone}</td>
                      <td className="p-2.5">
                        <span className={`px-1.5 py-0.5 rounded border text-[9px] font-mono font-bold uppercase ${
                          item.delivery_status === 'ERP_CLEARED_DELIVERED'
                            ? 'bg-blue-50 border-blue-200 text-blue-700 font-black'
                            : item.delivery_status === 'CANCELLED_DELAYED' 
                            ? 'bg-rose-50 border-rose-200 text-rose-700' 
                            : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        }`}>
                          {item.delivery_status === 'ERP_CLEARED_DELIVERED' 
                            ? 'ERP CLEARED' 
                            : item.delivery_status === 'CANCELLED_DELAYED' 
                            ? 'CANCELLED' 
                            : 'DELIVERED'}
                        </span>
                      </td>
                      <td className="p-2.5">
                        <span className={`px-1.5 py-0.5 rounded border text-[9px] font-mono font-bold uppercase tracking-tight flex items-center gap-0.5 max-w-max ${
                          item.cash_status === 'RECONCILED_WITH_WM' 
                            ? 'bg-blue-50 border-blue-200 text-blue-700' 
                            : item.cash_status === 'GPAY_TO_HUB_INCHARGE'
                            ? 'bg-purple-50 border-purple-200 text-purple-700 font-extrabold'
                            : item.cash_status === 'NO_CASH_PREPAID' 
                            ? 'bg-ink-100 border-ink-200 text-ink-600'
                            : 'bg-amber-50 border-amber-200 text-amber-700 font-black animate-pulse'
                        }`}>
                          {item.cash_status === 'GPAY_TO_HUB_INCHARGE' && <Smartphone className="h-2.5 w-2.5" />}
                          {item.cash_status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="p-2.5 text-ink-500 max-w-[120px] truncate italic text-[10px]" title={item.notes}>
                        {item.notes || '—'}
                      </td>
                      <td className="p-2.5">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Financial Switcher */}
                          <button
                            onClick={() => toggleCashSettlement(item.id, item.cash_status)}
                            className="p-1 rounded bg-ink-50 border border-ink-200 text-ink-600 hover:text-brand-600 hover:bg-brand-50 transition-all"
                            title="Cycle Financial Settlement Status"
                            disabled={item.delivery_status === 'ERP_CLEARED_DELIVERED'}
                          >
                            <CheckCircle className="h-3 w-3" />
                          </button>

                          {/* ERP Clear Status Tracker */}
                          {item.delivery_status !== 'ERP_CLEARED_DELIVERED' && (
                            <button
                              onClick={() => handleMarkErpCleared(item)}
                              className="p-1 rounded bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-600 hover:text-white transition-all"
                              title="Mark as Cleared on Main ERP Portal"
                            >
                              <CheckSquare className="h-3 w-3" />
                            </button>
                          )}

                          {/* NEW: Permanent Row Delete Option Button */}
                          <button
                            onClick={() => handleDeleteRecord(item)}
                            className="p-1 rounded bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-600 hover:text-white transition-all"
                            title="Delete Record Permanently"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>

                          <span className="text-ink-200 select-none">|</span>

                          {/* Cross-Sync Escalation Area */}
                          <button
                            onClick={() => handleCrossSyncLpLoss(item)}
                            className="flex items-center gap-0.5 bg-red-600 text-white hover:bg-red-700 text-[9px] font-black uppercase px-1.5 py-0.5 rounded shadow-3xs transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Sync to primary LP Tracker logs table"
                            disabled={isSyncingId === item.id || item.delivery_status === 'ERP_CLEARED_DELIVERED'}
                          >
                            {isSyncingId === item.id ? (
                              <RefreshCw className="h-2 w-2 animate-spin" />
                            ) : (
                              <>
                                <ShieldAlert className="h-2.5 w-2.5" /> Loss
                              </>
                            )}
                          </button>
                        </div>
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