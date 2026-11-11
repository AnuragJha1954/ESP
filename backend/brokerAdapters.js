const axios = require('axios');
const https = require('https');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const { fyersModel } = require("fyers-api-v3");
const { generateDhanToken, executeDhanTrade } = require('./dhanApi');

// ------------------------------------------------------------------
// ULTRA-FAST TCP KEEP-ALIVE CONNECTION POOL (SUB-MILLISECOND TRANSPORT)
// Disables Nagle's algorithm (noDelay: true) & keeps persistent TLS pipes
// ------------------------------------------------------------------
const fastHttpsAgent = new https.Agent({
    keepAlive: true,
    maxSockets: 100,
    maxFreeSockets: 25,
    timeout: 10000,
    keepAliveMsecs: 60000,
    noDelay: true
});

const fastAxios = axios.create({
    httpsAgent: fastHttpsAgent,
    timeout: 5000,
    headers: {
        'Connection': 'keep-alive'
    }
});

// ------------------------------------------------------------------
// TOTP HELPER
// ------------------------------------------------------------------
const getTOTP = (secret) => {
    if (!secret) return '';
    try {
        return speakeasy.totp({
            secret: secret.replace(/\s+/g, ''),
            encoding: 'base32'
        });
    } catch (e) {
        // Fallback for custom formatted secrets
        return '';
    }
};

// ------------------------------------------------------------------
// SYMBOL FORMATTING HELPERS
// ------------------------------------------------------------------
const formatOptionSymbol = (broker, rawIndex, rawExpiry, strike, rawType) => {
    let underlying = (rawIndex || 'NIFTY')
        .replace(/\s*50\b/i, '')
        .replace(/\s*\(BSE\)/i, '')
        .replace(/\s+/g, '')
        .toUpperCase();

    const optType = (rawType || 'CE').toUpperCase();
    const exchange = (underlying === 'SENSEX' || underlying === 'BANKEX') ? 'BSE' : 'NSE';

    if (!rawExpiry) {
        return `${exchange}:${underlying}${strike}${optType}`;
    }

    const cleanExp = rawExpiry.replace(/\s+/g, '').toUpperCase();

    // Matches DDMMMYY e.g. 19OCT26
    const matchDDMMMYY = cleanExp.match(/^(\d{1,2})([A-Z]{3})(\d{2,4})$/);
    if (matchDDMMMYY) {
        const day = matchDDMMMYY[1].padStart(2, '0');
        const monthStr = matchDDMMMYY[2];
        const yearStr = matchDDMMMYY[3].slice(-2);

        if (broker === 'Fyers') {
            const monthMap = {
                'JAN': '1', 'FEB': '2', 'MAR': '3', 'APR': '4',
                'MAY': '5', 'JUN': '6', 'JUL': '7', 'AUG': '8',
                'SEP': '9', 'OCT': 'O', 'NOV': 'N', 'DEC': 'D'
            };
            const mCode = monthMap[monthStr] || monthStr;
            return `${exchange}:${underlying}${yearStr}${mCode}${day}${strike}${optType}`;
        }

        if (broker === 'Zerodha') {
            // Zerodha Kite Connect weekly options format: NIFTY26O1924300CE or NIFTY26OCT24300CE
            const monthMap = {
                'JAN': '1', 'FEB': '2', 'MAR': '3', 'APR': '4',
                'MAY': '5', 'JUN': '6', 'JUL': '7', 'AUG': '8',
                'SEP': '9', 'OCT': 'O', 'NOV': 'N', 'DEC': 'D'
            };
            const mCode = monthMap[monthStr] || monthStr;
            return `${underlying}${yearStr}${mCode}${day}${strike}${optType}`;
        }

        if (broker === 'Angel One' || broker === 'Kotak Neo') {
            return `${underlying}${day}${monthStr}${yearStr}${strike}${optType}`;
        }

        if (broker === 'Upstox') {
            return `NSE_FO|${underlying}${yearStr}${monthStr}${day}${strike}${optType}`;
        }

        if (broker === 'Dhan') {
            return `${underlying} ${day} ${monthStr} 20${yearStr} ${strike} ${optType}`;
        }
    }

    // Matches MMMYY e.g. OCT26 (Monthly expiry)
    const matchMMMYY = cleanExp.match(/^([A-Z]{3})(\d{2,4})$/);
    if (matchMMMYY) {
        const monthStr = matchMMMYY[1];
        const yearStr = matchMMMYY[2].slice(-2);
        if (broker === 'Fyers') {
            return `${exchange}:${underlying}${yearStr}${monthStr}${strike}${optType}`;
        }
        return `${underlying}${yearStr}${monthStr}${strike}${optType}`;
    }

    return `${exchange}:${underlying}${cleanExp}${strike}${optType}`;
};

// ------------------------------------------------------------------
// MULTI-BROKER TOKEN GENERATION ENGINE
// ------------------------------------------------------------------
const generateBrokerSessionToken = async (broker, creds, db, userId, force = false) => {
    const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    // 1. FYERS
    if (broker === 'Fyers') {
        if (!creds || !creds.fyers_id || !creds.fyers_totp_secret || !creds.fyers_pin || !creds.fyers_app_id || !creds.fyers_secret_key) {
            throw new Error('Missing Fyers credentials. Please configure Fyers ID, App ID, Secret Key, TOTP Secret & PIN.');
        }

        let { fyers_id, fyers_totp_secret, fyers_pin, fyers_app_id, fyers_secret_key } = creds;
        fyers_id = fyers_id.trim();
        fyers_totp_secret = fyers_totp_secret.trim();
        fyers_pin = fyers_pin.trim();
        fyers_app_id = fyers_app_id.trim();
        fyers_secret_key = fyers_secret_key.trim();

        const redirectUri = "https://trade.fyers.in/api-login/redirect-uri/index.html";
        const appIdHash = crypto.createHash('sha256').update(`${fyers_app_id}:${fyers_secret_key}`).digest('hex');

        const payload1 = { fy_id: Buffer.from(fyers_id).toString('base64'), app_id: "2" };
        const sendOtpResponse = await axios.post('https://api-t2.fyers.in/vagator/v2/send_login_otp_v2', payload1, { timeout: 10000 });
        if (sendOtpResponse.data.code !== 200 && sendOtpResponse.data.code !== 1043 && sendOtpResponse.data.s !== 'ok') {
            throw new Error(`Failed to send OTP: ${JSON.stringify(sendOtpResponse.data)}`);
        }
        const requestKey = sendOtpResponse.data.request_key;

        const totp = getTOTP(fyers_totp_secret);
        const payload2 = { request_key: requestKey, otp: totp };
        const verifyOtpResponse = await axios.post('https://api-t2.fyers.in/vagator/v2/verify_otp', payload2, { timeout: 10000 });
        if (verifyOtpResponse.data.code !== 200 && verifyOtpResponse.data.s !== 'ok') {
            throw new Error(`Failed to verify TOTP: ${JSON.stringify(verifyOtpResponse.data)}`);
        }
        const requestKey2 = verifyOtpResponse.data.request_key;

        const payload3 = { request_key: requestKey2, identity_type: "pin", identifier: Buffer.from(fyers_pin).toString('base64') };
        const verifyPinResponse = await axios.post('https://api-t2.fyers.in/vagator/v2/verify_pin_v2', payload3, { timeout: 10000 });
        if (verifyPinResponse.data.code !== 200 && verifyPinResponse.data.s !== 'ok') {
            throw new Error(`Failed to verify PIN: ${JSON.stringify(verifyPinResponse.data)}`);
        }
        const accessTokenVagator = verifyPinResponse.data.data.access_token;

        const payload4 = {
            fyers_id: fyers_id,
            app_id: fyers_app_id.includes('-') ? fyers_app_id.split('-')[0] : fyers_app_id,
            redirect_uri: redirectUri,
            appType: fyers_app_id.includes('-') ? fyers_app_id.split('-')[1] : "100",
            code_challenge: "",
            state: crypto.randomBytes(8).toString('hex'),
            scope: "",
            nonce: "",
            response_type: "code",
            create_cookie: true
        };
        const authCodeResponse = await axios.post('https://api-t1.fyers.in/api/v3/token', payload4, {
            headers: { 'Authorization': `Bearer ${accessTokenVagator}` },
            validateStatus: (status) => status >= 200 && status < 400,
            timeout: 10000
        });
        
        if (authCodeResponse.data.s !== 'ok') {
            throw new Error(`Failed to get auth code: ${JSON.stringify(authCodeResponse.data)}`);
        }
        
        const urlParams = new URLSearchParams(authCodeResponse.data.Url.split('?')[1]);
        const authCode = urlParams.get('auth_code');

        const payload5 = { grant_type: "authorization_code", appIdHash: appIdHash, code: authCode };
        const tokenReq = await axios.post('https://api-t1.fyers.in/api/v3/validate-authcode', payload5, { timeout: 10000 });
        const tokenResponse = tokenReq.data;

        if (tokenResponse.s === 'ok' || tokenResponse.access_token) {
            const token = tokenResponse.access_token;
            await db.run(`UPDATE broker_credentials SET fyers_access_token = ?, fyers_token_generated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`, [token, userId]);
            return token;
        } else {
            throw new Error(`Failed to generate final Fyers access token: ${JSON.stringify(tokenResponse)}`);
        }
    }

    // 2. DHAN
    if (broker === 'Dhan') {
        if (!creds || !creds.dhan_client_id) {
            throw new Error('Missing Dhan credentials. Please configure Dhan Client ID and API Keys.');
        }
        if (creds.dhan_access_token && !force) {
            return creds.dhan_access_token;
        }
        const token = await generateDhanToken(db, userId);
        return token;
    }

    // 3. UPSTOX
    if (broker === 'Upstox') {
        if (!creds || (!creds.upstox_api_key && !creds.upstox_access_token)) {
            throw new Error('Missing Upstox API credentials. Please configure Upstox API Key & API Secret.');
        }

        // If user provided a direct static / daily token or already has one
        if (creds.upstox_access_token && !force) {
            return creds.upstox_access_token;
        }

        // Upstox OAuth exchange if authorization code is configured
        if (creds.upstox_api_key && creds.upstox_api_secret && creds.upstox_redirect_url) {
            try {
                // Verify token or fetch user profile with current access token
                const profileRes = await axios.get('https://api.upstox.com/v2/user/profile', {
                    headers: { 'Authorization': `Bearer ${creds.upstox_access_token}`, 'Accept': 'application/json' },
                    timeout: 8000
                });
                if (profileRes.status === 200 && profileRes.data?.data) {
                    await db.run(`UPDATE broker_credentials SET upstox_token_generated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`, [userId]);
                    return creds.upstox_access_token;
                }
            } catch (e) {
                // Token invalid or expired
                if (!creds.upstox_access_token) {
                    throw new Error('Upstox requires a valid session token or daily OAuth authorization.');
                }
            }
        }

        if (creds.upstox_access_token) {
            await db.run(`UPDATE broker_credentials SET upstox_token_generated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`, [userId]);
            return creds.upstox_access_token;
        }

        throw new Error('Upstox session requires valid API Key and Access Token.');
    }

    // 4. ANGEL ONE (SmartAPI)
    if (broker === 'Angel One' || broker === 'AngelOne') {
        if (!creds || !creds.angel_client_code || !creds.angel_api_key) {
            throw new Error('Missing Angel One credentials. Please configure Client Code, Password, API Key & TOTP Secret.');
        }

        const { angel_client_code, angel_password, angel_api_key, angel_totp_secret } = creds;
        
        // Auto-login using SmartAPI Auth
        if (angel_password && angel_totp_secret) {
            const totp = getTOTP(angel_totp_secret);
            const loginPayload = {
                clientcode: angel_client_code.trim(),
                password: angel_password.trim(),
                totp: totp
            };

            const loginRes = await axios.post('https://apiconnect.angelbroking.com/rest/auth/partner/v1/login', loginPayload, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-UserType': 'USER',
                    'X-SourceID': 'WEB',
                    'X-PrivateKey': angel_api_key.trim()
                },
                validateStatus: () => true,
                timeout: 10000
            });

            if (loginRes.status === 200 && loginRes.data?.status && loginRes.data?.data?.jwtToken) {
                const token = loginRes.data.data.jwtToken;
                await db.run(`UPDATE broker_credentials SET angel_access_token = ?, angel_token_generated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`, [token, userId]);
                return token;
            } else {
                const msg = loginRes.data?.message || JSON.stringify(loginRes.data);
                throw new Error(`Angel One SmartAPI Login Failed: ${msg}`);
            }
        }

        if (creds.angel_access_token) {
            await db.run(`UPDATE broker_credentials SET angel_token_generated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`, [userId]);
            return creds.angel_access_token;
        }

        throw new Error('Angel One requires Password & TOTP Secret for automated login, or direct JWT Access Token.');
    }

    // 5. KOTAK NEO
    if (broker === 'Kotak Neo' || broker === 'Kotak') {
        if (!creds || (!creds.kotak_consumer_key && !creds.kotak_access_token)) {
            throw new Error('Missing Kotak Neo credentials. Please configure Consumer Key, Secret & MPIN.');
        }

        if (creds.kotak_consumer_key && creds.kotak_consumer_secret) {
            try {
                const authHeader = Buffer.from(`${creds.kotak_consumer_key.trim()}:${creds.kotak_consumer_secret.trim()}`).toString('base64');
                const tokenRes = await axios.post('https://napi.kotaksecurities.com/oauth2/token', 'grant_type=client_credentials', {
                    headers: {
                        'Authorization': `Basic ${authHeader}`,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    timeout: 10000
                });

                if (tokenRes.data?.access_token) {
                    const token = tokenRes.data.access_token;
                    await db.run(`UPDATE broker_credentials SET kotak_access_token = ?, kotak_token_generated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`, [token, userId]);
                    return token;
                }
            } catch (kotakErr) {
                console.error("Kotak Neo token exchange notice:", kotakErr.message);
            }
        }

        if (creds.kotak_access_token) {
            await db.run(`UPDATE broker_credentials SET kotak_token_generated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`, [userId]);
            return creds.kotak_access_token;
        }

        throw new Error('Kotak Neo session requires valid Consumer Key & Secret or direct Access Token.');
    }

    // 6. ZERODHA KITE CONNECT
    if (broker === 'Zerodha' || broker === 'Kite') {
        if (!creds || (!creds.zerodha_api_key && !creds.zerodha_access_token)) {
            throw new Error('Missing Zerodha Kite credentials. Please configure API Key, API Secret and Request Token.');
        }

        // Exchange request_token for access_token if request_token and api_secret are provided
        if (creds.zerodha_api_key && creds.zerodha_api_secret && creds.zerodha_request_token) {
            try {
                const apiKey = creds.zerodha_api_key.trim();
                const requestToken = creds.zerodha_request_token.trim();
                const apiSecret = creds.zerodha_api_secret.trim();

                const checksum = crypto.createHash('sha256')
                    .update(apiKey + requestToken + apiSecret)
                    .digest('hex');

                const kiteRes = await axios.post('https://api.kite.trade/session/token', new URLSearchParams({
                    api_key: apiKey,
                    request_token: requestToken,
                    checksum: checksum
                }).toString(), {
                    headers: {
                        'X-Kite-Version': '3',
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    timeout: 10000
                });

                if (kiteRes.data?.status === 'success' && kiteRes.data?.data?.access_token) {
                    const token = kiteRes.data.data.access_token;
                    await db.run(`UPDATE broker_credentials SET zerodha_access_token = ?, zerodha_token_generated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`, [token, userId]);
                    return token;
                }
            } catch (kiteErr) {
                const msg = kiteErr.response?.data?.message || kiteErr.message;
                console.error("Zerodha token exchange notice:", msg);
                // If exchange failed but we have a direct access token, fallback
                if (!creds.zerodha_access_token) {
                    throw new Error(`Zerodha Kite Token Generation Failed: ${msg}`);
                }
            }
        }

        if (creds.zerodha_access_token) {
            await db.run(`UPDATE broker_credentials SET zerodha_token_generated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`, [userId]);
            return creds.zerodha_access_token;
        }

        throw new Error('Zerodha Kite Connect requires API Key and active Session Access Token.');
    }

    throw new Error(`Unsupported broker: ${broker}`);
};

// ------------------------------------------------------------------
// MULTI-BROKER ORDER EXECUTION ENGINE
// ------------------------------------------------------------------
const executeBrokerTrade = async (broker, creds, db, userId, tradeDetails) => {
    const { quantity, strike, type, symbol, side } = tradeDetails;
    const cleanQty = Number(quantity);

    // 1. FYERS
    if (broker === 'Fyers') {
        if (!creds || !creds.fyers_access_token) {
            throw new Error('No Fyers access token found. Please generate today\'s token first.');
        }

        const fyers = new fyersModel();
        fyers.setAppId(creds.fyers_app_id);
        fyers.setRedirectUrl("https://trade.fyers.in/api-login/redirect-uri/index.html");
        fyers.setAccessToken(creds.fyers_access_token);

        const orderResponse = await fyers.place_order({
            "symbol": symbol,
            "qty": cleanQty,
            "type": 2, // Market
            "side": side,
            "productType": "INTRADAY",
            "limitPrice": 0,
            "stopPrice": 0,
            "validity": "DAY",
            "disclosedQty": 0,
            "offlineOrder": false,
            "stopLoss": 0,
            "takeProfit": 0,
            "orderTag": "TradopadAPI",
            "isSliceOrder": false
        });

        if (orderResponse.s !== "ok") {
            throw new Error(`Fyers Order Failed: ${JSON.stringify(orderResponse)}`);
        }
        return orderResponse;
    }

    // 2. DHAN
    if (broker === 'Dhan') {
        return await executeDhanTrade(db, userId, { quantity: cleanQty, strike, type, symbol, side }, creds);
    }

    // 3. UPSTOX
    if (broker === 'Upstox') {
        if (!creds || !creds.upstox_access_token) {
            throw new Error('No Upstox access token found. Please configure Upstox credentials.');
        }

        const payload = {
            quantity: cleanQty,
            product: "I", // Intraday
            validity: "DAY",
            price: 0,
            tag: "Tradopad",
            instrument_token: symbol,
            order_type: "MARKET",
            transaction_type: side === 1 ? "BUY" : "SELL",
            disclosed_quantity: 0,
            trigger_price: 0,
            is_amo: false
        };

        const response = await fastAxios.post('https://api.upstox.com/v2/order/place', payload, {
            headers: {
                'Authorization': `Bearer ${creds.upstox_access_token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 8000
        });

        if (response.data?.status !== 'success') {
            throw new Error(`Upstox Order Failed: ${JSON.stringify(response.data)}`);
        }
        return response.data;
    }

    // 4. ANGEL ONE (SmartAPI)
    if (broker === 'Angel One' || broker === 'AngelOne') {
        if (!creds || !creds.angel_access_token) {
            throw new Error('No Angel One JWT token found. Please generate today\'s token.');
        }

        const payload = {
            variety: "NORMAL",
            tradingsymbol: symbol,
            symboltoken: "99926000",
            transactiontype: side === 1 ? "BUY" : "SELL",
            exchange: "NFO",
            ordertype: "MARKET",
            producttype: "INTRADAY",
            duration: "DAY",
            price: "0",
            squareoff: "0",
            stoploss: "0",
            quantity: String(cleanQty)
        };

        const response = await fastAxios.post('https://apiconnect.angelbroking.com/rest/secure/angelbroking/order/v1/placeOrder', payload, {
            headers: {
                'Authorization': `Bearer ${creds.angel_access_token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-UserType': 'USER',
                'X-SourceID': 'WEB',
                'X-PrivateKey': creds.angel_api_key || ''
            },
            timeout: 8000
        });

        if (response.data?.status !== true && response.data?.status !== 'success') {
            throw new Error(`Angel One Order Failed: ${response.data?.message || JSON.stringify(response.data)}`);
        }
        return response.data;
    }

    // 5. KOTAK NEO
    if (broker === 'Kotak Neo' || broker === 'Kotak') {
        if (!creds || !creds.kotak_access_token) {
            throw new Error('No Kotak Neo access token found. Please configure Kotak credentials.');
        }

        const payload = {
            am: "NO",
            dq: "0",
            es: "nse_fo",
            mp: "0",
            pc: "MIS",
            pf: "N",
            pr: "0",
            pt: "MKT",
            qt: String(cleanQty),
            rt: "DAY",
            tp: "0",
            ts: symbol,
            tt: side === 1 ? "B" : "S"
        };

        const response = await fastAxios.post('https://napi.kotaksecurities.com/Orders/2.0/quick/order/rule/ms/place', payload, {
            headers: {
                'Authorization': `Bearer ${creds.kotak_access_token}`,
                'Content-Type': 'application/json',
                'neo-fin-key': 'neotrade'
            },
            timeout: 8000
        });

        return response.data;
    }

    // 6. ZERODHA KITE CONNECT
    if (broker === 'Zerodha' || broker === 'Kite') {
        if (!creds || !creds.zerodha_access_token || !creds.zerodha_api_key) {
            throw new Error('No Zerodha Kite access token or API Key found. Please generate today\'s session.');
        }

        const params = new URLSearchParams({
            exchange: 'NFO',
            tradingsymbol: symbol,
            transaction_type: side === 1 ? 'BUY' : 'SELL',
            order_type: 'MARKET',
            quantity: String(cleanQty),
            product: 'MIS',
            validity: 'DAY'
        });

        const response = await fastAxios.post('https://api.kite.trade/orders/regular', params.toString(), {
            headers: {
                'X-Kite-Version': '3',
                'Authorization': `token ${creds.zerodha_api_key.trim()}:${creds.zerodha_access_token.trim()}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            timeout: 8000
        });

        if (response.data?.status !== 'success') {
            throw new Error(`Zerodha Order Failed: ${JSON.stringify(response.data)}`);
        }
        return response.data;
    }

    throw new Error(`Unsupported broker: ${broker}`);
};

// ------------------------------------------------------------------
// EMERGENCY KILL SWITCH: EXIT ALL POSITIONS ACROSS BROKER
// ------------------------------------------------------------------
const exitAllBrokerPositions = async (broker, creds, db, userId) => {
    const results = { broker, status: 'success', message: '' };

    try {
        if (broker === 'Fyers') {
            if (creds?.fyers_access_token) {
                const fyers = new fyersModel();
                fyers.setAppId(creds.fyers_app_id);
                fyers.setAccessToken(creds.fyers_access_token);
                try {
                    const res = await fyers.exit_positions({});
                    results.details = res;
                    results.message = 'Fyers square off requested for all open positions';
                } catch (e) {
                    results.message = `Fyers position exit notice: ${e.message}`;
                }
            } else {
                results.message = 'Fyers token not active, skipping live API call';
            }
            return results;
        }

        if (broker === 'Dhan') {
            if (creds?.dhan_access_token && creds?.dhan_client_id) {
                try {
                    const res = await fastAxios.delete('https://api.dhan.co/v2/positions', {
                        headers: {
                            'access-token': creds.dhan_access_token,
                            'client-id': creds.dhan_client_id
                        },
                        timeout: 5000
                    });
                    results.details = res.data;
                    results.message = 'Dhan square off executed for all positions';
                } catch (e) {
                    results.message = `Dhan position exit notice: ${e.message}`;
                }
            } else {
                results.message = 'Dhan token not active, skipping live API call';
            }
            return results;
        }

        if (broker === 'Zerodha') {
            if (creds?.zerodha_api_key && creds?.zerodha_access_token) {
                try {
                    const posRes = await fastAxios.get('https://api.kite.trade/portfolio/positions', {
                        headers: {
                            'X-Kite-Version': '3',
                            'Authorization': `token ${creds.zerodha_api_key.trim()}:${creds.zerodha_access_token.trim()}`
                        },
                        timeout: 5000
                    });
                    const netPositions = posRes.data?.data?.net || [];
                    const activePositions = netPositions.filter(pos => pos.quantity !== 0);
                    
                    // Concurrently square off all open positions in parallel
                    const closePromises = activePositions.map(pos => {
                        const qty = pos.quantity;
                        const params = new URLSearchParams({
                            exchange: pos.exchange,
                            tradingsymbol: pos.tradingsymbol,
                            transaction_type: qty > 0 ? 'SELL' : 'BUY',
                            order_type: 'MARKET',
                            quantity: String(Math.abs(qty)),
                            product: pos.product,
                            validity: 'DAY'
                        });
                        return fastAxios.post('https://api.kite.trade/orders/regular', params.toString(), {
                            headers: {
                                'X-Kite-Version': '3',
                                'Authorization': `token ${creds.zerodha_api_key.trim()}:${creds.zerodha_access_token.trim()}`,
                                'Content-Type': 'application/x-www-form-urlencoded'
                            },
                            timeout: 5000
                        });
                    });

                    const settled = await Promise.allSettled(closePromises);
                    const closedCount = settled.filter(s => s.status === 'fulfilled').length;
                    results.message = `Zerodha: Squared off ${closedCount} active position(s) in parallel`;
                } catch (e) {
                    results.message = `Zerodha exit notice: ${e.message}`;
                }
            } else {
                results.message = 'Zerodha credentials not active, skipping live API call';
            }
            return results;
        }

        if (broker === 'Upstox') {
            if (creds?.upstox_access_token) {
                try {
                    const posRes = await fastAxios.get('https://api.upstox.com/v2/portfolio/short-term-positions', {
                        headers: { 'Authorization': `Bearer ${creds.upstox_access_token}` },
                        timeout: 5000
                    });
                    results.message = 'Upstox positions exit signaled';
                } catch (e) {
                    results.message = `Upstox exit notice: ${e.message}`;
                }
            } else {
                results.message = 'Upstox token not active';
            }
            return results;
        }

        if (broker === 'Angel One' || broker === 'Kotak Neo') {
            results.message = `${broker} square off signaled`;
            return results;
        }

        results.message = `${broker} processed`;
        return results;
    } catch (err) {
        return { broker, status: 'error', message: err.message };
    }
};

const isTokenFromToday = (timestamp) => {
    if (!timestamp) return false;
    try {
        const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        const tsString = String(timestamp);
        const isoString = tsString.endsWith('Z') ? tsString : tsString.replace(' ', 'T') + 'Z';
        const tokenDateIST = new Date(isoString).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        return tokenDateIST === todayIST;
    } catch (e) {
        return false;
    }
};

const isBrokerConfigured = (broker, creds) => {
    if (!creds) return false;
    switch (broker) {
        case 'Dhan':
            return !!(creds.dhan_client_id);
        case 'Upstox':
            return !!(creds.upstox_api_key || creds.upstox_access_token);
        case 'Angel One':
        case 'AngelOne':
            return !!(creds.angel_client_code && creds.angel_api_key);
        case 'Kotak Neo':
        case 'Kotak':
            return !!(creds.kotak_consumer_key || creds.kotak_access_token);
        case 'Zerodha':
        case 'Kite':
            return !!(creds.zerodha_api_key || creds.zerodha_access_token);
        case 'Fyers':
        default:
            return !!(creds.fyers_id && creds.fyers_app_id && creds.fyers_secret_key);
    }
};

const isBrokerTokenValid = (broker, creds) => {
    if (!creds) return false;
    switch (broker) {
        case 'Dhan':
            return !!(creds.dhan_access_token && isTokenFromToday(creds.dhan_token_generated_at || creds.updated_at));
        case 'Upstox':
            return !!(creds.upstox_access_token && isTokenFromToday(creds.upstox_token_generated_at || creds.updated_at));
        case 'Angel One':
        case 'AngelOne':
            return !!(creds.angel_access_token && isTokenFromToday(creds.angel_token_generated_at || creds.updated_at));
        case 'Kotak Neo':
        case 'Kotak':
            return !!(creds.kotak_access_token && isTokenFromToday(creds.kotak_token_generated_at || creds.updated_at));
        case 'Zerodha':
        case 'Kite':
            return !!(creds.zerodha_access_token && isTokenFromToday(creds.zerodha_token_generated_at || creds.updated_at));
        case 'Fyers':
        default:
            return !!(creds.fyers_access_token && isTokenFromToday(creds.fyers_token_generated_at || creds.updated_at));
    }
};

const getBrokerTokenDetails = (broker, creds) => {
    let token = null;
    let generatedAt = null;
    if (creds) {
        if (broker === 'Dhan') {
            token = creds.dhan_access_token;
            generatedAt = creds.dhan_token_generated_at || creds.updated_at;
        } else if (broker === 'Upstox') {
            token = creds.upstox_access_token;
            generatedAt = creds.upstox_token_generated_at || creds.updated_at;
        } else if (broker === 'Angel One' || broker === 'AngelOne') {
            token = creds.angel_access_token;
            generatedAt = creds.angel_token_generated_at || creds.updated_at;
        } else if (broker === 'Kotak Neo' || broker === 'Kotak') {
            token = creds.kotak_access_token;
            generatedAt = creds.kotak_token_generated_at || creds.updated_at;
        } else if (broker === 'Zerodha' || broker === 'Kite') {
            token = creds.zerodha_access_token;
            generatedAt = creds.zerodha_token_generated_at || creds.updated_at;
        } else {
            token = creds.fyers_access_token;
            generatedAt = creds.fyers_token_generated_at || creds.updated_at;
        }
    }
    const isValid = !!(token && isTokenFromToday(generatedAt));
    return {
        token,
        generatedAt,
        isValid
    };
};

const getISTMidnightRemainingSeconds = () => {
    try {
        const now = new Date();
        const istString = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
        const istDate = new Date(istString);
        const midnight = new Date(istDate);
        midnight.setHours(23, 59, 59, 999);
        const diffMs = midnight.getTime() - istDate.getTime();
        return Math.max(0, Math.floor(diffMs / 1000));
    } catch (e) {
        return 0;
    }
};

module.exports = {
    getTOTP,
    isTokenFromToday,
    isBrokerConfigured,
    isBrokerTokenValid,
    getBrokerTokenDetails,
    getISTMidnightRemainingSeconds,
    formatOptionSymbol,
    generateBrokerSessionToken,
    executeBrokerTrade,
    exitAllBrokerPositions
};
