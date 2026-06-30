export const DEFAULT_BARCODE_SETTINGS = {
  type: 'CODE128',
  width: 2,
  height: 80,
  displayValue: true,
  fontSize: 16,
  margin: 4,
  background: '#ffffff',
  lineColor: '#0f172a',
};

export const LABEL_SIZES = [
  {
    key: '100x150',
    name: '100 × 150 mm',
    description: 'Standard shipping label',
    widthMm: 100,
    heightMm: 150,
    layout: 'full',
  },
  {
    key: '50x25',
    name: '50 × 25 mm',
    description: 'Compact thermal label',
    widthMm: 50,
    heightMm: 25,
    layout: 'compact',
  },
  {
    key: 'a4',
    name: 'A4 Sheet',
    description: 'Multiple labels per A4 page',
    widthMm: 210,
    heightMm: 297,
    layout: 'sheet',
    perSheet: 12,
  },
];

export function getLabelSize(key) {
  return LABEL_SIZES.find((s) => s.key === key) ?? LABEL_SIZES[0];
}

export const COURIER_OPTIONS = [
  'FedEx',
  'UPS',
  'DHL',
  'USPS',
  'TNT',
  'Aramex',
  'India Post',
  'Blue Dart',
  'Delhivery',
  'DTDC',
  'Other',
];

export const COUNTRY_OPTIONS = [
  'United States',
  'United Kingdom',
  'Canada',
  'Australia',
  'Germany',
  'France',
  'India',
  'Japan',
  'Singapore',
  'United Arab Emirates',
  'Other',
];
