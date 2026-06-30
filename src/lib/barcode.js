import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';

function renderLinear(value, type, settings) {
  const safeValue =
    type === 'CODE39'
      ? value.toUpperCase().replace(/[^A-Z0-9 \-.$/+%]/g, '')
      : value;

  const tmpSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  JsBarcode(tmpSvg, safeValue || ' ', {
    format: type,
    width: settings.width,
    height: settings.height,
    displayValue: settings.displayValue,
    fontSize: settings.fontSize,
    margin: settings.margin,
    background: settings.background,
    lineColor: settings.lineColor,
    textMargin: 4,
    font: 'monospace',
    fontOptions: 'bold',
  });

  const svgString = tmpSvg.outerHTML;
  const dataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgString)))}`;
  return { dataUrl, svgString };
}

async function renderQr(value, settings) {
  const dark = settings.lineColor;
  const light = settings.background;
  const dataUrl = await QRCode.toDataURL(value || ' ', {
    errorCorrectionLevel: 'M',
    margin: settings.margin,
    width: Math.max(80, settings.height * 2),
    color: { dark, light },
  });
  const svgString = `<img src="${dataUrl}" alt="QR" />`;
  return { dataUrl, svgString };
}

export async function renderBarcode(value, settings) {
  const type = settings.type;
  if (type === 'QR') {
    return renderQr(value, settings);
  }
  return renderLinear(value, type, settings);
}

export function renderBarcodeSync(value, settings) {
  const type = settings.type;
  if (type === 'QR') {
    return {
      dataUrl: '',
      svgString: `<div class="text-xs text-ink-400">QR renders async</div>`,
    };
  }
  return renderLinear(value, type, settings);
}

export function supportsValue(type, value) {
  if (!value) return false;
  if (type === 'CODE39') {
    return /^[A-Z0-9 \-.$/+%]*$/.test(value.toUpperCase());
  }
  return true;
}

export function sanitizeForCode39(value) {
  return value.toUpperCase().replace(/[^A-Z0-9 \-.$/+%]/g, '');
}
