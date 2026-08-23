import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../lib/useToast';

// Master deletion / edit passcode set to admin123
const MASTER_DELETE_PASSWORD = import.meta.env.VITE_DELETE_PASSWORD || 'admin123';

export default function BagSessionManager() {
  const toastHook = typeof useToast === 'function' ? useToast() : null;

  const showToast = useCallback(
    (message, type = 'info') => {
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
    },
    [toastHook]
  );

  // Helper: Format YYYY-MM-DD to DD/MM/YYYY (e.g. 28/10/2026)
  const formatToDisplayDate = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // Tabs: 'dashboard' | 'sessions' | 'global_search'
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Sessions & Active Data
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [sessionDetails, setSessionDetails] = useState(null);
  const [selectedBgGroup, setSelectedBgGroup] = useState(null);

  // Expanded session cards tracking for "Show More"
  const [expandedSessions, setExpandedSessions] = useState({});

  // Modals
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isBulkImporting, setIsBulkImporting] = useState(false);
  const [targetBgForImport, setTargetBgForImport] = useState(null);
  const [isMailModalOpen, setIsMailModalOpen] = useState(false);
  const [mailSessionTarget, setMailSessionTarget] = useState(null);

  // Manual Single Bag Creator Modal State
  const [manualBagForm, setManualBagForm] = useState({
    bg_tracking_id: '',
    bag_type: 'tro',
    tids_text: '',
  });
  const [isManualBagModalOpen, setIsManualBagModalOpen] = useState(false);

  // Reusable Confirmation & Password Auth Modal State
  const [confirmModalState, setConfirmModalState] = useState({
    isOpen: false,
    title: '',
    description: '',
    isPasswordRequired: false,
    passwordInput: '',
    error: '',
    confirmButtonText: 'Confirm',
    confirmButtonColor: 'bg-red-600 hover:bg-red-700',
    onConfirm: null,
  });

  // Bag Type State ('tro' | 'missroute' | 'tote')
  const [selectedBagType, setSelectedBagType] = useState('tro');

  // Quick single item scanning inside inspector modal
  const [modalSingleTrackingInput, setModalSingleTrackingInput] = useState('');

  // Form Fields
  const [sessionForm, setSessionForm] = useState({
    session_date: new Date().toISOString().split('T')[0],
    title: '',
    status: 'open',
    notes: '',
  });

  const [rawBulkData, setRawBulkData] = useState('');

  // Mail Modal Configuration Fields
  const [mailSentFrom, setMailSentFrom] = useState('ElasticRunKottakkalODH_KOT');
  const [mailSentTo, setMailSentTo] = useState('MH CJB');

  // Dashboard Filters & Pagination
  const [dashboardFilterDate, setDashboardFilterDate] = useState('');
  const [dashboardFilterStatus, setDashboardFilterStatus] = useState('all');
  const [sessionSearchTerm, setSessionSearchTerm] = useState('');
  const [workspaceBgSearch, setWorkspaceBgSearch] = useState('');
  const [workspaceBagTypeFilter, setWorkspaceBagTypeFilter] = useState('all');
  const [sessionPage, setSessionPage] = useState(1);
  const itemsPerPage = 10;

  // Global Lookup State
  const [globalQuery, setGlobalQuery] = useState('');
  const [globalSearchType, setGlobalSearchType] = useState('bg_tracking_id');
  const [globalResults, setGlobalResults] = useState([]);
  const [isSearchingGlobal, setIsSearchingGlobal] = useState(false);

  const emailTableRef = useRef(null);

  const toggleSessionExpand = (sessionId) => {
    setExpandedSessions((prev) => ({
      ...prev,
      [sessionId]: !prev[sessionId],
    }));
  };

  // Helper: Trigger Confirmation or Password Modal
  const openConfirmModal = ({
    title,
    description,
    isPasswordRequired = false,
    confirmButtonText = 'Confirm',
    confirmButtonColor = 'bg-red-600 hover:bg-red-700',
    onConfirm,
  }) => {
    setConfirmModalState({
      isOpen: true,
      title,
      description,
      isPasswordRequired,
      passwordInput: '',
      error: '',
      confirmButtonText,
      confirmButtonColor,
      onConfirm,
    });
  };

  // Helper: Execute action checking if session is closed
  const requireAuthIfClosed = (sessionObj, title, description, actionCallback) => {
    const isClosed = sessionObj?.status === 'completed' || sessionObj?.status === 'closed';
    if (!isClosed) {
      actionCallback();
      return;
    }

    openConfirmModal({
      title: title || 'Authorized Closed-Session Edit',
      description: description || 'This session is marked as CLOSED. Enter master passcode to proceed with changes.',
      isPasswordRequired: true,
      confirmButtonText: 'Authorize',
      confirmButtonColor: 'bg-indigo-600 hover:bg-indigo-700',
      onConfirm: actionCallback,
    });
  };

  const handleModalSubmit = async () => {
    if (confirmModalState.isPasswordRequired) {
      if (!confirmModalState.passwordInput) {
        setConfirmModalState((prev) => ({ ...prev, error: 'Please enter the authorization passcode.' }));
        return;
      }
      if (confirmModalState.passwordInput !== MASTER_DELETE_PASSWORD) {
        setConfirmModalState((prev) => ({ ...prev, error: 'Incorrect passcode! Access denied.' }));
        return;
      }
    }

    const action = confirmModalState.onConfirm;
    setConfirmModalState({
      isOpen: false,
      title: '',
      description: '',
      isPasswordRequired: false,
      passwordInput: '',
      error: '',
      confirmButtonText: 'Confirm',
      confirmButtonColor: 'bg-red-600 hover:bg-red-700',
      onConfirm: null,
    });

    if (typeof action === 'function') {
      await action();
    }
  };

  // Helper: Group items by unique bg_tracking_id
  const groupItemsByBgTrackingId = (items = []) => {
    const map = {};
    items.forEach((item) => {
      const bgKey = item.bg_tracking_id?.trim() || 'NO-BG-ID';
      if (!map[bgKey]) {
        map[bgKey] = {
          bg_tracking_id: bgKey,
          bag_id_fk: item.bag_id_fk,
          bag_id: item.bag_id,
          category: item.category,
          bag_type: item.bag_type || item.destination || 'tro',
          status: item.status || 'manifested',
          items: [],
        };
      }
      map[bgKey].items.push(item);
    });
    return Object.values(map);
  };

  // 1. Fetch Sessions
  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bag_sessions')
        .select(`
          id,
          session_date,
          title,
          status,
          notes,
          created_at,
          dispatch_bags (
            id,
            bag_id,
            bg_tracking_id,
            destination,
            status,
            bagged_items (
              id,
              session_id,
              bag_id_fk,
              bag_id,
              tracking_id,
              bg_tracking_id,
              category,
              status,
              created_at
            )
          )
        `)
        .order('session_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formatted = (data || []).map((s) => {
        const allItems = [];
        (s.dispatch_bags || []).forEach((b) => {
          (b.bagged_items || []).forEach((item) =>
            allItems.push({
              ...item,
              bag_type: b.destination || 'tro',
            })
          );
        });

        const bgGroups = groupItemsByBgTrackingId(allItems);

        return {
          ...s,
          rawBags: s.dispatch_bags || [],
          bgGroups,
          totalUniqueBgs: bgGroups.length,
          totalPackets: allItems.length,
          allItems,
        };
      });

      setSessions(formatted);

      setSessionDetails((prevSession) => {
        if (!prevSession) return null;
        return formatted.find((s) => s.id === prevSession.id) || null;
      });

      setSelectedBgGroup((prevGroup) => {
        if (!prevGroup) return null;
        for (const s of formatted) {
          const matchedBg = s.bgGroups.find((g) => g.bg_tracking_id === prevGroup.bg_tracking_id);
          if (matchedBg) {
            return {
              ...matchedBg,
              sessionTitle: s.title,
              sessionDate: s.session_date,
              sessionId: s.id,
            };
          }
        }
        return null;
      });
    } catch (err) {
      console.error('Error fetching sessions:', err);
      showToast(err.message || 'Failed to load sessions', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleSelectSession = (session) => {
    setSelectedSessionId(session.id);
    setSessionDetails(session);
    setActiveTab('sessions');
  };

  // 2. Smart Parser
  const parseRawLogisticsData = (text, fallbackBgId = '') => {
    let raw = text.trim();
    const parsed = [];
    const duplicatesInPayload = new Set();
    const seenTrackingIds = new Set();

    if (!raw.includes('\n') && /Remove/i.test(raw)) {
      raw = raw.replace(/Remove/gi, 'Remove\n');
    }

    const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);

    lines.forEach((line) => {
      let trackingId = '';
      let bagId = 'AUTO-BAG';
      let bgTrackingId = fallbackBgId;
      let category = 'SUR/SURF';

      if (/\t+|\s{2,}/.test(line)) {
        const parts = line.split(/\t+|\s{2,}/);
        if (parts.length >= 3) {
          trackingId = parts[0]?.trim();
          bagId = parts[1]?.trim() || 'AUTO-BAG';
          bgTrackingId = parts[2]?.trim() || fallbackBgId;
          category = parts[3]?.trim() || 'SUR/SURF';
        } else if (parts.length === 2) {
          trackingId = parts[0]?.trim();
          bgTrackingId = parts[1]?.trim() || fallbackBgId;
        } else if (parts.length === 1) {
          trackingId = parts[0]?.trim();
        }
      } else {
        const match = line.match(/^([A-Z]{4}\d{10}|[A-Z0-9]{10,16})([0-9]{14,16})?([A-Z0-9\-]+?)(SUR\/SURF|SURF|SUR|N\/A)?(?:Remove)?$/i);
        if (match) {
          trackingId = match[1]?.trim();
          bagId = match[2]?.trim() || 'AUTO-BAG';
          bgTrackingId = match[3]?.trim() || fallbackBgId;
          category = match[4]?.trim() || 'SUR/SURF';
        } else {
          trackingId = line.replace(/Remove/gi, '').trim();
        }
      }

      if (trackingId) {
        if (seenTrackingIds.has(trackingId)) {
          duplicatesInPayload.add(trackingId);
        }
        seenTrackingIds.add(trackingId);

        parsed.push({
          tracking_id: trackingId,
          bag_id: bagId,
          bg_tracking_id: bgTrackingId || 'UNASSIGNED-BG',
          category: category.replace(/Remove/gi, '').trim() || 'SUR/SURF',
          status: 'manifested',
        });
      }
    });

    return { parsed, duplicatesInPayload: Array.from(duplicatesInPayload) };
  };

  // 3. Create Session
  const handleCreateSession = async (e) => {
    e.preventDefault();
    if (!sessionForm.session_date) return;

    setSubmitting(true);
    try {
      const title = sessionForm.title.trim() || `Session - ${formatToDisplayDate(sessionForm.session_date)}`;
      const { data, error } = await supabase
        .from('bag_sessions')
        .insert([
          {
            session_date: sessionForm.session_date,
            title,
            status: sessionForm.status,
            notes: sessionForm.notes.trim(),
          },
        ])
        .select()
        .single();

      if (error) throw error;

      showToast(`Session "${title}" created!`, 'success');
      setSessionForm({
        session_date: new Date().toISOString().split('T')[0],
        title: '',
        status: 'open',
        notes: '',
      });
      setIsCreatingSession(false);
      await fetchSessions();
      handleSelectSession({ ...data, rawBags: [], bgGroups: [], totalUniqueBgs: 0, totalPackets: 0, allItems: [] });
    } catch (err) {
      showToast(err.message || 'Error creating session', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // 4. Toggle Session Status
  const handleToggleSessionStatus = async (sessionId, currentStatus) => {
    const isClosed = currentStatus === 'completed' || currentStatus === 'closed';

    const executeToggle = async () => {
      const nextStatus = isClosed ? 'open' : 'completed';
      try {
        const { error } = await supabase
          .from('bag_sessions')
          .update({ status: nextStatus, updated_at: new Date().toISOString() })
          .eq('id', sessionId);

        if (error) throw error;

        showToast(`Session marked as ${nextStatus === 'open' ? 'reopened' : 'closed'}!`, 'success');
        await fetchSessions();

        if (nextStatus === 'completed') {
          const found = sessions.find((s) => s.id === sessionId);
          if (found) {
            setMailSessionTarget(found);
            setIsMailModalOpen(true);
          }
        }
      } catch (err) {
        showToast(err.message || 'Failed to update session status', 'error');
      }
    };

    if (isClosed) {
      openConfirmModal({
        title: 'Authorize Session Reopen',
        description: 'This session is currently CLOSED. Enter master passcode to reopen it.',
        isPasswordRequired: true,
        confirmButtonText: 'Reopen Session',
        confirmButtonColor: 'bg-emerald-600 hover:bg-emerald-700',
        onConfirm: executeToggle,
      });
    } else {
      openConfirmModal({
        title: 'Close Session',
        description: 'Are you sure you want to close this session and finalize all bagged dispatches?',
        isPasswordRequired: false,
        confirmButtonText: 'Close Session',
        confirmButtonColor: 'bg-amber-600 hover:bg-amber-700',
        onConfirm: executeToggle,
      });
    }
  };

  // 5. Bulk Import
  const handleBulkImport = async (e) => {
    e?.preventDefault();
    if (!sessionDetails) {
      showToast('Select a session first', 'error');
      return;
    }
    if (!rawBulkData.trim()) return;

    const performImport = async () => {
      setSubmitting(true);
      try {
        const { parsed } = parseRawLogisticsData(rawBulkData, targetBgForImport || '');

        if (parsed.length === 0) {
          showToast('No valid tracking lines found.', 'error');
          setSubmitting(false);
          return;
        }

        const bgMap = {};
        parsed.forEach((row) => {
          const bgKey = row.bg_tracking_id;
          if (!bgMap[bgKey]) {
            bgMap[bgKey] = {
              bg_tracking_id: bgKey,
              bag_id: row.bag_id || 'AUTO-BAG',
              items: [],
            };
          }
          bgMap[bgKey].items.push(row);
        });

        let skippedCount = 0;
        let addedCount = 0;

        for (const [bgKey, group] of Object.entries(bgMap)) {
          let existingBag = sessionDetails.rawBags?.find((b) => b.bg_tracking_id === bgKey);
          let bagFkId = existingBag?.id;

          if (!existingBag) {
            const { data: newBag, error: newBagErr } = await supabase
              .from('dispatch_bags')
              .insert([
                {
                  session_id: sessionDetails.id,
                  bag_id: group.bag_id || bgKey,
                  bg_tracking_id: bgKey,
                  destination: selectedBagType,
                  status: 'open',
                },
              ])
              .select()
              .single();

            if (newBagErr) throw newBagErr;
            bagFkId = newBag.id;
          } else if (existingBag.destination !== selectedBagType) {
            await supabase
              .from('dispatch_bags')
              .update({ destination: selectedBagType })
              .eq('id', existingBag.id);
          }

          const currentGroupItems = sessionDetails.bgGroups?.find(
            (g) => g.bg_tracking_id === bgKey
          )?.items || [];
          const existingTrackingIds = new Set(currentGroupItems.map((i) => i.tracking_id));

          const itemsToInsert = [];
          group.items.forEach((item) => {
            if (existingTrackingIds.has(item.tracking_id)) {
              skippedCount++;
            } else {
              existingTrackingIds.add(item.tracking_id);
              itemsToInsert.push({
                session_id: sessionDetails.id,
                bag_id_fk: bagFkId,
                bag_id: item.bag_id || bgKey,
                tracking_id: item.tracking_id,
                bg_tracking_id: bgKey,
                category: item.category || 'SUR/SURF',
                status: 'manifested',
              });
            }
          });

          if (itemsToInsert.length > 0) {
            const { error: itemsErr } = await supabase.from('bagged_items').insert(itemsToInsert);
            if (itemsErr) throw itemsErr;
            addedCount += itemsToInsert.length;
          }
        }

        const bagLabel = selectedBagType === 'tro' ? 'TRO Bags' : selectedBagType === 'missroute' ? 'Missroute Bags' : 'Totes';

        if (skippedCount > 0) {
          showToast(
            `Added ${addedCount} [${selectedBagType.toUpperCase()}] shipments. Skipped ${skippedCount} duplicate(s).`,
            'info'
          );
        } else {
          showToast(
            `Successfully imported ${addedCount} shipments into ${bagLabel}!`,
            'success'
          );
        }

        setRawBulkData('');
        setIsBulkImporting(false);
        setTargetBgForImport(null);
        await fetchSessions();
      } catch (err) {
        console.error('Import error:', err);
        showToast(err.message || 'Import failed', 'error');
      } finally {
        setSubmitting(false);
      }
    };

    requireAuthIfClosed(
      sessionDetails,
      'Authorize Closed-Session Import',
      'This session is currently CLOSED. Enter master passcode to import parcels into it.',
      performImport
    );
  };

  // 6. Manual Add Single Bag / Tote
  const handleCreateManualBag = async (e) => {
    e.preventDefault();
    if (!sessionDetails) {
      showToast('Select a session first', 'error');
      return;
    }

    const customBgId = manualBagForm.bg_tracking_id.trim();
    if (!customBgId) {
      showToast('Please enter a Bag / Tote ID', 'error');
      return;
    }

    const performCreateBag = async () => {
      setSubmitting(true);
      try {
        let existingBag = sessionDetails.rawBags?.find((b) => b.bg_tracking_id === customBgId);
        let bagFkId = existingBag?.id;

        if (!existingBag) {
          const { data: newBag, error: bagErr } = await supabase
            .from('dispatch_bags')
            .insert([
              {
                session_id: sessionDetails.id,
                bag_id: customBgId,
                bg_tracking_id: customBgId,
                destination: manualBagForm.bag_type,
                status: 'open',
              },
            ])
            .select()
            .single();

          if (bagErr) throw bagErr;
          bagFkId = newBag.id;
        } else if (existingBag.destination !== manualBagForm.bag_type) {
          await supabase
            .from('dispatch_bags')
            .update({ destination: manualBagForm.bag_type })
            .eq('id', existingBag.id);
        }

        const rawTids = manualBagForm.tids_text
          .split(/[\r\n,]+/)
          .map((t) => t.trim())
          .filter(Boolean);

        if (rawTids.length > 0) {
          const currentGroupItems = sessionDetails.bgGroups?.find(
            (g) => g.bg_tracking_id === customBgId
          )?.items || [];
          const existingTrackingIds = new Set(currentGroupItems.map((i) => i.tracking_id));

          const itemsToInsert = [];
          let duplicateCount = 0;

          rawTids.forEach((tid) => {
            if (existingTrackingIds.has(tid)) {
              duplicateCount++;
            } else {
              existingTrackingIds.add(tid);
              itemsToInsert.push({
                session_id: sessionDetails.id,
                bag_id_fk: bagFkId,
                bag_id: customBgId,
                tracking_id: tid,
                bg_tracking_id: customBgId,
                category: 'SUR/SURF',
                status: 'manifested',
              });
            }
          });

          if (itemsToInsert.length > 0) {
            const { error: itemsErr } = await supabase.from('bagged_items').insert(itemsToInsert);
            if (itemsErr) throw itemsErr;
          }

          if (duplicateCount > 0) {
            showToast(`Added ${itemsToInsert.length} items. Skipped ${duplicateCount} duplicate(s).`, 'info');
          } else {
            showToast(`Created ${manualBagForm.bag_type.toUpperCase()} ${customBgId} with ${itemsToInsert.length} item(s)!`, 'success');
          }
        } else {
          showToast(`Created ${manualBagForm.bag_type.toUpperCase()} ID ${customBgId} successfully!`, 'success');
        }

        setManualBagForm({ bg_tracking_id: '', bag_type: 'tro', tids_text: '' });
        setIsManualBagModalOpen(false);
        await fetchSessions();
      } catch (err) {
        console.error('Manual bag creation error:', err);
        showToast(err.message || 'Failed to create Bag ID', 'error');
      } finally {
        setSubmitting(false);
      }
    };

    requireAuthIfClosed(
      sessionDetails,
      'Authorize Closed-Session Bag Entry',
      'This session is currently CLOSED. Enter master passcode to add this bag.',
      performCreateBag
    );
  };

  // 7. Single Tracking Item Add inside Inspector
  const handleAddTrackingToCurrentBg = async () => {
    const val = modalSingleTrackingInput.trim();
    if (!val || !selectedBgGroup) return;

    const alreadyExists = selectedBgGroup.items?.some(
      (item) => item.tracking_id.toLowerCase() === val.toLowerCase()
    );

    if (alreadyExists) {
      showToast(`Warning: Tracking ID "${val}" is already inside this bag/tote!`, 'error');
      return;
    }

    const performAdd = async () => {
      try {
        let bagFkId = selectedBgGroup.bag_id_fk;

        if (!bagFkId) {
          const { data: newBag, error: bErr } = await supabase
            .from('dispatch_bags')
            .insert([
              {
                session_id: selectedBgGroup.sessionId || sessionDetails?.id,
                bag_id: selectedBgGroup.bag_id || selectedBgGroup.bg_tracking_id,
                bg_tracking_id: selectedBgGroup.bg_tracking_id,
                destination: selectedBgGroup.bag_type || 'tro',
                status: 'open',
              },
            ])
            .select()
            .single();

          if (bErr) throw bErr;
          bagFkId = newBag.id;
        }

        const { error } = await supabase.from('bagged_items').insert([
          {
            session_id: selectedBgGroup.sessionId || sessionDetails?.id,
            bag_id_fk: bagFkId,
            bag_id: selectedBgGroup.bag_id || selectedBgGroup.bg_tracking_id,
            tracking_id: val,
            bg_tracking_id: selectedBgGroup.bg_tracking_id,
            category: 'SUR/SURF',
            status: 'manifested',
          },
        ]);

        if (error) throw error;

        setModalSingleTrackingInput('');
        showToast(`Added ${val}`, 'success');
        await fetchSessions();
      } catch (err) {
        showToast(err.message || 'Failed to add shipment', 'error');
      }
    };

    requireAuthIfClosed(
      sessionDetails,
      'Authorize Closed-Session Scan',
      'Session is CLOSED. Enter master passcode to add shipment.',
      performAdd
    );
  };

  // 8. Delete Handlers
  const handleDeleteSessionPrompt = (sessionId, sessionTitle) => {
    const performDelete = async () => {
      try {
        const { error } = await supabase.from('bag_sessions').delete().eq('id', sessionId);
        if (error) throw error;

        showToast('Session removed successfully', 'success');
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));

        if (selectedSessionId === sessionId) {
          setSelectedSessionId(null);
          setSessionDetails(null);
        }
      } catch (err) {
        showToast(err.message || 'Failed to delete session', 'error');
        await fetchSessions();
      }
    };

    openConfirmModal({
      title: 'Delete Session',
      description: `Are you sure you want to permanently delete session "${sessionTitle}" and all its bags?`,
      isPasswordRequired: true,
      confirmButtonText: 'Delete Session',
      confirmButtonColor: 'bg-red-600 hover:bg-red-700',
      onConfirm: performDelete,
    });
  };

  const handleDeleteBgGroupPrompt = (bgTrackingId) => {
    const isClosed = sessionDetails?.status === 'completed' || sessionDetails?.status === 'closed';

    const performDeleteBg = async () => {
      try {
        const { error } = await supabase
          .from('bagged_items')
          .delete()
          .eq('session_id', sessionDetails.id)
          .eq('bg_tracking_id', bgTrackingId);

        if (error) throw error;

        showToast(`Bag/Tote ID ${bgTrackingId} deleted`, 'success');

        setSessionDetails((prev) => {
          if (!prev) return null;
          const updatedBgGroups = (prev.bgGroups || []).filter((g) => g.bg_tracking_id !== bgTrackingId);
          return {
            ...prev,
            bgGroups: updatedBgGroups,
            totalUniqueBgs: updatedBgGroups.length,
          };
        });

        if (selectedBgGroup?.bg_tracking_id === bgTrackingId) setSelectedBgGroup(null);
        await fetchSessions();
      } catch (err) {
        showToast(err.message || 'Failed to delete record', 'error');
      }
    };

    openConfirmModal({
      title: 'Delete Bag / Tote',
      description: `Are you sure you want to delete "${bgTrackingId}" and all its recorded shipments?`,
      isPasswordRequired: isClosed,
      confirmButtonText: 'Delete Bag/Tote',
      confirmButtonColor: 'bg-red-600 hover:bg-red-700',
      onConfirm: performDeleteBg,
    });
  };

  const handleDeleteTrackingItemPrompt = (itemId, trackingId) => {
    const isClosed = sessionDetails?.status === 'completed' || sessionDetails?.status === 'closed';

    const performDeleteItem = async () => {
      try {
        const { error } = await supabase.from('bagged_items').delete().eq('id', itemId);
        if (error) throw error;

        showToast('Tracking ID removed', 'success');

        setSelectedBgGroup((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            items: (prev.items || []).filter((i) => i.id !== itemId),
          };
        });

        await fetchSessions();
      } catch (err) {
        showToast(err.message || 'Failed to delete item', 'error');
      }
    };

    openConfirmModal({
      title: 'Delete Tracking ID',
      description: `Are you sure you want to remove shipment "${trackingId}" from this bag?`,
      isPasswordRequired: isClosed,
      confirmButtonText: 'Remove Item',
      confirmButtonColor: 'bg-red-600 hover:bg-red-700',
      onConfirm: performDeleteItem,
    });
  };

  // 9. Global Search
  const handleGlobalSearch = async (e) => {
    e?.preventDefault();
    if (!globalQuery.trim()) return;

    setIsSearchingGlobal(true);
    try {
      const { data, error } = await supabase
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
        .ilike(globalSearchType, `%${globalQuery.trim()}%`)
        .limit(200);

      if (error) throw error;
      setGlobalResults(data || []);
    } catch (err) {
      console.error('Global search error:', err);
      showToast(err.message || 'Global search failed', 'error');
    } finally {
      setIsSearchingGlobal(false);
    }
  };

  // 10. Stats & Filters
  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    let totalSessions = sessions.length;
    let totalBgs = 0;
    let totalTrackingIds = 0;
    let todayBgs = 0;
    let todayTrackingIds = 0;
    let openCount = 0;
    let closedCount = 0;

    sessions.forEach((s) => {
      const isClosed = s.status === 'completed' || s.status === 'closed';
      if (isClosed) closedCount++;
      else openCount++;

      totalBgs += s.totalUniqueBgs || 0;
      totalTrackingIds += s.totalPackets || 0;

      if (s.session_date === todayStr) {
        todayBgs += s.totalUniqueBgs || 0;
        todayTrackingIds += s.totalPackets || 0;
      }
    });

    const avgPerBag = totalBgs > 0 ? (totalTrackingIds / totalBgs).toFixed(1) : 0;

    return {
      totalSessions,
      totalBgs,
      totalTrackingIds,
      todayBags: todayBgs,
      todayTrackingIds,
      openCount,
      closedCount,
      avgPerBag,
    };
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    return sessions.map((s) => {
      const sortedGroups = [...(s.bgGroups || [])].sort((a, b) => {
        if (a.bag_type === 'missroute' && b.bag_type !== 'missroute') return 1;
        if (a.bag_type !== 'missroute' && b.bag_type === 'missroute') return -1;
        return 0;
      });
      return { ...s, bgGroups: sortedGroups };
    }).filter((s) => {
      const matchesDate = dashboardFilterDate ? s.session_date === dashboardFilterDate : true;
      const matchesStatus =
        dashboardFilterStatus === 'all'
          ? true
          : dashboardFilterStatus === 'open'
          ? s.status === 'open'
          : s.status === 'completed' || s.status === 'closed';
      const matchesSearch = sessionSearchTerm
        ? s.title?.toLowerCase().includes(sessionSearchTerm.toLowerCase()) ||
          s.bgGroups?.some((b) => b.bg_tracking_id?.toLowerCase().includes(sessionSearchTerm.toLowerCase()))
        : true;
      return matchesDate && matchesStatus && matchesSearch;
    });
  }, [sessions, dashboardFilterDate, dashboardFilterStatus, sessionSearchTerm]);

  const paginatedSessions = useMemo(() => {
    const start = (sessionPage - 1) * itemsPerPage;
    return filteredSessions.slice(start, start + itemsPerPage);
  }, [filteredSessions, sessionPage]);

  // Session Workspace filtered and always sorted with Missroute bags at the bottom
  const filteredWorkspaceBgs = useMemo(() => {
    if (!sessionDetails?.bgGroups) return [];
    return sessionDetails.bgGroups
      .filter((g) => {
        const matchesSearch = workspaceBgSearch.trim()
          ? g.bg_tracking_id?.toLowerCase().includes(workspaceBgSearch.toLowerCase())
          : true;
        const matchesType =
          workspaceBagTypeFilter === 'all' ? true : g.bag_type === workspaceBagTypeFilter;
        return matchesSearch && matchesType;
      })
      .sort((a, b) => {
        if (a.bag_type === 'missroute' && b.bag_type !== 'missroute') return 1;
        if (a.bag_type !== 'missroute' && b.bag_type === 'missroute') return -1;
        return 0;
      });
  }, [sessionDetails, workspaceBgSearch, workspaceBagTypeFilter]);

  // 11. Copy Rich Mailable HTML & Text Format to Clipboard
  const copyFormattedMail = () => {
    if (!emailTableRef.current) return;

    try {
      const htmlContent = emailTableRef.current.innerHTML;
      const plainText = emailTableRef.current.innerText;

      if (navigator.clipboard && window.ClipboardItem) {
        const blobHtml = new Blob([htmlContent], { type: 'text/html' });
        const blobText = new Blob([plainText], { type: 'text/plain' });
        const data = [new window.ClipboardItem({ 'text/html': blobHtml, 'text/plain': blobText })];

        navigator.clipboard.write(data).then(() => {
          showToast('Dispatch mail table copied with styles! Ready to paste in Gmail.', 'success');
        });
      } else {
        navigator.clipboard.writeText(plainText);
        showToast('Table text copied to clipboard!', 'success');
      }
    } catch (e) {
      console.error(e);
      showToast('Error copying formatted mail', 'error');
    }
  };

  const exportSessionCSV = (session) => {
    if (!session || !session.allItems) return;

    const headers = ['Session Date', 'Session Title', 'Bag Type', 'BG Tracking ID', 'Tracking ID', 'Category', 'Status'];
    const rows = session.allItems.map((item) => [
      formatToDisplayDate(session.session_date),
      `"${session.title}"`,
      (item.bag_type || 'tro').toUpperCase(),
      item.bg_tracking_id || 'N/A',
      item.tracking_id,
      item.category || 'SUR/SURF',
      item.status || 'manifested',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csvContent);
    link.download = `Dispatch_${formatToDisplayDate(session.session_date).replace(/\//g, '-')}_${session.title.replace(/\s+/g, '_')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-4 space-y-4 text-xs">
      {/* Top Application Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-2.5 gap-2">
        <div className="flex items-center gap-2">
          <span className="p-1.5 bg-indigo-600 text-white rounded-md shadow-2xs">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </span>
          <div>
            <h1 className="text-base sm:text-lg font-black text-gray-900 tracking-tight leading-none">
              Logistics Dispatch Hub
            </h1>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Unique BG Tracking ID management, TRO, Missroute & Tote categorization, and mailable dispatch reports.
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex-1 sm:flex-none px-3 py-1 text-[11px] font-bold rounded-md transition-all ${
              activeTab === 'dashboard' ? 'bg-white text-indigo-600 shadow-2xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('sessions')}
            className={`flex-1 sm:flex-none px-3 py-1 text-[11px] font-bold rounded-md transition-all ${
              activeTab === 'sessions' ? 'bg-white text-indigo-600 shadow-2xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Session Workspace {sessionDetails && `(${sessionDetails.bgGroups?.length || 0} Bags/Totes)`}
          </button>
          <button
            onClick={() => setActiveTab('global_search')}
            className={`flex-1 sm:flex-none px-3 py-1 text-[11px] font-bold rounded-md transition-all ${
              activeTab === 'global_search' ? 'bg-white text-indigo-600 shadow-2xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Global Lookup
          </button>
        </div>
      </div>

      {/* TAB 1: DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
            <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase text-gray-400">Total Sessions</span>
              <p className="text-lg font-black text-gray-900 mt-0.5">{stats.totalSessions}</p>
              <span className="text-[9px] text-emerald-600 font-semibold">{stats.openCount} Open</span>
            </div>
            <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase text-indigo-500">Unique Bags/Totes</span>
              <p className="text-lg font-black text-indigo-600 mt-0.5">{stats.totalBgs}</p>
              <span className="text-[9px] text-gray-400 font-medium">~{stats.avgPerBag} pkts/bg</span>
            </div>
            <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase text-emerald-500">Total Shipments</span>
              <p className="text-lg font-black text-emerald-600 mt-0.5">{stats.totalTrackingIds}</p>
              <span className="text-[9px] text-indigo-500 font-semibold">Active Parcels</span>
            </div>
            <div className="bg-gradient-to-br from-indigo-50 to-white p-3 rounded-lg border border-indigo-100 shadow-2xs">
              <span className="text-[10px] font-bold uppercase text-indigo-600">Today's Bags/Totes</span>
              <p className="text-lg font-black text-indigo-900 mt-0.5">{stats.todayBags}</p>
              <span className="text-[9px] text-indigo-400 font-medium">Daily Outward</span>
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-white p-3 rounded-lg border border-emerald-100 shadow-2xs">
              <span className="text-[10px] font-bold uppercase text-emerald-600">Today's Shipments</span>
              <p className="text-lg font-black text-emerald-900 mt-0.5">{stats.todayTrackingIds}</p>
              <span className="text-[9px] text-emerald-500 font-medium">Dispatched Today</span>
            </div>
            <div className="bg-gradient-to-br from-gray-50 to-white p-3 rounded-lg border border-gray-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase text-gray-500">Closed Shifts</span>
              <p className="text-lg font-black text-gray-800 mt-0.5">{stats.closedCount}</p>
              <span className="text-[9px] text-gray-400 font-medium">Archived Sessions</span>
            </div>
          </div>

          <div className="bg-white p-2.5 rounded-lg border border-gray-200 shadow-2xs flex flex-col sm:flex-row justify-between gap-2 items-center">
            <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
              <input
                type="date"
                value={dashboardFilterDate}
                onChange={(e) => {
                  setDashboardFilterDate(e.target.value);
                  setSessionPage(1);
                }}
                className="text-[11px] border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-indigo-500"
              />

              <div className="flex bg-gray-100 p-0.5 rounded border border-gray-200">
                <button
                  onClick={() => {
                    setDashboardFilterStatus('all');
                    setSessionPage(1);
                  }}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                    dashboardFilterStatus === 'all' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500'
                  }`}
                >
                  All ({stats.totalSessions})
                </button>
                <button
                  onClick={() => {
                    setDashboardFilterStatus('open');
                    setSessionPage(1);
                  }}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                    dashboardFilterStatus === 'open' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-emerald-700'
                  }`}
                >
                  Open ({stats.openCount})
                </button>
                <button
                  onClick={() => {
                    setDashboardFilterStatus('completed');
                    setSessionPage(1);
                  }}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                    dashboardFilterStatus === 'completed' ? 'bg-gray-700 text-white shadow-2xs' : 'text-gray-600'
                  }`}
                >
                  Closed ({stats.closedCount})
                </button>
              </div>

              {dashboardFilterDate && (
                <button
                  onClick={() => setDashboardFilterDate('')}
                  className="text-[10px] text-gray-500 hover:text-gray-800 underline"
                >
                  Clear Date
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <input
                type="text"
                placeholder="Search title, date, BG ID..."
                value={sessionSearchTerm}
                onChange={(e) => {
                  setSessionSearchTerm(e.target.value);
                  setSessionPage(1);
                }}
                className="text-[11px] border border-gray-300 rounded px-2.5 py-1 w-full sm:w-56 focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={() => setIsCreatingSession(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] px-2.5 py-1 rounded whitespace-nowrap shadow-2xs"
              >
                + New Session
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {loading ? (
              <div className="p-8 text-center text-xs text-gray-400 bg-white rounded-lg border">
                Loading dispatch sessions...
              </div>
            ) : paginatedSessions.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400 bg-white rounded-lg border border-dashed">
                No sessions match the selected filters.
              </div>
            ) : (
              paginatedSessions.map((session) => {
                const isClosed = session.status === 'completed' || session.status === 'closed';
                const isExpanded = !!expandedSessions[session.id];
                const bgList = session.bgGroups || [];

                return (
                  <div
                    key={session.id}
                    className={`rounded-lg border transition-all overflow-hidden ${
                      isClosed
                        ? 'bg-gray-50/70 border-gray-300 opacity-65 grayscale-25 hover:opacity-90'
                        : 'bg-white border-gray-200 shadow-2xs hover:border-gray-300'
                    }`}
                  >
                    <div className="px-3 py-2 bg-gray-50/90 border-b flex flex-wrap justify-between items-center gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          {isClosed && (
                            <span className="text-[9px] bg-gray-600 text-white px-1.5 py-0.2 rounded font-bold uppercase tracking-wider">
                              🔒 Closed
                            </span>
                          )}
                          <span className="font-bold text-gray-900 text-xs">{session.title}</span>
                          <span className="text-[10px] font-mono bg-white px-1.5 py-0.5 rounded border border-gray-200 text-gray-700">
                            {formatToDisplayDate(session.session_date)}
                          </span>
                          <span
                            className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded-full ${
                              isClosed
                                ? 'bg-gray-200 text-gray-700'
                                : session.status === 'dispatched'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {isClosed ? 'Completed' : session.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          <span className="font-semibold text-indigo-600">{session.totalUniqueBgs} Unique Bags/Totes</span> •{' '}
                          <span className="font-semibold text-emerald-600">{session.totalPackets} Total Shipments</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {bgList.length > 6 && (
                          <button
                            onClick={() => toggleSessionExpand(session.id)}
                            className="px-2 py-1 bg-white hover:bg-gray-100 text-gray-700 text-[10px] font-bold rounded border border-gray-200 flex items-center gap-1"
                          >
                            <span>{isExpanded ? 'Collapse' : `Show All (${bgList.length})`}</span>
                            <span>{isExpanded ? '▲' : '▼'}</span>
                          </button>
                        )}

                        <button
                          onClick={() => {
                            setMailSessionTarget(session);
                            setIsMailModalOpen(true);
                          }}
                          className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded border border-indigo-200"
                        >
                          ✉️ Dispatch Mail
                        </button>

                        <button
                          onClick={() => handleToggleSessionStatus(session.id, session.status)}
                          className={`px-2 py-1 text-[10px] font-bold rounded border transition ${
                            isClosed
                              ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                          }`}
                          title={isClosed ? 'Reopen this session (Requires Passcode)' : 'Close this session'}
                        >
                          {isClosed ? 'Reopen' : 'Close Session'}
                        </button>

                        <button
                          onClick={() => exportSessionCSV(session)}
                          className="px-2 py-1 bg-white hover:bg-gray-100 text-gray-700 text-[10px] font-semibold rounded border border-gray-200"
                        >
                          Export CSV
                        </button>
                        <button
                          onClick={() => handleSelectSession(session)}
                          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded shadow-2xs"
                        >
                          Open →
                        </button>
                        <button
                          onClick={() => handleDeleteSessionPrompt(session.id, session.title)}
                          className="p-1 text-gray-400 hover:text-red-600 rounded"
                          title="Delete Session"
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    <div className="p-2.5">
                      {bgList.length === 0 ? (
                        <p className="text-[11px] text-gray-400 italic">No Bags/Totes imported yet.</p>
                      ) : (
                        <div
                          className={
                            isExpanded
                              ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2'
                              : 'flex items-center gap-2 overflow-x-auto pb-1.5 pt-0.5 no-scrollbar'
                          }
                          style={!isExpanded ? { WebkitOverflowScrolling: 'touch' } : {}}
                        >
                          {bgList.map((group) => {
                            const isMissroute = group.bag_type === 'missroute';
                            const isTote = group.bag_type === 'tote';
                            return (
                              <div
                                key={group.bg_tracking_id}
                                onClick={() =>
                                  setSelectedBgGroup({
                                    ...group,
                                    sessionTitle: session.title,
                                    sessionDate: session.session_date,
                                    sessionId: session.id,
                                  })
                                }
                                className={`p-2 border rounded-md cursor-pointer transition flex flex-col justify-between group shadow-2xs ${
                                  !isExpanded ? 'min-w-[155px] max-w-[170px] shrink-0' : ''
                                } ${
                                  isTote
                                    ? 'bg-amber-50/50 hover:bg-amber-50 border-amber-200 hover:border-amber-300'
                                    : isMissroute
                                    ? 'bg-rose-50/50 hover:bg-rose-50 border-rose-200 hover:border-rose-300'
                                    : 'bg-gray-50 hover:bg-indigo-50/50 border-gray-200 hover:border-indigo-300'
                                }`}
                              >
                                <div className="flex justify-between items-start gap-1">
                                  <span
                                    className={`text-[8px] font-extrabold uppercase px-1 py-0.2 rounded ${
                                      isTote
                                        ? 'bg-amber-100 text-amber-900 font-black'
                                        : isMissroute
                                        ? 'bg-rose-100 text-rose-800'
                                        : 'bg-blue-100 text-blue-800'
                                    }`}
                                  >
                                    {isTote ? 'TOTE' : isMissroute ? 'Missroute' : 'TRO'}
                                  </span>
                                  <span className="bg-white border text-gray-800 text-[10px] font-bold px-1.5 py-0.2 rounded-full shadow-2xs">
                                    {group.items.length}
                                  </span>
                                </div>

                                <p className="font-mono text-[11px] font-bold text-gray-900 mt-1 truncate">
                                  {group.bg_tracking_id}
                                </p>

                                <div className="mt-1.5 pt-1 border-t border-gray-200/60 flex justify-between items-center text-[10px] text-gray-500">
                                  <span className="text-indigo-600 font-semibold text-[9px] group-hover:underline">
                                    Show IDs →
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {filteredSessions.length > itemsPerPage && (
              <div className="flex justify-between items-center pt-1 text-[11px]">
                <span className="text-gray-500">
                  Showing {(sessionPage - 1) * itemsPerPage + 1} -{' '}
                  {Math.min(sessionPage * itemsPerPage, filteredSessions.length)} of {filteredSessions.length} sessions
                </span>
                <div className="flex gap-1">
                  <button
                    disabled={sessionPage === 1}
                    onClick={() => setSessionPage((p) => Math.max(p - 1, 1))}
                    className="px-2 py-0.5 bg-white border rounded text-[11px] disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <button
                    disabled={sessionPage * itemsPerPage >= filteredSessions.length}
                    onClick={() => setSessionPage((p) => p + 1)}
                    className="px-2 py-0.5 bg-white border rounded text-[11px] disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: SESSION WORKSPACE */}
      {activeTab === 'sessions' && (
        <div className="space-y-4">
          {sessionDetails ? (
            <div
              className={`rounded-xl border shadow-2xs overflow-hidden transition-all ${
                sessionDetails.status === 'completed' || sessionDetails.status === 'closed'
                  ? 'bg-gray-50/70 border-gray-300'
                  : 'bg-white border-gray-200'
              }`}
            >
              {/* Active Session Info & Operational Controls Bar */}
              <div className="p-3.5 bg-gray-50 border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-black text-gray-900">{sessionDetails.title}</h2>
                    <span className="text-[10px] font-mono bg-white px-2 py-0.5 rounded border border-gray-200 text-gray-700">
                      {formatToDisplayDate(sessionDetails.session_date)}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        sessionDetails.status === 'completed' || sessionDetails.status === 'closed'
                          ? 'bg-gray-200 text-gray-700'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {sessionDetails.status === 'completed' || sessionDetails.status === 'closed'
                        ? '🔒 Closed'
                        : 'Open'}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Unique Bags/Totes: <span className="font-bold text-indigo-600">{sessionDetails.bgGroups?.length || 0}</span> |{' '}
                    Total Shipments: <span className="font-bold text-emerald-600">{sessionDetails.totalPackets || 0}</span>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                  <button
                    onClick={() => {
                      setManualBagForm({ bg_tracking_id: '', bag_type: 'tro', tids_text: '' });
                      setIsManualBagModalOpen(true);
                    }}
                    className="flex-1 md:flex-none bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg shadow-2xs transition flex items-center justify-center gap-1"
                  >
                    <span>+ Add Bag / Tote ID</span>
                  </button>

                  <button
                    onClick={() => {
                      setTargetBgForImport(null);
                      setIsBulkImporting(true);
                    }}
                    className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg shadow-2xs transition"
                  >
                    + Bulk Import Manifest
                  </button>

                  <button
                    onClick={() => {
                      setMailSessionTarget(sessionDetails);
                      setIsMailModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold border bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
                  >
                    ✉️ Dispatch Mail
                  </button>

                  <button
                    onClick={() => handleToggleSessionStatus(sessionDetails.id, sessionDetails.status)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition ${
                      sessionDetails.status === 'completed' || sessionDetails.status === 'closed'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                        : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                    }`}
                  >
                    {sessionDetails.status === 'completed' || sessionDetails.status === 'closed'
                      ? 'Reopen Session'
                      : 'Close Session'}
                  </button>

                  <button
                    onClick={() => exportSessionCSV(sessionDetails)}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg border"
                  >
                    Export CSV
                  </button>
                </div>
              </div>

              {/* Workspace Bags Filter Bar */}
              <div className="p-2.5 bg-white border-b flex justify-between items-center gap-2">
                <span className="text-xs font-bold text-gray-800">
                  Assigned Bags / Totes ({filteredWorkspaceBgs.length})
                </span>

                <div className="flex gap-1.5">
                  <select
                    value={workspaceBagTypeFilter}
                    onChange={(e) => setWorkspaceBagTypeFilter(e.target.value)}
                    className="text-[11px] border border-gray-300 rounded px-2 py-1 bg-white focus:outline-none"
                  >
                    <option value="all">All Types</option>
                    <option value="tro">TRO Bags</option>
                    <option value="missroute">Missroute Bags</option>
                    <option value="tote">Totes Only</option>
                  </select>

                  <input
                    type="text"
                    placeholder="Filter by Bag / Tote ID..."
                    value={workspaceBgSearch}
                    onChange={(e) => setWorkspaceBgSearch(e.target.value)}
                    className="text-[11px] border border-gray-300 rounded px-2 py-1 w-48 focus:border-indigo-500 focus:outline-none bg-white"
                  />
                </div>
              </div>

              {/* BG Tracking Rows */}
              {filteredWorkspaceBgs.length === 0 ? (
                <div className="p-12 text-center text-xs text-gray-400 space-y-2">
                  <p>No Bags or Totes found in this session workspace.</p>
                  <div className="flex justify-center gap-2">
                    <button
                      onClick={() => {
                        setManualBagForm({ bg_tracking_id: '', bag_type: 'tro', tids_text: '' });
                        setIsManualBagModalOpen(true);
                      }}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg shadow-2xs"
                    >
                      + Add Bag / Tote ID
                    </button>
                    <button
                      onClick={() => {
                        setTargetBgForImport(null);
                        setIsBulkImporting(true);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg shadow-2xs"
                    >
                      + Bulk Paste Manifest
                    </button>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 bg-white">
                  {filteredWorkspaceBgs.map((group, idx) => {
                    const isMissroute = group.bag_type === 'missroute';
                    const isTote = group.bag_type === 'tote';
                    return (
                      <div
                        key={group.bg_tracking_id}
                        className="px-4 py-2.5 hover:bg-gray-50/80 transition flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-mono text-gray-400 font-semibold">
                            #{idx + 1}
                          </span>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded ${
                                  isTote
                                    ? 'bg-amber-100 text-amber-900 font-black'
                                    : isMissroute
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {isTote ? 'TOTE' : isMissroute ? 'Missroute' : 'TRO'}
                              </span>
                              <span className="font-mono text-xs font-black text-gray-900 bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
                                {group.bg_tracking_id}
                              </span>
                              <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded-full bg-gray-100 text-gray-700">
                                {group.category || 'SUR/SURF'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                          <span className="bg-emerald-50 text-emerald-800 text-[11px] font-black px-2.5 py-0.5 rounded border border-emerald-200">
                            {group.items.length} Shipments
                          </span>

                          <button
                            onClick={() =>
                              setSelectedBgGroup({
                                ...group,
                                sessionTitle: sessionDetails.title,
                                sessionDate: sessionDetails.session_date,
                                sessionId: sessionDetails.id,
                              })
                            }
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] px-2.5 py-1 rounded shadow-2xs whitespace-nowrap transition"
                          >
                            Show Tracking IDs
                          </button>

                          <button
                            onClick={() => {
                              setTargetBgForImport(group.bg_tracking_id);
                              setSelectedBagType(group.bag_type || 'tro');
                              setIsBulkImporting(true);
                            }}
                            className="p-1 text-gray-500 hover:text-emerald-700 rounded hover:bg-emerald-50 border border-gray-200"
                            title="Paste shipments into this Bag / Tote ID"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                            </svg>
                          </button>

                          <button
                            onClick={() => handleDeleteBgGroupPrompt(group.bg_tracking_id)}
                            className="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"
                            title="Delete this Bag/Tote Group"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white p-12 text-center rounded-xl border text-xs text-gray-400 space-y-2">
              <p>No session selected. Please open a session from the Dashboard.</p>
              <button
                onClick={() => setActiveTab('dashboard')}
                className="px-3 py-1.5 bg-indigo-600 text-white font-bold rounded-lg shadow-2xs"
              >
                Go to Dashboard
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: GLOBAL SEARCH */}
      {activeTab === 'global_search' && (
        <div className="space-y-4">
          <div className="bg-white p-3.5 rounded-lg border border-gray-200 shadow-2xs space-y-2">
            <div>
              <h2 className="text-xs font-bold text-gray-900">Global Historical Search</h2>
              <p className="text-[11px] text-gray-500">
                Query across all past sessions to locate specific Bag/Tote IDs, bag types, or parcel tracking codes.
              </p>
            </div>

            <form onSubmit={handleGlobalSearch} className="flex flex-col sm:flex-row gap-2">
              <select
                value={globalSearchType}
                onChange={(e) => setGlobalSearchType(e.target.value)}
                className="text-[11px] font-semibold border border-gray-300 rounded px-2.5 py-1 bg-gray-50 focus:outline-none"
              >
                <option value="bg_tracking_id">Bag / Tote ID</option>
                <option value="tracking_id">Tracking ID</option>
                <option value="bag_id">Bag ID</option>
              </select>

              <input
                type="text"
                value={globalQuery}
                onChange={(e) => setGlobalQuery(e.target.value)}
                placeholder="Enter exact or partial ID (e.g. 535-GNL-379608 or ESURSURF-56565656)..."
                className="flex-1 text-[11px] border border-gray-300 rounded px-2.5 py-1 font-mono focus:border-indigo-500 focus:outline-none"
                required
              />

              <button
                type="submit"
                disabled={isSearchingGlobal}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-[11px] font-bold px-4 py-1 rounded shadow-2xs transition"
              >
                {isSearchingGlobal ? 'Searching...' : 'Search'}
              </button>
            </form>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 shadow-2xs overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-bold text-gray-800 text-[11px]">Matching Historical Items ({globalResults.length})</h3>
            </div>

            {globalResults.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b text-gray-500">
                      <th className="py-2 px-3 font-semibold">Classification</th>
                      <th className="py-2 px-3 font-semibold">Bag / Tote ID</th>
                      <th className="py-2 px-3 font-semibold">Tracking ID</th>
                      <th className="py-2 px-3 font-semibold">Category</th>
                      <th className="py-2 px-3 font-semibold">Session Date</th>
                      <th className="py-2 px-3 font-semibold">Session Title</th>
                      <th className="py-2 px-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {globalResults.map((item) => {
                      const bagType = item.dispatch_bags?.destination;
                      const isTote = bagType === 'tote';
                      const isMissroute = bagType === 'missroute';
                      return (
                        <tr key={item.id} className="hover:bg-gray-50 transition">
                          <td className="py-1.5 px-3">
                            <span
                              className={`text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded ${
                                isTote
                                  ? 'bg-amber-100 text-amber-900 font-black'
                                  : isMissroute
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {isTote ? 'TOTE' : isMissroute ? 'Missroute' : 'TRO'}
                            </span>
                          </td>
                          <td className="py-1.5 px-3 font-mono font-bold text-gray-900">{item.bg_tracking_id || 'N/A'}</td>
                          <td className="py-1.5 px-3 font-mono font-bold text-indigo-700">{item.tracking_id}</td>
                          <td className="py-1.5 px-3 text-gray-600">{item.category}</td>
                          <td className="py-1.5 px-3 font-semibold text-gray-800">{formatToDisplayDate(item.bag_sessions?.session_date)}</td>
                          <td className="py-1.5 px-3 text-gray-600">{item.bag_sessions?.title}</td>
                          <td className="py-1.5 px-3">
                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded-full bg-gray-100 text-gray-700">
                              {item.status || 'manifested'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-gray-400">
                No matching records found. Enter an ID above to search globally.
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: CREATE SESSION */}
      {isCreatingSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-4 space-y-3">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-gray-900 text-xs">Create New Session</h3>
              <button onClick={() => setIsCreatingSession(false)} className="text-gray-400 hover:text-gray-600 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSession} className="space-y-2.5 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-gray-700">Date</label>
                <input
                  type="date"
                  value={sessionForm.session_date}
                  onChange={(e) => setSessionForm({ ...sessionForm, session_date: e.target.value })}
                  className="mt-0.5 w-full text-[11px] border rounded p-1.5 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700">Shift Name</label>
                <input
                  type="text"
                  placeholder="e.g. RG Morning Outward Shift"
                  value={sessionForm.title}
                  onChange={(e) => setSessionForm({ ...sessionForm, title: e.target.value })}
                  className="mt-0.5 w-full text-[11px] border rounded p-1.5 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setIsCreatingSession(false)}
                  className="px-2.5 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded shadow-2xs disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: BULK IMPORT (WITH TOTE TYPE) */}
      {isBulkImporting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-4 space-y-3">
            <div className="flex justify-between items-center border-b pb-2">
              <div>
                <h3 className="font-bold text-gray-900 text-xs">Bulk Import Manifest</h3>
                <p className="text-[10px] text-gray-500">
                  {targetBgForImport
                    ? `Assigning to ID: ${targetBgForImport}`
                    : `Session: ${sessionDetails?.title}`}
                </p>
              </div>
              <button
                onClick={() => {
                  setIsBulkImporting(false);
                  setTargetBgForImport(null);
                }}
                className="text-gray-400 hover:text-gray-600 font-bold text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleBulkImport} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1.5">Select Bag / Tote Type</label>
                <div className="grid grid-cols-3 gap-2 bg-gray-100 p-1 rounded-lg border border-gray-200">
                  <button
                    type="button"
                    onClick={() => setSelectedBagType('tro')}
                    className={`py-1.5 px-2 rounded-md text-[11px] font-bold transition flex items-center justify-center gap-1 ${
                      selectedBagType === 'tro'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <span>📦 TRO Bag</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedBagType('missroute')}
                    className={`py-1.5 px-2 rounded-md text-[11px] font-bold transition flex items-center justify-center gap-1 ${
                      selectedBagType === 'missroute'
                        ? 'bg-rose-600 text-white shadow-2xs'
                        : 'text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <span>⚠️ Missroute</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedBagType('tote')}
                    className={`py-1.5 px-2 rounded-md text-[11px] font-bold transition flex items-center justify-center gap-1 ${
                      selectedBagType === 'tote'
                        ? 'bg-amber-600 text-white shadow-2xs'
                        : 'text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <span>🗃️ Tote Bag</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700">Paste Raw Data</label>
                <textarea
                  rows={8}
                  value={rawBulkData}
                  onChange={(e) => setRawBulkData(e.target.value)}
                  placeholder={`FMPR0948731050\tBAG10001\t535-GNL-379608\tSUR/SURF\nFMPR0948731051\tBAG10001\t535-GNL-379608\tSUR/SURF`}
                  className="mt-0.5 w-full text-[11px] font-mono border rounded p-2 focus:border-indigo-500 focus:outline-none"
                  required
                />
                <p className="text-[10px] text-gray-500 mt-0.5">
                  💡 Shipments imported under <b>Totes</b> will store all tracking IDs while displaying directly in the Tote ID email column.
                </p>
              </div>

              <div className="flex justify-end gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsBulkImporting(false);
                    setTargetBgForImport(null);
                  }}
                  className="px-2.5 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`px-3.5 py-1 text-white text-[11px] font-bold rounded shadow-2xs disabled:opacity-50 transition ${
                    selectedBagType === 'tote'
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : selectedBagType === 'missroute'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {submitting ? 'Importing...' : `Import as ${selectedBagType.toUpperCase()}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2.5: MANUALLY CREATE SINGLE BAG / TOTE ID */}
      {isManualBagModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-4 space-y-3">
            <div className="flex justify-between items-center border-b pb-2">
              <div>
                <h3 className="font-bold text-gray-900 text-xs">Add Single Bag / Tote ID</h3>
                <p className="text-[10px] text-gray-500">Session: {sessionDetails?.title}</p>
              </div>
              <button
                onClick={() => setIsManualBagModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 font-bold text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateManualBag} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">
                  Bag / Tote ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. 535-GNL-379608 or ESURSURF-1919366"
                  value={manualBagForm.bg_tracking_id}
                  onChange={(e) => setManualBagForm({ ...manualBagForm, bg_tracking_id: e.target.value })}
                  className="w-full text-[11px] font-mono border border-gray-300 rounded p-1.5 focus:border-indigo-500 focus:outline-none"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">Select Type</label>
                <div className="grid grid-cols-3 gap-2 bg-gray-100 p-1 rounded-lg border border-gray-200">
                  <button
                    type="button"
                    onClick={() => setManualBagForm({ ...manualBagForm, bag_type: 'tro' })}
                    className={`py-1.5 px-2 rounded-md text-[11px] font-bold transition flex items-center justify-center gap-1 ${
                      manualBagForm.bag_type === 'tro'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <span>📦 TRO Bag</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualBagForm({ ...manualBagForm, bag_type: 'missroute' })}
                    className={`py-1.5 px-2 rounded-md text-[11px] font-bold transition flex items-center justify-center gap-1 ${
                      manualBagForm.bag_type === 'missroute'
                        ? 'bg-rose-600 text-white shadow-2xs'
                        : 'text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <span>⚠️ Missroute</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualBagForm({ ...manualBagForm, bag_type: 'tote' })}
                    className={`py-1.5 px-2 rounded-md text-[11px] font-bold transition flex items-center justify-center gap-1 ${
                      manualBagForm.bag_type === 'tote'
                        ? 'bg-amber-600 text-white shadow-2xs'
                        : 'text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <span>🗃️ Tote</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-0.5">
                  Shipment Tracking IDs / TIDs (Optional - One per line)
                </label>
                <textarea
                  rows={5}
                  placeholder={`FMPR0948731050\nFMPR0948731051\nMYEC1115211455`}
                  value={manualBagForm.tids_text}
                  onChange={(e) => setManualBagForm({ ...manualBagForm, tids_text: e.target.value })}
                  className="w-full text-[11px] font-mono border border-gray-300 rounded p-2 focus:border-indigo-500 focus:outline-none"
                />
                <p className="text-[10px] text-gray-500 mt-0.5">
                  You can leave this empty or add items one by one inside the session.
                </p>
              </div>

              <div className="flex justify-end gap-1.5 pt-1 border-t">
                <button
                  type="button"
                  onClick={() => setIsManualBagModalOpen(false)}
                  className="px-2.5 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !manualBagForm.bg_tracking_id.trim()}
                  className="px-3.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded shadow-2xs disabled:opacity-50 transition"
                >
                  {submitting ? 'Creating...' : 'Add Bag / Tote'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: SHOW TRACKING IDS */}
      {selectedBgGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[82vh] flex flex-col overflow-hidden text-xs">
            <div className="px-4 py-2.5 bg-gray-50 border-b flex justify-between items-center">
              <div>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-[8px] font-extrabold uppercase px-1.5 py-0.2 rounded ${
                      selectedBgGroup.bag_type === 'tote'
                        ? 'bg-amber-100 text-amber-900 font-black'
                        : selectedBgGroup.bag_type === 'missroute'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {selectedBgGroup.bag_type === 'tote' ? 'TOTE' : selectedBgGroup.bag_type === 'missroute' ? 'Missroute Bag' : 'TRO Bag'}
                  </span>
                  <h3 className="font-bold text-gray-900 text-xs">
                    ID: <span className="font-mono text-gray-900 font-black">{selectedBgGroup.bg_tracking_id}</span>
                  </h3>
                </div>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  {selectedBgGroup.sessionTitle} • {formatToDisplayDate(selectedBgGroup.sessionDate)} •{' '}
                  <span className="font-semibold text-indigo-600">
                    {selectedBgGroup.items?.length || 0} Shipments
                  </span>
                </p>
              </div>
              <button
                onClick={() => setSelectedBgGroup(null)}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="px-3 py-2 bg-gray-50/50 border-b flex gap-1.5">
              <input
                type="text"
                placeholder="Scan or type Tracking ID and hit Enter..."
                value={modalSingleTrackingInput}
                onChange={(e) => setModalSingleTrackingInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTrackingToCurrentBg();
                  }
                }}
                className="text-[11px] font-mono border border-gray-300 rounded px-2.5 py-1 flex-1 focus:border-indigo-500 focus:outline-none bg-white"
              />
              <button
                onClick={handleAddTrackingToCurrentBg}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold px-2.5 py-1 rounded shadow-2xs"
              >
                + Add
              </button>
            </div>

            <div className="p-3 overflow-y-auto flex-1">
              {(!selectedBgGroup.items || selectedBgGroup.items.length === 0) ? (
                <div className="p-6 text-center text-[11px] text-gray-400 italic">
                  No tracking IDs recorded in this {selectedBgGroup.bag_type === 'tote' ? 'tote' : 'bag'} yet.
                </div>
              ) : (
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-gray-100/80 border-b text-gray-600 sticky top-0">
                      <th className="py-1.5 px-2 font-semibold">#</th>
                      <th className="py-1.5 px-2 font-semibold">Tracking ID</th>
                      <th className="py-1.5 px-2 font-semibold">Category</th>
                      <th className="py-1.5 px-2 font-semibold">Status</th>
                      <th className="py-1.5 px-2 text-right font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedBgGroup.items.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-gray-50 transition">
                        <td className="py-1 px-2 text-gray-400">{idx + 1}</td>
                        <td className="py-1 px-2 font-mono font-bold text-indigo-700">{item.tracking_id}</td>
                        <td className="py-1 px-2 text-gray-600">{item.category || 'SUR/SURF'}</td>
                        <td className="py-1 px-2">
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded-full bg-gray-100 text-gray-700">
                            {item.status || 'manifested'}
                          </span>
                        </td>
                        <td className="py-1 px-2 text-right">
                          <button
                            onClick={() => handleDeleteTrackingItemPrompt(item.id, item.tracking_id)}
                            className="text-red-500 hover:text-red-700 font-bold px-1"
                            title="Delete Tracking ID"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="px-4 py-2 bg-gray-50 border-t flex justify-end gap-1.5">
              <button
                onClick={() => {
                  const trackingList = (selectedBgGroup.items || []).map((i) => i.tracking_id).join('\n');
                  navigator.clipboard.writeText(trackingList);
                  showToast('Tracking IDs copied to clipboard!', 'success');
                }}
                className="px-2.5 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-[11px] rounded"
              >
                Copy All Tracking IDs
              </button>
              <button
                onClick={() => setSelectedBgGroup(null)}
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] rounded"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: EXACT COLOR-MATCHED DISPATCH MAIL FORMAT GENERATOR */}
      {isMailModalOpen && mailSessionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden text-xs">
            <div className="px-4 py-3 bg-gray-900 text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <span>✉️ Exact Styled Dispatch Mail Format</span>
                  <span className="text-[10px] bg-emerald-700 text-white px-2 py-0.5 rounded font-normal">
                    {formatToDisplayDate(mailSessionTarget.session_date)}
                  </span>
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Proportionate column widths, full continuous table borders, and bounded Tote columns.
                </p>
              </div>
              <button
                onClick={() => setIsMailModalOpen(false)}
                className="text-gray-400 hover:text-white font-bold text-sm p-1"
              >
                ✕
              </button>
            </div>

            {/* Editable Controls */}
            <div className="p-3 bg-gray-50 border-b space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500">SENT FROM</label>
                  <input
                    type="text"
                    placeholder="Enter Sent From..."
                    value={mailSentFrom}
                    onChange={(e) => setMailSentFrom(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded p-1 text-[11px] font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500">SENT TO</label>
                  <input
                    type="text"
                    placeholder="Enter Sent To..."
                    value={mailSentTo}
                    onChange={(e) => setMailSentTo(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded p-1 text-[11px] font-semibold"
                  />
                </div>
              </div>
            </div>

            {/* Table Area */}
            <div className="p-4 overflow-auto flex-1 bg-white">
              <div ref={emailTableRef} style={{ fontFamily: 'Calibri, Arial, sans-serif', fontSize: '11px' }}>
                {(() => {
                  const allGroups = mailSessionTarget.bgGroups || [];
                  
                  // Separate standard bags and sort so Missroute bags always appear at the bottom
                  const standardBagList = allGroups
                    .filter((g) => g.bag_type !== 'tote')
                    .sort((a, b) => {
                      if (a.bag_type === 'missroute' && b.bag_type !== 'missroute') return 1;
                      if (a.bag_type !== 'missroute' && b.bag_type === 'missroute') return -1;
                      return 0;
                    });
                  
                  const combinedToteList = allGroups
                    .filter((g) => g.bag_type === 'tote')
                    .map((g) => g.bg_tracking_id);

                  const actualRowCount = Math.max(standardBagList.length, 1);
                  const totalShipmentSum = standardBagList.reduce((sum, b) => sum + (b.items?.length || 0), 0);

                  return (
                    <table
                      style={{
                        borderCollapse: 'collapse',
                        width: '100%',
                        textAlign: 'center',
                        fontSize: '11px',
                        fontFamily: 'Calibri, Arial, sans-serif',
                      }}
                      border="1"
                      cellPadding="4"
                      cellSpacing="0"
                    >
                      <thead>
                        <tr style={{ backgroundColor: '#4B8B3B', color: '#FFFFFF', fontWeight: 'bold', fontSize: '11px' }}>
                          <th style={{ border: '1px solid #000000', padding: '5px', width: '9%', color: '#FFFFFF' }}>DATE</th>
                          <th style={{ border: '1px solid #000000', padding: '5px', width: '15%', color: '#FFFFFF' }}>SENT FROM</th>
                          <th style={{ border: '1px solid #000000', padding: '5px', width: '11%', color: '#FFFFFF' }}>SENT TO</th>
                          <th style={{ border: '1px solid #000000', padding: '5px', width: '9%', color: '#FFFFFF' }}>BAG COUNT</th>
                          <th style={{ border: '1px solid #000000', padding: '5px', width: '6%', color: '#FFFFFF' }}>SL No</th>
                          <th style={{ border: '1px solid #000000', padding: '5px', width: '20%', color: '#FFFFFF' }}>BAG TRACKING ID</th>
                          <th style={{ border: '1px solid #000000', padding: '5px', width: '6%', color: '#FFFFFF' }}>COUNT</th>
                          <th style={{ border: '1px solid #000000', padding: '5px', width: '8%', color: '#FFFFFF' }}>TYPE</th>
                          {/* SPACE GAP */}
                          <th style={{ width: '2%', border: 'none', backgroundColor: 'transparent' }}></th>
                          {/* TOTE ID HEADER */}
                          <th style={{ border: '1px solid #000000', padding: '5px', width: '14%', backgroundColor: '#4B8B3B', color: '#FFFFFF', whiteSpace: 'nowrap' }}>TOTE ID</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: actualRowCount }).map((_, idx) => {
                          const bg = standardBagList[idx];
                          const isMissroute = bg?.bag_type === 'missroute';
                          const toteId = combinedToteList[idx] || '';

                          return (
                            <tr key={idx} style={{ height: '22px' }}>
                              {idx === 0 && (
                                <>
                                  {/* DATE (DD/MM/YYYY) */}
                                  <td
                                    rowSpan={actualRowCount}
                                    style={{
                                      backgroundColor: '#FFF2CC',
                                      border: '1px solid #000000',
                                      fontWeight: 'bold',
                                      color: '#000000',
                                      verticalAlign: 'middle',
                                    }}
                                  >
                                    {formatToDisplayDate(mailSessionTarget.session_date)}
                                  </td>

                                  {/* SENT FROM */}
                                  <td
                                    rowSpan={actualRowCount}
                                    style={{
                                      backgroundColor: '#D9EAD3',
                                      border: '1px solid #000000',
                                      fontWeight: 'bold',
                                      fontStyle: 'italic',
                                      color: '#000000',
                                      verticalAlign: 'middle',
                                    }}
                                  >
                                    {mailSentFrom}
                                  </td>

                                  {/* SENT TO */}
                                  <td
                                    rowSpan={actualRowCount}
                                    style={{
                                      backgroundColor: '#FFF2CC',
                                      border: '1px solid #000000',
                                      fontWeight: 'bold',
                                      color: '#000000',
                                      verticalAlign: 'middle',
                                    }}
                                  >
                                    {mailSentTo}
                                  </td>

                                  {/* BAG COUNT */}
                                  <td
                                    rowSpan={actualRowCount}
                                    style={{
                                      backgroundColor: '#D9EAD3',
                                      border: '1px solid #000000',
                                      fontWeight: 'bold',
                                      color: '#000000',
                                      verticalAlign: 'middle',
                                      fontSize: '13px',
                                    }}
                                  >
                                    {standardBagList.length}
                                  </td>
                                </>
                              )}

                              {/* SL No */}
                              <td
                                style={{
                                  backgroundColor: bg ? '#FFF2CC' : '#FFFFFF',
                                  border: '1px solid #000000',
                                  fontWeight: 'bold',
                                  color: '#000000',
                                }}
                              >
                                {bg ? idx + 1 : ''}
                              </td>

                              {/* BAG TRACKING ID */}
                              <td
                                style={{
                                  border: '1px solid #000000',
                                  fontFamily: 'Arial, sans-serif',
                                  fontWeight: 'normal',
                                  textAlign: 'center',
                                  color: '#000000',
                                  backgroundColor: '#FFFFFF',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {bg?.bg_tracking_id || ''}
                              </td>

                              {/* COUNT */}
                              <td
                                style={{
                                  border: '1px solid #000000',
                                  fontWeight: 'bold',
                                  color: '#000000',
                                  backgroundColor: '#FFFFFF',
                                }}
                              >
                                {bg ? bg.items.length : ''}
                              </td>

                              {/* TYPE */}
                              <td
                                style={{
                                  backgroundColor: bg
                                    ? isMissroute
                                      ? '#C9DAF8'
                                      : '#F4CCCC'
                                    : '#FFFFFF',
                                  border: '1px solid #000000',
                                  fontWeight: 'bold',
                                  fontStyle: 'italic',
                                  color: bg ? (isMissroute ? '#1155CC' : '#990000') : '#000000',
                                }}
                              >
                                {bg ? (isMissroute ? 'MISS ROUTE' : 'RTO') : ''}
                              </td>

                              {/* SPACE GAP */}
                              <td style={{ border: 'none', backgroundColor: 'transparent' }}></td>

                              {/* TOTE ID */}
                              <td
                                style={{
                                  border: '1px solid #000000',
                                  fontWeight: 'bold',
                                  fontFamily: 'Arial, sans-serif',
                                  backgroundColor: '#FFFFFF',
                                  color: '#000000',
                                  whiteSpace: 'nowrap',
                                  padding: '4px 6px',
                                }}
                              >
                                {toteId}
                              </td>
                            </tr>
                          );
                        })}

                        {/* FULLY ALIGNED CLOSED 8-COLUMN MAIN SUMMARY ROW */}
                        <tr style={{ height: '24px' }}>
                          <td colSpan={4} style={{ backgroundColor: '#4B8B3B', border: '1px solid #000000' }}></td>
                          <td colSpan={2} style={{ backgroundColor: '#4B8B3B', border: '1px solid #000000' }}></td>
                          <td
                            style={{
                              backgroundColor: '#4B8B3B',
                              border: '1px solid #000000',
                              color: '#FFFFFF',
                              fontWeight: 'bold',
                              fontSize: '12px',
                            }}
                          >
                            {totalShipmentSum}
                          </td>
                          <td style={{ backgroundColor: '#4B8B3B', border: '1px solid #000000' }}></td>
                          <td style={{ border: 'none', backgroundColor: 'transparent' }}></td>
                          <td style={{ border: 'none', backgroundColor: 'transparent' }}></td>
                        </tr>
                      </tbody>
                    </table>
                  );
                })()}
              </div>
            </div>

            <div className="px-4 py-2.5 bg-gray-100 border-t flex justify-between items-center">
              <span className="text-[11px] text-gray-600">
                Standard Bags: <b>{(mailSessionTarget.bgGroups || []).filter(g => g.bag_type !== 'tote').length}</b> | 
                Totes: <b>{(mailSessionTarget.bgGroups || []).filter(g => g.bag_type === 'tote').length}</b> | 
                Shipments: <b>{mailSessionTarget.totalPackets || 0}</b>
              </span>
              <div className="flex gap-2">
                <button
                  onClick={copyFormattedMail}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded shadow-xs transition flex items-center gap-1.5"
                >
                  <span>📋 Copy Formatted Table for Email</span>
                </button>
                <button
                  onClick={() => setIsMailModalOpen(false)}
                  className="px-3 py-1.5 bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold text-xs rounded"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: REUSABLE CONFIRMATION & PASSWORD AUTHENTICATION MODAL */}
      {confirmModalState.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-4 space-y-3 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2 border-b pb-2 text-rose-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 className="font-bold text-gray-900 text-sm">{confirmModalState.title}</h3>
            </div>

            <p className="text-xs text-gray-600">{confirmModalState.description}</p>

            {confirmModalState.isPasswordRequired && (
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">
                  Enter Master Passcode:
                </label>
                <input
                  type="password"
                  placeholder="Passcode..."
                  value={confirmModalState.passwordInput}
                  onChange={(e) =>
                    setConfirmModalState((prev) => ({
                      ...prev,
                      passwordInput: e.target.value,
                      error: '',
                    }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleModalSubmit();
                    }
                  }}
                  className="w-full border border-gray-300 rounded p-1.5 text-xs focus:outline-none focus:border-indigo-500"
                  autoFocus
                />
                {confirmModalState.error && (
                  <p className="text-[10px] text-red-600 mt-1 font-semibold">{confirmModalState.error}</p>
                )}
              </div>
            )}

            <div className="flex justify-end gap-1.5 pt-2 border-t">
              <button
                type="button"
                onClick={() =>
                  setConfirmModalState({
                    isOpen: false,
                    title: '',
                    description: '',
                    isPasswordRequired: false,
                    passwordInput: '',
                    error: '',
                    confirmButtonText: 'Confirm',
                    confirmButtonColor: 'bg-red-600 hover:bg-red-700',
                    onConfirm: null,
                  })
                }
                className="px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleModalSubmit}
                className={`px-4 py-1.5 text-white text-xs font-bold rounded-lg shadow-xs transition ${confirmModalState.confirmButtonColor}`}
              >
                {confirmModalState.confirmButtonText}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}