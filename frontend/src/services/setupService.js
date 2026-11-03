import { apiRequest } from './apiClient';
import { indexLotSizes, mockRiskSettings } from '../mock/mockData';

const RISK_STORAGE_KEY = 'tradopad_risk_settings';

export function isExpiryCodePast(code) {
  if (!code || typeof code !== 'string') return true;
  const match = code.trim().toUpperCase().match(/^(\d{1,2})([A-Z]{3})(\d{2,4})$/);
  if (!match) return true;
  const months = { 'JAN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3, 'MAY': 4, 'JUN': 5, 'JUL': 6, 'AUG': 7, 'SEP': 8, 'OCT': 9, 'NOV': 10, 'DEC': 11 };
  const day = parseInt(match[1], 10);
  const mIdx = months[match[2]];
  if (mIdx === undefined) return true;
  let year = parseInt(match[3], 10);
  if (year < 100) year += 2000;

  const expiryTime = new Date(year, mIdx, day, 15, 30, 0).getTime();
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const nowIST = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + istOffset).getTime();

  return nowIST > expiryTime;
}

export async function fetchExpiries(indexStr = 'NIFTY') {
  const cleanIndex = (indexStr || 'NIFTY')
    .replace(/\s*50\b/i, '')
    .replace(/\s*\(BSE\)/i, '')
    .replace(/\s+/g, '')
    .toUpperCase();

  try {
    const res = await apiRequest(`/api/calendar/expiries?index=${cleanIndex}`);
    if (res.ok && res.data?.status === 'success' && res.data.data?.length > 0) {
      // Filter out any past expiries
      const valid = res.data.data.filter(item => !isExpiryCodePast(item.expiry_code));
      if (valid.length > 0) {
        return valid.map(item => ({
          label: `${item.expiry_date} (${item.expiry_code})${item.is_monthly ? ' [Monthly]' : ''}`,
          value: item.expiry_code,
          date: item.expiry_date,
          is_monthly: item.is_monthly
        }));
      }
    }
  } catch (e) {
    console.warn('API expiries fetch error, calculating dynamically:', e);
  }

  // Fallback calculation for upcoming Tuesdays
  return getCalculatedExpiries(cleanIndex);
}

export function getCalculatedExpiries(cleanIndex = 'NIFTY') {
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + istOffset);

  let d = new Date(istDate.getFullYear(), istDate.getMonth(), istDate.getDate());

  // Expiries are strictly on Tuesdays (day of week = 2)
  const isTuesday = d.getDay() === 2;
  const isPastCutoff = isTuesday && (istDate.getHours() > 15 || (istDate.getHours() === 15 && istDate.getMinutes() >= 30));

  if (isTuesday && isPastCutoff) {
    d.setDate(d.getDate() + 7);
  } else {
    while (d.getDay() !== 2) {
      d.setDate(d.getDate() + 1);
    }
  }

  const options = [];
  for (let i = 0; i < 8; i++) {
    const dd = String(d.getDate()).padStart(2, '0');
    const mIdx = d.getMonth();
    const mm = String(mIdx + 1).padStart(2, '0');
    const mmm = months[mIdx];
    const yyyy = d.getFullYear();
    const yy = String(yyyy).slice(-2);

    const nextWeek = new Date(d);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const isMonthly = nextWeek.getMonth() !== mIdx;

    const dateStr = `${dd}-${mm}-${yyyy}`;
    const codeStr = `${dd}${mmm}${yy}`;
    const labelStr = `${dateStr} (${codeStr})${isMonthly ? ' [Monthly]' : ''}`;

    options.push({
      label: labelStr,
      value: codeStr,
      date: dateStr,
      is_monthly: isMonthly ? 1 : 0
    });

    d.setDate(d.getDate() + 7);
  }

  return options;
}

export function getLotMultiplier(indexStr) {
  const cleanIndex = (indexStr || 'NIFTY')
    .replace(/\s*50\b/i, '')
    .replace(/\s*\(BSE\)/i, '')
    .replace(/\s+/g, '')
    .toUpperCase();
  return indexLotSizes[cleanIndex] || 65;
}

export function getRiskSettings() {
  const saved = JSON.parse(localStorage.getItem(RISK_STORAGE_KEY) || 'null');
  return saved || mockRiskSettings;
}

export function saveRiskSettings(settings) {
  const current = getRiskSettings();
  const updated = {
    ...current,
    ...settings,
    version: (current.version || 1) + 1,
    updated_at: new Date().toISOString()
  };
  localStorage.setItem(RISK_STORAGE_KEY, JSON.stringify(updated));
  return updated;
}
