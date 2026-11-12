const BaseBrokerAdapter = require('./baseBrokerAdapter');
const { createFastBrokerClient } = require('./transport');

/**
 * Groww Trading Open API Adapter
 * Ultra-low latency order execution engine for Groww Trading Platform
 */
class GrowwAdapter extends BaseBrokerAdapter {
    constructor(credentials = {}) {
        super('Groww', credentials);
    }

    initClient() {
        const apiKey = this.credentials.api_key || this.credentials.groww_api_key || '';
        const accessToken = this.credentials.access_token || this.credentials.groww_access_token || '';

        this.client = createFastBrokerClient('https://api.groww.in/v1', {
            'Authorization': accessToken ? `Bearer ${accessToken}` : '',
            'X-GROWW-API-KEY': apiKey
        });
    }

    /**
     * Executes Buy/Long or Sell/Short order on Groww
     */
    async executeOrder(params) {
        const startTime = Date.now();
        const side = this.normalizeSide(params.side); // 'BUY' or 'SELL'
        const productType = (params.productType || 'INTRADAY').toUpperCase() === 'MARGIN' ? 'CARRYFORWARD' : 'INTRADAY';
        const orderType = (params.orderType || 'MARKET').toUpperCase();
        
        const cleanSymbol = String(params.symbol).replace(/^(NSE|NFO|BSE|BFO):/i, '').trim();
        const exchange = (cleanSymbol.includes('SENSEX') || cleanSymbol.includes('BANKEX')) ? 'BSE_FO' : 'NSE_FO';

        const payload = {
            tradingSymbol: cleanSymbol,
            exchange: exchange,
            transactionType: side,
            orderType: orderType,
            productType: productType,
            quantity: Number(params.qty || params.quantity || 1),
            price: Number(params.price || 0),
            triggerPrice: Number(params.triggerPrice || 0),
            validity: 'DAY',
            tag: params.orderTag || 'TRADOPAD'
        };

        try {
            const res = await this.client.post('/order/create', payload);
            const latencyMs = Date.now() - startTime;
            const orderId = res.data?.orderId || res.data?.data?.orderId || 'GROWW_ACK';

            return {
                success: true,
                orderId: String(orderId),
                broker: 'Groww',
                status: 'SUBMITTED',
                latencyMs,
                message: `Groww ${side} ${params.qty}x ${cleanSymbol} dispatched in ${latencyMs}ms`,
                raw: res.data
            };
        } catch (err) {
            const latencyMs = Date.now() - startTime;
            const errMsg = err.response?.data?.message || err.response?.data?.error || err.message || 'Groww order execution error';
            return {
                success: false,
                orderId: null,
                broker: 'Groww',
                status: 'REJECTED',
                latencyMs,
                message: errMsg,
                raw: err.response?.data || err.message
            };
        }
    }

    /**
     * Exits specific position on Groww
     */
    async exitPosition(params) {
        const positions = await this.getPositions();
        const cleanSymbol = String(params.symbol).replace(/^(NSE|NFO|BSE|BFO):/i, '').trim();
        const pos = positions.find(p => p.symbol === cleanSymbol);

        if (!pos || pos.qty === 0) {
            return { success: true, message: `No open Groww position found for ${cleanSymbol}` };
        }

        const exitSide = pos.qty > 0 ? 'SELL' : 'BUY';
        return this.executeOrder({
            symbol: cleanSymbol,
            qty: Math.abs(pos.qty),
            side: exitSide,
            productType: pos.productType || 'INTRADAY',
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
                    productType: pos.productType || 'INTRADAY',
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
            const res = await this.client.get('/positions');
            const data = res.data?.positions || res.data?.data || [];
            return data.map(p => ({
                symbol: p.tradingSymbol || p.symbol,
                qty: Number(p.netQuantity || p.quantity || 0),
                buyAvg: Number(p.buyAvgPrice || 0),
                sellAvg: Number(p.sellAvgPrice || 0),
                pnl: Number(p.pnl || 0),
                productType: p.productType || 'INTRADAY'
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
            const res = await this.client.get('/positions');
            return res.status === 200;
        } catch (e) {
            return false;
        }
    }

    /**
     * Generates or refreshes Groww token
     */
    async generateToken(creds = this.credentials) {
        const apiKey = creds.api_key || creds.groww_api_key;
        const apiSecret = creds.api_secret || creds.groww_api_secret;
        const refreshToken = creds.refresh_token || creds.groww_refresh_token;

        if (creds.access_token && !refreshToken) {
            return {
                accessToken: creds.access_token,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                raw: { message: 'Using pre-configured Groww access token' }
            };
        }

        if (refreshToken) {
            const res = await this.client.post('/auth/token/refresh', {
                refreshToken,
                apiKey
            });
            const token = res.data?.accessToken || res.data?.data?.accessToken;
            if (token) {
                this.credentials.access_token = token;
                this.initClient();
                return {
                    accessToken: token,
                    refreshToken: res.data?.refreshToken || refreshToken,
                    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                    raw: res.data
                };
            }
        }

        throw new Error('Groww token generation requires valid API Key and Refresh Token');
    }
}

module.exports = GrowwAdapter;
