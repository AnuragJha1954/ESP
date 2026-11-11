# Fyers Vercel API Documentation

This document outlines the request payloads and response structures for all endpoints of the Fyers Auto-Trading API deployed on Vercel. This is intended as a reference for the microcontroller/hardware backend developer.

## Base URL
`https://<your-vercel-project-name>.vercel.app`

---

## 1. Authentication Endpoint

This endpoint triggers the headless auto-login sequence to generate a fresh Fyers access token and stores it securely in the database. 

**Endpoint:** `/api/fyers/generate-access-token`
**Method:** `GET` or `POST`

### Request Payload
*None required.* The Vercel server relies entirely on its internal environment variables to generate the token.

### Successful Response (HTTP 200)
```json
{
  "status": "success",
  "message": "Auto-login successful! Access token saved to Neon DB.",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6Ik..."
  }
}
```

### Error Response (HTTP 400/500)
```json
{
  "status": "error",
  "message": "Missing Fyers credentials. Please set FYERS_ID...",
  "error": "Optional detailed error message"
}
```

---

## 2. Trading Endpoints

These endpoints trigger actual live Market INTRADAY options orders on the Fyers account. 
*Note: Ensure the authentication endpoint is triggered successfully at least once for the day before hitting these.*

### Endpoints:
- **Buy Call:** `/api/buy/call`
- **Buy Put:** `/api/buy/put`
- **Sell Call:** `/api/sell/call`
- **Sell Put:** `/api/sell/put`

**Method:** `POST`
**Headers Required:** `Content-Type: application/json`

### Request Payload (Same for all 4 endpoints)
```json
{
  "quantity": 50,
  "strike_price": 25000
}
```
* **`quantity`** (Number): The total quantity to trade (e.g., 50 for 2 lots of Nifty). Must be > 0.
* **`strike_price`** (Number): The strike price of the option contract. Must be > 0.

*(The API will automatically construct the exact trading symbol like `NSE:NIFTY24OCT25000CE` internally using Vercel environment variables).*

### Successful Response (HTTP 200)
```json
{
  "status": "success",
  "message": "Buy Call order placed successfully",
  "order_id": "813824819231",
  "symbol": "NSE:NIFTY24OCT25000CE",
  "quantity": 50
}
```
*(The message will dynamically change based on the endpoint, e.g., "Sell Put order placed successfully").*

### Error Responses

**Bad Request - Missing/Invalid Payload (HTTP 400)**
```json
{
  "status": "error",
  "message": "Missing quantity or strike_price parameter"
}
```

**Unauthorized - No Access Token (HTTP 401)**
```json
{
  "status": "error",
  "message": "Not authenticated with Fyers. Generate token first."
}
```

**Fyers Exchange Error (HTTP 400)**
*(Example: Insufficient funds or invalid symbol)*
```json
{
  "status": "error",
  "message": "Failed to place order with Fyers",
  "details": {
    "s": "error",
    "code": -300,
    "message": "RMS: Margin Exceeds"
  }
}
```

---

## 3. Environment Variables (Vercel)

The backend relies on these environment variables being set in the Vercel Project Settings. **The microcontroller developer does not need to worry about these**, but whoever deploys the backend must configure them in Vercel for the API to function.

| Variable Name | Description | Example |
| :--- | :--- | :--- |
| `DATABASE_URL` | The Neon PostgreSQL database connection string. | `postgresql://neondb_owner:npg_H5...` |
| `FYERS_ID` | Your Fyers Client ID (Username). | `XY12345` |
| `FYERS_TOTP_SECRET` | The 32-character TOTP secret from Fyers 2FA settings. | `ABCDEFGHIJKLMNOPQRSTUVWXYZ123456` |
| `FYERS_PIN` | Your 4-digit numeric Fyers account PIN. | `1234` |
| `FYERS_APP_ID` | Your Fyers API App Client ID. | `ABCDEFGH12-100` |
| `FYERS_SECRET_KEY` | Your Fyers API App Secret Key. | `A1B2C3D4E5` |
| `FYERS_SYMBOL_PREFIX` | The exact Fyers symbol prefix for the current expiry. Must be manually updated upon expiry. | `NSE:NIFTY24OCT` |
```
