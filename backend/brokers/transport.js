const https = require('https');
const http = require('http');
const axios = require('axios');

/**
 * ULTRA-LOW LATENCY PERSISTENT TCP KEEP-ALIVE SOCKET POOL
 * 
 * Performance Engineering:
 * 1. keepAlive: true — Reuses pre-established TLS/TCP handshakes (saves 50-90ms roundtrip per trade).
 * 2. noDelay: true — Disables Nagle's algorithm; pushes small market execution packets to NIC instantly.
 * 3. maxSockets: 200 — Prevents socket queuing under high-frequency triggers.
 * 4. maxFreeSockets: 50 — Keeps warm idle sockets ready for instant dispatch.
 */
const fastHttpsAgent = new https.Agent({
    keepAlive: true,
    maxSockets: 200,
    maxFreeSockets: 50,
    timeout: 10000,
    keepAliveMsecs: 120000,
    noDelay: true
});

const fastHttpAgent = new http.Agent({
    keepAlive: true,
    maxSockets: 200,
    maxFreeSockets: 50,
    timeout: 10000,
    keepAliveMsecs: 120000,
    noDelay: true
});

/**
 * Creates an ultra-fast Axios client instance bound to the persistent socket pool
 * @param {string} baseURL - The broker's base REST API endpoint
 * @param {object} defaultHeaders - Pre-configured authorization and content headers
 * @returns {AxiosInstance}
 */
const createFastBrokerClient = (baseURL, defaultHeaders = {}) => {
    return axios.create({
        baseURL,
        httpsAgent: fastHttpsAgent,
        httpAgent: fastHttpAgent,
        timeout: 5000,
        headers: {
            'Connection': 'keep-alive',
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            ...defaultHeaders
        }
    });
};

module.exports = {
    fastHttpsAgent,
    fastHttpAgent,
    createFastBrokerClient
};
