const BaseBrokerAdapter = require('./baseBrokerAdapter');
const { createFastBrokerClient } = require('./transport');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const axios = require('axios');

/**
 * Fyers API v3 Adapter
 * Ultra-low latency execution engine for Fyers Securities
 */
class FyersAdapter extends BaseBrokerAdapter {
    constructor(credentials = {}) {
        super('Fyers', credentials);
    }

    initClient() {
        const appId = this.credentials.app_id || this.credentials.fyers_app_id || '';
        const accessToken = this.credentials.access_token || this.credentials.fyers_access_token || '';

        this.client = createFastBrokerClient('https://api-t1.fyers.in/api/v3', {
            'Authorization': (appId && accessToken) ? `${appId}:${accessToken}` : ''
        });
    }

    /**
     * Executes Buy/Long or Sell/Short order on Fyers
     */
    async executeOrder(params) {
        const startTime = Date.now();
        const sideInt = (params.side === 1 || String(params.side).toUpperCase() === 'BUY' || String(params.side).toUpperCase() === 'LONG') ? 1 : -1;
        const sideLabel = sideInt === 1 ? 'BUY' : 'SELL';
        const productType = (params.productType || 'MARGIN').toUpperCase() === 'INTRADAY' ? 'INTRADAY' : 'MARGIN';
        const orderType = (params.orderType || 'MARKET').toUpperCase() === 'LIMIT' ? 1 : 2;

        let symbol = String(params.symbol).trim();
        if (!symbol.startsWith('NSE:') && !symbol.startsWith('BSE:') && !symbol.startsWith('MCX:')) {
            const prefix = (symbol.includes('SENSEX') || symbol.includes('BANKEX')) ? 'BSE:' : 'NSE:';
            symbol = `${prefix}${symbol}`;
        }

        const payload = {
            symbol: symbol,
            qty: Number(params.qty || params.quantity || 1),
            type: orderType, // 2: Market, 1: Limit
            side: sideInt,   // 1: Buy, -1: Sell
            productType: productType,
            limitPrice: Number(params.price || 0),
            stopPrice: Number(params.triggerPrice || 0),
            validity: 'DAY',
            disclosedQty: 0,
            offlineOrder: false,
            orderTag: params.orderTag || 'TRADOPAD'
        };

        try {
            const res = await this.client.post('/orders/sync', payload);
            const latencyMs = Date.now() - startTime;
            const orderId = res.data?.id || res.data?.data?.id || 'FYERS_ACK';

            if (res.data?.s === 'ok' || res.data?.code === 1101 || res.data?.id) {
                return {
                    success: true,
                    orderId: String(orderId),
                    broker: 'Fyers',
                    status: 'SUBMITTED',
                    latencyMs,
                    message: `Fyers ${sideLabel} ${params.qty}x ${symbol} dispatched in ${latencyMs}ms`,
                    raw: res.data
                };
            }

            return {
                success: false,
                orderId: null,
                broker: 'Fyers',
                status: 'REJECTED',
                latencyMs,
                message: res.data?.message || 'Fyers order placement rejected',
                raw: res.data
            };
        } catch (err) {
            const latencyMs = Date.now() - startTime;
            const errMsg = err.response?.data?.message || err.message || 'Fyers order execution error';
            return {
                success: false,
                orderId: null,
                broker: 'Fyers',
                status: 'REJECTED',
                latencyMs,
                message: errMsg,
                raw: err.response?.data || err.message
            };
        }
    }

    /**
     * Exits specific position on Fyers
     */
    async exitPosition(params) {
        const cleanSymbol = String(params.symbol).replace(/^(NSE|BSE):/i, '').trim();
        try {
            const payload = {
                id: `${cleanSymbol}-${params.productType || 'MARGIN'}`
            };
            const res = await this.client.delete('/positions', { data: payload });
            return {
                success: res.data?.s === 'ok',
                message: res.data?.message || `Position exited for ${cleanSymbol}`,
                raw: res.data
            };
        } catch (e) {
            return { success: false, message: e.message };
        }
    }

    /**
     * Exits all open positions (Kill Switch)
     */
    async exitAllPositions() {
        try {
            const res = await this.client.delete('/positions', { data: { exit_all: 1 } });
            return {
                success: res.data?.s === 'ok',
                exitedCount: res.data?.s === 'ok' ? 1 : 0,
                raw: res.data
            };
        } catch (e) {
            return { success: false, exitedCount: 0, error: e.message };
        }
    }

    /**
     * Retrieves currently active net positions
     */
    async getPositions() {
        try {
            const res = await this.client.get('/positions');
            const net = res.data?.netPositions || [];
            return net.map(p => ({
                symbol: p.symbol,
                qty: Number(p.netQty || 0),
                buyAvg: Number(p.buyAvg || 0),
                sellAvg: Number(p.sellAvg || 0),
                pnl: Number(p.pl || 0),
                productType: p.productType
            }));
        } catch (e) {
            return [];
        }
    }

    /**
     * Validates if current token is operational
     */
    async validateToken() {
        try {
            const res = await this.client.get('/profile');
            return res.status === 200 && res.data?.s === 'ok';
        } catch (e) {
            return false;
        }
    }

    /**
     * Headless auto-renewal flow for Fyers v3 token using TOTP + PIN
     */
    async generateToken(creds = this.credentials) {
        const fyId = (creds.fyers_id || creds.client_id || '').trim();
        const appId = (creds.fyers_app_id || creds.app_id || '').trim();
        const secretKey = (creds.fyers_secret_key || creds.api_secret || '').trim();
        const totpSecret = (creds.fyers_totp_secret || creds.totp_secret || '').trim();
        const pin = (creds.fyers_pin || creds.pin || '').trim();

        if (!fyId || !appId || !secretKey || !totpSecret || !pin) {
            throw new Error('Fyers token generation requires fyers_id, app_id, secret_key, totp_secret, and pin');
        }

        const redirectUri = "https://trade.fyers.in/api-login/redirect-uri/index.html";
        const appIdHash = crypto.createHash('sha256').update(`${appId}:${secretKey}`).digest('hex');

        // Step 1: Send Login OTP
        const payload1 = { fy_id: Buffer.from(fyId).toString('base64'), app_id: "2" };
        const sendOtpResponse = await axios.post('https://api-t2.fyers.in/vagator/v2/send_login_otp_v2', payload1, { timeout: 10000 });
        if (sendOtpResponse.data.code !== 200 && sendOtpResponse.data.code !== 1043 && sendOtpResponse.data.s !== 'ok') {
            throw new Error(`Failed to send Fyers OTP: ${JSON.stringify(sendOtpResponse.data)}`);
        }
        const requestKey = sendOtpResponse.data.request_key;

        // Step 2: Verify TOTP
        const totp = speakeasy.totp({ secret: totpSecret.replace(/\s+/g, ''), encoding: 'base32' });
        const payload2 = { request_key: requestKey, otp: totp };
        const verifyOtpResponse = await axios.post('https://api-t2.fyers.in/vagator/v2/verify_otp', payload2, { timeout: 10000 });
        if (verifyOtpResponse.data.code !== 200 && verifyOtpResponse.data.s !== 'ok') {
            throw new Error(`Failed to verify Fyers TOTP: ${JSON.stringify(verifyOtpResponse.data)}`);
        }
        const requestKey2 = verifyOtpResponse.data.request_key;

        // Step 3: Verify PIN
        const payload3 = { request_key: requestKey2, identity_type: "pin", identifier: Buffer.from(pin).toString('base64') };
        const verifyPinResponse = await axios.post('https://api-t2.fyers.in/vagator/v2/verify_pin_v2', payload3, { timeout: 10000 });
        if (verifyPinResponse.data.code !== 200 && verifyPinResponse.data.s !== 'ok') {
            throw new Error(`Failed to verify Fyers PIN: ${JSON.stringify(verifyPinResponse.data)}`);
        }
        const accessTokenVagator = verifyPinResponse.data.data.access_token;

        // Step 4: Obtain Auth Code
        const payload4 = {
            fyers_id: fyId,
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
        const authCodeResponse = await axios.post('https://api-t1.fyers.in/api/v3/token', payload4, {
            headers: { 'Authorization': `Bearer ${accessTokenVagator}` },
            validateStatus: (status) => status >= 200 && status < 400,
            timeout: 10000
        });

        if (authCodeResponse.data.s !== 'ok') {
            throw new Error(`Failed to get Fyers auth code: ${JSON.stringify(authCodeResponse.data)}`);
        }

        const urlParams = new URLSearchParams(authCodeResponse.data.Url.split('?')[1]);
        const authCode = urlParams.get('auth_code');

        // Step 5: Validate Auth Code & Exchange for Access Token
        const payload5 = { grant_type: "authorization_code", appIdHash: appIdHash, code: authCode };
        const tokenReq = await axios.post('https://api-t1.fyers.in/api/v3/validate-authcode', payload5, { timeout: 10000 });
        const tokenResponse = tokenReq.data;

        if (tokenResponse.s === 'ok' || tokenResponse.access_token) {
            const token = tokenResponse.access_token;
            this.credentials.access_token = token;
            this.initClient();
            return {
                accessToken: token,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                raw: tokenResponse
            };
        }

        throw new Error(`Failed to generate final Fyers access token: ${JSON.stringify(tokenResponse)}`);
    }
}

module.exports = FyersAdapter;
