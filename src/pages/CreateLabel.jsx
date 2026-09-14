import React, { useState, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { QRCodeSVG } from 'qrcode.react';
import Barcode from 'react-barcode';
import { 
  Printer, 
  Download, 
  Copy, 
  Check, 
  RefreshCw, 
  FileText, 
  Layers, 
  Settings2,
  MapPin,
  User,
  Package,
  Truck
} from 'lucide-react';

export default function CreatePrnLabel() {
  const [formData, setFormData] = useState({
    // Header & Meta
    logisticsType: 'NDD E-Kart Logistics',
    paymentType: 'PREPAID',
    priorityTag: 'PRIORITY',
    hubCode: 'CCJ/KOT',
    routeCode: '13-09',
    batchCode: 'LIAADSJ270015039',
    vendorCode: 'NPG',
    
    // Core Tracking
    trackingNumber: 'FMPP4273763844',
    orderId: 'S99090861540',
    platform: 'Flipkart',
    
    // Recipient Info
    customerName: 'Nasrin K',
    addressLine1: 'Kuruniyan saw mill Othukkungal',
    landmark: 'after the transformer',
    cityArea: 'Nottanalakkal, Othukkungal, Near Jamia Ihyaussun',
    districtPin: 'Malappuram - 676528',
    state: 'Kerala',
    
    // Label Config
    labelStyle: 'ekart-ndd-priority', // 'standard' | 'compact' | 'ekart-ndd-priority'
    widthMm: 75,
    heightMm: 100,
    copies: 1
  });

  const [copied, setCopied] = useState(false);
  const printRef = useRef();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `PRN_Label_${formData.trackingNumber || 'Print'}`,
    pageStyle: `
      @page {
        size: ${formData.widthMm}mm ${formData.heightMm}mm;
        margin: 0;
      }
      @media print {
        body {
          margin: 0;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      }
    `
  });

  // Generate Zebra / TSPL PRN command format string
  const generatePrnCode = () => {
    const { 
      trackingNumber, customerName, addressLine1, 
      districtPin, hubCode, orderId, paymentType, 
      priorityTag, logisticsType, routeCode, batchCode, vendorCode 
    } = formData;

    return `^XA
^PW600
^LL800
^PON

; --- TOP BAR ---
^FO30,30^A0N,22,22^FD${logisticsType}^FS
^FO330,30^A0N,22,22^FD${paymentType}^FS
^FO430,24^GB140,32,32^FS
^FO440,30^A0N,22,22^FR^FD${priorityTag}^FS
^FO30,65^GB540,2,2^FS

; --- LEFT VERTICAL BARCODE & TEXT ---
^FO40,90^BY2,3,90^B3R,N,70,N,N^FD${trackingNumber}^FS
^FO120,95^A0R,24,24^FD${hubCode}^FS
^FO120,230^A0R,22,22^FD${trackingNumber}^FS

; --- MINI ROUTING CODE & BATCH ---
^FO30,520^A0N,20,20^FD${routeCode}^FS
^FO30,545^A0N,16,16^FD${batchCode}^FS
^FO30,570^BY1,2,40^BCN,40,N,N,N^FD${trackingNumber}^FS

; --- QR CODE ---
^FO170,90^BQN,2,6^FDQA,${trackingNumber};${orderId};${districtPin}^FS

; --- CUSTOMER & ADDRESS DETAILS ---
^FO170,360^A0N,22,22^FD${customerName}^FS
^FO170,390^A0N,18,18^FD${addressLine1}^FS
^FO170,415^A0N,18,18^FD${formData.landmark}^FS
^FO170,440^A0N,18,18^FD${formData.cityArea}^FS
^FO170,465^A0N,20,20^B^FD${districtPin}^FS
^FO170,490^A0N,18,18^FD${formData.state}^FS

; --- FOOTER ---
^FO220,535^A0N,18,18^FD${vendorCode}^FS
^FO340,525^A0N,18,18^FDOrdered Through ${formData.platform}^FS
^FO400,545^A0N,20,20^FD${orderId}^FS

^XZ`;
  };

  const handleCopyPrn = () => {
    navigator.clipboard.writeText(generatePrnCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPrn = () => {
    const element = document.createElement("a");
    const file = new Blob([generatePrnCode()], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `${formData.trackingNumber || 'label'}.prn`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2 text-white">
              <Printer className="w-7 h-7 text-indigo-400" />
              PRN Label Generator & Thermal Styler
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Generate industrial ZPL/PRN code and high-precision SVG thermal labels
            </p>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-medium shadow-md hover:shadow-indigo-500/20 transition-all text-sm"
            >
              <Printer className="w-4 h-4" /> Print Label
            </button>
            <button
              onClick={handleDownloadPrn}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-2 rounded-lg font-medium transition-all text-sm"
            >
              <Download className="w-4 h-4" /> Export .PRN
            </button>
            <button
              onClick={handleCopyPrn}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-2 rounded-lg font-medium transition-all text-sm"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied' : 'Copy PRN'}
            </button>
          </div>
        </div>

        {/* Workspace Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Controls / Inputs Form */}
          <div className="lg:col-span-6 space-y-6">
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
                <span className="font-semibold text-sm text-slate-200 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-400" /> Style & Template Layout
                </span>
                <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/30 font-mono">
                  ZPL/Thermal
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Select Label Preset</label>
                <select
                  name="labelStyle"
                  value={formData.labelStyle}
                  onChange={handleInputChange}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="ekart-ndd-priority">Ekart NDD Priority (Compact Vertical Barcode)</option>
                  <option value="standard">Standard E-Commerce Shipping (Horizontal)</option>
                  <option value="compact">Compact Warehouse Mini Label</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Header / Logistics Brand</label>
                  <input
                    type="text"
                    name="logisticsType"
                    value={formData.logisticsType}
                    onChange={handleInputChange}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Priority / Tag</label>
                  <input
                    type="text"
                    name="priorityTag"
                    value={formData.priorityTag}
                    onChange={handleInputChange}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Tracking & Logistics Info */}
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-5 shadow-lg space-y-4">
              <span className="font-semibold text-sm text-slate-200 flex items-center gap-2 border-b border-slate-700/60 pb-3">
                <Truck className="w-4 h-4 text-emerald-400" /> Tracking & Routing Identifiers
              </span>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Tracking / AWB Number</label>
                  <input
                    type="text"
                    name="trackingNumber"
                    value={formData.trackingNumber}
                    onChange={handleInputChange}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm font-mono text-white focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Hub / Route Tag</label>
                  <input
                    type="text"
                    name="hubCode"
                    value={formData.hubCode}
                    onChange={handleInputChange}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm font-mono text-white focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Order ID</label>
                  <input
                    type="text"
                    name="orderId"
                    value={formData.orderId}
                    onChange={handleInputChange}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm font-mono text-white focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Payment Mode</label>
                  <select
                    name="paymentType"
                    value={formData.paymentType}
                    onChange={handleInputChange}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="PREPAID">PREPAID</option>
                    <option value="COD">CASH ON DELIVERY (COD)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Run Date/Route Code</label>
                  <input
                    type="text"
                    name="routeCode"
                    value={formData.routeCode}
                    onChange={handleInputChange}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Batch / Bag Manifest</label>
                  <input
                    type="text"
                    name="batchCode"
                    value={formData.batchCode}
                    onChange={handleInputChange}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white"
                  />
                </div>
              </div>
            </div>

            {/* Destination Address */}
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-5 shadow-lg space-y-4">
              <span className="font-semibold text-sm text-slate-200 flex items-center gap-2 border-b border-slate-700/60 pb-3">
                <MapPin className="w-4 h-4 text-amber-400" /> Customer & Destination
              </span>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Customer Name</label>
                  <input
                    type="text"
                    name="customerName"
                    value={formData.customerName}
                    onChange={handleInputChange}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Address Line</label>
                  <input
                    type="text"
                    name="addressLine1"
                    value={formData.addressLine1}
                    onChange={handleInputChange}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Landmark</label>
                    <input
                      type="text"
                      name="landmark"
                      value={formData.landmark}
                      onChange={handleInputChange}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Locality / Area</label>
                    <input
                      type="text"
                      name="cityArea"
                      value={formData.cityArea}
                      onChange={handleInputChange}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">City / PIN Code</label>
                    <input
                      type="text"
                      name="districtPin"
                      value={formData.districtPin}
                      onChange={handleInputChange}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">State</label>
                    <input
                      type="text"
                      name="state"
                      value={formData.state}
                      onChange={handleInputChange}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Label Preview Container */}
          <div className="lg:col-span-6 flex flex-col items-center">
            <div className="sticky top-6 w-full flex flex-col items-center">
              <div className="w-full flex items-center justify-between mb-3 px-2 text-xs text-slate-400">
                <span>Direct Print Preview (Thermal 1:1)</span>
                <span>Preset: {formData.labelStyle}</span>
              </div>

              {/* Printable Component Container */}
              <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-2xl flex justify-center w-full overflow-auto">
                <div 
                  ref={printRef}
                  className="bg-white text-black font-sans selection:bg-none"
                  style={{
                    width: '340px',
                    minHeight: '430px',
                    padding: '12px 14px',
                    boxSizing: 'border-box',
                    border: '1px solid #d1d5db',
                    fontSize: '11px',
                    lineHeight: '1.25'
                  }}
                >
                  {/* --- NEW STYLE: EKART NDD PRIORITY --- */}
                  {formData.labelStyle === 'ekart-ndd-priority' ? (
                    <div className="flex flex-col h-full justify-between select-none">
                      {/* Top bar */}
                      <div className="flex items-center justify-between border-b border-black pb-1.5 text-[11px] font-bold tracking-tight">
                        <span className="font-extrabold uppercase">{formData.logisticsType}</span>
                        <div className="flex items-center gap-1.5">
                          <span>{formData.paymentType}</span>
                          <span className="bg-black text-white px-1.5 py-0.5 text-[9px] font-black uppercase rounded-none">
                            {formData.priorityTag}
                          </span>
                        </div>
                      </div>

                      {/* Main Center Area */}
                      <div className="grid grid-cols-12 gap-1.5 py-2.5 items-start">
                        {/* Left Vertical Section (Barcode & Vertical Text) */}
                        <div className="col-span-4 flex flex-col items-center justify-start pr-1">
                          <div className="flex items-center justify-center -rotate-90 origin-center my-14 translate-y-2">
                            <div className="flex items-center gap-1.5">
                              <Barcode
                                value={formData.trackingNumber || 'EMPTY'}
                                width={1.2}
                                height={38}
                                displayValue={false}
                                margin={0}
                              />
                              <div className="flex flex-col text-[9px] font-mono font-bold leading-tight">
                                <span>{formData.hubCode}</span>
                                <span>{formData.trackingNumber}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Right Section: Large QR Code + Full Address */}
                        <div className="col-span-8 flex flex-col pl-1 space-y-2">
                          <div className="flex justify-start">
                            <QRCodeSVG
                              value={`${formData.trackingNumber}|${formData.orderId}|${formData.districtPin}`}
                              size={128}
                              level="M"
                              includeMargin={false}
                            />
                          </div>

                          <div className="text-[10px] space-y-0.5 leading-snug">
                            <p className="font-bold text-[11px] text-neutral-900">{formData.customerName}</p>
                            <p className="text-neutral-800">{formData.addressLine1}</p>
                            {formData.landmark && <p className="text-neutral-600 italic text-[9px]">{formData.landmark}</p>}
                            <p className="text-neutral-800">{formData.cityArea}</p>
                            <p className="font-bold text-[11px] text-neutral-950 mt-1">{formData.districtPin}</p>
                            <p className="text-neutral-800">{formData.state}</p>
                          </div>
                        </div>
                      </div>

                      {/* Bottom Footer Section */}
                      <div className="border-t border-black/80 pt-2 flex items-end justify-between text-[9px]">
                        <div className="flex flex-col space-y-0.5">
                          <span className="font-bold text-[10px] font-mono">{formData.routeCode}</span>
                          <span className="text-[8px] font-mono tracking-tighter text-neutral-700">{formData.batchCode}</span>
                          <div className="pt-0.5">
                            <Barcode
                              value={formData.routeCode?.replace(/[^a-zA-Z0-9]/g, '') || '1309'}
                              width={1.0}
                              height={20}
                              displayValue={false}
                              margin={0}
                            />
                          </div>
                        </div>

                        <div className="text-right flex flex-col items-end">
                          <span className="font-bold text-[10px] uppercase">{formData.vendorCode}</span>
                          <span className="text-neutral-600 text-[8px]">Ordered Through {formData.platform}</span>
                          <span className="font-mono font-bold text-[9px] text-neutral-900">{formData.orderId}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Fallback / Standard E-Commerce View */
                    <div className="space-y-4 text-xs">
                      <div className="flex justify-between border-b pb-2 font-bold">
                        <span>{formData.logisticsType}</span>
                        <span>{formData.paymentType}</span>
                      </div>
                      <div className="flex justify-center">
                        <Barcode value={formData.trackingNumber || 'SAMPLE'} width={1.5} height={50} />
                      </div>
                      <div className="border-t pt-2 space-y-1 text-left">
                        <p className="font-bold">{formData.customerName}</p>
                        <p>{formData.addressLine1}</p>
                        <p>{formData.districtPin}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Raw ZPL / PRN Inspection Modal-like Viewer */}
              <div className="w-full mt-4 bg-slate-900 border border-slate-800 rounded-xl p-3">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-mono">
                  <span>PRN Command Output (ZPL II Compatible)</span>
                  <button onClick={handleCopyPrn} className="text-indigo-400 hover:text-indigo-300">
                    {copied ? 'Copied!' : 'Copy Code'}
                  </button>
                </div>
                <pre className="bg-black/60 p-3 rounded text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-40 selection:bg-emerald-900">
                  {generatePrnCode()}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
