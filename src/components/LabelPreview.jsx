import { Barcode } from './Barcode.jsx';

export function LabelPreview({ label, size, settings, organizationName, customerPosition, labelHeader }) {
  if (size.layout === 'compact') {
    return (
      <div
        className="label-50x25 bg-white border border-ink-200 flex flex-col p-1 overflow-hidden"
        style={{ width: `${size.widthMm}mm`, height: `${size.heightMm}mm` }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[6px] font-bold text-ink-700 truncate">
            {label.courier_name ?? 'COURIER'}
          </span>
          <span className="text-[6px] font-mono text-ink-500 truncate ml-1">
            {label.tracking_id}
          </span>
        </div>
        <Barcode
          value={label.tracking_id}
          settings={{ ...settings, height: 30, fontSize: 6, displayValue: false, margin: 0 }}
          className="flex-1 min-h-0"
        />
      </div>
    );
  }

  const header = labelHeader ?? { color: '#2563eb', heightMm: 22 };
  const customer = customerPosition ?? { xMm: 5, yMm: 62, widthMm: 90, fontSize: 11 };
  const bodyFontSize = Math.max(8, customer.fontSize - 2);

  return (
    <div
      className="bg-white border border-ink-300 shadow-card overflow-hidden relative"
      style={{ width: `${size.widthMm}mm`, height: `${size.heightMm}mm` }}
    >
      <div
        className="absolute inset-x-0 top-0 text-white px-4 flex items-center justify-between"
        style={{ height: `${header.heightMm}mm`, backgroundColor: header.color }}
      >
        <div>
          <h5 className="text-sm font-bold tracking-wide">SHIPPING LABEL</h5>
          <p className="text-[10px] text-white/80">{organizationName ?? 'ElasticRunKottakkal_KOT'}</p>
        </div>
        {label.courier_name && (
          <span className="text-xs font-bold bg-white/15 px-2 py-1 rounded">
            {label.courier_name}
          </span>
        )}
      </div>

      <div className="absolute" style={{ left: '5mm', top: `${header.heightMm + 5}mm`, right: '5mm' }}>
        <p className="text-[9px] font-bold text-ink-500 tracking-widest">TRACKING ID</p>
        <p className="text-base font-mono font-bold text-ink-900 break-all">
          {label.tracking_id || '-'}
        </p>
      </div>

      <Barcode
        value={label.tracking_id}
        settings={{ ...settings, height: 60, fontSize: 12, margin: 2 }}
        className="absolute bg-white border border-ink-100 rounded flex items-center justify-center"
        style={{ left: '5mm', top: `${header.heightMm + 20}mm`, width: `${size.widthMm - 10}mm`, height: '20mm' }}
      />

      <div
        className="absolute border border-dashed border-brand-300 bg-white/80 p-1"
        style={{ left: `${customer.xMm}mm`, top: `${customer.yMm}mm`, width: `${customer.widthMm}mm` }}
      >
        <p className="text-[9px] font-bold text-ink-500 tracking-widest mb-1">SHIP TO</p>
        <p className="font-bold text-ink-900 leading-tight" style={{ fontSize: `${customer.fontSize}px` }}>
          {label.receiver_name || 'Receiver name'}
        </p>
        <p className="text-ink-700 leading-snug" style={{ fontSize: `${bodyFontSize}px` }}>
          {label.receiver_address || 'Address'}
        </p>
        {(label.receiver_city || label.receiver_postal_code) && (
          <p className="text-ink-700 leading-snug" style={{ fontSize: `${bodyFontSize}px` }}>
            {[label.receiver_city, label.receiver_postal_code].filter(Boolean).join(' ')}
          </p>
        )}
        {label.receiver_country && (
          <p className="text-ink-700 leading-snug" style={{ fontSize: `${bodyFontSize}px` }}>{label.receiver_country}</p>
        )}
        {label.receiver_phone && (
          <p className="text-ink-600 leading-snug" style={{ fontSize: `${bodyFontSize}px` }}>Tel: {label.receiver_phone}</p>
        )}
      </div>

      {(label.sender_name || label.sender_address) && (
        <div className="absolute left-[5mm] right-[5mm] bottom-[14mm] border-t border-dashed border-ink-200 pt-2">
          <p className="text-[9px] font-bold text-ink-500 tracking-widest mb-1">FROM</p>
          {label.sender_name && <p className="text-xs font-semibold text-ink-800 leading-tight">{label.sender_name}</p>}
          {label.sender_address && <p className="text-xs text-ink-600 leading-snug">{label.sender_address}</p>}
        </div>
      )}

      {(label.courier_service || label.weight) && (
        <div className="absolute left-[5mm] right-[5mm] bottom-[5mm] border-t border-ink-200 pt-2 flex gap-4 text-[10px]">
          {label.courier_service && <div><span className="font-bold text-ink-500">SERVICE: </span><span className="text-ink-800">{label.courier_service}</span></div>}
          {label.weight && <div><span className="font-bold text-ink-500">WEIGHT: </span><span className="text-ink-800">{label.weight}</span></div>}
        </div>
      )}
    </div>
  );
}
