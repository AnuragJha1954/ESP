const BaseBrokerAdapter = require('./baseBrokerAdapter');
const { createFastBrokerClient } = require('./transport');
const speakeasy = require('speakeasy');

/**
 * Kotak Neo Trade API Adapter
 * Ultra-low latency execution for Kotak Securities Neo API
 */
class KotakAdapter extends BaseBrokerAdapter {
    constructor(credentials = {}) {
        super('Kotak Neo', credentials);
    }

    initClient() {
        const accessToken = this.credentials.access_token || this.credentials.kotak_access_token || '';
        const neoFinKey = this.credentials.neo_fin_key || this.credentials.kotak_neo_fin_key || 'neofinkeys';
        const sid = this.credentials.sid || this.credentials.kotak_sid || '';

        this.client = createFastBrokerClient('https://napi.kotak.com', {
            'Authorization': accessToken ? `Bearer ${accessToken}` : '',
            'Neo-Fin-Key': neoFinKey,
            'Sid': sid
        });
    }

    /**
     * Executes Buy/Long or Sell/Short order on Kotak Neo
     */
    async executeOrder(params) {
        const startTime = Date.now();
        const side = this.normalizeSide(params.side); // 'BUY' or 'SELL'
        const tt = side === 'BUY' ? 'B' : 'S';
        const pt = (params.productType || 'NRML').toUpperCase() === 'INTRADAY' ? 'MIS' : 'NRML';
        const cleanSymbol = String(params.symbol).replace(/^(NSE|NFO|BSE|BFO):/i, '').trim();
        const es = (cleanSymbol.includes('SENSEX') || cleanSymbol.includes('BANKEX')) ? 'bse_fo' : 'nse_fo';

        const payload = {
            am: 'NO',
            dq: '0',
            es: es,
            mp: '0',
            pc: params.price ? String(params.price) : '0',
            pf: 'N',
            pr: params.orderType === 'LIMIT' ? 'LMT' : 'MKT',
            pt: pt,
            qt: String(params.qty || params.quantity || 1),
            rt: 'DAY',
            tp: params.triggerPrice ? String(params.triggerPrice) : '0',
            ts: cleanSymbol,
            tt: tt
        };

        try {
            const res = await this.client.post('/Orders/2.0/quick/order/rule/ms/place', payload);
            const latencyMs = Date.now() - startTime;
            const orderId = res.data?.nOrdNo || res.data?.orderId || 'KOTAK_ACK';

            return {
                success: true,
                orderId: String(orderId),
                broker: 'Kotak Neo',
                status: 'SUBMITTED',
                latencyMs,
                message: `Kotak Neo ${side} ${params.qty}x ${cleanSymbol} dispatched in ${latencyMs}ms`,
                raw: res.data
            };
        } catch (err) {
            const latencyMs = Date.now() - startTime;
            const errMsg = err.response?.data?.message || err.response?.data?.errMsg || err.message || 'Kotak Neo order execution error';
            return {
                success: false,
                orderId: null,
                broker: 'Kotak Neo',
                status: 'REJECTED',
                latencyMs,
                message: errMsg,
                raw: err.response?.data || err.message
            };
        }
    }

    /**
     * Exits specific position on Kotak Neo
     */
    async exitPosition(params) {
        const positions = await this.getPositions();
        const cleanSymbol = String(params.symbol).replace(/^(NSE|NFO|BSE|BFO):/i, '').trim();
        const pos = positions.find(p => p.symbol === cleanSymbol);

        if (!pos || pos.qty === 0) {
            return { success: true, message: `No open Kotak Neo position found for ${cleanSymbol}` };
        }

        const exitSide = pos.qty > 0 ? 'SELL' : 'BUY';
        return this.executeOrder({
            symbol: cleanSymbol,
            qty: Math.abs(pos.qty),
            side: exitSide,
            productType: pos.productType || 'NRML',
            orderType: 'MARKET',
            orderTag: 'TP_EXIT'
        });
    }

    /**
     * Exits all open positions (Kill Switch)
     */
    async exitAllPositions() {
        const positions = await this.getPositions();
        const results = [];
        for (const pos of positions) {
            if (pos.qty !== 0) {
                const exitSide = pos.qty > 0 ? 'SELL' : 'BUY';
                const res = await this.executeOrder({
                    symbol: pos.symbol,
                    qty: Math.abs(pos.qty),
                    side: exitSide,
                    productType: pos.productType || 'NRML',
                    orderType: 'MARKET',
                    orderTag: 'TP_KILL_SWITCH'
                });
                results.push(res);
            }
        }
        return {
            success: true,
            exitedCount: results.length,
            details: results
        };
    }

    /**
     * Retrieves currently active net positions
     */
    async getPositions() {
        try {
            const res = await this.client.get('/Orders/2.0/quick/user/positions');
            const data = res.data?.data || [];
            return data.map(p => ({
                symbol: p.ts || p.tradingSymbol,
                qty: Number(p.flBuyQty || 0) - Number(p.flSellQty || 0),
                buyAvg: Number(p.buyAvgPr || 0),
                sellAvg: Number(p.sellAvgPr || 0),
                pnl: Number(p.urMtM || 0),
                productType: p.prod || 'NRML'
            }));
        } catch (e) {
            return [];
        }
    }

    /**
     * Validates if current session is alive
     */
    async validateToken() {
        try {
            const res = await this.client.get('/Orders/2.0/quick/user/positions');
            return res.status === 200 && Array.isArray(res.data?.data);
        } catch (e) {
            return false;
        }
    }

    /**
     * Generates or refreshes Kotak Neo token using Consumer Secret and TOTP
     */
    async generateToken(creds = this.credentials) {
        const consumerKey = creds.consumer_key || creds.kotak_consumer_key;
        const consumerSecret = creds.consumer_secret || creds.kotak_consumer_secret;
        const mobile = creds.mobile || creds.kotak_mobile;
        const mpin = creds.mpin || creds.kotak_mpin || creds.pin;
        const totpSecret = creds.totp_secret || creds.kotak_totp_secret;

        if (creds.access_token && !consumerKey) {
            return {
                accessToken: creds.access_token,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                raw: { message: 'Using pre-configured Kotak Neo token' }
            };
        }

        if (!consumerKey || !consumerSecret || !mobile || !mpin) {
            throw new Error('Kotak Neo token generation requires consumer_key, consumer_secret, mobile, and mpin');
        }

        // Step 1: OAuth Token
        const basicAuth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
        const oauthRes = await this.client.post('/oauth/token', 'grant_type=client_credentials', {
            headers: {
                'Authorization': `Basic ${basicAuth}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const bearerToken = oauthRes.data?.access_token;
        if (!bearerToken) {
            throw new Error('Failed to obtain Kotak Neo OAuth Bearer Token');
        }

        // Step 2: Validate Credentials / MPIN
        const loginPayload = {
            mobileNumber: mobile,
            password: mpin
        };
        const loginRes = await this.client.post('/login/1.0/login/v2/validate', loginPayload, {
            headers: { 'Authorization': `Bearer ${bearerToken}` }
        });

        const viewToken = loginRes.data?.data?.token;
        const sid = loginRes.data?.data?.sid;

        // Step 3: Validate TOTP
        const totp = totpSecret ? speakeasy.totp({ secret: totpSecret.replace(/\s+/g, ''), encoding: 'base32' }) : '';
        const totpPayload = {
            userId: mobile,
            otp: totp
        };
        const totpRes = await this.client.post('/login/1.0/login/v2/validate/totp', totpPayload, {
            headers: {
                'Authorization': `Bearer ${bearerToken}`,
                'Auth': viewToken,
                'Sid': sid
            }
        });

        const finalSessionToken = totpRes.data?.data?.token || bearerToken;
        this.credentials.access_token = finalSessionToken;
        this.credentials.sid = sid;
        this.initClient();

        return {
            accessToken: finalSessionToken,
            sid,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            raw: totpRes.data
        };
    }
}

module.exports = KotakAdapter;
