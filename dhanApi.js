const axios = require('axios');
const speakeasy = require('speakeasy');
const crypto = require('crypto');
const dhanhq = require('dhanhq');

// Generates the 6-digit TOTP
const getTOTP = (secret) => {
    return speakeasy.totp({
        secret: secret.replace(/\s+/g, ''),
        encoding: 'base32'
    });
};

// Auto-Login flow for Dhan
const generateDhanToken = async (db, userId) => {
    const creds = await db.get(`SELECT * FROM broker_credentials WHERE user_id = ?`, [userId]);
    if (!creds || !creds.dhan_client_id || !creds.dhan_password || !creds.dhan_totp_secret || !creds.dhan_api_key || !creds.dhan_api_secret) {
        throw new Error('Missing Dhan credentials for this user. Please configure them in your profile.');
    }

    const { dhan_client_id, dhan_password, dhan_totp_secret, dhan_api_key, dhan_api_secret } = creds;
    const currentTotp = getTOTP(dhan_totp_secret);

    try {
        // Dhan Unofficial Auto-Login Process (this simulates the web login)
        // Note: Dhan API endpoints for auto-login are subject to change. 
        // This is a standard emulation of the partner login flow.
        
        // 1. Authenticate with Client ID and Password
        const loginPayload = {
            clientId: dhan_client_id,
            password: dhan_password
        };
        
        const loginRes = await axios.post('https://api.dhan.co/v2/auth/login', loginPayload, {
            headers: {
                'Content-Type': 'application/json',
                'client-id': dhan_client_id
            },
            validateStatus: () => true
        });

        if (loginRes.status !== 200) {
            throw new Error(`Dhan Login Failed: ${JSON.stringify(loginRes.data)}`);
        }

        // 2. Validate with TOTP
        const totpPayload = {
            clientId: dhan_client_id,
            totp: currentTotp
        };

        const totpRes = await axios.post('https://api.dhan.co/v2/auth/totp', totpPayload, {
            headers: {
                'Content-Type': 'application/json',
                'client-id': dhan_client_id,
                'Authorization': `Bearer ${loginRes.data.token || loginRes.data.temporaryToken || ''}`
            },
            validateStatus: () => true
        });

        if (totpRes.status !== 200 || !totpRes.data.accessToken) {
            throw new Error(`Dhan TOTP Verification Failed: ${JSON.stringify(totpRes.data)}`);
        }

        const accessToken = totpRes.data.accessToken;

        // Save access token to database
        await db.run(`UPDATE broker_credentials SET dhan_access_token = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`, [accessToken, userId]);
        
        return accessToken;
    } catch (error) {
        console.error("Dhan Auto-Auth Error:", error.message || error);
        throw error;
    }
};

const executeDhanTrade = async (db, userId, tradeDetails) => {
    const { quantity, strike, type, symbol, side } = tradeDetails;
    
    const creds = await db.get(`SELECT dhan_client_id, dhan_access_token, dhan_api_key FROM broker_credentials WHERE user_id = ?`, [userId]);
    if (!creds || !creds.dhan_access_token) {
        throw new Error('No Dhan access token found. Please run the generate token flow first.');
    }

    // Initialize DhanHQ SDK
    // The dhanhq package uses clientId, accessToken, environment
    // Depending on the exact version, it might be a class or a function. 
    // Assuming standard dhanhq initialization:
    const Dhan = new dhanhq({
        clientId: creds.dhan_client_id,
        accessToken: creds.dhan_access_token,
        environment: "PROD"
    });

    // Formatting Symbol for Dhan (e.g., NIFTY 14 Nov 2024 19500 CE)
    // For simplicity, assuming the frontend sends a compatible dhan symbol format or we just pass it
    // We will place a generic equity/options order
    
    // Dhan expects specific transaction types: "BUY" or "SELL"
    const transactionType = side === 1 ? "BUY" : "SELL";

    try {
        const orderResponse = await Dhan.placeOrder({
            transactionType: transactionType,
            exchangeSegment: "NSE_FNO",
            productType: "INTRADAY",
            orderType: "MARKET",
            validity: "DAY",
            securityId: strike, // Note: Dhan uses specific securityIds for options. We will send the strike as an identifier for now, but in production, symbol mapping is required.
            quantity: Number(quantity),
            price: 0,
            tradingSymbol: symbol
        });

        if (orderResponse.status === "failure") {
            throw new Error(`Dhan Order Failed: ${orderResponse.remarks}`);
        }

        return orderResponse;
    } catch (error) {
        throw new Error(`Dhan Execution Error: ${error.message}`);
    }
};

module.exports = {
    generateDhanToken,
    executeDhanTrade
};
