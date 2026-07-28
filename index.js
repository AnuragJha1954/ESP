require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const { fyersModel } = require("fyers-api-v3");
const axios = require('axios');
const crypto = require('crypto');

// In-memory cache to eliminate Database latency on hot trading requests
let cachedAccessToken = null;

const app = express();
app.use(express.json());

let db;

const initDB = async () => {
    try {
        db = await open({
            filename: './fyers_auth.sqlite',
            driver: sqlite3.Database
        });

        await db.exec(`
            CREATE TABLE IF NOT EXISTS fyers_auth (
                id INTEGER PRIMARY KEY,
                access_token TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("Database 'fyers_auth.sqlite' initialized successfully.");
    } catch (err) {
        console.error("Error initializing SQLite database:", err);
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

// Native Zero-Dependency TOTP Generator
function base32tohex(base32) {
    let base32chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let bits = "";
    let hex = "";
    for (let i = 0; i < base32.length; i++) {
        let val = base32chars.indexOf(base32.charAt(i).toUpperCase());
        if (val === -1) continue;
        bits += val.toString(2).padStart(5, '0');
    }
    for (let i = 0; i + 4 <= bits.length; i += 4) {
        let chunk = bits.substring(i, i + 4);
        hex = hex + parseInt(chunk, 2).toString(16);
    }
    return hex;
}

function generateTOTP(secret) {
    const key = Buffer.from(base32tohex(secret), 'hex');
    const epoch = Math.round(Date.now() / 1000.0);
    const time = Buffer.alloc(8);
    let timeVal = Math.floor(epoch / 30);
    for (let i = 7; i >= 0; i--) {
        time[i] = timeVal & 0xff;
        timeVal >>= 8;
    }
    const hmac = crypto.createHmac('sha1', key);
    hmac.update(time);
    const result = hmac.digest();
    const offset = result[result.length - 1] & 0xf;
    const otp = (
        ((result[offset] & 0x7f) << 24) |
        ((result[offset + 1] & 0xff) << 16) |
        ((result[offset + 2] & 0xff) << 8) |
        (result[offset + 3] & 0xff)
    ) % 1000000;
    return otp.toString().padStart(6, '0');
}

// Auto-login endpoint to bypass the browser
app.all('/api/fyers/generate-access-token', async (req, res) => {
    try {
        const fy_id = "FAJ97539";
        const totp_secret = "C3AXMFE42T3PKWJB3H536RBDPW2SYPK3";
        const pin = "8259";
        const appId = "0LJX4AMOQB-200";
        const secretKey = "mouPEyXd92TrnWs6";
        const redirectUri = "https://trade.fyers.in/api-login/redirect-uri/index.html";

        if (!fy_id || !totp_secret || !pin || !appId || !secretKey) {
            return res.status(500).json({ 
                status: 'error', 
                message: 'Missing Fyers credentials. Please set FYERS_ID, FYERS_TOTP_SECRET, FYERS_PIN, FYERS_APP_ID, and FYERS_SECRET_KEY in Vercel Environment Variables.' 
            });
        }
        
        const baseAppId = appId.includes('-') ? appId.split('-')[0] : appId;
        const appIdHash = generateAppIdHash(appId, secretKey);

        console.log("-----------------------------------------");
        console.log("Step 1: Sending Login OTP Request...");
        const payload1 = {
            fy_id: Buffer.from(fy_id).toString('base64'),
            app_id: "2" // App id 2 is usually required for vagator authentication
        };
        console.log("Req Body:", JSON.stringify(payload1));
        const sendOtpResponse = await axios.post('https://api-t2.fyers.in/vagator/v2/send_login_otp_v2', payload1);
        console.log("Response:", JSON.stringify(sendOtpResponse.data));
        
        if (sendOtpResponse.data.code !== 200 && sendOtpResponse.data.code !== 1043 && sendOtpResponse.data.s !== 'ok') {
            throw new Error(`Failed to send OTP: ${JSON.stringify(sendOtpResponse.data)}`);
        }
        
        const requestKey = sendOtpResponse.data.request_key;

        console.log("-----------------------------------------");
        console.log("Step 2: Generating TOTP and Verifying...");
        const totp = generateTOTP(totp_secret);
        
        console.log("=========================================");
        console.log("GENERATED 6-DIGIT TOTP CODE:", totp);
        console.log("=========================================");
        
        const payload2 = {
            request_key: requestKey,
            otp: totp
        };
        console.log("Req Body:", JSON.stringify(payload2));
        const verifyOtpResponse = await axios.post('https://api-t2.fyers.in/vagator/v2/verify_otp', payload2);
        console.log("Response:", JSON.stringify(verifyOtpResponse.data));
        
        if (verifyOtpResponse.data.code !== 200 && verifyOtpResponse.data.s !== 'ok') {
            throw new Error(`Failed to verify TOTP: ${JSON.stringify(verifyOtpResponse.data)}`);
        }
        
        const requestKey2 = verifyOtpResponse.data.request_key;

        console.log("-----------------------------------------");
        console.log("Step 3: Verifying PIN...");
        const payload3 = {
            request_key: requestKey2,
            identity_type: "pin",
            identifier: Buffer.from(pin).toString('base64')
        };
        console.log("Req Body:", JSON.stringify(payload3));
        const verifyPinResponse = await axios.post('https://api-t2.fyers.in/vagator/v2/verify_pin_v2', payload3);
        console.log("Response:", JSON.stringify(verifyPinResponse.data));
        
        if (verifyPinResponse.data.code !== 200 && verifyPinResponse.data.s !== 'ok') {
            throw new Error(`Failed to verify PIN: ${JSON.stringify(verifyPinResponse.data)}`);
        }

        const accessTokenVagator = verifyPinResponse.data.data.access_token;

        console.log("-----------------------------------------");
        console.log("Step 4: Getting Auth Code...");
        const payload4 = {
            fyers_id: fy_id,
            app_id: appId.includes('-') ? appId.split('-')[0] : appId,
            redirect_uri: redirectUri,
            appType: appId.includes('-') ? appId.split('-')[1] : "100",
            code_challenge: "",
            state: crypto.randomBytes(8).toString('hex'),
            scope: "",
            nonce: "",
            response_type: "code",
            create_cookie: true
        };
        console.log("Req Body:", JSON.stringify(payload4));
        const authCodeResponse = await axios.post('https://api-t1.fyers.in/api/v3/token', payload4, {
            headers: {
                'Authorization': `Bearer ${accessTokenVagator}`
            },
            validateStatus: function (status) {
                return status >= 200 && status < 400; // Accept 308 Redirect as success
            }
        });
        console.log("Response:", JSON.stringify(authCodeResponse.data));
        
        if (authCodeResponse.data.s !== 'ok') {
            throw new Error(`Failed to get auth code: ${JSON.stringify(authCodeResponse.data)}`);
        }
        
        // Sometimes the API returns an explicit auth_code, sometimes we have to parse the URL redirect.
        // Fyers api v3 returns a url field which contains the auth_code
        const urlParams = new URLSearchParams(authCodeResponse.data.Url.split('?')[1]);
        const authCode = urlParams.get('auth_code');

        console.log("-----------------------------------------");
        console.log("Step 5: Exchanging Auth Code for Access Token...");
        const payload5 = {
            grant_type: "authorization_code",
            appIdHash: appIdHash,
            code: authCode
        };
        console.log("Req Params:", JSON.stringify(payload5));
        const tokenReq = await axios.post('https://api-t1.fyers.in/api/v3/validate-authcode', payload5);
        const tokenResponse = tokenReq.data;
        console.log("Response:", JSON.stringify(tokenResponse));

        if (tokenResponse.s === 'ok' || tokenResponse.access_token) {
            const finalAccessToken = tokenResponse.access_token;

            console.log("Step 6: Saving to Local SQLite Database...");
            await db.run(`
                INSERT INTO fyers_auth (id, access_token, updated_at)
                VALUES (1, ?, CURRENT_TIMESTAMP)
                ON CONFLICT (id) DO UPDATE SET 
                access_token = excluded.access_token,
                updated_at = CURRENT_TIMESTAMP;
            `, [finalAccessToken]);

            cachedAccessToken = finalAccessToken; // Update cache immediately

            return res.status(200).json({
                status: 'success',
                message: 'Login successful and local DB updated with new access token.'
            });
        } else {
            throw new Error(`Failed to generate final access token: ${JSON.stringify(tokenResponse)}`);
        }

    } catch (error) {
        const errorDetail = error.response ? error.response.data : (error.message || String(error));
        console.error("Auto-Auth Error:", JSON.stringify(errorDetail));
        return res.status(500).json({ 
            status: 'error', 
            message: 'Internal server error during auto-authentication', 
            error: errorDetail
        });
    }
});

const executeTrade = async (req, res, side) => {
    try {
        const { quantity, strike, type } = req.body;
        
        if (!quantity || !strike || !type) {
            return res.status(400).json({ status: 'error', message: 'Missing quantity, strike, or type (CE/PE)' });
        }
        
        const optionType = type.toUpperCase();
        if (optionType !== 'CE' && optionType !== 'PE') {
            return res.status(400).json({ status: 'error', message: 'type must be CE or PE' });
        }

        // Fetch access token from SQLite DB
        const row = await db.get(`SELECT access_token FROM fyers_auth WHERE id = 1 LIMIT 1`);
        if (!row || !row.access_token) {
            return res.status(401).json({ status: 'error', message: 'No access token found in database. Run auto-auth first.' });
        }
        
        const accessToken = row.access_token;
        const appId = "0LJX4AMOQB-200";

        // Setup Fyers SDK
        const fyers = new fyersModel();
        fyers.setAppId(appId);
        fyers.setRedirectUrl("https://trade.fyers.in/api-login/redirect-uri/index.html");
        fyers.setAccessToken(accessToken);

        // Construct dynamic symbol (Hardcoding 26JUL as the active contract month)
        const tradingSymbol = `NSE:NIFTY26JUL${strike}${optionType}`;

        console.log(`Executing ${side === 1 ? 'BUY' : 'SELL'} -> ${tradingSymbol} | Qty: ${quantity}`);

        // Place the live order
        const orderResponse = await fyers.place_order({
            "symbol": tradingSymbol,
            "qty": Number(quantity),
            "type": 2, // 2 = Market order
            "side": side, // 1 = Buy, -1 = Sell
            "productType": "INTRADAY",
            "limitPrice": 0,
            "stopPrice": 0,
            "validity": "DAY",
            "disclosedQty": 0,
            "offlineOrder": false,
            "stopLoss": 0,
            "takeProfit": 0,
            "orderTag": "APIOrder",
            "isSliceOrder": false
        });

        return res.status(200).json({
            status: "success",
            message: "Order placed",
            symbol: tradingSymbol,
            fyers_response: orderResponse
        });

    } catch (error) {
        console.log(`FAILURE: Execute Trade - Error: ${error.message}`);
        return res.status(500).json({ status: 'error', message: 'Internal server error', error: error.message });
    }
};

app.post('/api/buy', (req, res) => executeTrade(req, res, 1));
app.post('/api/sell', (req, res) => executeTrade(req, res, -1));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running locally on port ${PORT}`);
});

module.exports = app;
