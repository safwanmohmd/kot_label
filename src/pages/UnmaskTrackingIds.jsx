import { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  Copy, 
  FileDown, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Trash2,
  Bell
} from 'lucide-react';

export function UnmaskTrackingIds() {
  const [originalInput, setOriginalInput] = useState('');
  const [maskedInput, setMaskedInput] = useState('');
  const [results, setResults] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stripWordsInput, setStripWordsInput] = useState('arrow_righsdas');
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const wordsToStrip = useMemo(() => {
    return stripWordsInput
      .split(/[\n,;\t]+/)
      .map((w) => w.trim())
      .filter(Boolean);
  }, [stripWordsInput]);

  function parseAndCleanLines(text) {
    return text
      .split(/[\n;\t]+/)
      .map((s) => {
        let cleaned = s.trim();
        wordsToStrip.forEach(word => {
          if (word) {
            const regex = new RegExp(word, 'gi');
            cleaned = cleaned.replace(regex, '');
          }
        });
        return cleaned.trim();
      })
      .filter(Boolean);
  }

  const handleFindMatches = () => {
    setIsProcessing(true);
    
    setTimeout(() => {
      const rawOriginals = parseAndCleanLines(originalInput);
      const rawMaskeds = parseAndCleanLines(maskedInput);

      if (rawOriginals.length === 0 || rawMaskeds.length === 0) {
        setResults([]);
        setIsProcessing(false);
        return;
      }

      // CHANGED: Map now stores an ARRAY of matching full IDs instead of just one string
      const lookupMap = new Map();
      rawOriginals.forEach(line => {
        const cleanId = line.toUpperCase();
        if (cleanId.length >= 4) {
          const prefix = cleanId.substring(0, 4);
          const suffix = cleanId.slice(-4);
          const key = `${prefix}_${suffix}`;
          
          if (!lookupMap.has(key)) {
            lookupMap.set(key, []);
          }
          lookupMap.get(key).push(line);
        }
      });

      const computedResults = [];
      rawMaskeds.forEach((line) => {
        const cleanMasked = line.toUpperCase();
        
        if (cleanMasked.length < 4) {
          computedResults.push({ maskedId: line, matchedId: '—', status: 'Invalid' });
          return;
        }

        const prefix = cleanMasked.substring(0, 4);
        const suffix = cleanMasked.slice(-4);
        const searchKey = `${prefix}_${suffix}`;

        if (lookupMap.has(searchKey)) {
          const matchedList = lookupMap.get(searchKey);
          
          // CHANGED: Push an entry for EVERY possible matched master tracking ID
          matchedList.forEach((fullId, index) => {
            computedResults.push({
              maskedId: line,
              matchedId: fullId,
              status: 'Found',
              matchCount: matchedList.length,
              matchIndex: index + 1
            });
          });
        } else {
          computedResults.push({
            maskedId: line,
            matchedId: '—',
            status: 'Not Found',
            matchCount: 0,
            matchIndex: 0
          });
        }
      });

      setResults(computedResults);
      setIsProcessing(false);
    }, 50);
  };

  const stats = useMemo(() => {
    const totalMasked = parseAndCleanLines(maskedInput).length;
    const found = results.filter(r => r.status === 'Found').length;
    const notFound = results.filter(r => r.status === 'Not Found').length;
    return { totalMasked, totalRows: results.length, found, notFound };
  }, [results, maskedInput]);

  const handleCopyResults = () => {
    if (results.length === 0) return;
    
    // Copies unique matched tracking IDs
    const matchedIdsOnly = Array.from(
      new Set(
        results
          .filter(r => r.status === 'Found')
          .map(r => r.matchedId)
      )
    ).join('\n');

    if (!matchedIdsOnly) {
      setToastMessage('No successful matches found to copy!');
      return;
    }

    navigator.clipboard.writeText(matchedIdsOnly);
    setToastMessage(`Copied ${stats.found} matched tracking IDs!`);
  };

  const handleExportCSV = () => {
    if (results.length === 0) return;
    const csvContent = [
      ['Masked ID', 'Matched Full ID', 'Status', 'Possible Matches Count'],
      ...results.map(r => [r.maskedId, r.matchedId, r.status, r.matchCount || 0])
    ]
      .map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `unmasked_tracking_matches.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleClearAll = () => {
    setOriginalInput('');
    setMaskedInput('');
    setResults([]);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto p-4 relative">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 bg-neutral-900 text-white px-4 py-3 rounded-xl shadow-xl border border-neutral-700 animate-slide-in font-medium text-sm">
          <Bell className="h-4 w-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-ink-100 shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-ink-900 flex items-center gap-2">
            <Search className="h-5 w-5 text-brand-600" />
            Tracking ID Unmask Deck
          </h1>
          <p className="text-xs text-ink-500">Match masked values against master lists instantly</p>
        </div>
        
        <div className="flex items-center gap-3">
          {results.length > 0 && (
            <div className="flex items-center gap-2">
              <button onClick={handleCopyResults} className="btn-secondary py-1.5 px-3 text-sm flex items-center gap-1.5">
                <Copy className="h-3.5 w-3.5" /> Copy Matches
              </button>
              <button onClick={handleExportCSV} className="btn-primary py-1.5 px-3 text-sm flex items-center gap-1.5">
                <FileDown className="h-3.5 w-3.5" /> Export CSV
              </button>
              <button onClick={handleClearAll} className="btn-ghost py-1.5 px-3 text-sm text-red-600 hover:bg-red-50">
                Clear
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Workspace Inputs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-xl border border-ink-200 shadow-sm flex flex-col">
              <label className="text-xs font-bold text-ink-700 uppercase tracking-wider mb-2 block">
                1. Master Full Tracking IDs
              </label>
              <textarea
                className="w-full min-h-[260px] p-3 border border-ink-200 rounded-lg font-mono text-xs focus:ring-2 focus:ring-brand-500 focus:border-brand-500 flex-1 resize-y"
                value={originalInput}
                onChange={(e) => setOriginalInput(e.target.value)}
                placeholder={`Paste absolute true codes here...\n\nFMPC4101158571\nFMPC8881158571\nBSRC0000018120`}
              />
            </div>

            <div className="bg-white p-4 rounded-xl border border-ink-200 shadow-sm flex flex-col">
              <label className="text-xs font-bold text-ink-700 uppercase tracking-wider mb-2 block">
                2. Masked Tracking IDs
              </label>
              <textarea
                className="w-full min-h-[260px] p-3 border border-ink-200 rounded-lg font-mono text-xs focus:ring-2 focus:ring-brand-500 focus:border-brand-500 flex-1 resize-y"
                value={maskedInput}
                onChange={(e) => setMaskedInput(e.target.value)}
                placeholder={`Paste masked text blocks...\n\narrow_righsdasFMPCXXX8571\nBSRCXXX8120`}
              />
            </div>
          </div>

          <div className="flex justify-start">
            <button
              onClick={handleFindMatches}
              disabled={isProcessing}
              className="w-full md:w-auto bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm px-6 py-2.5 rounded-lg shadow transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Scrubbing & Matching Data...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  Find Matches
                </>
              )}
            </button>
          </div>

          {/* Results Table View */}
          {results.length > 0 && (
            <div className="bg-white rounded-xl border border-ink-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-ink-50 border-b border-ink-200">
                <h3 className="text-xs font-bold text-ink-800 uppercase tracking-wider">Computed Run Results</h3>
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-ink-50 sticky top-0 border-b border-ink-200 z-10">
                    <tr>
                      <th className="px-4 py-2 text-xs font-bold text-ink-600 uppercase tracking-wider">Scrubbed Masked ID</th>
                      <th className="px-4 py-2 text-xs font-bold text-ink-600 uppercase tracking-wider">Matched Full ID</th>
                      <th className="px-4 py-2 text-xs font-bold text-ink-600 uppercase tracking-wider text-center">Matches</th>
                      <th className="px-4 py-2 text-xs font-bold text-ink-600 uppercase tracking-wider text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100 font-mono text-xs text-ink-900">
                    {results.map((row, idx) => (
                      <tr key={idx} className="hover:bg-ink-50 transition-colors">
                        <td className="px-4 py-2.5 select-all">{row.maskedId}</td>
                        <td className={`px-4 py-2.5 select-all font-bold ${row.status === 'Found' ? 'text-brand-700' : 'text-ink-400'}`}>
                          {row.matchedId}
                        </td>
                        <td className="px-4 py-2.5 text-center text-[11px] text-ink-500 font-sans">
                          {row.matchCount > 1 ? (
                            <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold">
                              {row.matchIndex} of {row.matchCount}
                            </span>
                          ) : row.matchCount === 1 ? (
                            <span className="text-ink-400">1 of 1</span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            row.status === 'Found' 
                              ? 'bg-green-50 text-green-700 border border-green-200' 
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}>
                            {row.status === 'Found' ? (
                              <CheckCircle className="h-3 w-3" />
                            ) : (
                              <XCircle className="h-3 w-3" />
                            )}
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Panel */}
        <div className="space-y-5">
          <div className="bg-white p-5 rounded-xl border border-amber-200 shadow-sm bg-amber-50/10">
            <div className="flex items-center gap-1.5 text-amber-800 font-bold text-sm mb-2">
              <Trash2 className="h-4 w-4 text-amber-600" />
              <h3>Scrub Text Prefixes</h3>
            </div>
            <p className="text-[11px] text-ink-500 mb-3">
              Words typed here are deleted from lines before matching.
            </p>
            <textarea
              className="w-full p-2 border border-ink-200 rounded-lg font-mono text-xs focus:ring-2 focus:ring-amber-500 focus:border-amber-500 min-h-[80px] resize-y bg-white"
              value={stripWordsInput}
              onChange={(e) => setStripWordsInput(e.target.value)}
              placeholder="e.g., arrow_righsdas"
            />
          </div>

          <div className="bg-white p-5 rounded-xl border border-ink-200 shadow-sm">
            <h3 className="text-sm font-bold text-ink-900 mb-4">Verification Statistics</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-ink-700">
                <span>Masked Input Lines</span>
                <span className="font-mono font-bold text-ink-900">{stats.totalMasked}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-ink-700">
                <span>Total Matches Generated</span>
                <span className="font-mono font-bold text-green-600">{stats.found}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-ink-700">
                <span>Unresolved / Missing</span>
                <span className="font-mono font-bold text-red-600">{stats.notFound}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}