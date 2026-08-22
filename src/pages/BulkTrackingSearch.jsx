import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../lib/useToast';

export default function BulkTrackingSearch() {
  const toastHook = typeof useToast === 'function' ? useToast() : null;

  const showToast = (message, type = 'info') => {
    if (typeof toastHook === 'function') {
      toastHook(message, type);
    } else if (typeof toastHook?.showToast === 'function') {
      toastHook.showToast(message, type);
    } else if (typeof toastHook?.toast === 'function') {
      toastHook.toast(message, type);
    } else if (typeof toastHook?.addToast === 'function') {
      toastHook.addToast({ message, type });
    } else {
      if (type === 'error') console.error(message);
      alert(message);
    }
  };

  // Active Mode: 'bulk' | 'single'
  const [searchMode, setSearchMode] = useState('bulk');

  // Single Search State
  const [singleQuery, setSingleQuery] = useState('');
  const [isSearchingSingle, setIsSearchingSingle] = useState(false);
  const [singleResult, setSingleResult] = useState(null);
  const [singleSearched, setSingleSearched] = useState(false);

  // Bulk Search State
  const [rawInput, setRawInput] = useState('');
  const [isSearchingBulk, setIsSearchingBulk] = useState(false);
  const [results, setResults] = useState([]);
  const [filterType, setFilterType] = useState('all'); // 'all' | 'found' | 'loss' | 'not_found'

  // Helper: Query ONLY Dedicated Loss Ledger table
  const queryDedicatedLossLedger = async (trackingIds = []) => {
    const matchedLossMap = new Map();
    if (!trackingIds || trackingIds.length === 0) return matchedLossMap;

    const normalizedTargetIds = new Set(
      trackingIds.map((id) => id.trim().toLowerCase())
    );

    // 1. Query dedicated loss_ledger table
    try {
      const { data, error } = await supabase
        .from('loss_ledger')
        .select('*')
        .in('tracking_id', trackingIds);

      if (!error && Array.isArray(data)) {
        data.forEach((row) => {
          const tid = (row.tracking_id || '').trim().toLowerCase();
          if (tid && normalizedTargetIds.has(tid)) {
            matchedLossMap.set(tid, {
              trackingId: row.tracking_id,
              reason: row.details || 'Loss Reported / Mailed',
              date: row.resolved_at?.split('T')[0] || row.created_at?.split('T')[0] || '-',
              wmVendor: row.wishmaster_name || '-',
              isExplicitLoss: true,
              status: 'LOSS / LOSS MAILED',
              agingDays: row.aging_days ?? '-',
              priority: row.priority || 'CRITICAL',
            });
          }
        });
      }
    } catch (e) {
      console.warn('Dedicated loss_ledger query notice:', e);
    }

    // 2. Query legacy wm_loss_records if present
    try {
      const { data, error } = await supabase
        .from('wm_loss_records')
        .select('*')
        .in('tracking_id', trackingIds);

      if (!error && Array.isArray(data)) {
        data.forEach((row) => {
          const tid = (row.tracking_id || '').trim().toLowerCase();
          if (tid && !matchedLossMap.has(tid)) {
            matchedLossMap.set(tid, {
              trackingId: row.tracking_id,
              reason: row.reason || 'Loss Reported',
              date: row.date || row.created_at?.split('T')[0] || '-',
              wmVendor: row.wm_name || row.vendor || '-',
              isExplicitLoss: true,
              status: 'LOSS / LOSS MAILED',
              agingDays: '-',
              priority: 'CRITICAL',
            });
          }
        });
      }
    } catch (e) {
      // Ignored
    }

    return matchedLossMap;
  };

  // 1. Single Tracking ID Search
  const handleSingleSearch = async (e) => {
    e?.preventDefault();
    const cleanId = singleQuery.trim();
    if (!cleanId) return;

    setIsSearchingSingle(true);
    setSingleSearched(true);
    setSingleResult(null);

    try {
      // Query Loss Ledger sources ONLY (never treats pending lp_tracker as loss or bagged)
      const lossMap = await queryDedicatedLossLedger([cleanId]);
      const lossFound = lossMap.get(cleanId.toLowerCase());

      // Query Bagged Items table
      const { data: bagData } = await supabase
        .from('bagged_items')
        .select(`
          id,
          tracking_id,
          bg_tracking_id,
          bag_id,
          category,
          status,
          created_at,
          bag_sessions (
            id,
            session_date,
            title,
            status,
            notes
          ),
          dispatch_bags (
            id,
            destination,
            seal_number,
            status
          )
        `)
        .ilike('tracking_id', cleanId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lossFound || bagData) {
        const isLoss = !!lossFound;
        const bagType = bagData?.dispatch_bags?.destination === 'missroute' ? 'Missroute' : 'TRO';

        setSingleResult({
          trackingId: cleanId,
          isLoss,
          isBagged: !!bagData,
          status: isLoss
            ? 'LOSS / LOSS MAILED'
            : 'BAGGED / FOUND',
          bgTrackingId: bagData?.bg_tracking_id || '-',
          bagType: isLoss ? 'LOSS' : bagType,
          sessionDate: isLoss ? lossFound.date : (bagData?.bag_sessions?.session_date || '-'),
          sessionTitle: isLoss ? `Loss Ledger (${lossFound.wmVendor})` : (bagData?.bag_sessions?.title || '-'),
          category: bagData?.category || 'SUR/SURF',
          lossReason: lossFound?.reason || '-',
          wmVendor: lossFound?.wmVendor || '-',
          agingDays: lossFound?.agingDays || '-',
        });

        if (isLoss) {
          showToast(`⚠️ TID ${cleanId} found in LOSS LEDGER!`, 'error');
        } else {
          showToast(`✓ TID ${cleanId} found in active bag dispatch`, 'success');
        }
      } else {
        setSingleResult(null);
        showToast(`No record found for ${cleanId}`, 'info');
      }
    } catch (err) {
      console.error('Single search error:', err);
      showToast(err.message || 'Single search failed', 'error');
    } finally {
      setIsSearchingSingle(false);
    }
  };

  // 2. Bulk Tracking ID Search & Audit
  const handleBulkSearch = async (e) => {
    e?.preventDefault();
    if (!rawInput.trim()) return;

    setIsSearchingBulk(true);
    try {
      const inputList = rawInput
        .split(/[\r\n,]+/)
        .map((id) => id.trim())
        .filter(Boolean);

      if (inputList.length === 0) {
        showToast('Please enter at least one tracking ID.', 'error');
        setIsSearchingBulk(false);
        return;
      }

      const uniqueLookupSet = Array.from(new Set(inputList));
      const chunkSize = 500;
      let fetchedBagged = [];

      // Query Bagged Items in chunks
      for (let i = 0; i < uniqueLookupSet.length; i += chunkSize) {
        const chunk = uniqueLookupSet.slice(i, i + chunkSize);

        const { data: bagData } = await supabase
          .from('bagged_items')
          .select(`
            id,
            tracking_id,
            bg_tracking_id,
            bag_id,
            category,
            status,
            created_at,
            bag_sessions (
              id,
              session_date,
              title,
              status
            ),
            dispatch_bags (
              destination
            )
          `)
          .in('tracking_id', chunk);

        if (bagData) fetchedBagged = fetchedBagged.concat(bagData);
      }

      // Query Dedicated Loss Ledger table
      const lossMap = await queryDedicatedLossLedger(uniqueLookupSet);

      // Index Bagged Items by lowercase TID
      const bagMap = new Map();
      fetchedBagged.forEach((item) => {
        const key = item.tracking_id.toLowerCase().trim();
        if (!bagMap.has(key)) bagMap.set(key, item);
      });

      // Assemble results preserving exact pasted order
      const orderedOutput = inputList.map((trackingId, idx) => {
        const key = trackingId.toLowerCase().trim();
        const bagMatch = bagMap.get(key);
        const lossMatch = lossMap.get(key);

        if (lossMatch) {
          return {
            index: idx + 1,
            trackingId,
            status: 'LOSS / LOSS MAILED',
            isLoss: true,
            isFound: false,
            bgTrackingId: bagMatch?.bg_tracking_id || '-',
            bagId: bagMatch?.bag_id || '-',
            bagType: 'LOSS',
            sessionDate: lossMatch.date || '-',
            sessionTitle: lossMatch.wmVendor !== '-' ? `Loss (${lossMatch.wmVendor})` : 'Loss Ledger Record',
            category: bagMatch?.category || 'SUR/SURF',
            lossReason: lossMatch.reason || 'Loss reported',
          };
        } else if (bagMatch) {
          const bagType = bagMatch.dispatch_bags?.destination === 'missroute' ? 'Missroute' : 'TRO';
          return {
            index: idx + 1,
            trackingId,
            status: 'BAGGED / FOUND',
            isLoss: false,
            isFound: true,
            bgTrackingId: bagMatch.bg_tracking_id || 'N/A',
            bagId: bagMatch.bag_id || 'N/A',
            bagType,
            sessionDate: bagMatch.bag_sessions?.session_date || 'N/A',
            sessionTitle: bagMatch.bag_sessions?.title || 'N/A',
            category: bagMatch.category || 'SUR/SURF',
            lossReason: '-',
          };
        } else {
          return {
            index: idx + 1,
            trackingId,
            status: 'NO RECORD FOUND',
            isLoss: false,
            isFound: false,
            bgTrackingId: '-',
            bagId: '-',
            bagType: '-',
            sessionDate: '-',
            sessionTitle: '-',
            category: '-',
            lossReason: '-',
          };
        }
      });

      setResults(orderedOutput);
      const lossTotal = orderedOutput.filter((r) => r.isLoss).length;
      const foundTotal = orderedOutput.filter((r) => r.isFound).length;
      const missingTotal = orderedOutput.filter((r) => !r.isFound && !r.isLoss).length;

      showToast(
        `Audit Complete: ${foundTotal} Bagged, ${lossTotal} Loss Ledger, ${missingTotal} No Record`,
        'info'
      );
    } catch (err) {
      console.error('Bulk search error:', err);
      showToast(err.message || 'Bulk audit failed', 'error');
    } finally {
      setIsSearchingBulk(false);
    }
  };

  const displayedResults = results.filter((item) => {
    if (filterType === 'found') return item.isFound;
    if (filterType === 'loss') return item.isLoss;
    if (filterType === 'not_found') return !item.isFound && !item.isLoss;
    return true;
  });

  const exportToCSV = () => {
    if (results.length === 0) return;

    const headers = [
      'Original Sequence',
      'Tracking ID',
      'Result Status',
      'BG Tracking ID',
      'Classification',
      'Date',
      'Session / Loss Info',
      'Loss Reason',
      'Category',
    ];

    const rows = results.map((r) => [
      r.index,
      `"${r.trackingId}"`,
      `"${r.status}"`,
      `"${r.bgTrackingId}"`,
      `"${r.bagType}"`,
      `"${r.sessionDate}"`,
      `"${r.sessionTitle}"`,
      `"${r.lossReason}"`,
      `"${r.category}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csvContent);
    link.download = `Tracking_Audit_Report_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyResultsTable = () => {
    if (results.length === 0) return;
    const lines = results.map(
      (r) => `${r.trackingId}\t${r.status}\t${r.bgTrackingId}\t${r.sessionDate}\t${r.bagType}\t${r.lossReason}`
    );
    navigator.clipboard.writeText(
      `Tracking ID\tStatus\tBG Tracking ID\tDate\tType\tLoss Reason\n${lines.join('\n')}`
    );
    showToast('Copied audit results to clipboard!', 'success');
  };

  const foundCount = results.filter((r) => r.isFound).length;
  const lossCount = results.filter((r) => r.isLoss).length;
  const notFoundCount = results.filter((r) => !r.isFound && !r.isLoss).length;

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-5 space-y-4 text-xs">
      {/* Header & Mode Switcher */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-3 gap-2">
        <div className="flex items-center gap-2">
          <span className="p-1.5 bg-indigo-600 text-white rounded-md shadow-2xs">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
            </svg>
          </span>
          <div>
            <h1 className="text-base sm:text-lg font-black text-gray-900 tracking-tight leading-none">
              Shipment Tracking Auditor
            </h1>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Audits against <b>Bagging Dispatch Sessions</b> and the dedicated <b>Loss Ledger</b>.
            </p>
          </div>
        </div>

        <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200 w-full sm:w-auto">
          <button
            onClick={() => setSearchMode('bulk')}
            className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
              searchMode === 'bulk' ? 'bg-white text-indigo-600 shadow-2xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            📋 Bulk Audit
          </button>
          <button
            onClick={() => setSearchMode('single')}
            className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
              searchMode === 'single' ? 'bg-white text-indigo-600 shadow-2xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            🔍 Single TID Lookup
          </button>
        </div>
      </div>

      {/* SINGLE SEARCH */}
      {searchMode === 'single' && (
        <div className="max-w-3xl mx-auto space-y-4 pt-2">
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs space-y-3">
            <h2 className="text-sm font-bold text-gray-900">Single Tracking ID Lookup</h2>
            <form onSubmit={handleSingleSearch} className="flex gap-2">
              <input
                type="text"
                placeholder="Scan barcode or enter exact Tracking ID (e.g. MYSC1329788722)..."
                value={singleQuery}
                onChange={(e) => setSingleQuery(e.target.value)}
                className="flex-1 text-xs font-mono border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500"
                autoFocus
                required
              />
              <button
                type="submit"
                disabled={isSearchingSingle || !singleQuery.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs px-5 py-2 rounded-lg shadow-xs transition"
              >
                {isSearchingSingle ? 'Checking...' : 'Inspect ID'}
              </button>
            </form>
          </div>

          {singleSearched && (
            <div>
              {singleResult ? (
                <div
                  className={`bg-white rounded-xl border shadow-xs overflow-hidden ${
                    singleResult.isLoss ? 'border-amber-300' : 'border-emerald-200'
                  }`}
                >
                  <div
                    className={`px-4 py-3 border-b flex justify-between items-center ${
                      singleResult.isLoss ? 'bg-amber-500 text-white' : 'bg-emerald-50 text-emerald-900'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs uppercase tracking-wider">
                        {singleResult.isLoss ? '⚠️ LOSS / LOSS MAILED' : '✓ BAGGED / FOUND RECORD'}
                      </span>
                    </div>
                    <span
                      className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded ${
                        singleResult.isLoss
                          ? 'bg-amber-900 text-amber-100'
                          : singleResult.bagType === 'Missroute'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {singleResult.isLoss ? 'Loss Record' : `${singleResult.bagType} Bag`}
                    </span>
                  </div>

                  <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3.5 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-gray-400">Tracking ID</span>
                      <p className="font-mono text-sm font-black text-indigo-700 mt-0.5 truncate">
                        {singleResult.trackingId}
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-gray-400">BG Tracking ID</span>
                      <p className="font-mono text-xs font-black text-emerald-800 mt-0.5 truncate">
                        {singleResult.bgTrackingId}
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-gray-400">Category</span>
                      <p className="font-semibold text-gray-800 mt-0.5">{singleResult.category}</p>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-gray-400">Date</span>
                      <p className="font-semibold text-gray-800 mt-0.5">{singleResult.sessionDate}</p>
                    </div>

                    {singleResult.isLoss ? (
                      <>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-amber-700">Loss Reason</span>
                          <p className="font-semibold text-amber-900 mt-0.5 truncate">{singleResult.lossReason}</p>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-amber-700">Wishmaster / Vendor</span>
                          <p className="font-semibold text-amber-900 mt-0.5 truncate">{singleResult.wmVendor}</p>
                        </div>
                      </>
                    ) : (
                      <div className="sm:col-span-2">
                        <span className="text-[10px] uppercase font-bold text-gray-400">Session Title</span>
                        <p className="font-semibold text-gray-800 mt-0.5 truncate">{singleResult.sessionTitle}</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-rose-200 p-8 text-center space-y-1.5">
                  <span className="inline-block bg-rose-100 text-rose-700 px-3 py-1 rounded-full text-xs font-bold">
                    ✕ NO RECORD FOUND
                  </span>
                  <p className="text-xs text-gray-500 font-mono">
                    Tracking ID <b>"{singleQuery}"</b> was not found in active dispatch bags or the Loss Ledger.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* BULK SEARCH */}
      {searchMode === 'bulk' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Paste Tracking IDs</h2>
              {rawInput && (
                <button
                  onClick={() => setRawInput('')}
                  className="text-[10px] text-red-500 hover:text-red-700 underline"
                >
                  Clear
                </button>
              )}
            </div>

            <form onSubmit={handleBulkSearch} className="space-y-3">
              <textarea
                rows={16}
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                placeholder="Paste list of Tracking IDs (one per line):&#10;MYSC1329788722&#10;FMPR0948731452&#10;FMPC6355741453&#10;MYEC1115211455..."
                className="w-full text-[11px] font-mono border border-gray-300 rounded-lg p-2.5 focus:border-indigo-500 focus:outline-none bg-gray-50/50"
                required
              />

              <button
                type="submit"
                disabled={isSearchingBulk || !rawInput.trim()}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs py-2 rounded-lg shadow-xs transition flex items-center justify-center gap-1.5"
              >
                <span>{isSearchingBulk ? 'Auditing Database...' : '🔍 Check All Tracking IDs'}</span>
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 space-y-3">
            {/* Metric Overview */}
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-white p-2.5 rounded-lg border border-gray-200 shadow-2xs">
                <span className="text-[10px] font-bold uppercase text-gray-400">Total Checked</span>
                <p className="text-base font-black text-gray-900 mt-0.5">{results.length}</p>
              </div>
              <div className="bg-emerald-50/60 p-2.5 rounded-lg border border-emerald-200 shadow-2xs">
                <span className="text-[10px] font-bold uppercase text-emerald-600">Bagged / Found</span>
                <p className="text-base font-black text-emerald-700 mt-0.5">{foundCount}</p>
              </div>
              <div className="bg-amber-50/70 p-2.5 rounded-lg border border-amber-300 shadow-2xs">
                <span className="text-[10px] font-bold uppercase text-amber-700">Loss Ledger</span>
                <p className="text-base font-black text-amber-800 mt-0.5">{lossCount}</p>
              </div>
              <div className="bg-rose-50/60 p-2.5 rounded-lg border border-rose-200 shadow-2xs">
                <span className="text-[10px] font-bold uppercase text-rose-600">No Record</span>
                <p className="text-base font-black text-rose-700 mt-0.5">{notFoundCount}</p>
              </div>
            </div>

            {/* Results Table Card */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
              <div className="p-2.5 bg-gray-50/80 border-b flex flex-wrap justify-between items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-gray-900 text-xs">Audit Results</span>
                  <span className="text-[10px] bg-gray-200 text-gray-700 px-1.5 py-0.2 rounded font-mono">
                    {displayedResults.length} / {results.length}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <div className="flex bg-gray-200/80 p-0.5 rounded border border-gray-300">
                    <button
                      onClick={() => setFilterType('all')}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded transition ${
                        filterType === 'all' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-600'
                      }`}
                    >
                      All ({results.length})
                    </button>
                    <button
                      onClick={() => setFilterType('found')}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded transition ${
                        filterType === 'found' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-emerald-700'
                      }`}
                    >
                      Found ({foundCount})
                    </button>
                    <button
                      onClick={() => setFilterType('loss')}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded transition ${
                        filterType === 'loss' ? 'bg-amber-500 text-white shadow-2xs' : 'text-amber-800'
                      }`}
                    >
                      Loss ({lossCount})
                    </button>
                    <button
                      onClick={() => setFilterType('not_found')}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded transition ${
                        filterType === 'not_found' ? 'bg-rose-600 text-white shadow-2xs' : 'text-rose-700'
                      }`}
                    >
                      Missing ({notFoundCount})
                    </button>
                  </div>

                  {results.length > 0 && (
                    <>
                      <button
                        onClick={copyResultsTable}
                        className="px-2 py-1 bg-white hover:bg-gray-100 text-gray-700 font-semibold rounded border text-[10px]"
                        title="Copy results to clipboard"
                      >
                        📋 Copy
                      </button>
                      <button
                        onClick={exportToCSV}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-[10px] shadow-2xs"
                      >
                        Export CSV (Pasted Order)
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="max-h-[500px] overflow-y-auto">
                {results.length === 0 ? (
                  <div className="p-12 text-center text-xs text-gray-400 italic">
                    Paste tracking IDs in the left box and click "Check All Tracking IDs" to verify their status.
                  </div>
                ) : displayedResults.length === 0 ? (
                  <div className="p-8 text-center text-xs text-gray-400 italic">
                    No items match the active filter.
                  </div>
                ) : (
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-gray-100/90 border-b text-gray-600 sticky top-0">
                        <th className="py-2 px-3 font-semibold w-12 text-center">#</th>
                        <th className="py-2 px-3 font-semibold">Tracking ID</th>
                        <th className="py-2 px-3 font-semibold">Audit Status</th>
                        <th className="py-2 px-3 font-semibold">BG Tracking ID</th>
                        <th className="py-2 px-3 font-semibold">Classification</th>
                        <th className="py-2 px-3 font-semibold">Date</th>
                        <th className="py-2 px-3 font-semibold">Session / Loss Info</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-sans">
                      {displayedResults.map((row) => (
                        <tr
                          key={`${row.index}-${row.trackingId}`}
                          className={`transition ${
                            row.isLoss
                              ? 'bg-amber-50/50 hover:bg-amber-50'
                              : row.isFound
                              ? 'hover:bg-emerald-50/30'
                              : 'bg-rose-50/20 hover:bg-rose-50/40'
                          }`}
                        >
                          <td className="py-2 px-3 text-center text-gray-400 font-mono text-[10px]">
                            {row.index}
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-gray-900">
                            {row.trackingId}
                          </td>
                          <td className="py-2 px-3">
                            {row.isLoss ? (
                              <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                                <span>⚠️</span> LOSS / LOSS MAILED
                              </span>
                            ) : row.isFound ? (
                              <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <span>✓</span> BAGGED / FOUND
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                                <span>✕</span> NO RECORD FOUND
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-emerald-800">
                            {row.bgTrackingId}
                          </td>
                          <td className="py-2 px-3">
                            {row.bagType !== '-' ? (
                              <span
                                className={`text-[8px] font-extrabold uppercase px-1.5 py-0.2 rounded ${
                                  row.bagType === 'Missroute'
                                    ? 'bg-rose-100 text-rose-800'
                                    : row.bagType === 'LOSS'
                                    ? 'bg-amber-200 text-amber-900 font-black'
                                    : 'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {row.bagType}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-gray-700 font-medium">
                            {row.sessionDate}
                          </td>
                          <td className="py-2 px-3 text-gray-600 truncate max-w-[150px]">
                            {row.isLoss ? row.lossReason : row.sessionTitle}
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
      )}
    </div>
  );
}