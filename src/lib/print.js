export function printHtml(html) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  const cleanup = () => {
    setTimeout(() => {
      if (iframe.parentNode) document.body.removeChild(iframe);
    }, 1000);
  };

  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      // ignore
    }
    cleanup();
  };

  setTimeout(cleanup, 3000);
}

export function buildPrintDocument(bodyHtml, pageSizeMm, extraCss = '') {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Print</title>
<style>
  @page { size: ${pageSizeMm.w}mm ${pageSizeMm.h}mm; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: white; }
  body { font-family: 'Inter', system-ui, sans-serif; color: #0f172a; }
  .print-page { page-break-after: always; }
  .print-page:last-child { page-break-after: auto; }
  .barcode-svg rect { shape-rendering: crispEdges; }
  ${extraCss}
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}
