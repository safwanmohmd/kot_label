import jsPDF from 'jspdf';
import { renderBarcode } from './barcode.js';
import { getLabelSize } from '../types/label.js';
import { CUSTOM_LABEL_SIZE_KEY } from './settings.js';

function wrapText(doc, text, maxWidth) {
  return doc.splitTextToSize(text, maxWidth);
}

async function drawLabelOnPage(doc, data, size, settings, originMm) {
  const { x: ox, y: oy } = originMm;
  const w = size.widthMm;
  const h = size.heightMm;

  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.3);
  doc.rect(ox, oy, w, h);

  if (size.layout === 'compact') {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);
    doc.text(data.trackingId, ox + 1.5, oy + 3, { maxWidth: w - 3 });

    const { dataUrl } = await renderBarcode(data.trackingId, {
      ...settings,
      height: 40,
      fontSize: 8,
      displayValue: false,
      margin: 1,
    });
    if (dataUrl) {
      const imgW = w - 3;
      const imgH = 14;
      doc.addImage(dataUrl, 'PNG', ox + 1.5, oy + 4, imgW, imgH);
    }
    return;
  }

  const padX = 4;
  let cursorY = oy + 5;

  const header = data.labelHeader ?? { color: '#2563eb', heightMm: 8 };
  const headerRgb = hexToRgb(header.color);
  const headerHeight = header.heightMm ?? 8;
  doc.setFillColor(headerRgb.r, headerRgb.g, headerRgb.b);
  doc.rect(ox, oy, w, headerHeight, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('SHIPPING LABEL', ox + padX, oy + Math.min(headerHeight - 3, 4.5));
  if (data.courierName) {
    doc.setFontSize(9);
    doc.text(data.courierName.toUpperCase(), ox + w - padX, oy + Math.min(headerHeight - 3, 5.5), {
      align: 'right',
    });
  }

  cursorY = oy + headerHeight + 6;
  doc.setTextColor(15, 23, 42);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('TRACKING ID', ox + padX, cursorY);
  doc.setFontSize(13);
  doc.text(data.trackingId, ox + padX, cursorY + 5);

  cursorY += 8;
  const { dataUrl } = await renderBarcode(data.trackingId, {
    ...settings,
    height: 50,
    fontSize: 12,
    margin: 2,
  });
  if (dataUrl) {
    const barW = w - padX * 2;
    const barH = 22;
    doc.addImage(dataUrl, 'PNG', ox + padX, cursorY, barW, barH);
  }
  cursorY += 26;

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  doc.line(ox + padX, cursorY, ox + w - padX, cursorY);
  cursorY += 4;

  const customer = data.customerPosition;
  const customerX = customer ? ox + customer.xMm : ox + padX;
  const customerWidth = customer ? customer.widthMm : w - padX * 2;
  if (customer) cursorY = oy + customer.yMm;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('SHIP TO', customerX, cursorY);
  cursorY += 4;

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(customer?.fontSize ?? 11);
  doc.text(data.receiverName, customerX, cursorY);
  cursorY += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(Math.max(8, (customer?.fontSize ?? 11) - 2));
  const addrLines = wrapText(doc, data.receiverAddress, customerWidth);
  doc.text(addrLines, customerX, cursorY);
  cursorY += addrLines.length * 4;

  const cityLine = [data.receiverCity, data.receiverPostalCode]
    .filter(Boolean)
    .join(' ');
  if (cityLine) {
    doc.text(cityLine, customerX, cursorY);
    cursorY += 4;
  }
  if (data.receiverCountry) {
    doc.text(data.receiverCountry, customerX, cursorY);
    cursorY += 4;
  }
  if (data.receiverPhone) {
    doc.text(`Tel: ${data.receiverPhone}`, customerX, cursorY);
    cursorY += 4;
  }

  cursorY += 2;
  doc.setDrawColor(203, 213, 225);
  doc.line(ox + padX, cursorY, ox + w - padX, cursorY);
  cursorY += 4;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('FROM', ox + padX, cursorY);
  cursorY += 4;

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  if (data.senderName) {
    doc.text(data.senderName, ox + padX, cursorY);
    cursorY += 4;
  }
  if (data.senderAddress) {
    const senderLines = wrapText(doc, data.senderAddress, w - padX * 2);
    doc.text(senderLines, ox + padX, cursorY);
    cursorY += senderLines.length * 4;
  }

  if (data.courierService || data.weight) {
    cursorY = oy + h - 10;
    doc.setDrawColor(203, 213, 225);
    doc.line(ox + padX, cursorY, ox + w - padX, cursorY);
    cursorY += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    if (data.courierService) {
      doc.text('SERVICE', ox + padX, cursorY);
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'normal');
      doc.text(data.courierService, ox + padX + 18, cursorY);
    }
    if (data.weight) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text('WEIGHT', ox + w / 2, cursorY);
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'normal');
      doc.text(data.weight, ox + w / 2 + 14, cursorY);
    }
  }
}

function hexToRgb(hex) {
  const clean = String(hex || '#2563eb').replace('#', '');
  const value = Number.parseInt(clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean, 16);
  if (!Number.isFinite(value)) return { r: 37, g: 99, b: 235 };
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

export async function exportLabelToPdf(label, settings, appSettings) {
  const size = label.label_size === CUSTOM_LABEL_SIZE_KEY && appSettings?.customLabelSize
    ? {
        widthMm: appSettings.customLabelSize.widthMm,
        heightMm: appSettings.customLabelSize.heightMm,
        layout: 'full',
      }
    : getLabelSize(label.label_size);
  const doc = new jsPDF({
    unit: 'mm',
    format: [size.widthMm, size.heightMm],
    orientation: size.widthMm > size.heightMm ? 'landscape' : 'portrait',
  });

  await drawLabelOnPage(
    doc,
    {
      trackingId: label.tracking_id,
      receiverName: label.receiver_name,
      receiverAddress: label.receiver_address,
      receiverPhone: label.receiver_phone,
      receiverCity: label.receiver_city,
      receiverPostalCode: label.receiver_postal_code,
      receiverCountry: label.receiver_country,
      senderName: label.sender_name,
      senderAddress: label.sender_address,
      courierName: label.courier_name,
      courierService: label.courier_service,
      weight: label.weight,
      notes: label.notes,
      customerPosition: appSettings?.customerPosition,
      labelHeader: appSettings?.labelHeader,
    },
    size,
    settings,
    { x: 0, y: 0 },
  );

  doc.save(`label-${label.tracking_id}.pdf`);
}

export async function exportLabelsBulkPdf(labels, settings) {
  if (labels.length === 0) return;

  const bySize = new Map();
  for (const l of labels) {
    const arr = bySize.get(l.label_size) ?? [];
    arr.push(l);
    bySize.set(l.label_size, arr);
  }

  for (const [sizeKey, group] of bySize) {
    const size = getLabelSize(sizeKey);
    const doc = new jsPDF({
      unit: 'mm',
      format: [size.widthMm, size.heightMm],
      orientation: size.widthMm > size.heightMm ? 'landscape' : 'portrait',
    });

    for (let i = 0; i < group.length; i++) {
      const label = group[i];
      if (i > 0) doc.addPage([size.widthMm, size.heightMm], size.widthMm > size.heightMm ? 'landscape' : 'portrait');
      await drawLabelOnPage(
        doc,
        {
          trackingId: label.tracking_id,
          receiverName: label.receiver_name,
          receiverAddress: label.receiver_address,
          receiverPhone: label.receiver_phone,
          receiverCity: label.receiver_city,
          receiverPostalCode: label.receiver_postal_code,
          receiverCountry: label.receiver_country,
          senderName: label.sender_name,
          senderAddress: label.sender_address,
          courierName: label.courier_name,
          courierService: label.courier_service,
          weight: label.weight,
        },
        size,
        settings,
        { x: 0, y: 0 },
      );
    }

    const suffix = bySize.size > 1 ? `-${sizeKey}` : '';
    doc.save(`labels${suffix}.pdf`);
  }
}

export async function exportBarcodesBulkPdf(trackingIds, settings, sizeKey) {
  if (trackingIds.length === 0) return;
  const size = getLabelSize(sizeKey);

  const doc = new jsPDF({
    unit: 'mm',
    format: [size.widthMm, size.heightMm],
    orientation: size.widthMm > size.heightMm ? 'landscape' : 'portrait',
  });

  if (sizeKey === 'a4') {
    const cols = 4;
    const rows = 3;
    const marginX = 10;
    const marginY = 12;
    const gapX = 4;
    const gapY = 4;
    const cellW = (size.widthMm - marginX * 2 - gapX * (cols - 1)) / cols;
    const cellH = (size.heightMm - marginY * 2 - gapY * (rows - 1)) / rows;

    let idx = 0;
    let page = 0;
    while (idx < trackingIds.length) {
      if (page > 0) doc.addPage();
      for (let r = 0; r < rows && idx < trackingIds.length; r++) {
        for (let c = 0; c < cols && idx < trackingIds.length; c++) {
          const id = trackingIds[idx];
          const x = marginX + c * (cellW + gapX);
          const y = marginY + r * (cellH + gapY);
          doc.setDrawColor(203, 213, 225);
          doc.setLineWidth(0.2);
          doc.rect(x, y, cellW, cellH);

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7);
          doc.setTextColor(100, 116, 139);
          doc.text('TRACKING', x + 2, y + 4);

          doc.setFontSize(9);
          doc.setTextColor(15, 23, 42);
          doc.text(id, x + 2, y + 8, { maxWidth: cellW - 4 });

          const { dataUrl } = await renderBarcode(id, {
            ...settings,
            height: 40,
            fontSize: 8,
            margin: 1,
            displayValue: false,
          });
          if (dataUrl) {
            const barW = cellW - 4;
            const barH = 18;
            doc.addImage(dataUrl, 'PNG', x + 2, y + 10, barW, barH);
          }
          idx++;
        }
      }
      page++;
    }
  } else {
    for (let i = 0; i < trackingIds.length; i++) {
      if (i > 0) doc.addPage();
      const id = trackingIds[i];
      const { dataUrl } = await renderBarcode(id, settings);
      if (dataUrl) {
        const barW = size.widthMm - 10;
        const barH = size.layout === 'compact' ? size.heightMm - 8 : 40;
        doc.addImage(
          dataUrl,
          'PNG',
          5,
          size.layout === 'compact' ? 4 : (size.heightMm - barH) / 2,
          barW,
          barH,
        );
      }
    }
  }

  doc.save(`barcodes-${trackingIds.length}.pdf`);
}
