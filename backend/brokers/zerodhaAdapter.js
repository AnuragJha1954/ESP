const BaseBrokerAdapter = require('./baseBrokerAdapter');
const { createFastBrokerClient } = require('./transport');
const crypto = require('crypto');

/**
 * Zerodha Kite Connect API v3 Adapter
 * Ultra-low latency order execution engine for Zerodha Securities
 */
class ZerodhaAdapter extends BaseBrokerAdapter {
    constructor(credentials = {}) {
        super('Zerodha', credentials);
    }

    initClient() {
        const apiKey = this.credentials.api_key || this.credentials.zerodha_api_key || '';
        const accessToken = this.credentials.access_token || this.credentials.zerodha_access_token || '';

        this.client = createFastBrokerClient('https://api.kite.trade', {
            'X-Kite-Version': '3',
            'Authorization': (apiKey && accessToken) ? `token ${apiKey}:${accessToken}` : ''
        });
    }

    /**
     * Executes Buy/Long or Sell/Short order on Zerodha
     */
    async executeOrder(params) {
        const startTime = Date.now();
        const side = this.normalizeSide(params.side); // 'BUY' or 'SELL'
        const product = (params.productType || 'NRML').toUpperCase() === 'INTRADAY' ? 'MIS' : 'NRML';
        const orderType = (params.orderType || 'MARKET').toUpperCase();
        
        // Strip exchange prefix if present e.g. 'NFO:NIFTY...' -> 'NIFTY...'
        const cleanSymbol = String(params.symbol).replace(/^(NSE|NFO|BSE|BFO):/i, '').trim();
        const exchange = (params.exchange || (cleanSymbol.includes('SENSEX') || cleanSymbol.includes('BANKEX') ? 'BFO' : 'NFO')).toUpperCase();

        const formParams = new URLSearchParams();
        formParams.append('tradingsymbol', cleanSymbol);
        formParams.append('exchange', exchange);
        formParams.append('transaction_type', side);
        formParams.append('order_type', orderType);
        formParams.append('quantity', String(params.qty || params.quantity || 1));
        formParams.append('product', product);
        formParams.append('validity', 'DAY');
        if (params.price && Number(params.price) > 0) {
            formParams.append('price', String(params.price));
        }
        if (params.triggerPrice && Number(params.triggerPrice) > 0) {
            formParams.append('trigger_price', String(params.triggerPrice));
        }
        formParams.append('tag', params.orderTag || 'TRADOPAD');

        try {
            const res = await this.client.post('/orders/regular', formParams.toString(), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            const latencyMs = Date.now() - startTime;
            const orderId = res.data?.data?.order_id || 'KITE_ACK';

            return {
                success: true,
                orderId: String(orderId),
                broker: 'Zerodha',
                status: 'SUBMITTED',
                latencyMs,
                message: `Zerodha ${side} ${params.qty}x ${cleanSymbol} dispatched in ${latencyMs}ms`,
                raw: res.data
            };
        } catch (err) {
            const latencyMs = Date.now() - startTime;
            const errMsg = err.response?.data?.message || err.message || 'Zerodha order execution error';
            return {
                success: false,
                orderId: null,
                broker: 'Zerodha',
                status: 'REJECTED',
                latencyMs,
                message: errMsg,
                raw: err.response?.data || err.message
            };
        }
    }

    /**
     * Exits specific position on Zerodha
     */
    async exitPosition(params) {
        const positions = await this.getPositions();
        const cleanSymbol = String(params.symbol).replace(/^(NSE|NFO|BSE|BFO):/i, '').trim();
        const pos = positions.find(p => p.symbol === cleanSymbol);

        if (!pos || pos.qty === 0) {
            return { success: true, message: `No open Zerodha position found for ${cleanSymbol}` };
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
            const res = await this.client.get('/portfolio/positions');
            const net = res.data?.data?.net || [];
            return net.map(p => ({
                symbol: p.tradingsymbol,
                qty: p.quantity,
                buyAvg: p.buy_price,
                sellAvg: p.sell_price,
                pnl: p.pnl,
                productType: p.product
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
            const res = await this.client.get('/user/profile');
            return !!(res.status === 200 && res.data?.data?.user_id);
        } catch (e) {
            return false;
        }
    }

    /**
     * Generates session token from request_token
     */
    async generateToken(creds = this.credentials) {
        const apiKey = creds.api_key || creds.zerodha_api_key;
        const apiSecret = creds.api_secret || creds.zerodha_api_secret;
        const requestToken = creds.request_token || creds.zerodha_request_token;

        if (!apiKey || !apiSecret || !requestToken) {
            throw new Error('Zerodha token generation requires api_key, api_secret, and request_token');
        }

        const checksum = crypto.createHash('sha256').update(`${apiKey}${requestToken}${apiSecret}`).digest('hex');

        const params = new URLSearchParams();
        params.append('api_key', apiKey);
        params.append('request_token', requestToken);
        params.append('checksum', checksum);

        const res = await this.client.post('/session/token', params.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        if (res.data?.data?.access_token) {
            const accessToken = res.data.data.access_token;
            this.credentials.access_token = accessToken;
            this.initClient();
            return {
                accessToken,
                refreshToken: res.data.data.refresh_token || null,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                raw: res.data
            };
        }

        throw new Error(`Zerodha session token failed: ${JSON.stringify(res.data)}`);
    }
}

module.exports = ZerodhaAdapter;
