/**
 * Infirow Tradopad — Client Mock Fallback Data
 * Provides realistic offline / pre-deployment telemetry and session state.
 */

export const mockDeviceTelemetry = {
  device_id: 'DEV-0012',
  nickname: 'Desk Console (Primary)',
  serial_number: 'SN-TP-0012',
  hw_revision: 'rev1',
  firmware_version: '1.0.0',
  battery_pct: 88,
  wifi_ssid: 'Tradopad_Desk_5G',
  wifi_rssi_dbm: -58,
  is_online: true,
  last_heartbeat: new Date().toISOString(),
  bound_date: '2026-10-14',
  warranty_status: 'Active (1 Year Standard)',
};

export const mockRiskSettings = {
  max_lots_per_order: 10,
  max_orders_per_day: 50,
  max_loss_per_day_inr: 25000,
  order_type: 'MARKET_SLIPPAGE_PROTECTED', // or 'LIMIT_BUFFER'
  slippage_buffer_pts: 2,
  trading_start_ist: '09:15',
  trading_end_ist: '15:30',
  version: 1,
  updated_at: new Date().toISOString()
};

export const mockTokenSchedule = {
  auto_generate_enabled: false,
  scheduled_time_ist: '08:30',
  rate_limit_cooldown_sec: 0,
  recent_events: [
    {
      timestamp: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
      trigger: 'BOOT_OR_POLL',
      result: 'SUCCESS',
      reason: 'Token valid for current IST calendar day'
    }
  ]
};

export const indexLotSizes = {
  'NIFTY': 65,
  'BANKNIFTY': 30,
  'FINNIFTY': 65,
  'MIDCPNIFTY': 120,
  'SENSEX': 20,
  'BANKEX': 30
};
