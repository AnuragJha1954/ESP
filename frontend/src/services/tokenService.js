import { apiRequest } from './apiClient';
import { mockTokenSchedule } from '../mock/mockData';

const SCHEDULE_STORAGE_KEY = 'tradopad_token_schedule';

export async function fetchTokensStatus() {
  const res = await apiRequest('/api/broker/tokens-status');
  if (res.ok && res.data?.status === 'success') {
    return res.data;
  }
  return null;
}

export async function refreshAllTokensNow() {
  const res = await apiRequest('/api/broker/refresh-all-tokens', {
    method: 'POST'
  });
  return res;
}

export async function fetchTokenState(targetBroker = null) {
  const statusRes = await apiRequest('/api/device/status');
  const credsRes = await apiRequest('/api/user/credentials');
  const schedule = getTokenSchedule();

  let tokenValidToday = false;
  let activeBroker = 'Fyers';
  let tokenGeneratedAt = null;

  if (statusRes.ok && statusRes.data?.readiness) {
    activeBroker = statusRes.data.readiness.broker || 'Fyers';
    if (!targetBroker || targetBroker === activeBroker) {
      tokenValidToday = statusRes.data.readiness.checks.token_valid_today;
    }
  }

  const brokerToCheck = targetBroker || activeBroker;
  const creds = credsRes.ok && credsRes.data?.data ? credsRes.data.data : {};

  if (brokerToCheck === 'Dhan') tokenGeneratedAt = creds.dhan_token_generated_at;
  else if (brokerToCheck === 'Upstox') tokenGeneratedAt = creds.upstox_token_generated_at;
  else if (brokerToCheck === 'Angel One' || brokerToCheck === 'AngelOne') tokenGeneratedAt = creds.angel_token_generated_at;
  else if (brokerToCheck === 'Kotak Neo' || brokerToCheck === 'Kotak') tokenGeneratedAt = creds.kotak_token_generated_at;
  else if (brokerToCheck === 'Zerodha' || brokerToCheck === 'Kite') tokenGeneratedAt = creds.zerodha_token_generated_at;
  else tokenGeneratedAt = creds.fyers_token_generated_at;

  if (tokenGeneratedAt) {
    try {
      const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      const tsString = String(tokenGeneratedAt);
      const isoString = tsString.endsWith('Z') ? tsString : tsString.replace(' ', 'T') + 'Z';
      const tokenDateIST = new Date(isoString).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      if (tokenDateIST === todayIST) {
        tokenValidToday = true;
      }
    } catch (e) {}
  }

  return {
    broker: brokerToCheck,
    activeBroker,
    tokenValidToday,
    tokenGeneratedAt,
    schedule,
    allCreds: creds
  };
}

export async function generateTokenNow(force = true, targetBroker = null) {
  const url = targetBroker 
    ? `/api/broker/generate-access-token?force=${force}&broker=${encodeURIComponent(targetBroker)}`
    : `/api/broker/generate-access-token?force=${force}`;
  const res = await apiRequest(url, {
    method: 'POST',
    body: targetBroker ? JSON.stringify({ broker: targetBroker }) : undefined
  });
  return res;
}

export function formatTimeRemaining(seconds) {
  if (!seconds || seconds <= 0) return 'Session Expired';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}h ${m}m remaining`;
  }
  return `${m}m ${s}s remaining`;
}

export function formatISTTime(timestamp) {
  if (!timestamp) return 'Never generated';
  try {
    const tsString = String(timestamp);
    const isoString = tsString.endsWith('Z') ? tsString : tsString.replace(' ', 'T') + 'Z';
    return new Date(isoString).toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).toUpperCase() + ' IST';
  } catch (e) {
    return String(timestamp);
  }
}

export function getTokenSchedule() {
  const saved = JSON.parse(localStorage.getItem(SCHEDULE_STORAGE_KEY) || 'null');
  return saved || mockTokenSchedule;
}

export function saveTokenSchedule(settings) {
  const current = getTokenSchedule();
  const updated = {
    ...current,
    ...settings
  };
  localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export async function revokeToken(userId) {
  if (userId) {
    return await apiRequest(`/api/admin/user/${userId}/clear-token`, { method: 'POST' });
  }
  return { ok: true };
}
