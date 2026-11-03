# Infirow Tradopad — Hardware & Device API Specification

Comprehensive technical specification for all physical ESP32 console and mobile device endpoints, including request schemas, response payloads, status codes, and rough estimated response times.

---

## 1. Quick Reference Matrix

| Endpoint Name | Method | Path | Authentication | Primary Consumer | Rough Est. Response Time |
| :--- | :---: | :--- | :---: | :---: | :---: |
| **Boot, Token & Readiness** | `POST` | `/api/hardware/:userId/status` | None (Device ID check) | ESP32 Console | **5 – 15 ms** |
| **Battery & WiFi Heartbeat** | `POST` | `/api/hardware/:userId/battery` | None (Device ID check) | ESP32 Console | **3 – 8 ms** |
| **Physical Broker Switch** | `POST` | `/api/hardware/:userId/switch-broker` | None (`userId` in URL) | ESP32 Console | **8 – 18 ms** |
| **Physical CE Click (Buy Call)**| `POST` | `/api/hardware/:userId/buy` | None (`userId` in URL) | ESP32 Console | **< 2 ms** *(Guard)* / **35 – 85 ms** *(Broker)* |
| **Physical PE Click (Buy Put)** | `POST` | `/api/hardware/:userId/sell` | None (`userId` in URL) | ESP32 Console | **< 2 ms** *(Guard)* / **35 – 85 ms** *(Broker)* |
| **Physical Panic Kill Switch** | `POST` | `/api/hardware/:userId/kill-switch` | None (`userId` in URL) | ESP32 Console | **5 – 12 ms** *(Local)* / **80 – 180 ms** *(Broker)* |
| **Read Kill Switch State** | `GET` | `/api/hardware/:userId/kill-switch` | None (`userId` in URL) | ESP32 Console | **3 – 6 ms** |
| **App Device Status** | `GET` | `/api/device/status` | Bearer JWT | Mobile App | **6 – 14 ms** |
| **Device ID Status Check** | `GET` | `/api/v1/device/:deviceId/status` | None | Gateway / Web | **5 – 12 ms** |
| **Remote Console Lock** | `POST` | `/api/device/lock` | Bearer JWT | Mobile App | **6 – 15 ms** |
| **Password Console Unlock** | `POST` | `/api/device/unlock` | Bearer JWT (Password req) | Mobile App | **45 – 85 ms** *(Bcrypt verify)* |
| **Check Console Lock Status** | `GET` | `/api/device/lock-status` | Bearer JWT | Mobile App | **3 – 7 ms** |
| **Gateway Heartbeat Webhook**| `POST` | `/api/webhook/device-heartbeat` | None / Secret | Bridge / MQTT | **4 – 10 ms** |
| **List Hardware Fleet** | `GET` | `/api/admin/devices` | Bearer JWT (Admin role) | Admin Control | **8 – 20 ms** |
| **Register Hardware Unit** | `POST` | `/api/admin/devices` | Bearer JWT (Admin role) | Admin Control | **10 – 25 ms** |
| **Update Device Metadata** | `PUT` | `/api/admin/devices/:deviceId` | Bearer JWT (Admin role) | Admin Control | **10 – 25 ms** |
| **Deregister Hardware Unit** | `DELETE`| `/api/admin/devices/:deviceId` | Bearer JWT (Admin role) | Admin Control | **12 – 30 ms** |
| **Bind Device to Trader** | `POST` | `/api/admin/devices/bind` | Bearer JWT (Admin role) | Admin Control | **10 – 25 ms** |
| **Unbind Device from Trader** | `POST` | `/api/admin/devices/unbind` | Bearer JWT (Admin role) | Admin Control | **8 – 20 ms** |

---

## 2. Hardware Console Endpoints (ESP32 $\leftrightarrow$ Server)

### 2.1 Boot, Token & Readiness Check
Called by the ESP32 console on power-up and every 30 seconds during idle state. Verifies hardware binding, checks today's broker token, and returns active instrument parameters.

- **Method**: `POST`
- **Route**: `/api/hardware/:userId/status` (or `/api/hardware/status`)
- **Headers**: `Content-Type: application/json`
- **Estimated Response Time**: **5 ms – 15 ms** *(Single-digit SQLite query + In-Memory Token Evaluation)*

#### Request Body:
```json
{
  "device_id": "DEV-0012"
}
```

#### Success Response (`200 OK` — Console Ready):
```json
{
  "status": "success",
  "ready": true,
  "user_id": 1,
  "device_id": "DEV-0012",
  "selected_broker": "Fyers",
  "token_status": "VALID_TODAY",
  "device_locked": false,
  "kill_switch_active": false,
  "message": "Ready to trade",
  "terminal": {
    "broker": "Fyers",
    "selected_broker": "Fyers",
    "index": "NIFTY",
    "expiry": "2026-11-05",
    "strike": 24850,
    "quantity": 65
  }
}
```

#### Guard/Rejection Responses (`200 OK` with `ready: false`):
- **Token Expired / Missing**:
  ```json
  {
    "status": "success",
    "ready": false,
    "selected_broker": "Fyers",
    "token_status": "TOKEN_EXPIRED",
    "message": "Broker token expired or missing"
  }
  ```
- **Console Locked Remotely**:
  ```json
  {
    "status": "success",
    "ready": false,
    "device_locked": true,
    "message": "Console locked by owner"
  }
  ```

---

### 2.2 Hardware Battery & WiFi Telemetry Heartbeat
Pushed by the ESP32 every 5 minutes to report internal LiPo battery percentage (ADC) and WiFi signal strength (RSSI). Instantly broadcasts to the mobile app via Server-Sent Events (SSE).

- **Method**: `POST`
- **Route**: `/api/hardware/:userId/battery` (or `/api/hardware/battery`)
- **Headers**: `Content-Type: application/json`
- **Estimated Response Time**: **3 ms – 8 ms** *(SQLite Upsert + SSE broadcast)*

#### Request Body:
```json
{
  "device_id": "DEV-0012",
  "battery_pct": 88,
  "wifi_rssi": -58
}
```

#### Success Response (`200 OK`):
```json
{
  "status": "success",
  "message": "Battery status recorded successfully",
  "data": {
    "device_id": "DEV-0012",
    "user_id": 1,
    "battery_pct": 88,
    "timestamp": "2026-11-02T12:30:00.000Z"
  }
}
```

---

### 2.3 Physical Multi-Broker Switch / Toggle
Triggered by the physical console toggle switch. Cycles the trader's active execution broker across connected broker accounts (`Fyers` $\rightarrow$ `Dhan` $\rightarrow$ `Zerodha` $\rightarrow$ `Upstox` $\rightarrow$ `Angel One` $\rightarrow$ `Kotak Neo`).

- **Method**: `POST`
- **Route**: `/api/hardware/:userId/switch-broker`
- **Headers**: `Content-Type: application/json`
- **Estimated Response Time**: **8 ms – 18 ms**

#### Request Body (Optional):
```json
{
  "device_id": "DEV-0012",
  "broker": "Dhan"
}
```
*(If body is empty, the server automatically rotates to the next connected broker).*

#### Success Response (`200 OK`):
```json
{
  "status": "success",
  "message": "Active broker changed from Fyers to Dhan",
  "user_id": 1,
  "previous_broker": "Fyers",
  "selected_broker": "Dhan",
  "token_valid_today": true
}
```

---

### 2.4 Physical CE Click — Buy Call Option (1-Click Execution)
Fired instantaneously when the trader presses the **Green CE Button** on the physical console.

- **Method**: `POST`
- **Route**: `/api/hardware/:userId/buy`
- **Headers**: `Content-Type: application/json`
- **Estimated Response Time**:
  - **Rejection by Guard (Kill Switch / Locked)**: **< 2 ms** *(O(1) in-memory hot cache)*
  - **Live Order to Broker REST API**: **35 ms – 85 ms** *(3 ms server overhead + 30–80 ms broker roundtrip)*

#### Request Body (Optional Override):
```json
{
  "quantity": 65,
  "strike": 24850,
  "type": "CE"
}
```
*(If omitted, auto-resolves nearest ATM strike and default lot size from user preferences).*

#### Success Response (`200 OK`):
```json
{
  "status": "success",
  "order_id": "FYERS-261102-99812",
  "broker": "Fyers",
  "symbol": "NSE:NIFTY26NOV24850CE",
  "side": "BUY",
  "type": "CE",
  "quantity": 65,
  "executed_price": 142.30,
  "execution_time_ms": 42.6,
  "message": "Call Option Market Order Filled"
}
```

#### Rejection Response (`403 Forbidden` — Console Locked):
```json
{
  "status": "error",
  "reason": "DEVICE_LOCKED",
  "message": "Console is locked by owner. All physical button presses are blocked."
}
```

---

### 2.5 Physical PE Click — Buy Put Option (1-Click Execution)
Fired instantaneously when the trader presses the **Red PE Button** on the physical console.

- **Method**: `POST`
- **Route**: `/api/hardware/:userId/sell`
- **Headers**: `Content-Type: application/json`
- **Estimated Response Time**: **< 2 ms** *(Guard)* / **35 ms – 85 ms** *(Broker placement)*

#### Success Response (`200 OK`):
```json
{
  "status": "success",
  "order_id": "FYERS-261102-99813",
  "broker": "Fyers",
  "symbol": "NSE:NIFTY26NOV24850PE",
  "side": "BUY",
  "type": "PE",
  "quantity": 65,
  "executed_price": 96.80,
  "execution_time_ms": 39.1,
  "message": "Put Option Market Order Filled"
}
```

---

### 2.6 Physical Kill Switch / Emergency Panic Halt
Triggered by the physical emergency button on the console. Instantly squares off all open intraday positions and cancels pending orders according to user scope (`current` broker only or `all` available brokers).

- **Method**: `POST`
- **Route**: `/api/hardware/:userId/kill-switch`
- **Headers**: `Content-Type: application/json`
- **Estimated Response Time**:
  - **Local State & Cache Lock**: **5 ms – 12 ms**
  - **Broker Multi-Order Liquidation Roundtrip**: **80 ms – 180 ms**

#### Request Body:
```json
{
  "device_id": "DEV-0012",
  "reason": "Physical emergency halt button pressed"
}
```

#### Success Response (`200 OK`):
```json
{
  "status": "success",
  "message": "Emergency Kill Switch engaged. All active trades squared off.",
  "scope": "current",
  "target_broker": "Fyers",
  "orders_cancelled": 2,
  "positions_closed": 1,
  "kill_switch": {
    "active": true,
    "triggered_at": "2026-11-02T12:35:10.000Z",
    "triggered_by": "PHYSICAL_KEYPAD",
    "reason": "Physical emergency halt button pressed"
  }
}
```

---

### 2.7 Read Physical Kill Switch State
- **Method**: `GET`
- **Route**: `/api/hardware/:userId/kill-switch`
- **Estimated Response Time**: **3 ms – 6 ms**

#### Response (`200 OK`):
```json
{
  "status": "success",
  "active": false,
  "triggered_at": null,
  "triggered_by": null,
  "reason": null
}
```

---

## 3. Mobile Terminal Device Endpoints (Trader PWA $\leftrightarrow$ Server)

### 3.1 App Device Telemetry & Readiness Status
Used by the mobile terminal's **Console Tab** (`DeviceTab.jsx`) to poll or sync full hardware telemetry.

- **Method**: `GET`
- **Route**: `/api/device/status`
- **Headers**: `Authorization: Bearer <JWT>`
- **Estimated Response Time**: **6 ms – 14 ms**

#### Success Response (`200 OK`):
```json
{
  "status": "success",
  "readiness": {
    "ready": true,
    "reason": "READY",
    "checks": {
      "device_bound": true,
      "broker_configured": true,
      "token_valid_today": true,
      "kill_switch_off": true,
      "device_unlocked": true,
      "firmware_ok": true
    },
    "kill_switch": {
      "active": false,
      "triggered_at": null,
      "triggered_by": null,
      "reason": null
    },
    "device_lock": {
      "is_locked": false,
      "locked_at": null,
      "locked_by": null,
      "reason": null
    },
    "device_id": "DEV-0012",
    "battery_pct": 88,
    "wifi_rssi": -58,
    "last_heartbeat": "2026-11-02 12:30:00",
    "broker": "Fyers",
    "server_time_ist": "02/11/2026, 12:35:00 pm"
  }
}
```

---

### 3.2 Remote Console Lock (Halt Physical Hardware)
Enables the trader to lock out all physical button inputs on the hardware keypad directly from their smartphone (e.g. anti-theft, desk departure, child safety).

- **Method**: `POST`
- **Route**: `/api/device/lock`
- **Headers**: `Authorization: Bearer <JWT>`, `Content-Type: application/json`
- **Estimated Response Time**: **6 ms – 15 ms**

#### Request Body:
```json
{
  "reason": "Console locked by operator from mobile app"
}
```

#### Success Response (`200 OK`):
```json
{
  "status": "success",
  "message": "Hardware Console locked. All physical inputs and requests from this device are blocked by the server.",
  "device_lock": {
    "is_locked": true,
    "device_id": "DEV-0012",
    "locked_at": "2026-11-02T12:36:00.000Z",
    "locked_by": "USER_APP",
    "reason": "Console locked by operator from mobile app"
  }
}
```

---

### 3.3 Password-Guarded Console Unlock
Unlocks the physical console. Requires verifying the trader account's master password hash.

- **Method**: `POST`
- **Route**: `/api/device/unlock`
- **Headers**: `Authorization: Bearer <JWT>`, `Content-Type: application/json`
- **Estimated Response Time**: **45 ms – 85 ms** *(Includes Bcrypt hash comparison overhead)*

#### Request Body:
```json
{
  "password": "TraderPassword123"
}
```

#### Success Response (`200 OK`):
```json
{
  "status": "success",
  "message": "Hardware Console unlocked. Physical triggers re-enabled.",
  "device_lock": {
    "is_locked": false,
    "locked_at": "2026-11-02T12:38:00.000Z",
    "locked_by": "USER_APP",
    "reason": "Unlocked"
  }
}
```

#### Error Response (`401 Unauthorized` — Wrong Password):
```json
{
  "status": "error",
  "message": "Incorrect account password. Console remains locked."
}
```

---

### 3.4 Check Console Lock Status
- **Method**: `GET`
- **Route**: `/api/device/lock-status`
- **Headers**: `Authorization: Bearer <JWT>`
- **Estimated Response Time**: **3 ms – 7 ms**

#### Success Response (`200 OK`):
```json
{
  "status": "success",
  "is_locked": false,
  "locked_at": null,
  "locked_by": null,
  "reason": null,
  "device_id": "DEV-0012"
}
```

---

## 4. Admin Fleet Management Endpoints (Desktop Control Panel)

All `/api/admin/devices*` routes require an authenticated administrator session (`authenticateToken` + `authenticateAdmin`).

### 4.1 List All Hardware Fleet Units
- **Method**: `GET`
- **Route**: `/api/admin/devices`
- **Estimated Response Time**: **8 ms – 20 ms**

#### Success Response (`200 OK`):
```json
{
  "status": "success",
  "devices": [
    {
      "device_id": "DEV-0012",
      "serial_number": "SN-TP-0012",
      "hw_revision": "rev1",
      "firmware_version": "1.0.0-PROD",
      "status": "BOUND",
      "bound_user_id": 1,
      "bound_username": "admin",
      "battery_pct": 88,
      "wifi_rssi": -58,
      "last_heartbeat": "2026-11-02 12:30:00"
    }
  ]
}
```

---

### 4.2 Register New Hardware Node
- **Method**: `POST`
- **Route**: `/api/admin/devices`
- **Estimated Response Time**: **10 ms – 25 ms**

#### Request Body:
```json
{
  "device_id": "DEV-0015",
  "serial_number": "SN-TP-0015",
  "hw_revision": "rev1",
  "firmware_version": "1.0.0"
}
```

#### Success Response (`200 OK`):
```json
{
  "status": "success",
  "message": "Device DEV-0015 registered successfully"
}
```

---

### 4.3 Update Device Metadata & Serial
- **Method**: `PUT`
- **Route**: `/api/admin/devices/:deviceId`
- **Estimated Response Time**: **10 ms – 25 ms**

#### Request Body:
```json
{
  "new_device_id": "DEV-0012",
  "serial_number": "SN-TP-0012-PROD",
  "hw_revision": "rev1.2",
  "firmware_version": "1.0.1"
}
```

#### Success Response (`200 OK`):
```json
{
  "status": "success",
  "message": "Device DEV-0012 updated"
}
```

---

### 4.4 Bind Device to Trader Account
- **Method**: `POST`
- **Route**: `/api/admin/devices/bind`
- **Estimated Response Time**: **10 ms – 25 ms**

#### Request Body:
```json
{
  "device_id": "DEV-0012",
  "user_id": 1
}
```

#### Success Response (`200 OK`):
```json
{
  "status": "success",
  "message": "Device DEV-0012 bound to user ID 1 successfully"
}
```

---

### 4.5 Unbind Device from Trader
- **Method**: `POST`
- **Route**: `/api/admin/devices/unbind`
- **Estimated Response Time**: **8 ms – 20 ms**

#### Request Body:
```json
{
  "device_id": "DEV-0012"
}
```

#### Success Response (`200 OK`):
```json
{
  "status": "success",
  "message": "Device DEV-0012 unbound successfully"
}
```

---

### 4.6 Deregister Hardware Unit
- **Method**: `DELETE`
- **Route**: `/api/admin/devices/:deviceId`
- **Estimated Response Time**: **12 ms – 30 ms**

#### Success Response (`200 OK`):
```json
{
  "status": "success",
  "message": "Device DEV-0015 deregistered successfully"
}
```

---

## 5. Latency Architecture & Response Time Breakdown

```
[ ESP32 Console Button Press ]
              │ (Wi-Fi 2.4 GHz HTTP POST)
              ▼ ~10-15 ms network travel
┌────────────────────────────────────────────────────────┐
│ TRADOPAD NODE.JS EXECUTION ENGINE                      │
│                                                        │
│  1. In-Memory Hot Cache Lookup      < 0.005 ms         │
│  2. Emergency Kill Switch Guard     < 0.002 ms         │
│  3. Remote Device Lock Guard        < 0.002 ms         │
│  4. ATM Strike / Contract Resolver  < 0.8 ms           │
│  5. Asynchronous Audit Log Write    (non-blocking)     │
│                                                        │
│  Total Internal Server Overhead:    ~ 1.5 – 3.0 ms     │
└────────────────────────────────────────────────────────┘
              │ (TLS REST API)
              ▼ ~30-65 ms broker gateway roundtrip
[ Fyers / Dhan / Zerodha Execution Exchange ]
              │
              ▼
[ Total Wall-Clock Execution: ~45 - 85 ms ]
```

### Response Time Summary Categories:
1. **Ultra-Low Latency Guard Endpoints (`< 3 ms`)**:
   - `killSwitchActive` check, `deviceLocked` check.
2. **Fast In-Memory / SQLite Queries (`3 ms – 15 ms`)**:
   - `/api/device/status`, `/api/hardware/:userId/battery`, `/api/device/lock-status`.
3. **Cryptographic Computations (`45 ms – 85 ms`)**:
   - `/api/device/unlock` (Bcrypt password hash comparison).
4. **Live Broker REST Calls (`35 ms – 90 ms`)**:
   - `/api/hardware/:userId/buy`, `/api/hardware/:userId/sell`.
5. **Multi-Order Square-off Operations (`80 ms – 180 ms`)**:
   - `/api/hardware/:userId/kill-switch` (Fanout positions liquidation).
