import { useEffect, useState } from 'react';
import { DEFAULT_BARCODE_SETTINGS } from '../types/label.js';

const KEY = 'shiplabel-pro-settings-v1';

export const CUSTOM_LABEL_SIZE_KEY = 'custom';

export const DEFAULT_CUSTOM_LABEL_SIZE = {
  widthMm: 100,
  heightMm: 150,
};

export const DEFAULT_CUSTOMER_POSITION = {
  xMm: 5,
  yMm: 62,
  widthMm: 90,
  fontSize: 11,
};

export const DEFAULT_LABEL_HEADER = {
  color: '#2563eb',
  heightMm: 22,
};

const DEFAULTS = {
  barcode: DEFAULT_BARCODE_SETTINGS,
  defaultLabelSize: '100x150',
  defaultCourier: 'Ekart logistics',
  organizationName: 'ElasticRunKottakkal_KOT',
  organizationAddress: '',
  customLabelSize: DEFAULT_CUSTOM_LABEL_SIZE,
  customerPosition: DEFAULT_CUSTOMER_POSITION,
  labelHeader: DEFAULT_LABEL_HEADER,
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULTS,
      ...parsed,
      barcode: { ...DEFAULTS.barcode, ...(parsed.barcode ?? {}) },
      customLabelSize: { ...DEFAULT_CUSTOM_LABEL_SIZE, ...(parsed.customLabelSize ?? {}) },
      customerPosition: { ...DEFAULT_CUSTOMER_POSITION, ...(parsed.customerPosition ?? {}) },
      labelHeader: { ...DEFAULT_LABEL_HEADER, ...(parsed.labelHeader ?? {}) },
    };
  } catch {
    return DEFAULTS;
  }
}

export function saveSettings(s) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function useSettings() {
  const [settings, setSettings] = useState(() => loadSettings());

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  return [settings, setSettings];
}
