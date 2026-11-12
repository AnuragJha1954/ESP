/**
 * Standardized Base Broker Adapter Contract
 * Unified execution interface for all equity, derivative, and crypto brokers.
 */

class BaseBrokerAdapter {
    constructor(brokerName, credentials = {}) {
        this.brokerName = brokerName;
        this.credentials = credentials;
        this.client = null;
        this.initClient();
    }

    /**
     * Initializes the underlying HTTP transport client
     */
    initClient() {
        throw new Error(`initClient() must be implemented by ${this.brokerName} adapter`);
    }

    /**
     * Executes a market or limit order (Supports Long and Short)
     * @param {Object} params
     * @param {string} params.symbol - Standardized symbol
     * @param {number} params.qty - Quantity / Lots
     * @param {number|string} params.side - 1 / 'BUY' (Long) or -1 / 'SELL' (Short)
     * @param {string} [params.orderType='MARKET'] - 'MARKET' | 'LIMIT' | 'SL' | 'SL-M'
     * @param {string} [params.productType='INTRADAY'] - 'INTRADAY' | 'MARGIN' | 'DELIVERY'
     * @param {number} [params.price=0] - Limit price
     * @param {number} [params.triggerPrice=0] - Trigger price
     * @param {string} [params.orderTag='TRADOPAD'] - Client order tag for audit tracking
     * @returns {Promise<{success: boolean, orderId: string, broker: string, status: string, latencyMs: number, message: string, raw: any}>}
     */
    async executeOrder(params) {
        throw new Error(`executeOrder() must be implemented by ${this.brokerName} adapter`);
    }

    /**
     * Exits a specific open position for a given symbol
     * @param {Object} params
     * @param {string} params.symbol
     * @param {string} [params.productType]
     * @returns {Promise<{success: boolean, message: string, raw: any}>}
     */
    async exitPosition(params) {
        throw new Error(`exitPosition() must be implemented by ${this.brokerName} adapter`);
    }

    /**
     * Exits all open intraday and derivative positions (Emergency Kill Switch)
     * @returns {Promise<{success: boolean, exitedCount: number, errors: Array}>}
     */
    async exitAllPositions() {
        throw new Error(`exitAllPositions() must be implemented by ${this.brokerName} adapter`);
    }

    /**
     * Retrieves currently open net positions
     * @returns {Promise<Array<{symbol: string, qty: number, buyAvg: number, sellAvg: number, pnl: number, productType: string}>>}
     */
    async getPositions() {
        throw new Error(`getPositions() must be implemented by ${this.brokerName} adapter`);
    }

    /**
     * Validates if current access token is active and authorized
     * @returns {Promise<boolean>}
     */
    async validateToken() {
        throw new Error(`validateToken() must be implemented by ${this.brokerName} adapter`);
    }

    /**
     * Generates or refreshes access token using credentials
     * @returns {Promise<{accessToken: string, expiresAt: Date|null, raw: any}>}
     */
    async generateToken() {
        throw new Error(`generateToken() must be implemented by ${this.brokerName} adapter`);
    }

    /**
     * Normalizes side parameter to uniform 'BUY' or 'SELL'
     * @param {number|string} side - 1, -1, 'BUY', 'SELL', 'LONG', 'SHORT'
     * @returns {'BUY'|'SELL'}
     */
    normalizeSide(side) {
        if (side === 1 || String(side).toUpperCase() === 'BUY' || String(side).toUpperCase() === 'LONG') {
            return 'BUY';
        }
        if (side === -1 || String(side).toUpperCase() === 'SELL' || String(side).toUpperCase() === 'SHORT') {
            return 'SELL';
        }
        return 'BUY';
    }
}

module.exports = BaseBrokerAdapter;
