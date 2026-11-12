const BaseBrokerAdapter = require('./baseBrokerAdapter');
const { createFastBrokerClient } = require('./transport');
const speakeasy = require('speakeasy');

/**
 * DhanHQ API v2 Adapter
 * Ultra-low latency execution engine for Dhan Trading Platform
 */
class DhanAdapter extends BaseBrokerAdapter {
    constructor(credentials = {}) {
        super('Dhan', credentials);
    }

    initClient() {
        const accessToken = this.credentials.access_token || this.credentials.dhan_access_token || '';
        const clientId = this.credentials.client_id || this.credentials.dhan_client_id || '';

        this.client = createFastBrokerClient('https://api.dhan.co', {
            'access-token': accessToken,
            'client-id': clientId
        });
    }

    /**
     * Executes Buy/Long or Sell/Short order on Dhan
     */
    async executeOrder(params) {
        const startTime = Date.now();
        const side = this.normalizeSide(params.side); // 'BUY' or 'SELL'
        const productType = (params.productType || 'MARGIN').toUpperCase() === 'INTRADAY' ? 'INTRADAY' : 'MARGIN';
        const orderType = (params.orderType || 'MARKET').toUpperCase();
        
        const cleanSymbol = String(params.symbol).replace(/^(NSE|NFO|BSE|BFO):/i, '').trim();
        const exchangeSegment = (cleanSymbol.includes('SENSEX') || cleanSymbol.includes('BANKEX')) ? 'BSE_FNO' : 'NSE_FNO';
        const clientId = this.credentials.client_id || this.credentials.dhan_client_id || '';

        const payload = {
            dhanClientId: clientId,
            correlationId: `TP-${Date.now()}`,
            transactionType: side,
            exchangeSegment: exchangeSegment,
            productType: productType,
            orderType: orderType,
            validity: 'DAY',
            tradingSymbol: cleanSymbol,
            securityId: String(params.securityId || '0'),
            quantity: Number(params.qty || params.quantity || 1),
            disclosedQuantity: 0,
            price: Number(params.price || 0),
            triggerPrice: Number(params.triggerPrice || 0),
            afterMarketOrder: false
        };

        try {
            const res = await this.client.post('/v2/orders', payload);
            const latencyMs = Date.now() - startTime;
            const orderId = res.data?.orderId || res.data?.data?.orderId || 'DHAN_ACK';

            return {
                success: true,
                orderId: String(orderId),
                broker: 'Dhan',
                status: 'SUBMITTED',
                latencyMs,
                message: `Dhan ${side} ${params.qty}x ${cleanSymbol} dispatched in ${latencyMs}ms`,
                raw: res.data
            };
        } catch (err) {
            const latencyMs = Date.now() - startTime;
            const errMsg = err.response?.data?.internalErrorMessage || err.response?.data?.errorMessage || err.message || 'Dhan order execution error';
            return {
                success: false,
                orderId: null,
                broker: 'Dhan',
                status: 'REJECTED',
                latencyMs,
                message: errMsg,
                raw: err.response?.data || err.message
            };
        }
    }

    /**
     * Exits specific position on Dhan
     */
    async exitPosition(params) {
        const positions = await this.getPositions();
        const cleanSymbol = String(params.symbol).replace(/^(NSE|NFO|BSE|BFO):/i, '').trim();
        const pos = positions.find(p => p.symbol === cleanSymbol);

        if (!pos || pos.qty === 0) {
            return { success: true, message: `No open Dhan position found for ${cleanSymbol}` };
        }

        const exitSide = pos.qty > 0 ? 'SELL' : 'BUY';
        return this.executeOrder({
            symbol: cleanSymbol,
            qty: Math.abs(pos.qty),
            side: exitSide,
            productType: pos.productType || 'MARGIN',
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
                    productType: pos.productType || 'MARGIN',
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
            const res = await this.client.get('/v2/positions');
            const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
            return data.map(p => ({
                symbol: p.tradingSymbol,
                qty: Number(p.netQty || 0),
                buyAvg: Number(p.buyAvg || 0),
                sellAvg: Number(p.sellAvg || 0),
                pnl: Number(p.realizedProfit || 0) + Number(p.unrealizedProfit || 0),
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
            const res = await this.client.get('/v2/fundlimit');
            return res.status === 200;
        } catch (e) {
            return false;
        }
    }

    /**
     * Generates or refreshes Dhan token via TOTP login flow
     */
    async generateToken(creds = this.credentials) {
        const clientId = creds.client_id || creds.dhan_client_id;
        const password = creds.password || creds.dhan_password;
        const totpSecret = creds.totp_secret || creds.dhan_totp_secret;

        if (creds.access_token && !password) {
            return {
                accessToken: creds.access_token,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                raw: { message: 'Using configured Dhan access token' }
            };
        }

        if (!clientId || !password || !totpSecret) {
            throw new Error('Dhan token generation requires client_id, password, and totp_secret');
        }

        // 1. Password Auth
        const loginRes = await this.client.post('/v2/auth/login', { clientId, password });
        if (loginRes.status !== 200) {
            throw new Error(`Dhan auth login failed: ${JSON.stringify(loginRes.data)}`);
        }

        // 2. TOTP Verification
        const totp = speakeasy.totp({ secret: totpSecret.replace(/\s+/g, ''), encoding: 'base32' });
        const totpRes = await this.client.post('/v2/auth/totp', { clientId, totp }, {
            headers: {
                'Authorization': `Bearer ${loginRes.data.token || loginRes.data.temporaryToken || ''}`
            }
        });

        if (totpRes.status !== 200 || !totpRes.data?.accessToken) {
            throw new Error(`Dhan TOTP validation failed: ${JSON.stringify(totpRes.data)}`);
        }

        const accessToken = totpRes.data.accessToken;
        this.credentials.access_token = accessToken;
        this.initClient();

        return {
            accessToken,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            raw: totpRes.data
        };
    }
}

module.exports = DhanAdapter;
