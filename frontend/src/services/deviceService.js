import { apiRequest } from './apiClient';
import { mockDeviceTelemetry } from '../mock/mockData';

const STORAGE_KEYS = {
  TELEMETRY: 'tradopad_telemetry',
  ARMING: 'tradopad_arming',
  KILL_SWITCH: 'tradopad_kill_switch'
};

export async function fetchDeviceStatus() {
  const res = await apiRequest('/api/device/status');
  
  // Read local telemetry and arming state
  const savedTelemetry = JSON.parse(localStorage.getItem(STORAGE_KEYS.TELEMETRY) || 'null') || mockDeviceTelemetry;
  const armingState = getArmingState();
  const killSwitch = getKillSwitchState();

  let readiness = {
    ready: false,
    reason: 'TOKEN_MISSING',
    checks: {
      device_bound: true,
      broker_configured: true,
      token_valid_today: false,
      kill_switch_off: !killSwitch.active,
      firmware_ok: true
    },
    device_id: savedTelemetry.device_id,
    broker: 'Fyers',
    server_time_ist: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
  };

  let liveTelemetry = { ...savedTelemetry };

  if (res.ok && res.data?.readiness) {
    const r = res.data.readiness;
    readiness = {
      ...r,
      checks: {
        ...r.checks,
        kill_switch_off: !killSwitch.active
      }
    };
    if (killSwitch.active) {
      readiness.ready = false;
      readiness.reason = 'KILL_SWITCH_ON';
    }

    // Merge live hardware telemetry from server into telemetry state
    liveTelemetry = {
      ...savedTelemetry,
      device_id: r.device_id || savedTelemetry.device_id,
      battery_pct: (r.battery_pct !== null && r.battery_pct !== undefined) ? r.battery_pct : savedTelemetry.battery_pct,
      wifi_rssi_dbm: (r.wifi_rssi !== null && r.wifi_rssi !== undefined) ? r.wifi_rssi : (savedTelemetry.wifi_rssi_dbm || -58),
      last_heartbeat: r.last_heartbeat || savedTelemetry.last_heartbeat
    };
  }

  return {
    readiness,
    telemetry: liveTelemetry,
    arming: armingState,
    killSwitch
  };
}

export function getArmingState() {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.ARMING) || 'null');
  if (!saved) return { isArmed: false, expiresAt: null, contract: '', lots: 1 };

  // Check if session has expired (after 15:30 IST or past expiry timestamp)
  if (saved.expiresAt && Date.now() > new Date(saved.expiresAt).getTime()) {
    localStorage.removeItem(STORAGE_KEYS.ARMING);
    return { isArmed: false, expiresAt: null, contract: '', lots: 1 };
  }

  return saved;
}

export function setArmingState(isArmed, contract = '', lots = 1) {
  if (!isArmed) {
    localStorage.removeItem(STORAGE_KEYS.ARMING);
    return { isArmed: false, expiresAt: null, contract: '', lots: 1 };
  }

  // Calculate today's 15:30 IST market close
  const now = new Date();
  const expires = new Date();
  expires.setHours(15, 30, 0, 0);
  if (now > expires) {
    expires.setDate(expires.getDate() + 1);
  }

  const armData = {
    isArmed: true,
    armedAt: new Date().toISOString(),
    expiresAt: expires.toISOString(),
    contract,
    lots
  };
  localStorage.setItem(STORAGE_KEYS.ARMING, JSON.stringify(armData));
  return armData;
}

export function getKillSwitchState() {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.KILL_SWITCH) || 'null');
  return saved || { active: false, updatedAt: new Date().toISOString(), updatedBy: 'user' };
}

export function setKillSwitchState(active) {
  const state = {
    active: !!active,
    updatedAt: new Date().toISOString(),
    updatedBy: 'user'
  };
  localStorage.setItem(STORAGE_KEYS.KILL_SWITCH, JSON.stringify(state));
  if (active) {
    // Kill switch immediately disarms session
    setArmingState(false);
  }
  return state;
}

export async function triggerKillSwitchApi(active = true, reason = 'App trigger') {
  try {
    const res = await apiRequest('/api/user/kill-switch', {
      method: 'POST',
      body: JSON.stringify({ active, reason })
    });
    const isAct = res.ok && res.data?.status === 'success' ? !!res.data.kill_switch?.active : !!active;
    setKillSwitchState(isAct);
    return res.data;
  } catch (e) {
    setKillSwitchState(active);
    return { status: 'success', kill_switch: { active } };
  }
}

export async function fetchKillSwitchApi() {
  try {
    const res = await apiRequest('/api/user/kill-switch');
    if (res.ok && res.data?.status === 'success') {
      const active = !!res.data.active;
      setKillSwitchState(active);
      return res.data;
    }
  } catch (e) {}
  return getKillSwitchState();
}

export async function lockConsoleApi(reason = 'Console locked by operator from mobile app') {
  try {
    const res = await apiRequest('/api/device/lock', {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
    return res;
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export async function unlockConsoleApi(password) {
  try {
    const res = await apiRequest('/api/device/unlock', {
      method: 'POST',
      body: JSON.stringify({ password })
    });
    return res;
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export async function fetchDeviceLockStatus() {
  try {
    const res = await apiRequest('/api/device/lock-status');
    if (res.ok && res.data?.status === 'success') {
      return res.data;
    }
  } catch (e) {}
  return { is_locked: false };
}

export function updateDeviceNickname(nickname) {
  const current = JSON.parse(localStorage.getItem(STORAGE_KEYS.TELEMETRY) || 'null') || mockDeviceTelemetry;
  const updated = { ...current, nickname };
  localStorage.setItem(STORAGE_KEYS.TELEMETRY, JSON.stringify(updated));
  return updated;
}
