import { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Mail, 
  Copy, 
  Plus, 
  Trash2, 
  Layers,
  Search,
  Settings,
  Eye,
  Save,
  FilePlus,
  FolderHeart,
  EyeOff,
  X,
  CheckCircle,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { useToast } from '../lib/useToast.jsx';
import { fetchVendors } from '../lib/vendorService.js';
import { supabase } from '../lib/supabase.js';
import { createLpRecord, fetchLossLedgerRecords } from '../lib/lpService.js';

export function WmLossEmailGenerator() {
  const toast = useToast();
  const [vendors, setVendors] = useState([]);
  const [loadingVendors, setLoadingVendors] = useState(true);
  const [isSavingDb, setIsSavingDb] = useState(false);
  
  // Replace Confirmation Modal State
  const [duplicateWarningModal, setDuplicateWarningModal] = useState({
    isOpen: false,
    duplicates: [],
    pendingValidRows: []
  });

  // Toggle Visibility for the Preset Editor Configuration Tab Panel
  const [showPresetTab, setShowPresetTab] = useState(false);

  // Standard system columns template baseline
  const defaultColumns = [
    { key: 'trackingId', label: 'TRACKING ID', visible: true },
    { key: 'price', label: 'PRICE', visible: true },
    { key: 'wm_name', label: 'WM NAME', visible: true },
    { key: 'vendor_id', label: 'VENDOR ID', visible: true },
    { key: 'phone', label: 'PHONE NUMBER', visible: true },
    { key: 'invoice', label: 'INVOICE', visible: true }
  ];
  
  // System Baseline Presets including column headers configuration
  const defaultPresets = {
    loss_report: {
      id: 'loss_report',
      name: 'Wishmaster Loss Template',
      subject: 'Wishmaster Operational Loss Reconciliations',
      greeting: 'Hi Team,',
      body: 'Please find below the reported Wishmaster loss log mappings for reconciliation:',
      closing: 'Regards,\nOperations Team',
      includeTable: true,
      columns: [...defaultColumns]
    },
    tech_issue: {
      id: 'tech_issue',
      name: 'Technical App Issue Log',
      subject: 'URGENT: Mobile Device Application Synchronization Failure Log',
      greeting: 'Dear Support Team,',
      body: 'The following field delivery users are experiencing app crashes and profile load synchronization drops during deliveries. Detailed mapping logs attached:',
      closing: 'Thanks & Regards,\nLogistics Operations Desk',
      includeTable: true,
      columns: [
        { key: 'trackingId', label: 'WAYBILL / TRIP ID', visible: true },
        { key: 'price', label: 'COD AMOUNT', visible: true },
        { key: 'wm_name', label: 'DELIVERY EXECUTIVE', visible: true },
        { key: 'vendor_id', label: 'UID / EMP ID', visible: true },
        { key: 'phone', label: 'CONTACT NO', visible: true },
        { key: 'invoice', label: 'APP VERSION', visible: true }
      ]
    }
  };

  // State Management for System Presets
  const [presets, setPresets] = useState(() => {
    const saved = localStorage.getItem('wm_mail_presets_v3');
    return saved ? JSON.parse(saved) : defaultPresets;
  });
  
  const [activePresetId, setActivePresetId] = useState('loss_report');
  
  // Custom Live Editing Template Configuration States
  const [presetName, setPresetName] = useState('');
  const [subjectText, setSubjectText] = useState('');
  const [greetingText, setGreetingText] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [closingText, setClosingText] = useState('');
  const [includeTableInMail, setIncludeTableInMail] = useState(true);
  const [customColumns, setCustomColumns] = useState([]);

  // Dynamic input row array data
  const [rows, setRows] = useState([
    { trackingId: '', price: '', wm_name: '', vendor_id: '', phone: '', invoice: 'NA', searchInput: '', isDropdownOpen: false }
  ]);

  // Sync active configurations when selection preset changes
  useEffect(() => {
    const active = presets[activePresetId];
    if (active) {
      setPresetName(active.name);
      setSubjectText(active.subject);
      setGreetingText(active.greeting);
      setBodyText(active.body);
      setClosingText(active.closing);
      setIncludeTableInMail(active.includeTable);
      setCustomColumns(active.columns || [...defaultColumns]);
    }
  }, [activePresetId, presets]);

  useEffect(() => {
    async function getVendors() {
      try {
        const data = await fetchVendors();
        setVendors(data);
      } catch (err) {
        toast('Error reading vendor profile records.', 'error');
      } finally {
        setLoadingVendors(false);
      }
    }
    getVendors();
  }, []);

  const handleColumnLabelChange = (index, newLabel) => {
    const updated = [...customColumns];
    updated[index].label = newLabel.toUpperCase();
    setCustomColumns(updated);
  };

  const handleColumnVisibilityToggle = (index) => {
    const updated = [...customColumns];
    updated[index].visible = !updated[index].visible;
    setCustomColumns(updated);
  };

  const handleSavePreset = () => {
    const updatedPresets = {
      ...presets,
      [activePresetId]: {
        id: activePresetId,
        name: presetName,
        subject: subjectText,
        greeting: greetingText,
        body: bodyText,
        closing: closingText,
        includeTable: includeTableInMail,
        columns: customColumns
      }
    };
    setPresets(updatedPresets);
    localStorage.setItem('wm_mail_presets_v3', JSON.stringify(updatedPresets));
    toast(`Preset architecture for "${presetName}" successfully synchronized!`, 'success');
  };

  const handleCreateNewPreset = () => {
    const newId = `custom_${Date.now()}`;
    const newPresetStructure = {
      id: newId,
      name: 'New Custom Mail Template',
      subject: 'Custom Operational Dispatch Notice',
      greeting: 'Hi Team,',
      body: 'Type custom operational notes here...',
      closing: 'Regards,\nOperations Branch',
      includeTable: true,
      columns: [...defaultColumns]
    };

    const updatedPresets = { ...presets, [newId]: newPresetStructure };
    setPresets(updatedPresets);
    localStorage.setItem('wm_mail_presets_v3', JSON.stringify(updatedPresets));
    setActivePresetId(newId);
    setShowPresetTab(true);
    toast('Custom template profile created! Editing tab opened.', 'success');
  };

  const handleDeletePreset = (idToDelete) => {
    if (idToDelete === 'loss_report' || idToDelete === 'tech_issue') {
      toast('System baseline presets cannot be destroyed.', 'error');
      return;
    }
    const updated = { ...presets };
    delete updated[idToDelete];
    setPresets(updated);
    localStorage.setItem('wm_mail_presets_v3', JSON.stringify(updated));
    setActivePresetId('loss_report');
    toast('Custom template metadata profile dropped completely.', 'info');
  };

  const addRow = () => {
    setRows([...rows, { trackingId: '', price: '', wm_name: '', vendor_id: '', phone: '', invoice: 'NA', searchInput: '', isDropdownOpen: false }]);
  };

  const removeRow = (index) => {
    if (rows.length === 1) return;
    setRows(rows.filter((_, i) => i !== index));
  };

  const updateRowField = (index, field, value) => {
    const updated = [...rows];
    updated[index][field] = value;
    setRows(updated);
  };

  const handleSelectVendor = (index, vendor) => {
    const updated = [...rows];
    updated[index]['wm_name'] = vendor.wm_name;
    updated[index]['vendor_id'] = vendor.vendor_id;
    updated[index]['searchInput'] = `${vendor.wm_name.toUpperCase()} (${vendor.vendor_id})`;
    updated[index]['isDropdownOpen'] = false;
    setRows(updated);
  };

  const handleCopyToClipboard = () => {
    const visibleColumns = customColumns.filter(c => c.visible);
    if (includeTableInMail && rows.some(r => !r.vendor_id)) {
      toast('Please assign a profile connection across all active items.', 'error');
      return;
    }

    const plainTextMail = `Subject: ${subjectText}\n\n${greetingText}\n\n${bodyText}\n\n${closingText}`;
    let htmlTableContent = '';
    
    if (includeTableInMail) {
      const dataRowsHtml = rows.map(row => `
        <tr style="height: 22px;">
          ${visibleColumns.map(col => {
            let cellValue = row[col.key] || 'N/A';
            let formattedValue = cellValue.trim() === '' ? 'N/A' : cellValue;
            return `<td style="border: 1px solid #000000; padding: 4px 10px; color: #000000; font-weight: bold; font-family: sans-serif; font-size: 13px; text-transform: uppercase;">${formattedValue}</td>`;
          }).join('')}
        </tr>
      `).join('');

      htmlTableContent = `
        <table style="border-collapse: collapse; text-align: center; margin-top: 16px; width: 100%; max-width: 850px; border: 1px solid #000000;">
          <thead>
            <tr style="background-color: #FFFF00; color: #000000; font-weight: bold; height: 26px;">
              ${visibleColumns.map(col => `<th style="border: 1px solid #000000; padding: 4px 10px; font-family: sans-serif; font-size: 13px; text-transform: uppercase;">${col.label}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${dataRowsHtml}
          </tbody>
        </table>`;
    }

    const compiledHtmlMail = `
      <div style="font-family: Arial, sans-serif; font-size: 14px; color: #222222; line-height: 1.5;">
        <p><strong>Subject:</strong> ${subjectText}</p>
        <hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 12px 0;" />
        <p style="margin: 0 0 12px 0;">${greetingText}</p>
        <p style="margin: 0 0 14px 0;">${bodyText.replace(/\n/g, '<br />')}</p>
        ${htmlTableContent}
        <br />
        <p style="margin: 12px 0 0 0; white-space: pre-line;">${closingText}</p>
      </div>
    `;

    const blobHtml = new Blob([compiledHtmlMail], { type: 'text/html' });
    const blobText = new Blob([plainTextMail], { type: 'text/plain' });
    const data = [new ClipboardItem({ 'text/html': blobHtml, 'text/plain': blobText })];

    navigator.clipboard.write(data).then(() => {
      toast('Spreadsheet email configuration layout copied successfully!', 'success');
    }).catch(() => {
      toast('Failed exporting mail payload structure.', 'error');
    });
  };

  // Perform database write and upsert operations directly into loss_ledger
  const executeDatabaseSave = async (validRows) => {
    setIsSavingDb(true);
    try {
      const timestamp = new Date().toISOString();
      const dateStr = timestamp.split('T')[0];

      // 1. Commit / Upsert into standalone loss_ledger
      for (const row of validRows) {
        const cleanTid = row.trackingId.trim().toUpperCase();
        await createLpRecord({
          tracking_id: cleanTid,
          wishmaster_name: row.wm_name?.trim() || 'Vendor Courier',
          aging_days: 1,
          priority: 'CRITICAL',
          status: 'LOSS',
          details: `Loss Mailed: ${row.wm_name || 'WM'} (ID: ${row.vendor_id || 'N/A'}) | Price: ${row.price || 'N/A'}`,
          resolved_at: timestamp
        });
      }

      // 2. Upsert into wm_loss_records
      for (const row of validRows) {
        const cleanTid = row.trackingId.trim().toUpperCase();
        await supabase
          .from('wm_loss_records')
          .delete()
          .ilike('tracking_id', cleanTid);
      }

      const lossRecordsPayload = validRows.map(row => ({
        tracking_id: row.trackingId.trim().toUpperCase(),
        wm_name: row.wm_name?.trim() || 'Wishmaster',
        vendor: row.vendor_id?.trim() || 'Vendor',
        reason: subjectText || 'Wishmaster Loss Log',
        date: dateStr,
        status: 'LOSS',
        created_at: timestamp
      }));

      try {
        await supabase.from('wm_loss_records').insert(lossRecordsPayload);
      } catch (errDb) {
        console.warn('wm_loss_records write notice:', errDb);
      }

      // 3. Log batch entry into wm_loss_emails
      try {
        const trackingList = validRows.map(r => r.trackingId.trim().toUpperCase());
        await supabase.from('wm_loss_emails').insert([
          {
            mail_date: dateStr,
            vendor: validRows[0]?.vendor_id || 'Vendor',
            wm_name: validRows[0]?.wm_name || 'Wishmaster',
            reason: subjectText || 'Wishmaster Loss Log',
            tracking_ids: trackingList.join('\n'),
            items_count: trackingList.length,
            created_at: timestamp
          }
        ]);
      } catch (errEmailDb) {
        console.warn('wm_loss_emails write notice:', errEmailDb);
      }

      toast(`Successfully saved and confirmed ${validRows.length} loss record(s) into Loss Ledger!`, 'success');
      setDuplicateWarningModal({ isOpen: false, duplicates: [], pendingValidRows: [] });
    } catch (err) {
      console.error('Save to DB error:', err);
      toast('Failed to save records into database.', 'error');
    } finally {
      setIsSavingDb(false);
    }
  };

  // Check for existing duplicates before writing to database
  const handleSaveAndConfirmToDb = async () => {
    const validRows = rows.filter(r => r.trackingId?.trim() !== '');
    if (validRows.length === 0) {
      toast('Please enter at least one valid tracking ID.', 'error');
      return;
    }

    setIsSavingDb(true);
    try {
      const incomingTids = validRows.map(r => r.trackingId.trim().toUpperCase());

      // 1. Check in dedicated loss_ledger table
      let existingLossLedger = [];
      try {
        if (typeof fetchLossLedgerRecords === 'function') {
          existingLossLedger = await fetchLossLedgerRecords();
        }
      } catch (e) {
        console.warn(e);
      }

      // 2. Check in wm_loss_records
      let existingLossRecords = [];
      try {
        const { data } = await supabase
          .from('wm_loss_records')
          .select('*')
          .in('tracking_id', incomingTids);
        if (data) existingLossRecords = data;
      } catch (e) {
        console.warn(e);
      }

      const duplicateList = [];

      validRows.forEach(row => {
        const cleanTid = row.trackingId.trim().toUpperCase();
        const ledgerMatch = existingLossLedger.find(
          r => (r.tracking_id || '').toUpperCase() === cleanTid
        );
        const wmMatch = existingLossRecords.find(
          r => (r.tracking_id || '').toUpperCase() === cleanTid
        );

        if (ledgerMatch || wmMatch) {
          const oldWmName = ledgerMatch?.wishmaster_name || wmMatch?.wm_name || 'Another Wishmaster';
          duplicateList.push({
            trackingId: cleanTid,
            oldWmName,
            newWmName: row.wm_name || 'New Wishmaster'
          });
        }
      });

      // If duplicate records are detected, trigger confirmation modal
      if (duplicateList.length > 0) {
        setDuplicateWarningModal({
          isOpen: true,
          duplicates: duplicateList,
          pendingValidRows: validRows
        });
        setIsSavingDb(false);
        return;
      }

      // If no duplicates exist, execute standard write
      await executeDatabaseSave(validRows);
    } catch (err) {
      console.error(err);
      toast('Error checking existing tracking records.', 'error');
      setIsSavingDb(false);
    }
  };

  return (
    <div className="w-full p-3 space-y-4 text-xs bg-ink-50/20 min-h-screen">
      {/* HEADER CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-ink-100 pb-2 bg-white p-3 rounded-lg shadow-2xs">
        <div>
          <button onClick={() => window.history.back()} className="flex items-center gap-1 text-[10px] font-bold text-ink-600 hover:text-brand-600 transition-colors mb-0.5">
            <ArrowLeft className="h-3 w-3" /> Return to Terminal Workspace
          </button>
          <h2 className="text-base font-black text-ink-900 tracking-tight flex items-center gap-1.5">
            <Mail className="h-4 w-4 text-brand-600" /> Dynamic Preset Engine Workspace
          </h2>
        </div>

        {/* TOP SYSTEM CONTROLS */}
        <div className="flex items-center gap-2 self-start sm:self-auto bg-ink-50 p-1.5 rounded-lg border border-ink-200">
          <div className="flex items-center gap-1">
            <FolderHeart className="h-3.5 w-3.5 text-indigo-600 ml-1" />
            <select 
              className="h-7 text-[11px] font-bold bg-white border border-ink-300 rounded px-1.5 focus:outline-none w-44"
              value={activePresetId}
              onChange={e => {
                setActivePresetId(e.target.value);
                setShowPresetTab(true);
              }}
            >
              {Object.values(presets).map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <button 
            onClick={handleCreateNewPreset} 
            className="flex items-center gap-1 px-2.5 h-7 bg-indigo-600 text-white font-bold rounded hover:bg-indigo-700 transition-all text-[10px]"
          >
            <FilePlus className="h-3 w-3" /> Add Preset
          </button>

          <button
            onClick={() => setShowPresetTab(!showPresetTab)}
            className={`p-1.5 rounded border transition-all ${showPresetTab ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-white border-ink-300 text-ink-600 hover:bg-ink-100'}`}
            title="Toggle Custom Configuration Layout View Tab"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 items-start w-full">
        {/* LEFT CONFIGURATION PRESET TAB */}
        {showPresetTab && (
          <div className="w-full lg:w-[360px] shrink-0 card p-3.5 border-2 border-amber-300 bg-white shadow-md rounded-lg space-y-4 animate-in fade-in slide-in-from-left-2 duration-200">
            <div className="flex items-center justify-between border-b pb-1.5">
              <h3 className="text-[10px] font-black uppercase tracking-wider text-ink-700 flex items-center gap-1">
                <Settings className="h-3 w-3 text-amber-500" /> Live Preset Customizer
              </h3>
              <div className="flex items-center gap-1.5">
                {activePresetId !== 'loss_report' && activePresetId !== 'tech_issue' && (
                  <button 
                    onClick={() => handleDeletePreset(activePresetId)}
                    className="p-1 text-rose-500 hover:bg-rose-50 rounded border border-transparent hover:border-rose-200"
                    title="Delete Active Preset Profile"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
                <button 
                  onClick={() => setShowPresetTab(false)}
                  className="p-1 text-ink-400 hover:bg-ink-100 rounded"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* HEADERS MAPPING ENGINE */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-black uppercase text-ink-600 tracking-wider flex items-center gap-1">
                <Layers className="h-3 w-3 text-brand-500" /> Customize Data Grid Headers
              </span>
              <div className="space-y-1 bg-ink-50/50 p-1.5 rounded border border-ink-100 max-h-36 overflow-y-auto">
                {customColumns.map((col, index) => (
                  <div key={col.key} className="flex items-center gap-1.5 bg-white p-1 border border-ink-100 rounded">
                    <button 
                      type="button"
                      onClick={() => handleColumnVisibilityToggle(index)}
                      className={`p-0.5 rounded transition-colors ${col.visible ? 'text-emerald-600 bg-emerald-50' : 'text-ink-400 bg-ink-100'}`}
                    >
                      {col.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                    </button>
                    <input 
                      type="text" 
                      className={`h-5 text-[10px] font-mono font-bold px-1 flex-1 border rounded focus:outline-none ${!col.visible && 'opacity-40 text-ink-400 bg-ink-50'}`}
                      value={col.label}
                      disabled={!col.visible}
                      onChange={(e) => handleColumnLabelChange(index, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* CONTROLS FIELDS FORM */}
            <div className="space-y-2.5">
              <div>
                <label className="text-[10px] font-bold text-ink-600 block mb-0.5">Template Custom Label</label>
                <input 
                  type="text" 
                  className="input h-7 text-[11px] px-2 bg-white font-bold"
                  value={presetName}
                  onChange={e => setPresetName(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between bg-ink-50 p-1.5 rounded border border-ink-100">
                <span className="font-bold text-ink-800 text-[11px]">Inject Rows Grid Component</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={includeTableInMail}
                    onChange={(e) => setIncludeTableInMail(e.target.checked)}
                  />
                  <div className="w-7 h-4 bg-ink-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              <div>
                <label className="text-[10px] font-bold text-ink-600 block mb-0.5">Subject String Mapping</label>
                <input 
                  type="text" 
                  className="input h-7 text-[11px] px-2 bg-white"
                  value={subjectText}
                  onChange={e => setSubjectText(e.target.value)}
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-ink-600 block mb-0.5">Greeting Header</label>
                <input 
                  type="text" 
                  className="input h-7 text-[11px] px-2 bg-white"
                  value={greetingText}
                  onChange={e => setGreetingText(e.target.value)}
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-ink-600 block mb-0.5">Message Content Core Body</label>
                <textarea 
                  rows={3}
                  className="input text-[11px] p-2 bg-white h-auto resize-none"
                  value={bodyText}
                  onChange={e => setBodyText(e.target.value)}
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-ink-600 block mb-0.5">Sign-off Block / Signatures</label>
                <textarea 
                  rows={2}
                  className="input text-[11px] p-2 bg-white h-auto resize-none"
                  value={closingText}
                  onChange={e => setClosingText(e.target.value)}
                />
              </div>

              <button
                onClick={handleSavePreset}
                className="w-full flex items-center justify-center gap-1 h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded shadow-xs transition-colors mt-1"
              >
                <Save className="h-3.5 w-3.5" /> Save Overwritten Setup Changes
              </button>
            </div>
          </div>
        )}

        {/* MAIN PANEL AREA */}
        <div className="flex-1 space-y-3 w-full">
          <div className="card p-3.5 border border-ink-200 bg-white shadow-xs rounded-lg space-y-3">
            <div className="flex items-center justify-between border-b pb-1.5">
              <h3 className="text-[10px] font-black uppercase tracking-wider text-ink-700 flex items-center gap-1">
                <Layers className="h-3 w-3 text-brand-600" /> Active Rows Batch Matrix ({presetName})
              </h3>
              <div className="flex items-center gap-2">
                <button 
                  onClick={addRow}
                  className="flex items-center gap-1 px-2 py-1 bg-ink-900 text-white font-bold text-[10px] rounded hover:bg-ink-800 transition-colors"
                >
                  <Plus className="h-3 w-3" /> Add Item Row
                </button>
                
                {/* SAVE & CONFIRM TO DB BUTTON */}
                <button 
                  onClick={handleSaveAndConfirmToDb}
                  disabled={isSavingDb}
                  className="flex items-center gap-1 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] rounded transition-colors shadow-2xs disabled:opacity-50"
                  title="Store all row tracking IDs directly into the Loss Database"
                >
                  {isSavingDb ? (
                    <RefreshCw className="h-3 w-3 animate-spin" />
                  ) : (
                    <CheckCircle className="h-3 w-3" />
                  )}
                  Save & Confirm to DB
                </button>

                <button 
                  onClick={handleCopyToClipboard}
                  className="flex items-center gap-1 px-3 py-1 bg-emerald-600 text-white font-bold text-[10px] rounded hover:bg-emerald-700 transition-colors shadow-2xs"
                >
                  <Copy className="h-3 w-3" /> Copy Current Email Setup
                </button>
              </div>
            </div>

            {/* INPUT ROWS DISPLAY MATRIX */}
            <div className="space-y-3 max-h-72 overflow-y-visible pr-1">
              {rows.map((row, idx) => {
                const filteredOptions = vendors.filter(v => 
                  v.wm_name?.toLowerCase().includes(row.searchInput.toLowerCase()) ||
                  v.vendor_id?.toLowerCase().includes(row.searchInput.toLowerCase())
                );

                return (
                  <div 
                    key={idx} 
                    className="flex flex-col md:flex-row md:items-center gap-2 bg-ink-50/30 p-2 border border-ink-100 rounded"
                    style={{ position: 'relative', zIndex: row.isDropdownOpen ? 50 : 1 }}
                  >
                    <span className="font-mono font-bold text-ink-400 w-4 text-center hidden md:inline">{idx + 1}</span>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 flex-1">
                      <div>
                        <input 
                          type="text"
                          placeholder={customColumns.find(c => c.key === 'trackingId')?.label || "TRACKING ID"}
                          className="input h-7 text-[11px] font-mono font-bold uppercase px-1.5 bg-white border border-ink-200 rounded w-full"
                          value={row.trackingId}
                          onChange={e => updateRowField(idx, 'trackingId', e.target.value)}
                        />
                      </div>

                      <div>
                        <input 
                          type="number"
                          placeholder={customColumns.find(c => c.key === 'price')?.label || "PRICE"}
                          className="input h-7 text-[11px] font-mono font-bold px-1.5 bg-white border border-ink-200 rounded w-full"
                          value={row.price}
                          onChange={e => updateRowField(idx, 'price', e.target.value)}
                        />
                      </div>

                      {/* SEARCHABLE CONTEXT DROPDOWN */}
                      <div className="col-span-1 sm:col-span-2 md:col-span-2 relative">
                        <div className="relative w-full">
                          <input
                            type="text"
                            placeholder={loadingVendors ? "Loading..." : `Search ${customColumns.find(c => c.key === 'wm_name')?.label || "WM"}...`}
                            disabled={loadingVendors}
                            className="input h-7 text-[11px] font-bold bg-white px-2 pr-6 w-full border border-ink-300 rounded focus:outline-none focus:border-brand-500"
                            value={row.searchInput}
                            onFocus={() => updateRowField(idx, 'isDropdownOpen', true)}
                            onBlur={() => setTimeout(() => updateRowField(idx, 'isDropdownOpen', false), 250)}
                            onChange={e => {
                              updateRowField(idx, 'searchInput', e.target.value);
                              updateRowField(idx, 'isDropdownOpen', true);
                              if (!e.target.value) {
                                updateRowField(idx, 'wm_name', '');
                                updateRowField(idx, 'vendor_id', '');
                              }
                            }}
                          />
                          <Search className="absolute right-2 top-2 h-3 w-3 text-ink-400 pointer-events-none" />
                        </div>

                        {row.isDropdownOpen && filteredOptions.length > 0 && (
                          <div className="absolute left-0 top-[29px] w-full bg-white border border-ink-300 rounded-md shadow-xl max-h-48 overflow-y-auto z-[9999] min-w-[180px] divide-y divide-ink-100">
                            {filteredOptions.map(v => (
                              <div
                                key={v.id}
                                className="p-2.5 hover:bg-indigo-50 active:bg-indigo-100 cursor-pointer transition-colors text-left text-ink-900 font-bold uppercase text-[11px] flex flex-col gap-0.5"
                                onMouseDown={() => handleSelectVendor(idx, v)}
                              >
                                <span className="tracking-wide block truncate">{v.wm_name}</span>
                                {v.vendor_id && (
                                  <span className="text-indigo-600 font-mono text-[9px] font-normal normal-case block">
                                    ID: {v.vendor_id}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <input 
                          type="tel"
                          placeholder={customColumns.find(c => c.key === 'phone')?.label || "PHONE NUMBER"}
                          className="input h-7 text-[11px] font-mono px-1.5 bg-white border border-ink-200 rounded w-full"
                          value={row.phone}
                          onChange={e => updateRowField(idx, 'phone', e.target.value)}
                        />
                      </div>

                      <div>
                        <input 
                          type="text"
                          value={row.invoice}
                          className="input h-7 text-[11px] font-mono bg-ink-100 text-ink-400 font-bold px-1.5 border-none rounded w-full"
                          disabled
                        />
                      </div>
                    </div>

                    <button
                      onClick={() => removeRow(idx)}
                      className="p-1 rounded text-ink-400 hover:text-rose-600 transition-all self-end md:self-auto shrink-0 mt-1 md:mt-0"
                      disabled={rows.length === 1}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* LIVE PREVIEW BOX */}
            <div className="pt-3 border-t border-ink-100 space-y-2">
              <h4 className="text-[10px] font-black uppercase text-ink-500 tracking-wider flex items-center gap-1">
                <Eye className="h-3 w-3" /> Custom Generated Template Preview Summary
              </h4>
              
              <div className="p-4 border border-ink-200 rounded bg-white space-y-3 font-sans text-ink-800">
                <div className="text-[12px] border-b pb-1.5 text-ink-600">
                  <strong>Subject:</strong> {subjectText}
                </div>
                <div className="text-[13px]">{greetingText}</div>
                <div className="text-[13px] whitespace-pre-line">{bodyText}</div>
                
                {includeTableInMail ? (
                  <div className="overflow-x-auto my-3">
                    <table className="border-collapse text-center w-full max-w-(--size-breakpoint-md)" style={{ border: '1px solid #000000' }}>
                      <thead>
                        <tr className="bg-[#FFFF00] text-black font-bold text-[13px]" style={{ height: '26px' }}>
                          {customColumns.filter(c => c.visible).map(col => (
                            <th key={col.key} className="p-2 uppercase font-sans tracking-wide" style={{ border: '1px solid #000000' }}>
                              {col.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white">
                        {rows.map((row, idx) => (
                          <tr key={idx} style={{ height: '22px' }}>
                            {customColumns.filter(c => c.visible).map(col => {
                              let displayVal = row[col.key] || 'N/A';
                              let finalVal = displayVal.trim() === '' ? 'N/A' : displayVal;
                              return (
                                <td key={col.key} className="p-1.5 uppercase font-bold font-sans text-[13px] text-black" style={{ border: '1px solid #000000' }}>
                                  {finalVal}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-2 border border-dashed border-ink-200 text-center text-ink-400 italic rounded my-2 bg-ink-50">
                    -- [Spreadsheet Grid Marked Hidden for this Preset Template Configuration] --
                  </div>
                )}
                
                <div className="text-[13px] whitespace-pre-line text-ink-600 pt-1">{closingText}</div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* DUPLICATE OVERRIDE CONFIRMATION MODAL */}
      {duplicateWarningModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center gap-2 border-b pb-2.5 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="font-bold text-sm text-gray-900">Existing Loss Record Detected</h3>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-gray-600">
                The following Tracking ID(s) are already marked as <strong>LOSS</strong> in the Loss Ledger under another Wishmaster:
              </p>

              <div className="max-h-40 overflow-y-auto space-y-1.5 bg-amber-50/60 p-2.5 rounded-lg border border-amber-200">
                {duplicateWarningModal.duplicates.map((dup, i) => (
                  <div key={i} className="text-xs font-mono flex flex-col gap-0.5 border-b border-amber-200/60 pb-1 last:border-none">
                    <span className="font-bold text-indigo-700">{dup.trackingId}</span>
                    <span className="text-[11px] text-gray-700 font-sans">
                      Currently assigned: <b className="text-rose-700">{dup.oldWmName}</b> ➔ Replace with: <b className="text-emerald-700">{dup.newWmName}</b>
                    </span>
                  </div>
                ))}
              </div>

              <p className="text-xs font-bold text-gray-800 pt-1">
                Do you want to replace and update these record(s) with the new Wishmaster details?
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setDuplicateWarningModal({ isOpen: false, duplicates: [], pendingValidRows: [] })}
                className="px-3.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => executeDatabaseSave(duplicateWarningModal.pendingValidRows)}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-xs"
              >
                Yes, Replace & Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}