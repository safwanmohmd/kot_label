import { useState, useMemo } from 'react';
import {
  Filter,
  Copy,
  Download,
  Trash2,
  Check,
  ListFilter,
  CheckSquare,
  Square,
  FileText,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { useToast } from '../lib/useToast.jsx';

export function TrackingSorter() {
  const toast = useToast();
  const [rawInput, setRawInput] = useState('');
  const [copied, setCopied] = useState(false);

  // Stores user-toggled checkbox states for detected prefixes
  const [selectedPrefixes, setSelectedPrefixes] = useState({});

  // 1. Clean and split raw input into individual tracking IDs
  const parsedIds = useMemo(() => {
    if (!rawInput.trim()) return [];
    return rawInput
      .split(/[\n,\s]+/)
      .map((id) => id.trim().toUpperCase())
      .filter((id) => id.length > 0);
  }, [rawInput]);

  // 2. Extract leading prefix dynamically from ANY format (e.g. GIQC, FMPC, A1B2, etc.)
  const extractPrefix = (id) => {
    // Extracts all leading letters (e.g., "GIQC123" -> "GIQC", "MYSP99" -> "MYSP")
    const letterMatch = id.match(/^[A-Z]+/);
    if (letterMatch) return letterMatch[0];

    // Fallback for purely numeric or special character IDs
    return 'NUMERIC / OTHER';
  };

  // 3. Dynamically discover ALL unique prefixes in the pasted data
  const detectedPrefixes = useMemo(() => {
    const set = new Set();
    parsedIds.forEach((id) => {
      set.add(extractPrefix(id));
    });
    return Array.from(set).sort();
  }, [parsedIds]);

  // 4. Categorize tracking IDs into their detected prefix buckets
  const categorized = useMemo(() => {
    const map = {};
    detectedPrefixes.forEach((p) => (map[p] = []));

    parsedIds.forEach((id) => {
      const prefix = extractPrefix(id);
      if (map[prefix]) {
        map[prefix].push(id);
      }
    });

    return map;
  }, [parsedIds, detectedPrefixes]);

  // 5. Helper to check if a checkbox is enabled (defaults to true)
  const isPrefixSelected = (prefix) => {
    return selectedPrefixes[prefix] !== false;
  };

  // 6. Filter final output list based on checked prefixes
  const filteredList = useMemo(() => {
    let list = [];
    detectedPrefixes.forEach((prefix) => {
      if (isPrefixSelected(prefix)) {
        list = list.concat(categorized[prefix] || []);
      }
    });
    return list;
  }, [categorized, detectedPrefixes, selectedPrefixes]);

  // Toggle individual prefix checkbox
  function togglePrefix(prefix) {
    setSelectedPrefixes((prev) => ({
      ...prev,
      [prefix]: !isPrefixSelected(prefix),
    }));
  }

  // Toggle all checkboxes on or off
  function toggleSelectAll(selectAll) {
    const nextState = {};
    detectedPrefixes.forEach((prefix) => {
      nextState[prefix] = selectAll;
    });
    setSelectedPrefixes(nextState);
  }

  // Copy filtered list to clipboard
  async function handleCopy() {
    if (filteredList.length === 0) {
      toast('No tracking IDs selected to copy.', 'error');
      return;
    }
    try {
      await navigator.clipboard.writeText(filteredList.join('\n'));
      setCopied(true);
      toast(`Copied ${filteredList.length} tracking IDs!`, 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast('Failed to copy to clipboard.', 'error');
    }
  }

  // Export filtered list as a .txt file
  function handleDownloadTxt() {
    if (filteredList.length === 0) {
      toast('No tracking IDs selected to export.', 'error');
      return;
    }
    const textData = filteredList.join('\n');
    const blob = new Blob([textData], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sorted_tracking_ids_${filteredList.length}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast('Downloaded TXT file.', 'success');
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-ink-100 pb-4">
        <div>
          <h1 className="text-xl font-bold text-ink-900 flex items-center gap-2">
            <ListFilter className="h-5 w-5 text-brand-600" />
            Universal Dynamic Tracking Sorter
          </h1>
          <p className="text-xs text-ink-500 mt-1">
            Automatically parses any courier prefix format (GIQC, FMPC, MYSC, etc.) and generates instant filter controls.
          </p>
        </div>

        {parsedIds.length > 0 && (
          <button
            onClick={() => {
              setRawInput('');
              setSelectedPrefixes({});
            }}
            className="btn-ghost text-red-600 hover:bg-red-50 text-xs"
          >
            <Trash2 className="h-4 w-4" />
            Clear Input
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Column: Input and Dynamic Filters */}
        <div className="lg:col-span-2 space-y-5">
          {/* Input Box */}
          <div className="card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="label-text font-bold text-ink-900 flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-brand-600" />
                Paste Raw Bulk IDs
              </label>
              <span className="text-xs font-mono bg-ink-100 text-ink-700 px-2 py-0.5 rounded">
                Total: {parsedIds.length}
              </span>
            </div>
            <textarea
              className="input font-mono text-xs min-h-[200px] resize-y p-3"
              placeholder="Paste any tracking format here...&#10;&#10;GIQC98765432&#10;FMPC12345678&#10;MYSP11223344&#10;ANYOTHERPREFIX001"
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
            />
          </div>

          {/* Dynamic Prefix Checkboxes */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-ink-100 pb-2">
              <span className="text-sm font-bold text-ink-900 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-brand-600" />
                Detected Format Filters
              </span>
              {detectedPrefixes.length > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => toggleSelectAll(true)}
                    className="text-brand-600 hover:underline font-medium"
                  >
                    Select All
                  </button>
                  <span className="text-ink-300">|</span>
                  <button
                    type="button"
                    onClick={() => toggleSelectAll(false)}
                    className="text-ink-500 hover:underline"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            {detectedPrefixes.length > 0 ? (
              <div className="grid grid-cols-2 gap-2.5 max-h-[260px] overflow-y-auto pr-1">
                {detectedPrefixes.map((prefix) => {
                  const count = categorized[prefix]?.length || 0;
                  const isChecked = isPrefixSelected(prefix);

                  return (
                    <label
                      key={prefix}
                      onClick={() => togglePrefix(prefix)}
                      className={`flex items-center justify-between p-2.5 rounded-lg border text-xs cursor-pointer transition-all select-none ${
                        isChecked
                          ? 'border-brand-500 bg-brand-50/50 text-brand-900 font-semibold'
                          : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {isChecked ? (
                          <CheckSquare className="h-4 w-4 text-brand-600 flex-shrink-0" />
                        ) : (
                          <Square className="h-4 w-4 text-ink-400 flex-shrink-0" />
                        )}
                        <span className="truncate font-mono">{prefix}</span>
                      </div>
                      <span
                        className={`font-mono text-[11px] px-1.5 py-0.2 rounded flex-shrink-0 ${
                          isChecked ? 'bg-brand-100 text-brand-700' : 'bg-ink-100 text-ink-400'
                        }`}
                      >
                        {count}
                      </span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-ink-400 flex flex-col items-center gap-2">
                <AlertCircle className="h-5 w-5 text-ink-300" />
                <span>Paste tracking IDs above to automatically extract formats and checkboxes.</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Output Results */}
        <div className="lg:col-span-3 space-y-4">
          <div className="card p-5 space-y-4 min-h-[460px] flex flex-col justify-between">
            <div className="space-y-4">
              {/* Output Header Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 pb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-ink-900">Filtered Output</h3>
                  <span className="badge bg-brand-100 text-brand-700 font-mono text-xs">
                    {filteredList.length} Items
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    disabled={filteredList.length === 0}
                    className="btn-secondary text-xs py-1.5 px-3"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? 'Copied!' : 'Copy List'}
                  </button>

                  <button
                    onClick={handleDownloadTxt}
                    disabled={filteredList.length === 0}
                    className="btn-primary text-xs py-1.5 px-3"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export TXT
                  </button>
                </div>
              </div>

              {/* Output Display List */}
              {filteredList.length > 0 ? (
                <div className="bg-ink-900 rounded-lg p-4 font-mono text-xs text-green-400 max-h-[380px] overflow-y-auto space-y-1">
                  {filteredList.map((id, index) => {
                    const prefix = extractPrefix(id);
                    return (
                      <div
                        key={`${id}-${index}`}
                        className="flex items-center justify-between hover:bg-ink-800/80 px-2 py-0.5 rounded"
                      >
                        <span className="text-ink-100">{id}</span>
                        <span className="text-[10px] text-ink-500 uppercase tracking-wider">{prefix}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center text-ink-400 space-y-2 border-2 border-dashed border-ink-200 rounded-lg">
                  <Filter className="h-8 w-8 stroke-[1.5] text-ink-300" />
                  <p className="text-sm font-medium">No tracking IDs matching active checkboxes.</p>
                  <p className="text-xs text-ink-400">
                    Check one or more prefix filters on the left to display matching items.
                  </p>
                </div>
              )}
            </div>

            {/* Dynamic Stats Summary Bar */}
            {detectedPrefixes.length > 0 && (
              <div className="pt-3 border-t border-ink-100 flex flex-wrap gap-2">
                {detectedPrefixes.map((prefix) => (
                  <div key={prefix} className="bg-ink-50 px-2.5 py-1 rounded flex items-center gap-1.5 text-xs">
                    <span className="text-ink-500 font-semibold">{prefix}:</span>
                    <span className="font-bold font-mono text-ink-900">{categorized[prefix]?.length || 0}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}