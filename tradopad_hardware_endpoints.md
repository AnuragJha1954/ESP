# Tradopad Hardware Console API Specification

This document details the final hardware endpoints for the ESP32 console.

---

## Endpoint Summary

| Action | HTTP Method | Path | Request Body | Notes |
| :--- | :---: | :--- | :--- | :--- |
| **Boot, Token & Status Check** | `POST` | `/api/hardware/:userId/status` | `{"device_id": "DEV-0012"}` | **Requires `device_id` in body.** Verifies registration, warms up today's broker token, and returns readiness + `selected_broker`. |
| **Switch / Toggle Broker** | `POST` | `/api/hardware/:userId/switch-broker` | *None* (or `{}`) | **Only `userId` in URL.** Toggles active broker between `Fyers` and `Dhan` and returns the new `selected_broker`. |
| **Battery Heartbeat (Every 5 mins)** | `POST` | `/api/hardware/:userId/battery` | `{"device_id": "DEV-0012", "battery_pct": 85}` | Updates battery percentage and timestamp in database every 5 minutes. |
| **Buy Call (Green Button)** | `POST` | `/api/hardware/:userId/buy` | `{"quantity": 75, "strike": 24300, "type": "CE"}` | Places live INTRADAY MARKET Call order on active broker. |
| **Buy Put (Red Button)** | `POST` | `/api/hardware/:userId/sell` | `{"quantity": 75, "strike": 24300, "type": "PE"}` | Places live INTRADAY MARKET Put order on active broker. |

---

## 1. Switch / Toggle Broker Endpoint (No Device ID Needed)

Toggles the trader's active broker between `Fyers` and `Dhan`. **Does not require a device ID in the body**—it relies solely on `:userId` in the URL.

* **Method**: `POST`
* **Path**: `/api/hardware/:userId/switch-broker`
* **Example URL**: `POST http://api.tradopad.infirow.in/api/hardware/12/switch-broker`
* **Headers**: `Content-Type: application/json`

### Request Body:
*None required* (can be empty or `{}`).

### Success Response (HTTP 200):
```json
{
  "status": "success",
  "message": "Active broker changed from Fyers to Dhan",
  "user_id": 12,
  "previous_broker": "Fyers",
  "selected_broker": "Dhan",
  "token_valid_today": true
}
```

---

## 2. Boot, Token Warmup & Status Check (Requires Device ID)

Called by the console on boot and every 30 seconds idle. **Requires `device_id` in the body** to verify hardware binding to this user.

* **Method**: `POST`
* **Path**: `/api/hardware/:userId/status`
* **Example URL**: `POST http://api.tradopad.infirow.in/api/hardware/12/status`
* **Headers**: `Content-Type: application/json`

### Request Body:
```json
{
  "device_id": "DEV-0012"
}
```

### Success Response (HTTP 200 — Console Ready):
```json
{
  "status": "success",
  "ready": true,
  "user_id": 12,
  "device_id": "DEV-0012",
  "selected_broker": "Fyers",
  "token_status": "VALID_TODAY",
  "message": "Ready to trade",
  "terminal": {
    "broker": "Fyers",
    "selected_broker": "Fyers",
    "index": "NIFTY",
    "strike": 24300,
    "quantity": 75
  }
}
```

---

## 3. Battery Status Heartbeat Endpoint (Every 5 Minutes)

* **Method**: `POST`
* **Path**: `/api/hardware/:userId/battery`
* **Headers**: `Content-Type: application/json`

### Request Body:
```json
{
  "device_id": "DEV-0012",
  "battery_pct": 88
}
```

### Response (HTTP 200):
```json
{
  "status": "success",
  "message": "Battery status recorded successfully",
  "data": {
    "device_id": "DEV-0012",
    "user_id": 12,
    "battery_pct": 88,
    "timestamp": "2026-10-26T10:45:00.000Z"
  }
}
```

---

## 4. Order Execution Endpoints

### 4.1. Buy Call (CE / Green Button)
* **Method**: `POST`
* **Path**: `/api/hardware/:userId/buy`
* **Body**:
  ```json
  {
    "quantity": 75,
    "strike": 24300,
    "type": "CE"
  }
  ```
* **Success Response (HTTP 200)**:
  ```json
  {
    "status": "success",
    "message": "Order placed",
    "broker": "Fyers",
    "symbol": "NSE:NIFTY26O1924300CE",
    "response": { "s": "ok", "code": 1101, "id": "24102600012345" }
  }
  ```

### 4.2. Buy Put (PE / Red Button)
* **Method**: `POST`
* **Path**: `/api/hardware/:userId/sell`
* **Body**:
  ```json
  {
    "quantity": 75,
    "strike": 24300,
    "type": "PE"
  }
  ```
* **Success Response (HTTP 200)**:
  ```json
  {
    "status": "success",
    "message": "Order placed",
    "broker": "Fyers",
    "symbol": "NSE:NIFTY26O1924300PE",
    "response": { "s": "ok", "code": 1101, "id": "24102600012346" }
  }
  ```
