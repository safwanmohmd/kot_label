import { useState, useRef, useEffect, useMemo } from 'react';
import { Download, Copy, Calendar, Building2, Bell, Palette } from 'lucide-react';

export function EodReportGenerator() {
  const [reportDate, setReportDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [hubName, setHubName] = useState('ElasticRunKottakalODH_KOT');
  const [toastMessage, setToastMessage] = useState('');

  // Customizable Table Colors
  const [headerBg, setHeaderBg] = useState('#00FF00'); // Green default
  const [subHeaderBg, setSubHeaderBg] = useState('#FF9900'); // Orange default

  const [metrics, setMetrics] = useState([
    { id: 'conversion', label: 'Conversion', completed: 88, total: 100, remark: '' },
    { id: 'nexus', label: 'Nexus', completed: 10, total: 10, remark: '' },
    { id: 'cpt', label: 'CPT', completed: 15, total: 15, remark: '' },
    { id: 'prc', label: 'PRC', completed: 5, total: 5, remark: '' },
    { id: 'cv', label: 'CV', completed: 8, total: 8, remark: '' },
    { id: 'refund_rvp', label: 'Refund RVP', completed: 12, total: 12, remark: '' },
    { id: 'pp_escalation', label: 'PP Escalation', completed: 1, total: 2, remark: '' }
  ]);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const formattedDate = useMemo(() => {
    if (!reportDate) return '';
    const [year, month, day] = reportDate.split('-');
    return `${day}.${month}.${year}`;
  }, [reportDate]);

  const handleMetricChange = (index, field, value) => {
    const updated = [...metrics];
    updated[index][field] = value;
    setMetrics(updated);
  };

  // Safe Percentage Calculation (Capped at 100% max)
  const calcPercentage = (completed, total) => {
    const compNum = parseFloat(completed);
    const totNum = parseFloat(total);

    if (isNaN(compNum) || isNaN(totNum) || totNum === 0) return '0%';
    
    // Calculates percentage and caps at 100% maximum
    const rawPct = Math.round((compNum / totNum) * 100);
    const finalPct = Math.min(rawPct, 100); 
    
    return `${finalPct}%`;
  };

  // Canvas Generator Helper with Dynamic Colors
  const generateCanvas = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const width = 500;
    const rowHeight = 30;
    const headerHeight = 32;
    const totalHeight = headerHeight * 2 + metrics.length * rowHeight;

    canvas.width = width * 2; // High-DPI Scaling
    canvas.height = totalHeight * 2;
    ctx.scale(2, 2);

    // Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, totalHeight);

    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#000000';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 1. Custom Title Header Row
    ctx.fillStyle = headerBg;
    ctx.fillRect(0, 0, width, headerHeight);
    ctx.strokeRect(0, 0, width, headerHeight);
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 14px Arial, sans-serif';
    ctx.fillText(`EOD Report Date ${formattedDate}`, width / 2, headerHeight / 2);

    // 2. Custom Sub-Header Row
    const col1W = 150;
    const col2W = 220;
    const col3W = 130;
    const y2 = headerHeight;

    ctx.fillStyle = subHeaderBg;
    ctx.fillRect(0, y2, width, headerHeight);

    // Grid lines for column headers
    ctx.strokeRect(0, y2, col1W, headerHeight);
    ctx.strokeRect(col1W, y2, col2W, headerHeight);
    ctx.strokeRect(col1W + col2W, y2, col3W, headerHeight);

    ctx.fillStyle = '#000000';
    ctx.font = 'bold 12px Arial, sans-serif';
    ctx.fillText(hubName, col1W + col2W / 2, y2 + headerHeight / 2);
    ctx.fillText('Remarks', col1W + col2W + col3W / 2, y2 + headerHeight / 2);

    // 3. Metric Rows
    metrics.forEach((row, i) => {
      const y = y2 + headerHeight + i * rowHeight;
      const pct = calcPercentage(row.completed, row.total);

      // Borders
      ctx.strokeRect(0, y, col1W, rowHeight);
      ctx.strokeRect(col1W, y, col2W, rowHeight);
      ctx.strokeRect(col1W + col2W, y, col3W, rowHeight);

      // Text
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 12px Arial, sans-serif';

      ctx.textAlign = 'center';
      ctx.fillText(row.label, col1W / 2, y + rowHeight / 2);
      ctx.fillText(pct, col1W + col2W / 2, y + rowHeight / 2);

      if (row.remark) {
        ctx.textAlign = 'left';
        ctx.font = 'normal 11px Arial, sans-serif';
        ctx.fillText(row.remark, col1W + col2W + 8, y + rowHeight / 2);
      }
    });

    return canvas;
  };

  const handleDownloadPng = () => {
    const canvas = generateCanvas();
    const link = document.createElement('a');
    link.download = `EOD_Report_${formattedDate.replace(/\./g, '_')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    setToastMessage('Report downloaded as PNG!');
  };

  const handleCopyImageToClipboard = () => {
    const canvas = generateCanvas();
    canvas.toBlob((blob) => {
      if (blob) {
        navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
        setToastMessage('Report image copied to clipboard!');
      }
    });
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto p-4 relative font-sans">
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 bg-neutral-900 text-white px-4 py-3 rounded-xl shadow-xl border border-neutral-700 font-medium text-sm">
          <Bell className="h-4 w-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-neutral-200 shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-neutral-900">EOD Report Builder</h1>
          <p className="text-xs text-neutral-500">Calculate percentage KPIs and export customized image reports</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyImageToClipboard}
            className="btn-secondary py-2 px-3 text-xs md:text-sm font-semibold flex items-center gap-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-lg border border-neutral-300 transition-colors"
          >
            <Copy className="h-4 w-4 text-neutral-600" /> Copy Image
          </button>
          <button
            onClick={handleDownloadPng}
            className="btn-primary py-2 px-3 text-xs md:text-sm font-semibold flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow transition-colors"
          >
            <Download className="h-4 w-4" /> Download PNG
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Input Section */}
        <div className="lg:col-span-6 bg-white p-5 rounded-xl border border-neutral-200 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-neutral-800 border-b pb-2 uppercase tracking-wide">
            1. Report Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-neutral-600 mb-1 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" /> Date
              </label>
              <input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className="w-full text-xs p-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-600 mb-1 flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" /> Hub Code / Name
              </label>
              <input
                type="text"
                value={hubName}
                onChange={(e) => setHubName(e.target.value)}
                className="w-full text-xs p-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <h2 className="text-sm font-bold text-neutral-800 border-b pt-2 pb-2 uppercase tracking-wide">
            2. Enter Metrics (Delivered / Total)
          </h2>

          <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
            {metrics.map((m, idx) => (
              <div key={m.id} className="grid grid-cols-12 gap-2 items-center bg-neutral-50 p-2 rounded border border-neutral-200 text-xs">
                <span className="col-span-4 font-bold text-neutral-800 truncate">{m.label}</span>
                <input
                  type="number"
                  placeholder="Done"
                  value={m.completed}
                  onChange={(e) => handleMetricChange(idx, 'completed', e.target.value)}
                  className="col-span-2 text-center p-1 border rounded bg-white"
                />
                <span className="col-span-1 text-center font-bold text-neutral-400">/</span>
                <input
                  type="number"
                  placeholder="Total"
                  value={m.total}
                  onChange={(e) => handleMetricChange(idx, 'total', e.target.value)}
                  className="col-span-2 text-center p-1 border rounded bg-white"
                />
                <input
                  type="text"
                  placeholder="Remark"
                  value={m.remark}
                  onChange={(e) => handleMetricChange(idx, 'remark', e.target.value)}
                  className="col-span-3 p-1 border rounded bg-white text-[11px]"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Right Live Preview Section */}
        <div className="lg:col-span-6 flex flex-col items-center justify-start bg-neutral-100 p-6 rounded-xl border border-neutral-200 space-y-4">
          <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
            Live Preview & Theme Controls
          </p>

          {/* Color Customization Toolbar */}
          <div className="flex items-center gap-4 bg-white px-4 py-2.5 rounded-lg border border-neutral-300 shadow-xs text-xs font-medium">
            <div className="flex items-center gap-1.5">
              <Palette className="h-3.5 w-3.5 text-neutral-500" />
              <span>Header:</span>
              <input
                type="color"
                value={headerBg}
                onChange={(e) => setHeaderBg(e.target.value)}
                className="w-6 h-6 rounded cursor-pointer border border-neutral-300 p-0"
              />
            </div>
            <div className="h-4 w-px bg-neutral-300" />
            <div className="flex items-center gap-1.5">
              <span>Sub-Header:</span>
              <input
                type="color"
                value={subHeaderBg}
                onChange={(e) => setSubHeaderBg(e.target.value)}
                className="w-6 h-6 rounded cursor-pointer border border-neutral-300 p-0"
              />
            </div>
          </div>

          {/* Live Table */}
          <div className="bg-white p-1 inline-block shadow-md" style={{ width: '420px', fontFamily: 'Calibri, Arial, sans-serif' }}>
            <table className="w-full border-collapse text-black text-center border-2 border-black">
              <thead>
                <tr>
                  <th
                    colSpan="3"
                    className="border-2 border-black px-2 py-1.5 text-sm font-bold"
                    style={{ backgroundColor: headerBg }}
                  >
                    EOD Report Date {formattedDate}
                  </th>
                </tr>
                <tr>
                  <th
                    className="border-2 border-black w-1/3 px-1 py-1 text-xs font-bold"
                    style={{ backgroundColor: subHeaderBg }}
                  ></th>
                  <th
                    className="border-2 border-black w-2/5 px-2 py-1 text-xs font-bold truncate"
                    style={{ backgroundColor: subHeaderBg }}
                  >
                    {hubName}
                  </th>
                  <th
                    className="border-2 border-black w-1/4 px-2 py-1 text-xs font-bold"
                    style={{ backgroundColor: subHeaderBg }}
                  >
                    Remarks
                  </th>
                </tr>
              </thead>
              <tbody className="text-xs font-bold">
                {metrics.map((row) => (
                  <tr key={row.id}>
                    <td className="border-2 border-black px-2 py-1 text-center bg-white">{row.label}</td>
                    <td className="border-2 border-black px-2 py-1 bg-white">{calcPercentage(row.completed, row.total)}</td>
                    <td className="border-2 border-black px-2 py-1 bg-white text-left font-normal text-[11px]">{row.remark}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}