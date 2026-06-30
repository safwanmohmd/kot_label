import { useEffect, useRef, useState } from 'react';
import { renderBarcode } from '../lib/barcode.js';

export function Barcode({ value, settings, className, style }) {
  const containerRef = useRef(null);
  const [svgString, setSvgString] = useState('');
  const [isQr, setIsQr] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!value) {
      setSvgString('');
      return;
    }
    renderBarcode(value, settings)
      .then((r) => {
        if (cancelled) return;
        if (settings.type === 'QR') {
          setIsQr(true);
          setSvgString(r.dataUrl);
        } else {
          setIsQr(false);
          setSvgString(r.svgString);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setSvgString('');
      });
    return () => {
      cancelled = true;
    };
  }, [value, settings]);

  return (
    <div ref={containerRef} className={className} style={style}>
      {svgString && isQr && (
        <img src={svgString} alt={`QR ${value}`} className="w-full h-full object-contain" />
      )}
      {svgString && !isQr && (
        <div
          className="barcode-svg w-full h-full flex items-center justify-center"
          dangerouslySetInnerHTML={{ __html: svgString }}
        />
      )}
      {!svgString && (
        <div className="w-full h-full flex items-center justify-center text-ink-300 text-xs">
          {value ? 'Generating…' : 'Enter a tracking ID'}
        </div>
      )}
    </div>
  );
}
