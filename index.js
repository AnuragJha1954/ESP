const express = require('express');
const { Pool } = require('pg');
const fyers = require("fyers-api-v3");
const axios = require('axios');
const { authenticator } = require('otplib');
const crypto = require('crypto');

// In-memory cache to eliminate Database latency on hot trading requests
let cachedAccessToken = null;

const app = express();
app.use(express.json());

// Initialize Postgres connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_H5PIfSTxEk8o@ep-wispy-sunset-aydix10w.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require'
});

const initDB = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS fyers_auth (
                id INT PRIMARY KEY,
                access_token TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("Database table 'fyers_auth' initialized successfully.");
    } catch (err) {
        console.error("Error initializing database:", err);
    }
};
initDB();

// Function to generate the SHA256 hash required by Fyers API v3
function generateAppIdHash(clientId, secretKey) {
    const hash = crypto.createHash('sha256');
    // Fyers v3 format requires AppID + SecretKey
    hash.update(`${clientId}:${secretKey}`);
    return hash.digest('hex');
}

// Auto-login endpoint to bypass the browser
app.all('/api/fyers/generate-access-token', async (req, res) => {
    try {
        const fy_id = process.env.FYERS_ID || req.body?.fy_id;
        const totp_secret = process.env.FYERS_TOTP_SECRET || req.body?.totp_secret;
        const pin = process.env.FYERS_PIN || req.body?.pin;
        const appId = process.env.FYERS_APP_ID || req.body?.client_id;
        const secretKey = process.env.FYERS_SECRET_KEY || req.body?.secret_key;
        const redirectUri = process.env.FYERS_REDIRECT_URI || "https://trade.fyers.in/api-login/redirect-uri/index.html"; // Standard default

        if (!fy_id || !totp_secret || !pin || !appId || !secretKey) {
            return res.status(500).json({ 
                status: 'error', 
                message: 'Missing Fyers credentials. Please set FYERS_ID, FYERS_TOTP_SECRET, FYERS_PIN, FYERS_APP_ID, and FYERS_SECRET_KEY in Vercel Environment Variables.' 
            });
        }
        
        const appIdHash = generateAppIdHash(appId, secretKey);

        console.log("Step 1: Sending Login OTP Request...");
        const sendOtpResponse = await axios.post('https://api-t2.fyers.in/vagator/v2/send_login_otp_v2', {
            fy_id: fy_id,
            app_id: "2" // App id 2 is usually required for vagator authentication
        });
        
        if (sendOtpResponse.data.code !== 200) {
            throw new Error(`Failed to send OTP: ${JSON.stringify(sendOtpResponse.data)}`);
        }
        
        const requestKey = sendOtpResponse.data.request_key;

        console.log("Step 2: Generating TOTP and Verifying...");
        const totp = authenticator.generate(totp_secret);
        
        const verifyOtpResponse = await axios.post('https://api-t2.fyers.in/vagator/v2/verify_otp', {
            request_key: requestKey,
            otp: totp
        });
        
        if (verifyOtpResponse.data.code !== 200) {
            throw new Error(`Failed to verify TOTP: ${JSON.stringify(verifyOtpResponse.data)}`);
        }
        
        const requestKey2 = verifyOtpResponse.data.request_key;

        console.log("Step 3: Verifying PIN...");
        const verifyPinResponse = await axios.post('https://api-t2.fyers.in/vagator/v2/verify_pin_v2', {
            request_key: requestKey2,
            identity_type: "pin",
            identifier: pin
        });
        
        if (verifyPinResponse.data.code !== 200) {
            throw new Error(`Failed to verify PIN: ${JSON.stringify(verifyPinResponse.data)}`);
        }

        const accessTokenVagator = verifyPinResponse.data.data.access_token;

        console.log("Step 4: Getting Auth Code...");
        const authCodeResponse = await axios.post('https://api-t1.fyers.in/api/v3/token', {
            fyers_id: fy_id,
            app_id: appId,
            redirect_uri: redirectUri,
            appType: "100",
            code_challenge: "",
            state: "None",
            scope: "",
            nonce: "",
            response_type: "code",
            create_cookie: true
        }, {
            headers: {
                'Authorization': `Bearer ${accessTokenVagator}`
            }
        });
        
        if (authCodeResponse.data.s !== 'ok') {
            throw new Error(`Failed to get auth code: ${JSON.stringify(authCodeResponse.data)}`);
        }
        
        // Sometimes the API returns an explicit auth_code, sometimes we have to parse the URL redirect.
        // Fyers api v3 returns a url field which contains the auth_code
        const urlParams = new URLSearchParams(authCodeResponse.data.Url.split('?')[1]);
        const authCode = urlParams.get('auth_code');

        console.log("Step 5: Exchanging Auth Code for Access Token...");
        const tokenResponse = await fyers.generate_access_token({
            client_id: appId,
            secret_key: secretKey,
            auth_code: authCode
        });

        if (tokenResponse.s === 'ok' || tokenResponse.access_token) {
            const finalAccessToken = tokenResponse.access_token;

            console.log("Step 6: Saving to Neon Database...");
            await pool.query(`
                INSERT INTO fyers_auth (id, access_token, updated_at)
                VALUES (1, $1, CURRENT_TIMESTAMP)
                ON CONFLICT (id) DO UPDATE SET 
                access_token = EXCLUDED.access_token,
                updated_at = CURRENT_TIMESTAMP;
            `, [finalAccessToken]);

            cachedAccessToken = finalAccessToken; // Update cache immediately

            return res.status(200).json({
                status: 'success',
                message: 'Auto-login successful! Access token saved to Neon DB.',
                data: {
                    access_token: finalAccessToken
                }
            });
        } else {
            throw new Error(`Failed to generate final access token: ${JSON.stringify(tokenResponse)}`);
        }

    } catch (error) {
        console.error("Auto-Auth Error:", error.message || error);
        return res.status(500).json({ 
            status: 'error', 
            message: 'Internal server error during auto-authentication', 
            error: error.message || String(error)
        });
    }
});

// Existing trade logic
const processTrade = async (req, res, tradeType, side, optionType) => {
    try {
        const { quantity, strike_price } = req.body;
        
        if (!quantity || !strike_price) {
            console.log(`FAILURE: ${tradeType} - Missing 'quantity' or 'strike_price' in payload.`);
            return res.status(400).json({ status: 'error', message: 'Missing quantity or strike_price parameter' });
        }
        
        const numericQuantity = Number(quantity);
        const numericStrike = Number(strike_price);
        
        if (isNaN(numericQuantity) || numericQuantity <= 0 || isNaN(numericStrike) || numericStrike <= 0) {
            console.log(`FAILURE: ${tradeType} - Invalid numeric values provided.`);
            return res.status(400).json({ status: 'error', message: 'Quantity and strike_price must be positive numbers' });
        }

        const appId = process.env.FYERS_APP_ID;
        const symbolPrefix = process.env.FYERS_SYMBOL_PREFIX; // e.g., "NSE:NIFTY24OCT"

        if (!appId || !symbolPrefix) {
            console.log(`FAILURE: ${tradeType} - FYERS_APP_ID or FYERS_SYMBOL_PREFIX missing in environment variables.`);
            return res.status(500).json({ status: 'error', message: 'Server misconfiguration: Missing FYERS_APP_ID or FYERS_SYMBOL_PREFIX' });
        }

        // Fetch token from Cache or DB
        let accessToken = cachedAccessToken;
        if (!accessToken) {
            const result = await pool.query(`SELECT access_token FROM fyers_auth WHERE id = 1 LIMIT 1`);
            if (result.rows.length === 0) {
                console.log(`FAILURE: ${tradeType} - No access token found in database.`);
                return res.status(401).json({ status: 'error', message: 'Not authenticated with Fyers. Generate token first.' });
            }
            accessToken = result.rows[0].access_token;
            cachedAccessToken = accessToken; // Store in memory for next ultra-fast request
        }
        
        // Setup Fyers SDK
        fyers.setAppId(appId);
        fyers.setAccessToken(accessToken);

        // Construct exact trading symbol (e.g. NSE:NIFTY24OCT + 25000 + CE)
        const tradingSymbol = `${symbolPrefix}${numericStrike}${optionType}`;

        console.log(`Placing ${tradeType} Order -> Symbol: ${tradingSymbol}, Qty: ${numericQuantity}, Side: ${side}`);

        // Place the live order
        const orderResponse = await fyers.place_order({
            "symbol": tradingSymbol,
            "qty": numericQuantity,
            "type": 2, // 2 = Market order
            "side": side, // 1 = Buy, -1 = Sell
            "productType": "INTRADAY", // Defaulting to INTRADAY
            "limitPrice": 0,
            "stopPrice": 0,
            "validity": "DAY",
            "disclosedQty": 0,
            "offlineOrder": false
        });

        if (orderResponse.s === 'ok' || orderResponse.id) {
            console.log(`SUCCESS: ${tradeType} - Order ID: ${orderResponse.id}`);
            return res.status(200).json({
                status: 'success',
                message: `${tradeType} order placed successfully`,
                order_id: orderResponse.id,
                symbol: tradingSymbol,
                quantity: numericQuantity
            });
        } else {
            console.log(`FAILURE: ${tradeType} - Fyers API rejected order: ${JSON.stringify(orderResponse)}`);
            return res.status(400).json({
                status: 'error',
                message: 'Failed to place order with Fyers',
                details: orderResponse
            });
        }
        
    } catch (error) {
        console.log(`FAILURE: ${tradeType} - Unexpected Error: ${error.message}`);
        return res.status(500).json({ status: 'error', message: 'Internal server error', error: error.message });
    }
};

app.post('/api/buy/call', (req, res) => processTrade(req, res, 'Buy Call', 1, 'CE'));
app.post('/api/buy/put', (req, res) => processTrade(req, res, 'Buy Put', 1, 'PE'));
app.post('/api/sell/call', (req, res) => processTrade(req, res, 'Sell Call', -1, 'CE'));
app.post('/api/sell/put', (req, res) => processTrade(req, res, 'Sell Put', -1, 'PE'));

if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server running locally on port ${PORT}`);
    });
}

module.exports = app;
