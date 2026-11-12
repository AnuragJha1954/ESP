const BaseBrokerAdapter = require('./baseBrokerAdapter');
const { createFastBrokerClient } = require('./transport');
const crypto = require('crypto');

/**
 * Delta Exchange REST API v2 Adapter
 * Ultra-low latency crypto derivatives execution (BTC / ETH / SOL Futures & Options)
 */
class DeltaAdapter extends BaseBrokerAdapter {
    constructor(credentials = {}) {
        super('Delta Exchange', credentials);
    }

    initClient() {
        const isTestnet = this.credentials.is_testnet || this.credentials.delta_testnet || false;
        const baseURL = isTestnet ? 'https://testnet-api.delta.exchange' : 'https://api.delta.exchange';

        this.client = createFastBrokerClient(baseURL);
    }

    /**
     * Signs outgoing request with Delta Exchange HMAC-SHA256 signature
     */
    generateAuthHeaders(method, path, body = '') {
        const apiKey = this.credentials.api_key || this.credentials.delta_api_key || '';
        const apiSecret = this.credentials.api_secret || this.credentials.delta_api_secret || '';

        const timestamp = Math.floor(Date.now() / 1000).toString();
        const bodyStr = typeof body === 'object' ? JSON.stringify(body) : (body || '');
        const payloadToSign = `${method.toUpperCase()}${timestamp}${path}${bodyStr}`;

        const signature = crypto
            .createHmac('sha256', apiSecret)
            .update(payloadToSign)
            .digest('hex');

        return {
            'api-key': apiKey,
            'signature': signature,
            'timestamp': timestamp,
            'Content-Type': 'application/json'
        };
    }

    /**
     * Executes Buy/Long or Sell/Short order on Delta Exchange
     */
    async executeOrder(params) {
        const startTime = Date.now();
        const sideStr = this.normalizeSide(params.side) === 'BUY' ? 'buy' : 'sell';
        const orderType = (params.orderType || 'MARKET').toUpperCase() === 'LIMIT' ? 'limit_order' : 'market_order';
        
        let productSymbol = String(params.symbol || 'BTCUSD').toUpperCase().trim();
        // Normalize crypto symbols
        if (productSymbol === 'BTC' || productSymbol === 'BITCOIN') productSymbol = 'BTCUSD';
        if (productSymbol === 'ETH' || productSymbol === 'ETHEREUM') productSymbol = 'ETHUSD';
        if (productSymbol === 'SOL' || productSymbol === 'SOLANA') productSymbol = 'SOLUSD';

        const payload = {
            product_symbol: productSymbol,
            size: Number(params.qty || params.quantity || 1),
            side: sideStr, // 'buy' or 'sell'
            order_type: orderType,
            time_in_force: 'ioc' // Immediate or cancel for ultra-fast fills
        };

        if (orderType === 'limit_order' && params.price) {
            payload.limit_price = String(params.price);
        }

        const path = '/v2/orders';
        const headers = this.generateAuthHeaders('POST', path, payload);

        try {
            const res = await this.client.post(path, payload, { headers });
            const latencyMs = Date.now() - startTime;
            const orderId = res.data?.result?.id || 'DELTA_ACK';

            return {
                success: true,
                orderId: String(orderId),
                broker: 'Delta Exchange',
                status: 'SUBMITTED',
                latencyMs,
                message: `Delta ${sideStr.toUpperCase()} ${params.qty}x ${productSymbol} dispatched in ${latencyMs}ms`,
                raw: res.data
            };
        } catch (err) {
            const latencyMs = Date.now() - startTime;
            const errMsg = err.response?.data?.error?.message || err.message || 'Delta Exchange order error';
            return {
                success: false,
                orderId: null,
                broker: 'Delta Exchange',
                status: 'REJECTED',
                latencyMs,
                message: errMsg,
                raw: err.response?.data || err.message
            };
        }
    }

    /**
     * Exits specific crypto position on Delta Exchange
     */
    async exitPosition(params) {
        const positions = await this.getPositions();
        const symbol = String(params.symbol || '').toUpperCase().trim();
        const pos = positions.find(p => p.symbol === symbol);

        if (!pos || pos.qty === 0) {
            return { success: true, message: `No open Delta position found for ${symbol}` };
        }

        const exitSide = pos.qty > 0 ? 'SELL' : 'BUY';
        return this.executeOrder({
            symbol: pos.symbol,
            qty: Math.abs(pos.qty),
            side: exitSide,
            orderType: 'MARKET',
            orderTag: 'TP_EXIT'
        });
    }

    /**
     * Exits all open crypto positions (Kill Switch)
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
     * Retrieves currently open margined positions
     */
    async getPositions() {
        const path = '/v2/positions/margined';
        const headers = this.generateAuthHeaders('GET', path);

        try {
            const res = await this.client.get(path, { headers });
            const result = res.data?.result || [];
            return result.map(p => ({
                symbol: p.product_symbol,
                qty: Number(p.size || 0),
                buyAvg: Number(p.entry_price || 0),
                sellAvg: 0,
                pnl: Number(p.realized_pnl || 0) + Number(p.unrealized_pnl || 0),
                productType: 'PERPETUAL'
            }));
        } catch (e) {
            return [];
        }
    }

    /**
     * Validates if API key is operational
     */
    async validateToken() {
        const path = '/v2/wallet/balances';
        const headers = this.generateAuthHeaders('GET', path);
        try {
            const res = await this.client.get(path, { headers });
            return res.status === 200 && res.data?.success === true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Delta uses permanent API Key & Secret (No daily renewal required)
     */
    async generateToken(creds = this.credentials) {
        const isValid = await this.validateToken();
        if (!isValid) {
            throw new Error('Delta Exchange API credentials verification failed. Check API Key & Secret.');
        }
        return {
            accessToken: creds.api_key || creds.delta_api_key,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Valid for 1 year
            raw: { message: 'Delta Exchange API Key validated successfully' }
        };
    }
}

module.exports = DeltaAdapter;
